export type SoundName =
  | "move"
  | "rotate"
  | "hardDrop"
  | "lock"
  | "hold"
  | "clear1"
  | "clear2"
  | "clear3"
  | "clear4"
  | "tSpin"
  | "allClear"
  | "levelUp"
  | "gameOver"
  | "ready"
  | "go"
  | "pause"
  | "resume"
  | "ui";

interface ToneOptions {
  freq: number;
  to?: number;
  type?: OscillatorType;
  at?: number;
  duration: number;
  gain: number;
  attack?: number;
  filter?: number;
}

interface NoiseOptions {
  at?: number;
  duration: number;
  gain: number;
  filter: BiquadFilterType;
  freq: number;
  q?: number;
}

const MASTER_VOLUME = 0.55;

/** Minimum gap between repeats of the same sound, so auto-repeat stays soft. */
const THROTTLE_MS: Partial<Record<SoundName, number>> = { move: 28, rotate: 24 };

/**
 * Small synthesizer for UI feedback. Everything is generated on the fly with
 * oscillators and filtered noise, so there are no audio files to load.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private enabled = true;
  private readonly lastPlayed = new Map<SoundName, number>();

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.ctx && this.bus) {
      this.bus.gain.setTargetAtTime(enabled ? MASTER_VOLUME : 0, this.ctx.currentTime, 0.015);
    }
  }

  /** Browsers only allow audio after a user gesture; call this from one. */
  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor({ latencyHint: "interactive" });
      } catch {
        return;
      }
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 4;
      compressor.connect(this.ctx.destination);
      this.bus = this.ctx.createGain();
      this.bus.gain.value = this.enabled ? MASTER_VOLUME : 0;
      this.bus.connect(compressor);
      this.noise = this.createNoise(this.ctx);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
  }

  play(name: SoundName): void {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || ctx.state !== "running") return;
    const now = performance.now();
    const gap = THROTTLE_MS[name];
    if (gap && now - (this.lastPlayed.get(name) ?? -Infinity) < gap) return;
    this.lastPlayed.set(name, now);

    switch (name) {
      case "move":
        this.tone({ freq: 420, to: 380, type: "triangle", duration: 0.035, gain: 0.05 });
        break;
      case "rotate":
        this.tone({ freq: 640, to: 900, type: "sine", duration: 0.06, gain: 0.07 });
        this.tone({ freq: 1800, type: "sine", duration: 0.035, gain: 0.012 });
        break;
      case "hardDrop":
        this.tone({ freq: 190, to: 46, type: "sine", duration: 0.16, gain: 0.3, attack: 0.002 });
        this.noiseBurst({ duration: 0.08, gain: 0.08, filter: "lowpass", freq: 1400 });
        break;
      case "lock":
        this.tone({ freq: 170, to: 120, type: "triangle", duration: 0.05, gain: 0.1, attack: 0.002 });
        this.noiseBurst({ duration: 0.03, gain: 0.025, filter: "highpass", freq: 3000 });
        break;
      case "hold":
        this.tone({ freq: 520, to: 780, type: "sine", duration: 0.06, gain: 0.06 });
        this.tone({ freq: 780, to: 1040, type: "sine", at: 0.05, duration: 0.07, gain: 0.05 });
        break;
      case "clear1":
        this.arpeggio([880, 1320], 0.05, 0.14, 0.07);
        break;
      case "clear2":
        this.arpeggio([784, 1046, 1318], 0.045, 0.15, 0.07);
        break;
      case "clear3":
        this.arpeggio([698, 932, 1175, 1397], 0.04, 0.16, 0.07);
        break;
      case "clear4":
        this.arpeggio([523, 659, 784, 1046, 1318, 1568], 0.035, 0.22, 0.075);
        this.pad([262, 392, 523, 659], 0.7, 0.035);
        this.noiseBurst({ at: 0.05, duration: 0.5, gain: 0.02, filter: "highpass", freq: 6000 });
        break;
      case "tSpin":
        this.tone({ freq: 300, to: 1200, type: "square", duration: 0.14, gain: 0.02, filter: 1800 });
        this.arpeggio([1175, 1568, 2093], 0.04, 0.12, 0.05, 0.08);
        break;
      case "allClear":
        this.arpeggio([659, 784, 988, 1318, 1568, 1976], 0.04, 0.25, 0.06, 0.2);
        this.pad([330, 494, 659, 988], 0.9, 0.03, 0.2);
        break;
      case "levelUp":
        this.arpeggio([440, 554, 659, 880, 1109], 0.06, 0.18, 0.06);
        this.noiseBurst({ at: 0.24, duration: 0.3, gain: 0.015, filter: "highpass", freq: 7000 });
        break;
      case "gameOver":
        this.arpeggio([523, 440, 349, 262, 196], 0.12, 0.35, 0.07, 0, "triangle");
        this.pad([131, 196, 262], 1.2, 0.03, 0.3);
        break;
      case "ready":
        this.tone({ freq: 440, type: "sine", duration: 0.12, gain: 0.06 });
        break;
      case "go":
        this.tone({ freq: 880, to: 1320, type: "sine", duration: 0.2, gain: 0.07 });
        this.tone({ freq: 1760, type: "sine", at: 0.02, duration: 0.18, gain: 0.02 });
        break;
      case "pause":
        this.tone({ freq: 660, to: 440, type: "sine", duration: 0.1, gain: 0.05 });
        break;
      case "resume":
        this.tone({ freq: 440, to: 660, type: "sine", duration: 0.1, gain: 0.05 });
        break;
      case "ui":
        this.tone({ freq: 1250, type: "sine", duration: 0.03, gain: 0.035 });
        break;
    }
  }

  private tone({ freq, to, type = "sine", at = 0, duration, gain, attack = 0.004, filter }: ToneOptions) {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    let node: AudioNode = osc;
    if (filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = filter;
      node.connect(lp);
      node = lp;
    }
    node.connect(env);
    env.connect(bus);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  private arpeggio(
    notes: number[],
    step: number,
    duration: number,
    gain: number,
    at = 0,
    type: OscillatorType = "sine",
  ) {
    notes.forEach((freq, i) => {
      this.tone({ freq, type, at: at + i * step, duration, gain });
      this.tone({ freq: freq * 2, type: "sine", at: at + i * step, duration: duration * 0.6, gain: gain * 0.18 });
    });
  }

  /** Soft detuned chord through a closing low-pass filter. */
  private pad(notes: number[], duration: number, gain: number, at = 0) {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus) return;
    const t0 = ctx.currentTime + at;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(2400, t0);
    lp.frequency.exponentialRampToValueAtTime(500, t0 + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    lp.connect(env);
    env.connect(bus);
    for (const freq of notes) {
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = freq;
        osc.detune.value = detune;
        osc.connect(lp);
        osc.start(t0);
        osc.stop(t0 + duration + 0.05);
      }
    }
  }

  private noiseBurst({ at = 0, duration, gain, filter, freq, q = 0.8 }: NoiseOptions) {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus || !this.noise) return;
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.frequency.value = freq;
    bq.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(bq);
    bq.connect(env);
    env.connect(bus);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  private createNoise(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.6);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}
