import { describe, expect, it } from "vitest";
import { BOARD_WIDTH, HIDDEN_ROWS, LOCK_DELAY_MS, SPAWN_ROW } from "../constants";
import { GameEngine } from "../engine";
import type { GameEvent, LockResult, PieceType } from "../types";
import {
  activeCells,
  BOTTOM,
  fillRow,
  newGame,
  occupied,
  piece,
  place,
  setCell,
} from "./helpers";

function collectLocks(engine: GameEngine): LockResult[] {
  const locks: LockResult[] = [];
  engine.on((e: GameEvent) => {
    if (e.type === "lock") locks.push(e.result);
  });
  return locks;
}

describe("spawning", () => {
  it("starts playing with a piece at the guideline spawn, dropped one row", () => {
    const engine = newGame();
    expect(engine.status).toBe("playing");
    const p = engine.active!;
    expect(p.rotation).toBe(0);
    expect(p.x).toBe(p.type === "O" ? 4 : 3);
    expect(p.y).toBe(SPAWN_ROW + 1);
    // The lowest row of every piece becomes the top visible row.
    const lowest = Math.max(...activeCells(engine).map(([, y]) => y));
    expect(lowest).toBe(HIDDEN_ROWS);
  });

  it("keeps at least five upcoming pieces and follows the bag order", () => {
    const engine = newGame(3);
    expect(engine.preview()).toHaveLength(5);
    const firstBag = [engine.active!.type, ...engine.queue.slice(0, 6)];
    expect(new Set(firstBag).size).toBe(7);

    const expectedNext = engine.queue[0];
    engine.hardDrop();
    expect(engine.active!.type).toBe(expectedNext);
  });

  it("is reproducible from a seed", () => {
    const a = newGame(42);
    const b = newGame(42);
    expect(a.active!.type).toBe(b.active!.type);
    expect(a.queue).toEqual(b.queue);
  });
});

describe("movement", () => {
  it("cannot leave the board on either side", () => {
    for (let seed = 1; seed <= 7; seed++) {
      const engine = newGame(seed);
      for (let i = 0; i < 12; i++) engine.shift(-1);
      expect(Math.min(...activeCells(engine).map(([x]) => x))).toBe(0);
      for (let i = 0; i < 12; i++) engine.shift(1);
      expect(Math.max(...activeCells(engine).map(([x]) => x))).toBe(BOARD_WIDTH - 1);
    }
  });

  it("is blocked by the stack", () => {
    const engine = newGame();
    place(engine, piece("O", 0, 4, 30));
    setCell(engine, 3, 31);
    expect(engine.shift(-1)).toBe(false);
    expect(engine.active!.x).toBe(4);
    expect(engine.shift(1)).toBe(true);
    expect(engine.active!.x).toBe(5);
  });

  it("ignores input while paused", () => {
    const engine = newGame();
    const x = engine.active!.x;
    engine.pause();
    expect(engine.shift(1)).toBe(false);
    expect(engine.rotate(1)).toBe(false);
    expect(engine.hardDrop()).toBe(false);
    expect(engine.hold()).toBe(false);
    engine.update(5000);
    expect(engine.active!.x).toBe(x);
    engine.resume();
    expect(engine.shift(1)).toBe(true);
  });
});

describe("gravity", () => {
  it("drops one row per second at level 1", () => {
    const engine = newGame();
    const y = engine.active!.y;
    engine.update(999);
    expect(engine.active!.y).toBe(y);
    engine.update(1);
    expect(engine.active!.y).toBe(y + 1);
    engine.update(1000);
    expect(engine.active!.y).toBe(y + 2);
  });

  it("falls faster at higher levels", () => {
    const engine = newGame(7, 10);
    const y = engine.active!.y;
    engine.update(200);
    expect(engine.active!.y - y).toBe(3); // ~64ms per row
  });

  it("accumulates time across frames", () => {
    const engine = newGame();
    const y = engine.active!.y;
    for (let i = 0; i < 60; i++) engine.update(1000 / 60);
    expect(engine.active!.y).toBe(y + 1);
  });
});

describe("drops", () => {
  it("soft drop moves immediately, then at 20 rows/s, scoring 1 per row", () => {
    const engine = newGame();
    const y = engine.active!.y;
    engine.setSoftDrop(true);
    expect(engine.active!.y).toBe(y + 1);
    expect(engine.score).toBe(1);
    engine.update(100);
    expect(engine.active!.y).toBe(y + 3);
    expect(engine.score).toBe(3);
    engine.setSoftDrop(false);
    engine.update(500);
    expect(engine.active!.y).toBe(y + 3);
  });

  it("hard drop lands, locks, scores 2 per row and spawns the next piece", () => {
    const engine = newGame();
    const locks = collectLocks(engine);
    const p = engine.active!;
    const ghost = engine.ghostY()!;
    const distance = ghost - p.y;
    const cells = engine.pieceCells(p, ghost);
    const next = engine.queue[0];

    engine.hardDrop();
    expect(engine.score).toBe(distance * 2);
    expect(locks).toHaveLength(1);
    for (const [x, y] of cells) expect(occupied(engine, x, y)).toBe(true);
    expect(Math.max(...cells.map(([, y]) => y))).toBe(BOTTOM);
    expect(engine.active!.type).toBe(next);
    expect(engine.piecesPlaced).toBe(1);
  });

  it("puts the ghost where a hard drop lands", () => {
    const engine = newGame();
    fillRow(engine, BOTTOM, [0]);
    fillRow(engine, BOTTOM - 1, [0, 1]);
    place(engine, piece("O", 0, 4, 25));
    expect(engine.ghostY()).toBe(BOTTOM - 3);
  });
});

describe("line clears", () => {
  it.each([
    [1, 100],
    [2, 300],
    [3, 500],
    [4, 800],
  ])("clears %i line(s) for %i points", (lines, points) => {
    const engine = newGame();
    const locks = collectLocks(engine);
    setCell(engine, 0, BOTTOM - 4); // keeps the board from being a perfect clear
    for (let i = 0; i < 4; i++) fillRow(engine, BOTTOM - i, i < lines ? [9] : [8, 9]);
    place(engine, piece("I", 1, 7, 20)); // vertical I in column 9
    engine.hardDrop();

    const dropPoints = (BOTTOM - 3 - 20) * 2;
    expect(locks[0].lines).toBe(lines);
    expect(locks[0].points).toBe(points);
    expect(engine.lines).toBe(lines);
    expect(engine.score).toBe(points + dropPoints);
    expect(locks[0].clearedRows).toHaveLength(lines);
    expect(locks[0].clearedRows).toEqual(
      Array.from({ length: lines }, (_, i) => BOTTOM - lines + 1 + i),
    );
    expect(locks[0].clearedCells).toHaveLength(lines);
    for (const row of locks[0].clearedCells) expect(row.every((v) => v !== 0)).toBe(true);
    // The stray block above sinks by the number of cleared rows.
    expect(occupied(engine, 0, BOTTOM - 4 + lines)).toBe(true);
  });

  it("multiplies clear points by the current level", () => {
    const engine = newGame(7, 4);
    setCell(engine, 0, BOTTOM - 4);
    for (let i = 0; i < 4; i++) fillRow(engine, BOTTOM - i, [9]);
    place(engine, piece("I", 1, 7, BOTTOM - 3));
    engine.hardDrop();
    expect(engine.score).toBe(800 * 4);
  });

  it("levels up every ten lines and speeds gravity up", () => {
    const engine = newGame();
    const levels: number[] = [];
    engine.on((e) => {
      if (e.type === "levelUp") levels.push(e.level);
    });
    for (let round = 0; round < 3; round++) {
      setCell(engine, 0, BOTTOM - 4);
      for (let i = 0; i < 4; i++) fillRow(engine, BOTTOM - i, [9]);
      place(engine, piece("I", 1, 7, BOTTOM - 3));
      engine.hardDrop();
      engine.board.fill(0);
    }
    expect(engine.lines).toBe(12);
    expect(engine.level).toBe(2);
    expect(levels).toEqual([2]);

    const y = engine.active!.y;
    engine.update(800);
    expect(engine.active!.y).toBe(y + 1); // level 2 ≈ 793ms per row
  });

  it("chains combos and back-to-back quads", () => {
    const engine = newGame();
    const locks = collectLocks(engine);
    for (let round = 0; round < 2; round++) {
      setCell(engine, 0, BOTTOM - 4);
      for (let i = 0; i < 4; i++) fillRow(engine, BOTTOM - i, [9]);
      place(engine, piece("I", 1, 7, BOTTOM - 3));
      engine.hardDrop();
    }
    expect(locks[0]).toMatchObject({ lines: 4, points: 800, combo: 0, backToBack: false });
    expect(locks[1]).toMatchObject({ lines: 4, points: 1200 + 50, combo: 1, backToBack: true });
    expect(engine.stats.quads).toBe(2);
  });

  it("detects a perfect clear", () => {
    const engine = newGame();
    const locks = collectLocks(engine);
    fillRow(engine, BOTTOM, [8, 9]);
    fillRow(engine, BOTTOM - 1, [8, 9]);
    place(engine, piece("O", 0, 8, BOTTOM - 1));
    engine.hardDrop();
    expect(locks[0]).toMatchObject({ lines: 2, perfectClear: true, points: 300 + 1200 });
  });
});

describe("hold", () => {
  it("stores the current piece and brings in the next one", () => {
    const engine = newGame();
    const current = engine.active!.type;
    const next = engine.queue[0];
    expect(engine.hold()).toBe(true);
    expect(engine.holdPiece).toBe(current);
    expect(engine.active!.type).toBe(next);
    expect(engine.canHold).toBe(false);
  });

  it("allows only one hold per piece", () => {
    const engine = newGame();
    engine.hold();
    const active = engine.active!.type;
    expect(engine.hold()).toBe(false);
    expect(engine.active!.type).toBe(active);
  });

  it("swaps with the held piece after the next lock, respawning it upright", () => {
    const engine = newGame();
    const held = engine.active!.type;
    engine.hold();
    engine.hardDrop();
    expect(engine.canHold).toBe(true);
    const current = engine.active!.type;
    engine.rotate(1);
    engine.shift(-1);
    engine.hold();
    expect(engine.holdPiece).toBe(current);
    expect(engine.active).toMatchObject({ type: held, rotation: 0, x: held === "O" ? 4 : 3 });
  });
});

describe("lock delay", () => {
  /** Soft drops the spawned piece onto the empty floor, the way a player would. */
  function grounded(): GameEngine {
    const engine = newGame();
    engine.setSoftDrop(true);
    while (!engine.isGrounded()) engine.update(50);
    engine.setSoftDrop(false);
    expect(engine.active!.y).toBe(BOTTOM - 1);
    expect(engine.lockProgress()).toBe(0);
    return engine;
  }

  it("locks a grounded piece after the delay", () => {
    const engine = grounded();
    engine.update(LOCK_DELAY_MS - 1);
    expect(engine.piecesPlaced).toBe(0);
    expect(engine.lockProgress()).toBeGreaterThan(0.9);
    engine.update(1);
    expect(engine.piecesPlaced).toBe(1);
  });

  it("restarts the timer on successful moves", () => {
    const engine = grounded();
    engine.update(400);
    engine.shift(1);
    engine.update(400);
    engine.shift(-1);
    engine.update(LOCK_DELAY_MS - 1);
    expect(engine.piecesPlaced).toBe(0);
    engine.update(1);
    expect(engine.piecesPlaced).toBe(1);
  });

  it("restarts the timer on successful rotations", () => {
    const engine = grounded();
    place(engine, piece("O", 0, 4, BOTTOM - 1));
    engine.update(400);
    expect(engine.rotate(1)).toBe(true);
    engine.update(400);
    expect(engine.piecesPlaced).toBe(0);
    engine.update(100);
    expect(engine.piecesPlaced).toBe(1);
  });

  it("stops resetting after 15 moves so a piece cannot stall forever", () => {
    const engine = grounded();
    for (let i = 0; i < 15; i++) {
      engine.update(400);
      engine.shift(i % 2 === 0 ? 1 : -1);
    }
    engine.update(400);
    engine.shift(1); // 16th move: no reset
    expect(engine.piecesPlaced).toBe(0);
    engine.update(100);
    expect(engine.piecesPlaced).toBe(1);
  });

  it("restores resets after falling to a new lowest row", () => {
    const engine = newGame();
    fillRow(engine, BOTTOM, [0, 1, 2, 3]);
    place(engine, piece("O", 0, 4, BOTTOM - 2));
    for (let i = 0; i < 15; i++) engine.shift(i % 2 === 0 ? 1 : -1);
    // Slide off the ledge into the gap: the piece may fall again and keeps full resets.
    engine.shift(-1);
    engine.shift(-1);
    engine.shift(-1);
    engine.update(1000);
    expect(engine.active!.y).toBe(BOTTOM - 1);
    engine.update(400);
    engine.shift(-1);
    engine.update(400);
    expect(engine.piecesPlaced).toBe(0);
  });

  it("keeps airborne pieces from locking", () => {
    const engine = newGame();
    engine.update(900);
    expect(engine.piecesPlaced).toBe(0);
    expect(engine.lockProgress()).toBe(0);
  });
});

describe("rotation", () => {
  it("rotates every piece four times back to its start in open space", () => {
    const types: PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];
    for (const type of types) {
      const engine = newGame();
      place(engine, piece(type, 0, 3, 30));
      for (let i = 0; i < 4; i++) expect(engine.rotate(1)).toBe(true);
      expect(engine.active).toMatchObject({ rotation: 0, x: 3, y: 30 });
      for (let i = 0; i < 4; i++) expect(engine.rotate(-1)).toBe(true);
      expect(engine.active).toMatchObject({ rotation: 0, x: 3, y: 30 });
    }
  });

  it("kicks off both walls and keeps every cell inside the board", () => {
    const types: PieceType[] = ["I", "T", "S", "Z", "J", "L"];
    for (const type of types) {
      for (const side of [-1, 1] as const) {
        for (const dir of [1, -1] as const) {
          const engine = newGame();
          place(engine, piece(type, 0, 3, 30));
          for (let step = 0; step < 4; step++) {
            for (let i = 0; i < 12; i++) engine.shift(side);
            expect(engine.rotate(dir)).toBe(true);
            for (const [x, y] of activeCells(engine)) {
              expect(x).toBeGreaterThanOrEqual(0);
              expect(x).toBeLessThan(BOARD_WIDTH);
              expect(y).toBeLessThanOrEqual(BOTTOM);
            }
          }
        }
      }
    }
  });

  it("applies the SRS I-piece kick at the right wall", () => {
    const engine = newGame();
    place(engine, piece("I", 1, 7, 30)); // vertical in column 9
    expect(engine.rotate(1)).toBe(true);
    expect(engine.active).toMatchObject({ rotation: 2, x: 6, y: 30 });
  });

  it("floor-kicks a vertical I lying against the floor", () => {
    const engine = newGame();
    place(engine, piece("I", 0, 3, BOTTOM - 1)); // flat on the floor
    expect(engine.rotate(1)).toBe(true);
    for (const [, y] of activeCells(engine)) expect(y).toBeLessThanOrEqual(BOTTOM);
  });

  it("fails cleanly when no kick fits", () => {
    const engine = newGame();
    // Box the T in on every side so no kick test can succeed.
    for (let y = 28; y <= BOTTOM; y++) fillRow(engine, y, y === 31 ? [3, 4, 5] : y === 30 ? [4] : []);
    place(engine, piece("T", 0, 3, 30));
    expect(engine.rotate(1)).toBe(false);
    expect(engine.active).toMatchObject({ rotation: 0, x: 3, y: 30 });
  });
});

describe("T-spins", () => {
  it("scores a T-spin double", () => {
    const engine = newGame();
    const locks = collectLocks(engine);
    setCell(engine, 3, BOTTOM - 2); // overhang
    fillRow(engine, BOTTOM - 1, [3, 4, 5]);
    fillRow(engine, BOTTOM, [4]);
    place(engine, piece("T", 1, 3, BOTTOM - 2));

    expect(engine.rotate(1)).toBe(true);
    expect(engine.active).toMatchObject({ rotation: 2, x: 3, y: BOTTOM - 2 });
    engine.hardDrop();
    expect(locks[0]).toMatchObject({ lines: 2, tSpin: "full", points: 1200 });
    expect(engine.backToBack).toBe(true);
  });

  it("scores a zero-line T-spin mini and full T-spin", () => {
    for (const [frontFilled, kind, points] of [
      [false, "mini", 100],
      [true, "full", 400],
    ] as const) {
      const engine = newGame();
      const locks = collectLocks(engine);
      setCell(engine, 0, BOTTOM - 2);
      setCell(engine, 0, BOTTOM);
      setCell(engine, 2, BOTTOM);
      if (frontFilled) setCell(engine, 2, BOTTOM - 2);
      place(engine, piece("T", 0, 0, BOTTOM - 2));
      expect(engine.rotate(1)).toBe(true);
      engine.hardDrop();
      expect(locks[0]).toMatchObject({ lines: 0, tSpin: kind, points });
    }
  });

  it("does not count a T that moved after rotating", () => {
    const engine = newGame();
    const locks = collectLocks(engine);
    setCell(engine, 3, BOTTOM - 2);
    fillRow(engine, BOTTOM - 1, [3, 4, 5, 6]);
    fillRow(engine, BOTTOM, [4, 5]);
    place(engine, piece("T", 1, 3, BOTTOM - 2));
    engine.rotate(1);
    engine.shift(1);
    engine.hardDrop();
    expect(locks[0].tSpin).toBe("none");
  });
});

describe("game over", () => {
  it("ends with a block out when the spawn area is occupied", () => {
    const engine = newGame();
    const events: GameEvent[] = [];
    engine.on((e) => events.push(e));
    for (let x = 3; x <= 6; x++) {
      setCell(engine, x, SPAWN_ROW);
      setCell(engine, x, SPAWN_ROW + 1);
    }
    place(engine, piece("O", 0, 0, 30));
    engine.hardDrop();
    expect(engine.status).toBe("over");
    expect(engine.gameOverReason).toBe("blockOut");
    expect(events.at(-1)).toEqual({ type: "gameOver", reason: "blockOut" });
  });

  it("ends with a lock out when a piece settles entirely above the field", () => {
    const engine = newGame();
    fillRow(engine, HIDDEN_ROWS - 1, [9]);
    place(engine, piece("I", 0, 0, HIDDEN_ROWS - 3));
    engine.hardDrop();
    expect(engine.status).toBe("over");
    expect(engine.gameOverReason).toBe("lockOut");
  });

  it("freezes after game over and restarts cleanly", () => {
    const engine = newGame();
    for (let x = 0; x < BOARD_WIDTH; x++) setCell(engine, x, SPAWN_ROW + 1);
    engine.hold();
    expect(engine.status).toBe("over");
    expect(engine.shift(1)).toBe(false);

    engine.start({ seed: 5 });
    expect(engine.status).toBe("playing");
    expect(engine.score).toBe(0);
    expect(engine.holdPiece).toBeNull();
    expect(engine.board.every((v) => v === 0)).toBe(true);
  });
});
