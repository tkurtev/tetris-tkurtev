import {
  BOARD_WIDTH,
  HIDDEN_ROWS,
  LOCK_DELAY_MS,
  MAX_LOCK_RESETS,
  MAX_START_LEVEL,
  MIN_LEVEL,
  NEXT_QUEUE_SIZE,
} from "./constants";
import {
  clearFullRows,
  collides,
  createBoard,
  dropPosition,
  isBoardEmpty,
  isRowFull,
  isSolid,
  type Board,
} from "./collision";
import { PIECE_ID, shapeCells, spawnPosition } from "./pieces";
import { BagRandomizer, createRng, randomSeed } from "./randomizer";
import { kickTests, rotateIndex } from "./rotation";
import {
  gravityIntervalMs,
  HARD_DROP_POINTS,
  levelForLines,
  scoreLock,
  SOFT_DROP_POINTS,
  softDropIntervalMs,
} from "./scoring";
import type {
  GameEvent,
  GameOverReason,
  GameStatus,
  LockResult,
  Piece,
  PieceType,
  Rotation,
  TSpinKind,
} from "./types";

export interface GameStats {
  singles: number;
  doubles: number;
  triples: number;
  quads: number;
  tSpins: number;
  perfectClears: number;
  maxCombo: number;
}

export interface StartOptions {
  seed?: number;
  startLevel?: number;
}

type Listener = (event: GameEvent) => void;

/** Diagonal neighbours of the T centre, as offsets within its 3×3 box. */
const T_CORNERS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [2, 0],
  [0, 2],
  [2, 2],
];

/** The two corners on the side the T points toward, per rotation. */
const T_FRONT_CORNERS: Readonly<Record<Rotation, ReadonlyArray<readonly [number, number]>>> = {
  0: [[0, 0], [2, 0]],
  1: [[2, 0], [2, 2]],
  2: [[0, 2], [2, 2]],
  3: [[0, 0], [0, 2]],
};

/** Index of the SRS kick test that upgrades a mini T-spin to a full one. */
const T_SPIN_UPGRADE_KICK = 4;

/** Keep a few extra pieces generated beyond what the UI previews. */
const QUEUE_LENGTH = NEXT_QUEUE_SIZE + 2;

/** Simulation sub-step: long updates are split so lock delay only counts grounded time. */
const MAX_STEP_MS = 1000 / 60;
/** Absorbs floating-point drift when frame times are summed. */
const EPSILON = 1e-6;

export function clampStartLevel(level: number): number {
  if (!Number.isFinite(level)) return MIN_LEVEL;
  return Math.min(Math.max(Math.round(level), MIN_LEVEL), MAX_START_LEVEL);
}

function emptyStats(): GameStats {
  return { singles: 0, doubles: 0, triples: 0, quads: 0, tSpins: 0, perfectClears: 0, maxCombo: 0 };
}

/**
 * Framework-agnostic falling-block engine. It owns the rules and the clock
 * but knows nothing about rendering or input devices: callers feed it
 * elapsed time via `update(dt)` and player intents via the action methods.
 */
export class GameEngine {
  readonly board: Board = createBoard();
  active: Piece | null = null;
  holdPiece: PieceType | null = null;
  canHold = true;
  queue: PieceType[] = [];

  score = 0;
  lines = 0;
  level = MIN_LEVEL;
  startLevel = MIN_LEVEL;
  combo = -1;
  backToBack = false;
  piecesPlaced = 0;
  elapsedMs = 0;
  stats: GameStats = emptyStats();

  status: GameStatus = "idle";
  gameOverReason: GameOverReason | null = null;

  /** Bumped whenever state shown outside the board (HUD, previews) changes. */
  revision = 0;
  /** Bumped whenever the locked stack changes. */
  boardRevision = 0;

  private randomizer = new BagRandomizer(createRng(1));
  private softDropping = false;
  private gravityAcc = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private lowestY = 0;
  private lastActionRotation = false;
  private lastKick = 0;
  private readonly listeners = new Set<Listener>();

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---------------------------------------------------------------- lifecycle

  start(options: StartOptions = {}): void {
    this.board.fill(0);
    this.randomizer = new BagRandomizer(createRng(options.seed ?? randomSeed()));
    this.startLevel = clampStartLevel(options.startLevel ?? this.startLevel);
    this.level = this.startLevel;
    this.queue = [];
    this.fillQueue();
    this.active = null;
    this.holdPiece = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.combo = -1;
    this.backToBack = false;
    this.piecesPlaced = 0;
    this.elapsedMs = 0;
    this.stats = emptyStats();
    this.softDropping = false;
    this.gameOverReason = null;
    this.status = "playing";
    this.boardRevision++;
    this.touch();
    this.emit({ type: "start" });
    this.spawn(this.takeNext());
  }

  /** Clears the field and returns to the idle (menu) state. */
  reset(startLevel = this.startLevel): void {
    this.board.fill(0);
    this.active = null;
    this.holdPiece = null;
    this.canHold = true;
    this.queue = [];
    this.startLevel = clampStartLevel(startLevel);
    this.level = this.startLevel;
    this.score = 0;
    this.lines = 0;
    this.combo = -1;
    this.backToBack = false;
    this.piecesPlaced = 0;
    this.elapsedMs = 0;
    this.stats = emptyStats();
    this.softDropping = false;
    this.gameOverReason = null;
    this.status = "idle";
    this.boardRevision++;
    this.touch();
  }

  pause(): boolean {
    if (this.status !== "playing") return false;
    this.status = "paused";
    this.touch();
    this.emit({ type: "pause" });
    return true;
  }

  resume(): boolean {
    if (this.status !== "paused") return false;
    this.status = "playing";
    this.touch();
    this.emit({ type: "resume" });
    return true;
  }

  /**
   * Advances gravity and lock delay by `dt` milliseconds. Any duration is
   * simulated faithfully; callers should cap frame gaps themselves.
   */
  update(dt: number): void {
    let remaining = Math.max(0, dt);
    while (remaining > EPSILON && this.status === "playing" && this.active) {
      const step = Math.min(remaining, MAX_STEP_MS);
      remaining -= step;
      this.tick(step);
    }
  }

  private tick(step: number): void {
    this.elapsedMs += step;

    // Lock delay only counts time the piece spent resting at the start of the step.
    if (this.isGrounded()) {
      this.lockTimer += step;
      if (this.lockTimer + EPSILON >= LOCK_DELAY_MS) {
        this.lock();
        return;
      }
    }

    const interval = this.softDropping
      ? softDropIntervalMs(this.level)
      : gravityIntervalMs(this.level);
    this.gravityAcc += step;
    while (this.gravityAcc + EPSILON >= interval) {
      if (!this.stepDown(this.softDropping)) {
        // Keep the gravity clock's phase so a piece slid off a ledge falls on the next tick.
        this.gravityAcc %= interval;
        break;
      }
      this.gravityAcc = Math.max(0, this.gravityAcc - interval);
    }
  }

  // ------------------------------------------------------------------ actions

  shift(dx: -1 | 1): boolean {
    const p = this.active;
    if (this.status !== "playing" || !p) return false;
    if (collides(this.board, p.type, p.rotation, p.x + dx, p.y)) return false;
    const wasGrounded = this.isGrounded();
    p.x += dx;
    this.lastActionRotation = false;
    this.afterManipulation(wasGrounded);
    this.emit({ type: "move", dx });
    return true;
  }

  rotate(direction: 1 | -1): boolean {
    const p = this.active;
    if (this.status !== "playing" || !p) return false;
    const to = rotateIndex(p.rotation, direction);
    const tests = kickTests(p.type, p.rotation, to);
    for (let i = 0; i < tests.length; i++) {
      const [dx, dy] = tests[i];
      if (collides(this.board, p.type, to, p.x + dx, p.y + dy)) continue;
      const wasGrounded = this.isGrounded();
      p.rotation = to;
      p.x += dx;
      p.y += dy;
      this.lastActionRotation = true;
      this.lastKick = i;
      this.afterManipulation(wasGrounded);
      this.emit({ type: "rotate", direction, kick: i });
      return true;
    }
    return false;
  }

  /** Starts or stops soft drop. Starting moves the piece down a row immediately. */
  setSoftDrop(active: boolean): void {
    if (active === this.softDropping) return;
    this.softDropping = active;
    if (active && this.status === "playing" && this.active) {
      this.gravityAcc = 0;
      this.stepDown(true);
    }
  }

  /** Moves the piece down one row as a player soft drop (used by drag gestures). */
  softDropStep(): boolean {
    if (this.status !== "playing" || !this.active) return false;
    return this.stepDown(true);
  }

  hardDrop(): boolean {
    const p = this.active;
    if (this.status !== "playing" || !p) return false;
    const from = this.pieceCells(p);
    const landing = dropPosition(this.board, p.type, p.rotation, p.x, p.y);
    const distance = landing - p.y;
    if (distance > 0) {
      p.y = landing;
      this.lastActionRotation = false;
      this.score += distance * HARD_DROP_POINTS;
      this.touch();
    }
    this.emit({ type: "hardDrop", piece: p.type, distance, from });
    this.lock();
    return true;
  }

  hold(): boolean {
    const p = this.active;
    if (this.status !== "playing" || !p || !this.canHold) return false;
    const next = this.holdPiece ?? this.takeNext();
    this.holdPiece = p.type;
    this.canHold = false;
    this.touch();
    this.emit({ type: "hold", piece: p.type });
    this.spawn(next);
    return true;
  }

  // ---------------------------------------------------------------- queries

  isGrounded(): boolean {
    const p = this.active;
    if (!p) return false;
    return collides(this.board, p.type, p.rotation, p.x, p.y + 1);
  }

  /** Row the active piece would land on, or null without an active piece. */
  ghostY(): number | null {
    const p = this.active;
    if (!p) return null;
    return dropPosition(this.board, p.type, p.rotation, p.x, p.y);
  }

  /** 0 → just landed, 1 → about to lock. 0 while airborne. */
  lockProgress(): number {
    if (!this.isGrounded()) return 0;
    return Math.min(1, this.lockTimer / LOCK_DELAY_MS);
  }

  pieceCells(p: Piece, y = p.y): Array<[number, number]> {
    return shapeCells(p.type, p.rotation).map(([cx, cy]) => [p.x + cx, y + cy] as [number, number]);
  }

  /** Upcoming pieces, nearest first. */
  preview(count = NEXT_QUEUE_SIZE): PieceType[] {
    return this.queue.slice(0, count);
  }

  // ---------------------------------------------------------------- internals

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private touch(): void {
    this.revision++;
  }

  private fillQueue(): void {
    while (this.queue.length < QUEUE_LENGTH) this.queue.push(this.randomizer.next());
  }

  private takeNext(): PieceType {
    const next = this.queue.shift() as PieceType;
    this.fillQueue();
    this.touch();
    return next;
  }

  private spawn(type: PieceType): void {
    const { x, y } = spawnPosition(type);
    const piece: Piece = { type, rotation: 0, x, y };
    this.active = piece;
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lastActionRotation = false;
    this.lastKick = 0;

    if (collides(this.board, type, 0, x, y)) {
      this.endGame("blockOut");
      return;
    }
    // Guideline: a new piece drops one row straight away if nothing is in the way.
    if (!collides(this.board, type, 0, x, y + 1)) piece.y++;
    this.lowestY = piece.y;
    this.emit({ type: "spawn", piece: type });
  }

  private stepDown(fromSoftDrop: boolean): boolean {
    const p = this.active;
    if (!p || collides(this.board, p.type, p.rotation, p.x, p.y + 1)) return false;
    p.y++;
    this.lastActionRotation = false;
    if (p.y > this.lowestY) {
      this.lowestY = p.y;
      this.lockResets = 0;
      this.lockTimer = 0;
    }
    if (fromSoftDrop) {
      this.score += SOFT_DROP_POINTS;
      this.touch();
      this.emit({ type: "softDrop" });
    }
    return true;
  }

  /** Move-reset lock delay: successful moves near the floor restart the timer (up to a limit). */
  private afterManipulation(wasGrounded: boolean): void {
    const p = this.active;
    if (!p) return;
    if (p.y > this.lowestY) {
      this.lowestY = p.y;
      this.lockResets = 0;
      this.lockTimer = 0;
      return;
    }
    if ((wasGrounded || this.isGrounded()) && this.lockResets < MAX_LOCK_RESETS) {
      this.lockResets++;
      this.lockTimer = 0;
    }
  }

  private detectTSpin(p: Piece): TSpinKind {
    if (p.type !== "T" || !this.lastActionRotation) return "none";
    let corners = 0;
    for (const [cx, cy] of T_CORNERS) {
      if (isSolid(this.board, p.x + cx, p.y + cy)) corners++;
    }
    if (corners < 3) return "none";
    let front = 0;
    for (const [cx, cy] of T_FRONT_CORNERS[p.rotation]) {
      if (isSolid(this.board, p.x + cx, p.y + cy)) front++;
    }
    return front === 2 || this.lastKick === T_SPIN_UPGRADE_KICK ? "full" : "mini";
  }

  private lock(): void {
    const p = this.active;
    if (!p) return;
    const tSpin = this.detectTSpin(p);
    const cells = this.pieceCells(p);
    const id = PIECE_ID[p.type];
    for (const [cx, cy] of cells) this.board[cy * BOARD_WIDTH + cx] = id;
    this.active = null;
    this.piecesPlaced++;

    // Only rows the piece touched can have just become full.
    const clearedCells = [...new Set(cells.map(([, cy]) => cy))]
      .sort((a, b) => a - b)
      .filter((row) => isRowFull(this.board, row))
      .map((row) => Array.from(this.board.subarray(row * BOARD_WIDTH, (row + 1) * BOARD_WIDTH)));
    const clearedRows = clearFullRows(this.board);
    const lines = clearedRows.length;
    const perfectClear = lines > 0 && isBoardEmpty(this.board);
    const scored = scoreLock(lines, tSpin, this.level, perfectClear, {
      combo: this.combo,
      backToBack: this.backToBack,
    });
    this.score += scored.points;
    this.combo = scored.combo;
    this.backToBack = scored.backToBack;
    this.lines += lines;
    this.recordStats(lines, tSpin, perfectClear);
    this.boardRevision++;
    this.touch();

    const result: LockResult = {
      piece: p.type,
      cells,
      clearedRows,
      clearedCells,
      lines,
      tSpin,
      backToBack: scored.backToBackBonus,
      combo: scored.combo,
      perfectClear,
      points: scored.points,
    };
    this.emit({ type: "lock", result });

    const level = levelForLines(this.startLevel, this.lines);
    if (level > this.level) {
      this.level = level;
      this.emit({ type: "levelUp", level });
    }

    // Lock out: the whole piece came to rest above the visible field.
    if (lines === 0 && cells.every(([, cy]) => cy < HIDDEN_ROWS)) {
      this.endGame("lockOut");
      return;
    }

    this.canHold = true;
    this.spawn(this.takeNext());
  }

  private recordStats(lines: number, tSpin: TSpinKind, perfectClear: boolean): void {
    const s = this.stats;
    if (lines === 1) s.singles++;
    else if (lines === 2) s.doubles++;
    else if (lines === 3) s.triples++;
    else if (lines === 4) s.quads++;
    if (tSpin !== "none") s.tSpins++;
    if (perfectClear) s.perfectClears++;
    if (this.combo > s.maxCombo) s.maxCombo = this.combo;
  }

  private endGame(reason: GameOverReason): void {
    this.status = "over";
    this.gameOverReason = reason;
    this.softDropping = false;
    this.touch();
    this.emit({ type: "gameOver", reason });
  }
}
