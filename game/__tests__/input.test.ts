import { describe, expect, it } from "vitest";
import type { GameEngine } from "../engine";
import { InputController, KEYBOARD_TIMING, TOUCH_TIMING } from "../input";

function fakeEngine(wallAfter = Infinity) {
  const calls: string[] = [];
  let x = 0;
  const engine = {
    shift(dx: -1 | 1) {
      if (Math.abs(x + dx) > wallAfter) return false;
      x += dx;
      calls.push(dx < 0 ? "L" : "R");
      return true;
    },
    rotate(dir: 1 | -1) {
      calls.push(dir > 0 ? "CW" : "CCW");
      return true;
    },
    hardDrop() {
      calls.push("DROP");
      return true;
    },
    hold() {
      calls.push("HOLD");
      return true;
    },
    setSoftDrop(on: boolean) {
      calls.push(on ? "SOFT+" : "SOFT-");
    },
  };
  return { engine: engine as unknown as GameEngine, calls, position: () => x };
}

describe("delayed auto shift", () => {
  const { das, arr } = KEYBOARD_TIMING;

  it("moves once on press, waits for DAS, then repeats at ARR", () => {
    const { engine, calls } = fakeEngine();
    const input = new InputController(engine);
    input.press("left");
    expect(calls).toEqual(["L"]);
    input.update(das - 1);
    expect(calls).toHaveLength(1);
    input.update(1);
    expect(calls).toHaveLength(2);
    input.update(arr);
    expect(calls).toHaveLength(3);
    input.update(arr * 3);
    expect(calls).toHaveLength(6);
    input.release("left");
    input.update(1000);
    expect(calls).toHaveLength(6);
  });

  it("lets the most recent direction win and falls back when released", () => {
    const { engine, calls } = fakeEngine();
    const input = new InputController(engine);
    input.press("left");
    input.update(das + arr);
    const before = calls.length;
    input.press("right");
    expect(calls.at(-1)).toBe("R");
    input.update(das);
    expect(calls.slice(before).every((c) => c === "R")).toBe(true);
    input.release("right");
    const afterRelease = calls.length;
    input.update(das - 1);
    expect(calls.length).toBe(afterRelease);
    input.update(1);
    expect(calls.at(-1)).toBe("L");
  });

  it("stops at walls without building a burst of queued moves", () => {
    const { engine, position } = fakeEngine(3);
    const input = new InputController(engine);
    input.press("right");
    input.update(2000);
    expect(position()).toBe(3);
  });

  it("uses per-device timing", () => {
    const { engine, calls } = fakeEngine();
    const input = new InputController(engine);
    input.press("right", TOUCH_TIMING);
    input.update(KEYBOARD_TIMING.das);
    expect(calls).toHaveLength(1);
    input.update(TOUCH_TIMING.das - KEYBOARD_TIMING.das);
    expect(calls).toHaveLength(2);
  });
});

describe("other actions", () => {
  it("maps discrete actions and soft drop hold/release", () => {
    const { engine, calls } = fakeEngine();
    const input = new InputController(engine);
    input.press("rotateCW");
    input.press("rotateCCW");
    input.press("hold");
    input.press("softDrop");
    input.release("softDrop");
    input.press("hardDrop");
    expect(calls).toEqual(["CW", "CCW", "HOLD", "SOFT+", "SOFT-", "DROP"]);
  });

  it("releases everything at once", () => {
    const { engine, calls } = fakeEngine();
    const input = new InputController(engine);
    input.press("left");
    input.press("softDrop");
    input.releaseAll();
    input.update(1000);
    expect(calls).toEqual(["L", "SOFT+", "SOFT-"]);
  });
});
