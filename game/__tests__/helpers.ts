import { BOARD_WIDTH } from "../constants";
import { GameEngine } from "../engine";
import { PIECE_ID } from "../pieces";
import type { Piece, PieceType } from "../types";

export const BOTTOM = 39;

export function newGame(seed = 7, startLevel = 1): GameEngine {
  const engine = new GameEngine();
  engine.start({ seed, startLevel });
  return engine;
}

/** Fills row `y` with garbage except the listed columns. */
export function fillRow(engine: GameEngine, y: number, holes: number[] = []): void {
  for (let x = 0; x < BOARD_WIDTH; x++) {
    engine.board[y * BOARD_WIDTH + x] = holes.includes(x) ? 0 : PIECE_ID.Z;
  }
}

export function setCell(engine: GameEngine, x: number, y: number, filled = true): void {
  engine.board[y * BOARD_WIDTH + x] = filled ? PIECE_ID.J : 0;
}

export function place(engine: GameEngine, piece: Piece): void {
  engine.active = { ...piece };
}

export function activeCells(engine: GameEngine): Array<[number, number]> {
  if (!engine.active) throw new Error("no active piece");
  return engine.pieceCells(engine.active);
}

export function occupied(engine: GameEngine, x: number, y: number): boolean {
  return engine.board[y * BOARD_WIDTH + x] !== 0;
}

export function piece(type: PieceType, rotation: Piece["rotation"], x: number, y: number): Piece {
  return { type, rotation, x, y };
}
