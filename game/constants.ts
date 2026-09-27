/** Playfield width in cells. */
export const BOARD_WIDTH = 10;
/** Rows the player can see. */
export const VISIBLE_HEIGHT = 20;
/** Buffer rows above the visible field; pieces spawn here and may rotate into it. */
export const HIDDEN_ROWS = 20;
export const BOARD_HEIGHT = VISIBLE_HEIGHT + HIDDEN_ROWS;

/** Top row of a freshly spawned piece's bounding box (guideline rows 21–22). */
export const SPAWN_ROW = HIDDEN_ROWS - 2;

/** Time a grounded piece waits before locking. */
export const LOCK_DELAY_MS = 500;
/** Moves/rotations that may restart the lock timer before it stops resetting. */
export const MAX_LOCK_RESETS = 15;

export const NEXT_QUEUE_SIZE = 5;
export const LINES_PER_LEVEL = 10;
export const MIN_LEVEL = 1;
export const MAX_START_LEVEL = 15;
/** Gravity stops accelerating past this level (≈20G). */
export const MAX_GRAVITY_LEVEL = 20;

/** Soft drop falls this many times faster than gravity... */
export const SOFT_DROP_FACTOR = 20;
/** ...but never slower than 20 rows per second. */
export const MAX_SOFT_DROP_INTERVAL_MS = 50;
