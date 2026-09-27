import { clampStartLevel } from "@/game/engine";

export type EffectsLevel = "full" | "reduced";

export interface Settings {
  sound: boolean;
  effects: EffectsLevel;
  startLevel: number;
}

const SETTINGS_KEY = "teddis:settings:v1";
const BEST_KEY = "teddis:best:v1";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function defaultSettings(): Settings {
  return {
    sound: true,
    effects: prefersReducedMotion() ? "reduced" : "full",
    startLevel: 1,
  };
}

// Storage can throw (private mode, disabled cookies, quota); the game must work regardless.
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Persistence is a convenience only.
  }
}

export function loadSettings(): Settings {
  const defaults = defaultSettings();
  const raw = read(SETTINGS_KEY);
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      sound: typeof parsed.sound === "boolean" ? parsed.sound : defaults.sound,
      effects: parsed.effects === "full" || parsed.effects === "reduced" ? parsed.effects : defaults.effects,
      startLevel:
        typeof parsed.startLevel === "number" ? clampStartLevel(parsed.startLevel) : defaults.startLevel,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: Settings): void {
  write(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadBest(): number {
  const value = Number(read(BEST_KEY));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function saveBest(score: number): void {
  write(BEST_KEY, String(Math.floor(score)));
}
