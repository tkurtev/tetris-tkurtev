import { NEXT_QUEUE_SIZE } from "@/game/constants";
import { clampStartLevel, GameEngine } from "@/game/engine";
import { InputController, KEYBOARD_TIMING, TOUCH_TIMING, type GameAction } from "@/game/input";
import type { GameEvent, LockResult, PieceType, TSpinKind } from "@/game/types";
import { SoundEngine, type SoundName } from "./audio";
import { BoardRenderer, type RenderPhase } from "./renderer";
import {
  loadBest,
  loadSettings,
  saveBest,
  saveSettings,
  type EffectsLevel,
  type Settings,
} from "./storage";

export type Phase = "loading" | "title" | "countdown" | "playing" | "paused" | "ending" | "over";

export interface GameResult {
  score: number;
  level: number;
  lines: number;
  pieces: number;
  timeMs: number;
  best: number;
  newBest: boolean;
}

export interface HudState {
  phase: Phase;
  score: number;
  best: number;
  level: number;
  lines: number;
  hold: PieceType | null;
  canHold: boolean;
  next: PieceType[];
  combo: number;
  backToBack: boolean;
  settings: Settings;
  result: GameResult | null;
}

export type UiEvent =
  | {
      type: "clear";
      lines: number;
      tSpin: TSpinKind;
      backToBack: boolean;
      combo: number;
      perfectClear: boolean;
      points: number;
    }
  | { type: "levelUp"; level: number }
  | { type: "countdown"; stage: "ready" | "go" }
  | { type: "impact"; strength: number }
  | { type: "reset" };

const NEW_GAME_READY_MS = 750;
const RESUME_READY_MS = 550;
const ENDING_MS = 1150;
const REDUCED_ENDING_MS = 400;
/** Longest frame gap simulated in one go; longer stalls slow the game instead of jumping it. */
const MAX_FRAME_MS = 100;

const CONTINUOUS: ReadonlySet<GameAction> = new Set(["left", "right", "softDrop"]);

const UNLOCK_EVENTS = ["pointerdown", "pointerup", "touchend", "click"] as const;

function actionForKey(event: KeyboardEvent): GameAction | null {
  switch (event.code) {
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    case "ArrowDown":
      return "softDrop";
    case "ArrowUp":
      return "rotateCW";
    case "Space":
      return "hardDrop";
    case "ShiftLeft":
    case "ShiftRight":
      return "hold";
  }
  // Letters follow the printed key first, then the physical QWERTY position.
  switch (event.key.toLowerCase()) {
    case "x":
      return "rotateCW";
    case "z":
      return "rotateCCW";
    case "c":
      return "hold";
  }
  switch (event.code) {
    case "KeyX":
      return "rotateCW";
    case "KeyZ":
      return "rotateCCW";
    case "KeyC":
      return "hold";
  }
  return null;
}

function interactiveElementFocused(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || el === document.body) return false;
  return el.isContentEditable || ["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName);
}

function blurActiveElement(): void {
  const el = document.activeElement;
  if (el instanceof HTMLElement && el !== document.body) el.blur();
}

/**
 * Owns a game session: runs the frame loop, routes keyboard/touch input to the
 * engine, drives the renderer and sound, persists settings and best score,
 * and exposes a snapshot store for React (useSyncExternalStore).
 */
export class GameController {
  readonly engine = new GameEngine();
  private readonly input = new InputController(this.engine);
  private readonly sound = new SoundEngine();
  private renderer: BoardRenderer | null = null;
  private boardCanvas: HTMLCanvasElement | null = null;

  private state: HudState;
  private readonly listeners = new Set<() => void>();
  private readonly uiListeners = new Set<(event: UiEvent) => void>();

  private raf = 0;
  private lastFrame = 0;
  private syncedRevision = -1;
  private countdownLeft = 0;
  private endingLeft = 0;
  private hardDropPending = false;
  private renderDirty = true;
  private readonly heldKeys = new Map<string, GameAction>();

  constructor() {
    // Defaults only; persisted values load on mount (the constructor also runs during SSR).
    this.state = {
      phase: "loading",
      score: 0,
      best: 0,
      level: 1,
      lines: 0,
      hold: null,
      canHold: true,
      next: [],
      combo: -1,
      backToBack: false,
      settings: { sound: true, effects: "full", startLevel: 1 },
      result: null,
    };
    this.engine.on(this.onEngineEvent);
  }

  // ------------------------------------------------------------ store API

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): HudState => this.state;

  onUiEvent(listener: (event: UiEvent) => void): () => void {
    this.uiListeners.add(listener);
    return () => {
      this.uiListeners.delete(listener);
    };
  }

  // ------------------------------------------------------------ lifecycle

  /** Starts the loop and global listeners. Returns a cleanup function. */
  mount(): () => void {
    if (this.state.phase === "loading") {
      const settings = loadSettings();
      this.sound.setEnabled(settings.sound);
      this.renderer?.setReducedEffects(settings.effects === "reduced");
      this.engine.reset(settings.startLevel);
      this.syncHud();
      this.setState({ phase: "title", settings, best: loadBest() });
    }

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    // iOS only unlocks audio on some gesture events, so listen to several.
    for (const type of UNLOCK_EVENTS) {
      window.addEventListener(type, this.onUnlockGesture, { capture: true, passive: true });
    }
    document.addEventListener("visibilitychange", this.onVisibility);
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);

    return () => {
      cancelAnimationFrame(this.raf);
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
      window.removeEventListener("blur", this.onBlur);
      for (const type of UNLOCK_EVENTS) {
        window.removeEventListener(type, this.onUnlockGesture, { capture: true });
      }
      document.removeEventListener("visibilitychange", this.onVisibility);
      this.releaseAllInput();
    };
  }

  attachBoard(canvas: HTMLCanvasElement): void {
    this.boardCanvas = canvas;
    this.renderer = new BoardRenderer(canvas);
    this.renderer.setReducedEffects(this.state.settings.effects === "reduced");
    this.renderDirty = true;
  }

  detachBoard(canvas: HTMLCanvasElement): void {
    if (this.boardCanvas !== canvas) return;
    this.boardCanvas = null;
    this.renderer = null;
  }

  /** Sizes the board canvas; returns the CSS pixel size of one cell actually used. */
  resizeBoard(cell: number, dpr: number): number {
    this.renderDirty = true;
    return this.renderer ? this.renderer.resize(cell, dpr) : cell;
  }

  // ------------------------------------------------------------- commands

  /** Starts a new game (from the title, game over, or as a restart). */
  play = (): void => {
    this.sound.unlock();
    this.releaseAllInput();
    this.renderer?.reset();
    this.engine.start({ startLevel: this.state.settings.startLevel });
    this.engine.pause();
    this.syncHud();
    this.emitUi({ type: "reset" });
    this.beginCountdown(NEW_GAME_READY_MS, { result: null });
  };

  pause = (): void => {
    const { phase } = this.state;
    if (phase === "playing") this.engine.pause();
    else if (phase !== "countdown") return;
    this.releaseAllInput();
    this.setState({ phase: "paused" });
    this.sound.play("pause");
  };

  resume = (): void => {
    if (this.state.phase !== "paused") return;
    this.sound.unlock();
    this.beginCountdown(RESUME_READY_MS);
  };

  togglePause = (): void => {
    if (this.state.phase === "paused") this.resume();
    else this.pause();
  };

  goToMenu = (): void => {
    this.releaseAllInput();
    this.engine.reset(this.state.settings.startLevel);
    this.renderer?.reset();
    this.syncHud();
    this.setState({ phase: "title", result: null });
    this.emitUi({ type: "reset" });
  };

  setSound = (enabled: boolean): void => {
    this.updateSettings({ sound: enabled });
    this.sound.setEnabled(enabled);
    if (enabled) {
      this.sound.unlock();
      this.sound.play("ui");
    }
  };

  setEffects = (effects: EffectsLevel): void => {
    this.updateSettings({ effects });
    this.renderer?.setReducedEffects(effects === "reduced");
  };

  setStartLevel = (level: number): void => {
    const startLevel = clampStartLevel(level);
    this.updateSettings({ startLevel });
    if (this.state.phase === "title") {
      this.engine.reset(startLevel);
      this.syncHud();
    }
  };

  uiSound = (name: SoundName = "ui"): void => {
    this.sound.unlock();
    this.sound.play(name);
  };

  /** On-screen control pressed. */
  pressAction = (action: GameAction): void => {
    this.sound.unlock();
    if (this.state.phase === "playing") this.input.press(action, TOUCH_TIMING);
  };

  releaseAction = (action: GameAction): void => {
    this.input.release(action);
  };

  /** Board gestures: discrete steps rather than held inputs. */
  gesture = (kind: "left" | "right" | "down" | "rotate" | "drop" | "hold"): boolean => {
    if (this.state.phase !== "playing") return false;
    switch (kind) {
      case "left":
        return this.engine.shift(-1);
      case "right":
        return this.engine.shift(1);
      case "down":
        return this.engine.softDropStep();
      case "rotate":
        return this.engine.rotate(1);
      case "drop":
        return this.engine.hardDrop();
      case "hold":
        return this.engine.hold();
    }
  };

  // ------------------------------------------------------------ internals

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(Math.max(now - this.lastFrame, 0), MAX_FRAME_MS);
    this.lastFrame = now;

    switch (this.state.phase) {
      case "countdown":
        this.countdownLeft -= dt;
        if (this.countdownLeft <= 0) this.go();
        break;
      case "playing":
        this.input.update(dt);
        this.engine.update(dt);
        break;
      case "ending":
        this.endingLeft -= dt;
        if (this.endingLeft <= 0) this.setState({ phase: "over" });
        break;
    }

    this.syncHud();
    // Menus show a still board: redraw only when something changed.
    const { phase } = this.state;
    const live = phase === "playing" || phase === "countdown" || phase === "ending";
    if (this.renderer && (live || this.renderDirty)) {
      this.renderDirty = false;
      this.renderer.render(this.engine, now, this.renderPhase());
    }
  };

  private renderPhase(): RenderPhase {
    const { phase } = this.state;
    return phase === "loading" ? "title" : phase;
  }

  private beginCountdown(ms: number, patch: Partial<HudState> = {}): void {
    this.countdownLeft = ms;
    this.setState({ ...patch, phase: "countdown" });
    this.sound.play("ready");
    this.emitUi({ type: "countdown", stage: "ready" });
  }

  private go(): void {
    blurActiveElement();
    this.engine.resume();
    this.setState({ phase: "playing" });
    this.sound.play("go");
    this.emitUi({ type: "countdown", stage: "go" });
    // Directions held through the countdown start sliding right away.
    for (const action of this.heldKeys.values()) {
      if (CONTINUOUS.has(action)) this.input.press(action, KEYBOARD_TIMING);
    }
  }

  private syncHud(): void {
    const e = this.engine;
    if (e.revision === this.syncedRevision) return;
    this.syncedRevision = e.revision;
    this.renderDirty = true;
    const next = e.preview(NEXT_QUEUE_SIZE);
    const prev = this.state.next;
    const sameNext = prev.length === next.length && prev.every((p, i) => p === next[i]);
    this.setState({
      score: e.score,
      level: e.level,
      lines: e.lines,
      hold: e.holdPiece,
      canHold: e.canHold,
      next: sameNext ? prev : next,
      combo: e.combo,
      backToBack: e.backToBack,
    });
  }

  private setState(patch: Partial<HudState>): void {
    const keys = Object.keys(patch) as Array<keyof HudState>;
    if (keys.every((key) => patch[key] === this.state[key])) return;
    if (patch.phase !== undefined || patch.settings !== undefined) this.renderDirty = true;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private updateSettings(patch: Partial<Settings>): void {
    const settings = { ...this.state.settings, ...patch };
    saveSettings(settings);
    this.setState({ settings });
  }

  private emitUi(event: UiEvent): void {
    for (const listener of this.uiListeners) listener(event);
  }

  private releaseAllInput(): void {
    this.heldKeys.clear();
    this.input.releaseAll();
  }

  private onEngineEvent = (event: GameEvent): void => {
    const now = performance.now();
    switch (event.type) {
      case "move":
        this.sound.play("move");
        break;
      case "rotate":
        this.sound.play("rotate");
        break;
      case "hold":
        this.sound.play("hold");
        break;
      case "hardDrop":
        this.hardDropPending = true;
        this.sound.play("hardDrop");
        this.renderer?.hardDropTrail(event.piece, event.from, event.distance, now);
        this.emitUi({ type: "impact", strength: 1 });
        break;
      case "lock":
        this.onLock(event.result, now);
        break;
      case "levelUp":
        this.sound.play("levelUp");
        this.renderer?.levelUp(now);
        this.emitUi({ type: "levelUp", level: event.level });
        break;
      case "gameOver":
        this.onGameOver(now);
        break;
    }
  };

  private onLock(result: LockResult, now: number): void {
    const fromHardDrop = this.hardDropPending;
    this.hardDropPending = false;
    this.renderer?.lockFlash(result.cells, now);
    if (!fromHardDrop) this.sound.play("lock");

    if (result.lines > 0) {
      this.renderer?.lineClear(result.clearedRows, result.clearedCells, now);
      this.sound.play(`clear${Math.min(result.lines, 4)}` as SoundName);
      if (result.lines >= 4) this.emitUi({ type: "impact", strength: 2 });
    }
    if (result.tSpin !== "none") this.sound.play("tSpin");
    if (result.perfectClear) this.sound.play("allClear");

    if (result.lines > 0 || result.tSpin !== "none") {
      this.emitUi({
        type: "clear",
        lines: result.lines,
        tSpin: result.tSpin,
        backToBack: result.backToBack,
        combo: result.combo,
        perfectClear: result.perfectClear,
        points: result.points,
      });
    }
  }

  private onGameOver(now: number): void {
    this.releaseAllInput();
    this.renderer?.gameOver(now);
    this.sound.play("gameOver");
    const e = this.engine;
    const previousBest = this.state.best;
    const newBest = e.score > previousBest;
    if (newBest) saveBest(e.score);
    this.endingLeft = this.state.settings.effects === "reduced" ? REDUCED_ENDING_MS : ENDING_MS;
    this.syncHud();
    this.setState({
      phase: "ending",
      best: Math.max(previousBest, e.score),
      result: {
        score: e.score,
        level: e.level,
        lines: e.lines,
        pieces: e.piecesPlaced,
        timeMs: e.elapsedMs,
        best: Math.max(previousBest, e.score),
        newBest,
      },
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    this.sound.unlock();
    const { phase } = this.state;
    const key = e.key.toLowerCase();

    if (key === "escape" || key === "p") {
      if (phase === "playing" || phase === "countdown" || phase === "paused") {
        e.preventDefault();
        if (!e.repeat) this.togglePause();
      }
      return;
    }
    if (key === "r") {
      if (phase !== "loading" && phase !== "ending") {
        e.preventDefault();
        if (!e.repeat) this.play();
      }
      return;
    }
    if (key === "m") {
      if (!e.repeat) this.setSound(!this.state.settings.sound);
      return;
    }

    if (phase === "playing" || phase === "countdown") {
      const action = actionForKey(e);
      if (!action) return;
      e.preventDefault();
      if (e.repeat || this.heldKeys.has(e.code)) return;
      this.heldKeys.set(e.code, action);
      if (phase === "playing") this.input.press(action, KEYBOARD_TIMING);
      return;
    }

    if (key === "enter" && !e.repeat && !interactiveElementFocused()) {
      if (phase === "title" || phase === "over") {
        e.preventDefault();
        this.play();
      } else if (phase === "paused") {
        e.preventDefault();
        this.resume();
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const action = this.heldKeys.get(e.code);
    if (!action) return;
    this.heldKeys.delete(e.code);
    e.preventDefault();
    this.input.release(action);
  };

  private onBlur = (): void => {
    this.releaseAllInput();
    this.autoPause();
  };

  private onVisibility = (): void => {
    if (document.hidden) {
      this.releaseAllInput();
      this.autoPause();
    }
  };

  private onUnlockGesture = (): void => {
    this.sound.unlock();
  };

  /** Pauses an active game (window blur, hidden tab, layout change). */
  autoPause = (): void => {
    const { phase } = this.state;
    if (phase === "playing" || phase === "countdown") this.pause();
  };
}
