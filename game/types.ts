export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

/** 0 = spawn, 1 = clockwise (R), 2 = 180°, 3 = counter-clockwise (L). */
export type Rotation = 0 | 1 | 2 | 3;

export interface Piece {
  type: PieceType;
  rotation: Rotation;
  /** Board column of the bounding box's left edge. */
  x: number;
  /** Board row of the bounding box's top edge (row 0 is the top of the hidden buffer). */
  y: number;
}

export type TSpinKind = "none" | "mini" | "full";

export type GameStatus = "idle" | "playing" | "paused" | "over";

export type GameOverReason = "blockOut" | "lockOut";

export interface LockResult {
  piece: PieceType;
  /** Board cells the piece occupied when it locked, as [x, y]. */
  cells: Array<[number, number]>;
  /** Cleared row indices, top to bottom, in pre-collapse board coordinates. */
  clearedRows: number[];
  /** Cell values of each cleared row (parallel to `clearedRows`), for effects. */
  clearedCells: number[][];
  lines: number;
  tSpin: TSpinKind;
  /** This clear received the back-to-back bonus. */
  backToBack: boolean;
  /** Consecutive clearing pieces minus one; -1 when this lock cleared nothing. */
  combo: number;
  perfectClear: boolean;
  /** Points awarded for the clear itself (drop points excluded). */
  points: number;
}

export type GameEvent =
  | { type: "start" }
  | { type: "spawn"; piece: PieceType }
  | { type: "move"; dx: number }
  | { type: "rotate"; direction: 1 | -1; kick: number }
  | { type: "softDrop" }
  | {
      type: "hardDrop";
      piece: PieceType;
      distance: number;
      /** Cells of the piece before it dropped. */
      from: Array<[number, number]>;
    }
  | { type: "lock"; result: LockResult }
  | { type: "hold"; piece: PieceType }
  | { type: "levelUp"; level: number }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "gameOver"; reason: GameOverReason };
