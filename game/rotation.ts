import type { PieceType, Rotation } from "./types";

type Offset = readonly [number, number];

/*
 * Super Rotation System wall-kick tests. The tables are written the way they
 * are usually published (x right, y up) and converted to board space (y down)
 * below, so they can be checked against the reference tables line by line.
 */
const JLSTZ_KICKS_Y_UP: Readonly<Record<string, readonly Offset[]>> = {
  "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

const I_KICKS_Y_UP: Readonly<Record<string, readonly Offset[]>> = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

function toBoardSpace(table: Readonly<Record<string, readonly Offset[]>>) {
  const out: Record<string, readonly Offset[]> = {};
  for (const [key, tests] of Object.entries(table)) {
    out[key] = tests.map(([x, y]) => [x, y === 0 ? 0 : -y] as const);
  }
  return out;
}

const JLSTZ_KICKS = toBoardSpace(JLSTZ_KICKS_Y_UP);
const I_KICKS = toBoardSpace(I_KICKS_Y_UP);
const NO_KICKS: readonly Offset[] = [[0, 0]];

export function rotateIndex(rotation: Rotation, direction: 1 | -1): Rotation {
  return ((rotation + direction + 4) % 4) as Rotation;
}

/** Offsets (board space, y down) to try in order when rotating `from` → `to`. */
export function kickTests(type: PieceType, from: Rotation, to: Rotation): readonly Offset[] {
  if (type === "O") return NO_KICKS;
  const table = type === "I" ? I_KICKS : JLSTZ_KICKS;
  return table[`${from}>${to}`] ?? NO_KICKS;
}
