import { describe, expect, it } from "vitest";
import {
  baseClearPoints,
  gravityIntervalMs,
  levelForLines,
  scoreLock,
  softDropIntervalMs,
} from "../scoring";

describe("gravity curve", () => {
  it("starts gently at one row per second", () => {
    expect(gravityIntervalMs(1)).toBe(1000);
    expect(gravityIntervalMs(2)).toBeCloseTo(793, 0);
    expect(gravityIntervalMs(10)).toBeCloseTo(64.1, 0);
  });

  it("gets strictly faster up to level 20 and then stays constant", () => {
    for (let level = 2; level <= 20; level++) {
      expect(gravityIntervalMs(level)).toBeLessThan(gravityIntervalMs(level - 1));
    }
    expect(gravityIntervalMs(25)).toBe(gravityIntervalMs(20));
    expect(gravityIntervalMs(0)).toBe(gravityIntervalMs(1));
  });

  it("soft drops at 20x gravity but never slower than 20 rows/s", () => {
    expect(softDropIntervalMs(1)).toBe(50);
    expect(softDropIntervalMs(10)).toBeCloseTo(gravityIntervalMs(10) / 20, 5);
  });
});

describe("levels", () => {
  it("advances one level per ten lines from the starting level", () => {
    expect(levelForLines(1, 0)).toBe(1);
    expect(levelForLines(1, 9)).toBe(1);
    expect(levelForLines(1, 10)).toBe(2);
    expect(levelForLines(1, 35)).toBe(4);
    expect(levelForLines(5, 25)).toBe(7);
  });
});

describe("line clear scoring", () => {
  const fresh = { combo: -1, backToBack: false };

  it("awards the classic single / double / triple / quad values times level", () => {
    expect(scoreLock(1, "none", 1, false, fresh).points).toBe(100);
    expect(scoreLock(2, "none", 1, false, fresh).points).toBe(300);
    expect(scoreLock(3, "none", 1, false, fresh).points).toBe(500);
    expect(scoreLock(4, "none", 1, false, fresh).points).toBe(800);
    expect(scoreLock(4, "none", 3, false, fresh).points).toBe(2400);
  });

  it("scores T-spins", () => {
    expect(baseClearPoints(0, "full")).toBe(400);
    expect(baseClearPoints(1, "full")).toBe(800);
    expect(baseClearPoints(2, "full")).toBe(1200);
    expect(baseClearPoints(3, "full")).toBe(1600);
    expect(baseClearPoints(0, "mini")).toBe(100);
    expect(baseClearPoints(1, "mini")).toBe(200);
    expect(baseClearPoints(2, "mini")).toBe(400);
  });

  it("applies the back-to-back multiplier to consecutive difficult clears only", () => {
    const first = scoreLock(4, "none", 1, false, fresh);
    expect(first).toMatchObject({ points: 800, backToBack: true, backToBackBonus: false, combo: 0 });

    const second = scoreLock(4, "none", 1, false, { combo: -1, backToBack: true });
    expect(second).toMatchObject({ points: 1200, backToBackBonus: true, backToBack: true });

    const broken = scoreLock(1, "none", 1, false, { combo: -1, backToBack: true });
    expect(broken).toMatchObject({ points: 100, backToBack: false, backToBackBonus: false });

    // A T-spin that clears nothing keeps the chain alive.
    const spin = scoreLock(0, "full", 1, false, { combo: -1, backToBack: true });
    expect(spin).toMatchObject({ points: 400, backToBack: true, combo: -1 });
  });

  it("adds combo points for consecutive clearing pieces", () => {
    let chain = fresh;
    const points: number[] = [];
    for (let i = 0; i < 4; i++) {
      const result = scoreLock(1, "none", 2, false, chain);
      points.push(result.points);
      chain = result;
    }
    expect(points).toEqual([200, 300, 400, 500]);
    expect(scoreLock(0, "none", 2, false, chain).combo).toBe(-1);
  });

  it("adds perfect clear bonuses", () => {
    expect(scoreLock(1, "none", 1, true, fresh).points).toBe(100 + 800);
    expect(scoreLock(4, "none", 1, true, fresh).points).toBe(800 + 2000);
    expect(scoreLock(4, "none", 1, true, { combo: -1, backToBack: true }).points).toBe(
      1200 + 3200,
    );
  });
});
