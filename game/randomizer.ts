import { PIECE_TYPES } from "./pieces";
import type { PieceType } from "./types";

/** Returns a float in [0, 1). */
export type Rng = () => number;

/** Small, fast, seedable PRNG (mulberry32). */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 4294967296);
}

/**
 * 7-bag randomizer: every run of seven pieces contains each tetromino exactly
 * once, so droughts and floods are impossible.
 */
export class BagRandomizer {
  private bag: PieceType[] = [];

  constructor(private readonly rng: Rng) {}

  next(): PieceType {
    if (this.bag.length === 0) this.refill();
    return this.bag.pop() as PieceType;
  }

  private refill(): void {
    const bag = [...PIECE_TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    this.bag = bag;
  }
}
