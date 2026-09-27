import { describe, expect, it } from "vitest";
import { BOARD_HEIGHT, BOARD_WIDTH, SPAWN_ROW } from "../constants";
import { clearFullRows, collides, createBoard, dropPosition } from "../collision";
import { PIECE_TYPES, SHAPES, shapeCells, spawnPosition } from "../pieces";
import { BagRandomizer, createRng } from "../randomizer";
import { kickTests, rotateIndex } from "../rotation";
import type { PieceType, Rotation } from "../types";

const sorted = (cells: ReadonlyArray<readonly [number, number]>) =>
  [...cells].map(([x, y]) => `${x},${y}`).sort();

describe("piece shapes", () => {
  it("defines four cells for every orientation of all seven pieces", () => {
    expect(PIECE_TYPES).toHaveLength(7);
    for (const type of PIECE_TYPES) {
      expect(SHAPES[type]).toHaveLength(4);
      for (const state of SHAPES[type]) expect(state).toHaveLength(4);
    }
  });

  it("matches the SRS reference orientations", () => {
    expect(sorted(shapeCells("T", 1))).toEqual(sorted([[1, 0], [1, 1], [2, 1], [1, 2]]));
    expect(sorted(shapeCells("T", 2))).toEqual(sorted([[0, 1], [1, 1], [2, 1], [1, 2]]));
    expect(sorted(shapeCells("T", 3))).toEqual(sorted([[1, 0], [0, 1], [1, 1], [1, 2]]));
    expect(sorted(shapeCells("I", 1))).toEqual(sorted([[2, 0], [2, 1], [2, 2], [2, 3]]));
    expect(sorted(shapeCells("I", 2))).toEqual(sorted([[0, 2], [1, 2], [2, 2], [3, 2]]));
    expect(sorted(shapeCells("I", 3))).toEqual(sorted([[1, 0], [1, 1], [1, 2], [1, 3]]));
    expect(sorted(shapeCells("J", 1))).toEqual(sorted([[1, 0], [2, 0], [1, 1], [1, 2]]));
    expect(sorted(shapeCells("L", 1))).toEqual(sorted([[1, 0], [1, 1], [1, 2], [2, 2]]));
    expect(sorted(shapeCells("S", 1))).toEqual(sorted([[1, 0], [1, 1], [2, 1], [2, 2]]));
    expect(sorted(shapeCells("Z", 1))).toEqual(sorted([[2, 0], [1, 1], [2, 1], [1, 2]]));
  });

  it("keeps the O piece identical in every orientation", () => {
    for (const r of [1, 2, 3] as Rotation[]) {
      expect(sorted(shapeCells("O", r))).toEqual(sorted(shapeCells("O", 0)));
    }
  });

  it("spawns I and O centred and the rest left of centre, above the visible field", () => {
    expect(spawnPosition("I")).toEqual({ x: 3, y: SPAWN_ROW });
    expect(spawnPosition("O")).toEqual({ x: 4, y: SPAWN_ROW });
    for (const type of ["T", "S", "Z", "J", "L"] as PieceType[]) {
      expect(spawnPosition(type).x).toBe(3);
    }
  });
});

describe("SRS kick tables", () => {
  it("converts the published tables to board space (y down)", () => {
    expect(kickTests("T", 0, 1)).toEqual([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]);
    expect(kickTests("T", 1, 0)).toEqual([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]);
    expect(kickTests("I", 0, 1)).toEqual([[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]]);
    expect(kickTests("I", 1, 2)).toEqual([[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]);
  });

  it("gives every rotation pair five tests and mirrors each pair", () => {
    for (const type of ["I", "T"] as PieceType[]) {
      for (let from = 0; from < 4; from++) {
        for (const dir of [1, -1] as const) {
          const to = rotateIndex(from as Rotation, dir);
          const forward = kickTests(type, from as Rotation, to);
          const back = kickTests(type, to, from as Rotation);
          expect(forward).toHaveLength(5);
          forward.forEach(([x, y], i) => {
            expect(back[i][0]).toBe(x === 0 ? 0 : -x);
            expect(back[i][1]).toBe(y === 0 ? 0 : -y);
          });
        }
      }
    }
  });

  it("never kicks the O piece", () => {
    expect(kickTests("O", 0, 1)).toEqual([[0, 0]]);
  });
});

describe("7-bag randomizer", () => {
  it("deals each piece exactly once per bag", () => {
    const bag = new BagRandomizer(createRng(1234));
    for (let round = 0; round < 50; round++) {
      const seen = new Set<PieceType>();
      for (let i = 0; i < 7; i++) seen.add(bag.next());
      expect(seen.size).toBe(7);
    }
  });

  it("is deterministic for a given seed", () => {
    const a = new BagRandomizer(createRng(99));
    const b = new BagRandomizer(createRng(99));
    const seqA = Array.from({ length: 28 }, () => a.next());
    const seqB = Array.from({ length: 28 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces varied orders across seeds", () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const bag = new BagRandomizer(createRng(seed));
      orders.add(Array.from({ length: 7 }, () => bag.next()).join(""));
    }
    expect(orders.size).toBeGreaterThan(10);
  });
});

describe("collision helpers", () => {
  it("treats walls and floor as solid", () => {
    const board = createBoard();
    expect(collides(board, "I", 0, -1, 30)).toBe(true);
    expect(collides(board, "I", 0, 7, 30)).toBe(true);
    expect(collides(board, "I", 0, 6, 30)).toBe(false);
    expect(collides(board, "O", 0, 4, BOARD_HEIGHT - 1)).toBe(true);
    expect(dropPosition(board, "O", 0, 4, 20)).toBe(BOARD_HEIGHT - 2);
  });

  it("collapses cleared rows and keeps the rest in order", () => {
    const board = createBoard();
    const row = (y: number) => board.subarray(y * BOARD_WIDTH, (y + 1) * BOARD_WIDTH);
    row(39).fill(1);
    row(38).set([2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    row(37).fill(3);
    row(36).set([0, 0, 0, 0, 0, 0, 0, 0, 0, 4]);

    expect(clearFullRows(board)).toEqual([37, 39]);
    expect(Array.from(row(39))).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(Array.from(row(38))).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 4]);
    expect(Array.from(row(37)).every((v) => v === 0)).toBe(true);
  });
});
