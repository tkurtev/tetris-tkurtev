import {
  LINES_PER_LEVEL,
  MAX_GRAVITY_LEVEL,
  MAX_SOFT_DROP_INTERVAL_MS,
  MIN_LEVEL,
  SOFT_DROP_FACTOR,
} from "./constants";
import type { TSpinKind } from "./types";

export const SOFT_DROP_POINTS = 1;
export const HARD_DROP_POINTS = 2;
export const COMBO_POINTS = 50;
export const BACK_TO_BACK_MULTIPLIER = 1.5;

const LINE_CLEAR_POINTS = [0, 100, 300, 500, 800] as const;
const T_SPIN_POINTS = [400, 800, 1200, 1600] as const;
const T_SPIN_MINI_POINTS = [100, 200, 400] as const;
const PERFECT_CLEAR_POINTS = [0, 800, 1200, 1800, 2000] as const;
const PERFECT_CLEAR_B2B_QUAD_POINTS = 3200;

/**
 * Milliseconds per row at a given level (guideline curve): 1s at level 1,
 * ~64ms at level 10, ~20G by level 20.
 */
export function gravityIntervalMs(level: number): number {
  const l = Math.min(Math.max(Math.floor(level), MIN_LEVEL), MAX_GRAVITY_LEVEL);
  return Math.pow(0.8 - (l - 1) * 0.007, l - 1) * 1000;
}

export function softDropIntervalMs(level: number): number {
  return Math.min(gravityIntervalMs(level) / SOFT_DROP_FACTOR, MAX_SOFT_DROP_INTERVAL_MS);
}

export function levelForLines(startLevel: number, lines: number): number {
  return startLevel + Math.floor(lines / LINES_PER_LEVEL);
}

/** Four-line clears and T-spins that clear lines keep a back-to-back chain alive. */
export function isDifficultClear(lines: number, tSpin: TSpinKind): boolean {
  return lines === 4 || (tSpin !== "none" && lines > 0);
}

export function baseClearPoints(lines: number, tSpin: TSpinKind): number {
  if (tSpin === "full") return T_SPIN_POINTS[lines] ?? 0;
  if (tSpin === "mini") return T_SPIN_MINI_POINTS[lines] ?? T_SPIN_POINTS[lines] ?? 0;
  return LINE_CLEAR_POINTS[lines] ?? 0;
}

export interface ChainState {
  /** -1 when the previous piece cleared nothing. */
  combo: number;
  backToBack: boolean;
}

export interface LockScore extends ChainState {
  points: number;
  /** This clear received the back-to-back multiplier. */
  backToBackBonus: boolean;
}

/** Scores one lock and advances the combo / back-to-back chains. */
export function scoreLock(
  lines: number,
  tSpin: TSpinKind,
  level: number,
  perfectClear: boolean,
  chain: ChainState,
): LockScore {
  if (lines === 0) {
    return {
      points: tSpin === "none" ? 0 : baseClearPoints(0, tSpin) * level,
      combo: -1,
      backToBack: chain.backToBack,
      backToBackBonus: false,
    };
  }

  const difficult = isDifficultClear(lines, tSpin);
  const backToBackBonus = difficult && chain.backToBack;
  const combo = chain.combo + 1;

  let points = baseClearPoints(lines, tSpin) * level;
  if (backToBackBonus) points *= BACK_TO_BACK_MULTIPLIER;
  if (combo > 0) points += COMBO_POINTS * combo * level;
  if (perfectClear) {
    const bonus =
      lines === 4 && backToBackBonus ? PERFECT_CLEAR_B2B_QUAD_POINTS : PERFECT_CLEAR_POINTS[lines];
    points += bonus * level;
  }

  return { points: Math.floor(points), combo, backToBack: difficult, backToBackBonus };
}
