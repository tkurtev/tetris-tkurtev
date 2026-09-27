import { SPAWN_ROW } from "./constants";
import type { PieceType, Rotation } from "./types";

export const PIECE_TYPES: readonly PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];

/** Board cell value for each piece type (0 means empty). */
export const PIECE_ID: Readonly<Record<PieceType, number>> = {
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
};

export const PIECE_BY_ID: readonly (PieceType | null)[] = [null, "I", "O", "T", "S", "Z", "J", "L"];

type Cell = readonly [number, number];

interface ShapeDef {
  /** Bounding box size; rotation happens about the box centre (SRS). */
  size: number;
  /** Spawn-orientation cells as [x, y], y pointing down. */
  cells: readonly Cell[];
}

const SPAWN_SHAPES: Readonly<Record<PieceType, ShapeDef>> = {
  I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

function rotateClockwise(cells: readonly Cell[], size: number): Cell[] {
  return cells
    .map(([x, y]) => [size - 1 - y, x] as const)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

function buildRotations(def: ShapeDef): readonly (readonly Cell[])[] {
  const states: Cell[][] = [[...def.cells].sort((a, b) => a[1] - b[1] || a[0] - b[0])];
  for (let r = 1; r < 4; r++) states.push(rotateClockwise(states[r - 1], def.size));
  return states;
}

/** SHAPES[type][rotation] lists the four occupied cells of each orientation. */
export const SHAPES: Readonly<Record<PieceType, readonly (readonly Cell[])[]>> = {
  I: buildRotations(SPAWN_SHAPES.I),
  O: buildRotations(SPAWN_SHAPES.O),
  T: buildRotations(SPAWN_SHAPES.T),
  S: buildRotations(SPAWN_SHAPES.S),
  Z: buildRotations(SPAWN_SHAPES.Z),
  J: buildRotations(SPAWN_SHAPES.J),
  L: buildRotations(SPAWN_SHAPES.L),
};

export function shapeCells(type: PieceType, rotation: Rotation): readonly Cell[] {
  return SHAPES[type][rotation];
}

/** Guideline spawn: I/O centred, the rest left of centre, all in the two rows above the field. */
export function spawnPosition(type: PieceType): { x: number; y: number } {
  return { x: type === "O" ? 4 : 3, y: SPAWN_ROW };
}
