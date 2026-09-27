import { BOARD_HEIGHT, BOARD_WIDTH, HIDDEN_ROWS, VISIBLE_HEIGHT } from "@/game/constants";
import type { GameEngine } from "@/game/engine";
import { PIECE_BY_ID, PIECE_TYPES } from "@/game/pieces";
import type { PieceType } from "@/game/types";
import { ACCENT, DEAD_COLOR, mix, PIECE_COLORS, withAlpha } from "./theme";

/** Hidden rows drawn above the field so a freshly spawned piece is fully visible. */
export const SPAWN_STRIP_ROWS = 1;
export const RENDER_ROWS = VISIBLE_HEIGHT + SPAWN_STRIP_ROWS;
const FIRST_ROW = HIDDEN_ROWS - SPAWN_STRIP_ROWS;

export type RenderPhase = "title" | "countdown" | "playing" | "paused" | "ending" | "over";

interface PieceSprites {
  active: HTMLCanvasElement;
  locked: HTMLCanvasElement;
  ghost: HTMLCanvasElement;
  glow: HTMLCanvasElement;
}

type Effect =
  | { kind: "lock"; start: number; cells: Array<[number, number]> }
  | { kind: "clear"; start: number; rows: number[]; cells: number[][]; lines: number }
  | { kind: "trail"; start: number; color: string; columns: Array<{ x: number; from: number; to: number }> }
  | { kind: "level"; start: number };

const DURATION = {
  lock: 170,
  clear: 440,
  trail: 220,
  level: 750,
  gameOver: 950,
} as const;

function roundedRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + radius, y);
  g.arcTo(x + w, y, x + w, y + h, radius);
  g.arcTo(x + w, y + h, x, y + h, radius);
  g.arcTo(x, y + h, x, y, radius);
  g.arcTo(x, y, x + w, y, radius);
  g.closePath();
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvas;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Canvas 2D is not available");
  return g;
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/**
 * Draws the playfield. Static layers (grid, locked stack) are cached in
 * offscreen canvases and only the moving parts are redrawn each frame.
 */
export class BoardRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private unit = 0;
  private readonly sprites = new Map<PieceType, PieceSprites>();
  private deadSprite: HTMLCanvasElement | null = null;
  private background: HTMLCanvasElement | null = null;
  private stack: HTMLCanvasElement | null = null;
  private stackRevision = -1;
  private highestRow = BOARD_HEIGHT;
  private effects: Effect[] = [];
  private gameOverAt = -1;
  private reduced = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = context(canvas);
  }

  /**
   * Sizes the canvas for `cell` CSS pixels per cell. Returns the effective
   * CSS cell size, snapped so every cell maps to whole device pixels.
   */
  resize(cell: number, dpr: number): number {
    const unit = Math.max(4, Math.round(cell * dpr));
    const cssCell = unit / dpr;
    this.canvas.style.width = `${cssCell * BOARD_WIDTH}px`;
    this.canvas.style.height = `${cssCell * RENDER_ROWS}px`;
    if (unit !== this.unit) {
      this.unit = unit;
      this.canvas.width = unit * BOARD_WIDTH;
      this.canvas.height = unit * RENDER_ROWS;
      this.buildSprites();
      this.buildBackground();
      this.stack = makeCanvas(this.canvas.width, this.canvas.height);
      this.stackRevision = -1;
    }
    return cssCell;
  }

  setReducedEffects(reduced: boolean): void {
    this.reduced = reduced;
  }

  reset(): void {
    this.effects = [];
    this.gameOverAt = -1;
    this.stackRevision = -1;
  }

  // ------------------------------------------------------------- effects

  lockFlash(cells: Array<[number, number]>, now: number): void {
    this.effects.push({ kind: "lock", start: now, cells });
  }

  lineClear(rows: number[], cells: number[][], now: number): void {
    this.effects.push({ kind: "clear", start: now, rows, cells, lines: rows.length });
  }

  hardDropTrail(piece: PieceType, from: Array<[number, number]>, distance: number, now: number): void {
    if (this.reduced || distance <= 0) return;
    const columns = new Map<number, number>();
    for (const [x, y] of from) columns.set(x, Math.min(columns.get(x) ?? Infinity, y));
    this.effects.push({
      kind: "trail",
      start: now,
      color: PIECE_COLORS[piece],
      columns: [...columns].map(([x, top]) => ({ x, from: top, to: top + distance })),
    });
  }

  levelUp(now: number): void {
    this.effects.push({ kind: "level", start: now });
  }

  gameOver(now: number): void {
    this.gameOverAt = now;
  }

  // -------------------------------------------------------------- render

  render(engine: GameEngine, now: number, phase: RenderPhase): void {
    const g = this.ctx;
    const u = this.unit;
    if (!u || !this.background || !this.stack) return;

    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.drawImage(this.background, 0, 0);

    if (engine.boardRevision !== this.stackRevision) this.rebuildStack(engine);

    const ending = phase === "ending" || phase === "over";
    if (!ending && (phase === "playing" || phase === "countdown")) this.drawDanger(now);

    // A renderer created after the game ended (e.g. on rotation) starts fully powered down.
    if (ending && this.gameOverAt < 0) this.gameOverAt = now - DURATION.gameOver;
    if (ending) this.drawDyingStack(engine, now);
    else g.drawImage(this.stack, 0, 0);

    this.effects = this.effects.filter((fx) => now - fx.start < DURATION[fx.kind]);
    for (const fx of this.effects) {
      if (fx.kind === "trail") this.drawTrail(fx, now);
      else if (fx.kind === "clear") this.drawClear(fx, now);
    }

    const piece = engine.active;
    if (piece && phase !== "title") {
      if (ending) {
        for (const [x, y] of engine.pieceCells(piece)) this.drawCell(this.dyingSprite(), x, y, 0.9);
      } else {
        const ghostY = engine.ghostY();
        const sprites = this.sprites.get(piece.type);
        if (sprites) {
          if (ghostY !== null && ghostY > piece.y) {
            for (const [x, y] of engine.pieceCells(piece, ghostY)) this.drawCell(sprites.ghost, x, y, 1);
          }
          const cells = engine.pieceCells(piece);
          const fade = 1 - engine.lockProgress() * 0.35;
          g.save();
          g.globalCompositeOperation = "lighter";
          const pad = (sprites.glow.width - u) / 2;
          for (const [x, y] of cells) {
            if (y < FIRST_ROW) continue;
            g.globalAlpha = 0.42 * fade;
            g.drawImage(sprites.glow, x * u - pad, (y - FIRST_ROW) * u - pad);
          }
          g.restore();
          for (const [x, y] of cells) this.drawCell(sprites.active, x, y, fade);
        }
      }
    }

    for (const fx of this.effects) {
      if (fx.kind === "lock") this.drawLockFlash(fx, now);
      else if (fx.kind === "level") this.drawLevelSweep(fx, now);
    }

  }

  // ------------------------------------------------------------ internals

  private drawCell(sprite: HTMLCanvasElement, x: number, y: number, alpha: number): void {
    if (y < FIRST_ROW) return;
    const g = this.ctx;
    g.globalAlpha = y < HIDDEN_ROWS ? alpha * 0.7 : alpha;
    g.drawImage(sprite, x * this.unit, (y - FIRST_ROW) * this.unit);
    g.globalAlpha = 1;
  }

  private dyingSprite(): HTMLCanvasElement {
    return this.deadSprite as HTMLCanvasElement;
  }

  private rebuildStack(engine: GameEngine): void {
    const stack = this.stack;
    if (!stack) return;
    const g = context(stack);
    const u = this.unit;
    g.clearRect(0, 0, stack.width, stack.height);
    let highest = BOARD_HEIGHT;
    for (let row = FIRST_ROW; row < BOARD_HEIGHT; row++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const type = PIECE_BY_ID[engine.board[row * BOARD_WIDTH + x]];
        if (!type) continue;
        if (row < highest) highest = row;
        const sprite = this.sprites.get(type)?.locked;
        if (!sprite) continue;
        g.globalAlpha = row < HIDDEN_ROWS ? 0.6 : 1;
        g.drawImage(sprite, x * u, (row - FIRST_ROW) * u);
      }
    }
    g.globalAlpha = 1;
    this.highestRow = highest;
    this.stackRevision = engine.boardRevision;
  }

  private drawDyingStack(engine: GameEngine, now: number): void {
    const u = this.unit;
    const t = this.reduced ? 1 : Math.min(1, (now - this.gameOverAt) / DURATION.gameOver);
    // Rows power down from the bottom up.
    const threshold = BOARD_HEIGHT - Math.ceil(easeOut(t) * (BOARD_HEIGHT - FIRST_ROW));
    const dead = this.dyingSprite();
    for (let row = FIRST_ROW; row < BOARD_HEIGHT; row++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const type = PIECE_BY_ID[engine.board[row * BOARD_WIDTH + x]];
        if (!type) continue;
        const sprite = row >= threshold ? dead : this.sprites.get(type)?.locked;
        if (!sprite) continue;
        this.ctx.globalAlpha = row < HIDDEN_ROWS ? 0.6 : 1;
        this.ctx.drawImage(sprite, x * u, (row - FIRST_ROW) * u);
      }
    }
    this.ctx.globalAlpha = 1;
    if (t < 1) {
      const y = (threshold - FIRST_ROW) * u;
      const beam = this.ctx.createLinearGradient(0, y - u, 0, y + u * 0.2);
      beam.addColorStop(0, "rgba(255, 90, 116, 0)");
      beam.addColorStop(1, `rgba(255, 90, 116, ${0.35 * (1 - t)})`);
      this.ctx.fillStyle = beam;
      this.ctx.fillRect(0, y - u, this.canvas.width, u * 1.2);
    }
  }

  private drawDanger(now: number): void {
    if (this.highestRow > HIDDEN_ROWS + 3) return;
    const u = this.unit;
    const top = SPAWN_STRIP_ROWS * u;
    const pulse = this.reduced ? 0.6 : 0.5 + 0.5 * Math.sin(now / 260);
    const grad = this.ctx.createLinearGradient(0, top, 0, top + u * 4);
    grad.addColorStop(0, `rgba(255, 70, 100, ${0.12 + 0.12 * pulse})`);
    grad.addColorStop(1, "rgba(255, 70, 100, 0)");
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, top, this.canvas.width, u * 4);
  }

  private drawTrail(fx: Extract<Effect, { kind: "trail" }>, now: number): void {
    const g = this.ctx;
    const u = this.unit;
    const t = (now - fx.start) / DURATION.trail;
    const alpha = 0.32 * (1 - t);
    for (const col of fx.columns) {
      const y0 = Math.max(0, (col.from - FIRST_ROW) * u);
      const y1 = (col.to - FIRST_ROW) * u;
      if (y1 <= y0) continue;
      const grad = g.createLinearGradient(0, y0, 0, y1);
      grad.addColorStop(0, withAlpha(fx.color, 0));
      grad.addColorStop(1, withAlpha(fx.color, alpha));
      g.fillStyle = grad;
      g.fillRect(col.x * u + u * 0.18, y0, u * 0.64, y1 - y0);
    }
  }

  private drawClear(fx: Extract<Effect, { kind: "clear" }>, now: number): void {
    const g = this.ctx;
    const u = this.unit;
    const duration = this.reduced ? DURATION.clear * 0.6 : DURATION.clear;
    const t = Math.min(1, (now - fx.start) / duration);
    const big = fx.lines >= 4;
    g.save();
    if (big && !this.reduced) {
      g.fillStyle = `rgba(160, 240, 255, ${0.16 * (1 - t)})`;
      g.fillRect(0, SPAWN_STRIP_ROWS * u, this.canvas.width, VISIBLE_HEIGHT * u);
    }
    fx.rows.forEach((row, i) => {
      const y = (row - FIRST_ROW) * u;
      // Cleared blocks shrink toward their centres and burn out.
      const scale = 1 - 0.7 * easeOut(t);
      const size = u * scale;
      g.globalAlpha = Math.max(0, 1 - t * 1.15);
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const type = PIECE_BY_ID[fx.cells[i]?.[x] ?? 0];
        const sprite = type ? this.sprites.get(type)?.active : null;
        if (!sprite) continue;
        g.drawImage(sprite, x * u + (u - size) / 2, y + (u - size) / 2, size, size);
      }
      // Energy beam across the row.
      g.globalAlpha = 1;
      g.globalCompositeOperation = "lighter";
      const beamH = u * (big ? 1.25 : 1) * (1 - 0.65 * t);
      const beam = g.createLinearGradient(0, 0, this.canvas.width, 0);
      const a = (big ? 0.9 : 0.7) * (1 - t);
      beam.addColorStop(0, `rgba(61, 228, 242, 0)`);
      beam.addColorStop(0.5, `rgba(235, 252, 255, ${a})`);
      beam.addColorStop(1, `rgba(61, 228, 242, 0)`);
      g.fillStyle = beam;
      g.fillRect(0, y + (u - beamH) / 2, this.canvas.width, beamH);
      g.globalCompositeOperation = "source-over";
    });
    g.restore();
  }

  private drawLockFlash(fx: Extract<Effect, { kind: "lock" }>, now: number): void {
    const g = this.ctx;
    const u = this.unit;
    const t = (now - fx.start) / DURATION.lock;
    const inset = Math.max(1, Math.round(u * 0.045));
    g.save();
    g.globalCompositeOperation = "lighter";
    g.fillStyle = `rgba(255, 255, 255, ${(this.reduced ? 0.25 : 0.42) * (1 - t)})`;
    for (const [x, y] of fx.cells) {
      if (y < FIRST_ROW) continue;
      roundedRect(g, x * u + inset, (y - FIRST_ROW) * u + inset, u - inset * 2, u - inset * 2, u * 0.15);
      g.fill();
    }
    g.restore();
  }

  private drawLevelSweep(fx: Extract<Effect, { kind: "level" }>, now: number): void {
    if (this.reduced) return;
    const g = this.ctx;
    const u = this.unit;
    const t = (now - fx.start) / DURATION.level;
    const top = SPAWN_STRIP_ROWS * u;
    const height = VISIBLE_HEIGHT * u;
    const y = top + height * (1 - easeOut(t));
    const grad = g.createLinearGradient(0, y, 0, y + u * 3);
    grad.addColorStop(0, withAlpha(ACCENT, 0.55 * (1 - t)));
    grad.addColorStop(1, withAlpha(ACCENT, 0));
    g.save();
    g.globalCompositeOperation = "lighter";
    g.fillStyle = grad;
    g.fillRect(0, y, this.canvas.width, u * 3);
    g.fillStyle = withAlpha("#e8fdff", 0.8 * (1 - t));
    g.fillRect(0, y, this.canvas.width, Math.max(1, u * 0.05));
    g.restore();
  }

  private buildBackground(): void {
    const u = this.unit;
    const w = u * BOARD_WIDTH;
    const h = u * RENDER_ROWS;
    const top = SPAWN_STRIP_ROWS * u;
    const bg = makeCanvas(w, h);
    const g = context(bg);

    const field = g.createLinearGradient(0, top, 0, h);
    field.addColorStop(0, "#060a10");
    field.addColorStop(1, "#0a111b");
    g.fillStyle = field;
    g.fillRect(0, top, w, h - top);

    // Alternating column lanes help judge horizontal position at a glance.
    g.fillStyle = "rgba(120, 170, 255, 0.018)";
    for (let x = 1; x < BOARD_WIDTH; x += 2) g.fillRect(x * u, top, u, h - top);

    const line = Math.max(1, Math.round(u / 40));
    g.fillStyle = "rgba(130, 180, 255, 0.065)";
    for (let x = 1; x < BOARD_WIDTH; x++) g.fillRect(x * u - line / 2, top, line, h - top);
    for (let y = 1; y < VISIBLE_HEIGHT; y++) g.fillRect(0, top + y * u - line / 2, w, line);

    // Crosshair marks on every intersection.
    const arm = Math.max(2, Math.round(u * 0.14));
    const thick = Math.max(1, Math.round(u * 0.045));
    g.fillStyle = "rgba(150, 215, 255, 0.2)";
    for (let x = 1; x < BOARD_WIDTH; x++) {
      for (let y = 1; y < VISIBLE_HEIGHT; y++) {
        const px = x * u;
        const py = top + y * u;
        g.fillRect(px - arm / 2, py - thick / 2, arm, thick);
        g.fillRect(px - thick / 2, py - arm / 2, thick, arm);
      }
    }

    // Faint entry glow in the spawn strip above the field.
    const strip = g.createLinearGradient(0, 0, 0, top);
    strip.addColorStop(0, "rgba(61, 228, 242, 0)");
    strip.addColorStop(1, "rgba(61, 228, 242, 0.06)");
    g.fillStyle = strip;
    g.fillRect(0, 0, w, top);

    this.background = bg;
  }

  private buildSprites(): void {
    for (const type of PIECE_TYPES) {
      const color = PIECE_COLORS[type];
      this.sprites.set(type, {
        active: this.drawBlock(color, 1, false),
        locked: this.drawBlock(color, 0.84, false),
        ghost: this.drawGhost(color),
        glow: this.drawGlow(color),
      });
    }
    this.deadSprite = this.drawBlock(DEAD_COLOR, 1, true);
  }

  private drawBlock(color: string, brightness: number, dead: boolean): HTMLCanvasElement {
    const u = this.unit;
    const canvas = makeCanvas(u, u);
    const g = context(canvas);
    const inset = Math.max(1, Math.round(u * 0.045));
    const s = u - inset * 2;
    const r = Math.max(1, s * 0.16);

    const body = g.createLinearGradient(0, inset, 0, inset + s);
    body.addColorStop(0, mix(color, "#ffffff", dead ? 0.12 : 0.34));
    body.addColorStop(0.45, color);
    body.addColorStop(1, mix(color, "#04060a", 0.45));
    roundedRect(g, inset, inset, s, s, r);
    g.fillStyle = body;
    g.fill();

    // Recessed inner face gives the bevel.
    const b = Math.max(1, s * 0.17);
    const face = g.createLinearGradient(0, inset + b, 0, inset + s - b);
    face.addColorStop(0, mix(color, "#04060a", 0.24));
    face.addColorStop(1, mix(color, "#ffffff", 0.05));
    roundedRect(g, inset + b, inset + b, s - b * 2, s - b * 2, r * 0.55);
    g.fillStyle = face;
    g.fill();

    if (!dead) {
      // Energy core.
      const cx = u / 2;
      const core = g.createRadialGradient(cx, cx, 0, cx, cx, s * 0.36);
      core.addColorStop(0, "rgba(255, 255, 255, 0.5)");
      core.addColorStop(0.4, withAlpha(color, 0.45));
      core.addColorStop(1, withAlpha(color, 0));
      g.fillStyle = core;
      g.fillRect(inset, inset, s, s);
    }

    // Specular edge along the top.
    g.fillStyle = `rgba(255, 255, 255, ${dead ? 0.18 : 0.5})`;
    g.fillRect(inset + r, inset + Math.max(1, u * 0.025), s - r * 2, Math.max(1, u * 0.03));

    const lw = Math.max(1, Math.round(u * 0.03));
    roundedRect(g, inset + lw / 2, inset + lw / 2, s - lw, s - lw, r);
    g.strokeStyle = dead ? "rgba(160, 180, 200, 0.18)" : "rgba(255, 255, 255, 0.2)";
    g.lineWidth = lw;
    g.stroke();

    if (brightness < 1) {
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = `rgba(4, 6, 10, ${1 - brightness})`;
      g.fillRect(0, 0, u, u);
    }
    return canvas;
  }

  private drawGhost(color: string): HTMLCanvasElement {
    const u = this.unit;
    const canvas = makeCanvas(u, u);
    const g = context(canvas);
    const inset = Math.max(1, Math.round(u * 0.09));
    const s = u - inset * 2;
    const lw = Math.max(1, Math.round(u * 0.045));
    roundedRect(g, inset, inset, s, s, s * 0.16);
    g.fillStyle = withAlpha(color, 0.1);
    g.fill();
    g.strokeStyle = withAlpha(color, 0.6);
    g.lineWidth = lw;
    g.stroke();
    // Brighter corner ticks read as a projection rather than a block.
    const tick = Math.max(2, Math.round(s * 0.28));
    const lo = inset - lw / 2;
    const hi = inset + s + lw / 2;
    g.fillStyle = withAlpha(color, 0.95);
    g.fillRect(lo, lo, tick, lw);
    g.fillRect(lo, lo, lw, tick);
    g.fillRect(hi - tick, lo, tick, lw);
    g.fillRect(hi - lw, lo, lw, tick);
    g.fillRect(lo, hi - lw, tick, lw);
    g.fillRect(lo, hi - tick, lw, tick);
    g.fillRect(hi - tick, hi - lw, tick, lw);
    g.fillRect(hi - lw, hi - tick, lw, tick);
    return canvas;
  }

  private drawGlow(color: string): HTMLCanvasElement {
    const u = this.unit;
    const pad = Math.round(u * 0.5);
    const canvas = makeCanvas(u + pad * 2, u + pad * 2);
    const g = context(canvas);
    g.shadowColor = withAlpha(color, 0.9);
    g.shadowBlur = u * 0.5;
    g.fillStyle = withAlpha(color, 0.5);
    const inset = Math.round(u * 0.12);
    roundedRect(g, pad + inset, pad + inset, u - inset * 2, u - inset * 2, u * 0.16);
    g.fill();
    return canvas;
  }
}
