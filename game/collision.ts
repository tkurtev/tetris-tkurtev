import { BOARD_HEIGHT, BOARD_WIDTH } from "./constants";
import { shapeCells } from "./pieces";
import type { PieceType, Rotation } from "./types";

export type Board = Uint8Array;

export function createBoard(): Board {
  return new Uint8Array(BOARD_WIDTH * BOARD_HEIGHT);
}

/** Walls, floor and the top of the buffer count as solid. */
export function isSolid(board: Board, x: number, y: number): boolean {
  if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) return true;
  return board[y * BOARD_WIDTH + x] !== 0;
}

export function collides(
  board: Board,
  type: PieceType,
  rotation: Rotation,
  x: number,
  y: number,
): boolean {
  const cells = shapeCells(type, rotation);
  for (let i = 0; i < cells.length; i++) {
    if (isSolid(board, x + cells[i][0], y + cells[i][1])) return true;
  }
  return false;
}

/** Lowest y the piece can fall to from its current position. */
export function dropPosition(
  board: Board,
  type: PieceType,
  rotation: Rotation,
  x: number,
  y: number,
): number {
  let landing = y;
  while (!collides(board, type, rotation, x, landing + 1)) landing++;
  return landing;
}

export function isRowFull(board: Board, y: number): boolean {
  const start = y * BOARD_WIDTH;
  for (let x = 0; x < BOARD_WIDTH; x++) {
    if (board[start + x] === 0) return false;
  }
  return true;
}

export function isBoardEmpty(board: Board): boolean {
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== 0) return false;
  }
  return true;
}

/**
 * Removes every full row, shifting the rows above down. Returns the cleared
 * row indices (top to bottom) in pre-collapse coordinates.
 */
export function clearFullRows(board: Board): number[] {
  const cleared: number[] = [];
  let write = BOARD_HEIGHT - 1;
  for (let read = BOARD_HEIGHT - 1; read >= 0; read--) {
    if (isRowFull(board, read)) {
      cleared.push(read);
      continue;
    }
    if (write !== read) {
      board.copyWithin(write * BOARD_WIDTH, read * BOARD_WIDTH, (read + 1) * BOARD_WIDTH);
    }
    write--;
  }
  if (write >= 0) board.fill(0, 0, (write + 1) * BOARD_WIDTH);
  return cleared.reverse();
}
