import type { PieceType } from "@/game/types";

/** Piece colours: familiar hues, tuned for a dark, restrained palette. */
export const PIECE_COLORS: Readonly<Record<PieceType, string>> = {
  I: "#2fe0f0",
  O: "#f4c64a",
  T: "#b07cff",
  S: "#45df9c",
  Z: "#ff5a74",
  J: "#4f7dff",
  L: "#ff9147",
};

export const PIECE_NAMES: Readonly<Record<PieceType, string>> = {
  I: "I piece",
  O: "O piece",
  T: "T piece",
  S: "S piece",
  Z: "Z piece",
  J: "J piece",
  L: "L piece",
};

export const DEAD_COLOR = "#303a48";
export const ACCENT = "#3de4f2";

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear mix of two hex colours; `t` = 0 → a, 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(ar, br)}, ${c(ag, bg)}, ${c(ab, bb)})`;
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
