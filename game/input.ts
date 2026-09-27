import type { GameEngine } from "./engine";

export type GameAction =
  | "left"
  | "right"
  | "softDrop"
  | "hardDrop"
  | "rotateCW"
  | "rotateCCW"
  | "hold";

/** Auto-shift timing: `das` is the delay before repeating, `arr` the repeat interval (0 = instant). */
export interface ShiftTiming {
  das: number;
  arr: number;
}

export const KEYBOARD_TIMING: ShiftTiming = { das: 150, arr: 35 };
export const TOUCH_TIMING: ShiftTiming = { das: 170, arr: 50 };

/**
 * Turns press/release intents from any device into engine actions, including
 * delayed auto-shift. The charge is kept across pieces, so holding a direction
 * while a piece locks keeps sliding the next one.
 */
export class InputController {
  private leftHeld = false;
  private rightHeld = false;
  private softDropHeld = false;
  private direction: -1 | 0 | 1 = 0;
  private timing: ShiftTiming = KEYBOARD_TIMING;
  private dasElapsed = 0;
  private arrElapsed = 0;
  private charged = false;

  constructor(private readonly engine: GameEngine) {}

  press(action: GameAction, timing: ShiftTiming = KEYBOARD_TIMING): void {
    switch (action) {
      case "left":
      case "right": {
        const dir = action === "left" ? -1 : 1;
        if (dir === -1) this.leftHeld = true;
        else this.rightHeld = true;
        this.direction = dir;
        this.timing = timing;
        this.restartShift();
        this.engine.shift(dir);
        break;
      }
      case "softDrop":
        this.softDropHeld = true;
        this.engine.setSoftDrop(true);
        break;
      case "hardDrop":
        this.engine.hardDrop();
        break;
      case "rotateCW":
        this.engine.rotate(1);
        break;
      case "rotateCCW":
        this.engine.rotate(-1);
        break;
      case "hold":
        this.engine.hold();
        break;
    }
  }

  release(action: GameAction): void {
    if (action === "left" || action === "right") {
      const dir = action === "left" ? -1 : 1;
      if (dir === -1) this.leftHeld = false;
      else this.rightHeld = false;
      if (this.direction === dir) {
        // Fall back to the opposite direction if it is still held (last pressed wins).
        const otherHeld = dir === -1 ? this.rightHeld : this.leftHeld;
        this.direction = otherHeld ? (dir === -1 ? 1 : -1) : 0;
        this.restartShift();
      }
    } else if (action === "softDrop") {
      this.softDropHeld = false;
      this.engine.setSoftDrop(false);
    }
  }

  releaseAll(): void {
    this.leftHeld = false;
    this.rightHeld = false;
    this.direction = 0;
    this.restartShift();
    if (this.softDropHeld) {
      this.softDropHeld = false;
      this.engine.setSoftDrop(false);
    }
  }

  update(dt: number): void {
    if (this.direction === 0) return;
    const { das, arr } = this.timing;

    if (!this.charged) {
      this.dasElapsed += dt;
      if (this.dasElapsed < das) return;
      this.charged = true;
      this.arrElapsed = this.dasElapsed - das;
      this.engine.shift(this.direction);
    } else {
      this.arrElapsed += dt;
    }

    if (arr <= 0) {
      let moved = true;
      while (moved) moved = this.engine.shift(this.direction);
      this.arrElapsed = 0;
      return;
    }
    while (this.arrElapsed >= arr) {
      this.arrElapsed -= arr;
      if (!this.engine.shift(this.direction)) {
        this.arrElapsed = 0;
        break;
      }
    }
  }

  private restartShift(): void {
    this.dasElapsed = 0;
    this.arrElapsed = 0;
    this.charged = false;
  }
}
