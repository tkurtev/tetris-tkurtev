"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { BOARD_WIDTH } from "@/game/constants";
import { useController } from "@/hooks/useGame";
import { RENDER_ROWS } from "@/lib/renderer";
import { Callouts } from "./Callouts";

interface GestureState {
  id: number;
  startX: number;
  startY: number;
  stepX: number;
  stepY: number;
  startTime: number;
  moved: boolean;
  /** Recent positions, for release velocity. */
  samples: Array<{ t: number; x: number; y: number }>;
}

const TAP_SLOP_PX = 10;
const TAP_MAX_MS = 280;
/** Window used to measure how fast the finger was moving when it lifted. */
const VELOCITY_WINDOW_MS = 100;
const FLICK_DOWN_PX_PER_MS = 0.7;
const FLICK_UP_PX_PER_MS = 0.5;

interface GameBoardProps {
  /** Largest cell size in CSS pixels (keeps huge screens tasteful). */
  maxCell?: number;
  /** Enable swipe/tap gestures on the playfield. */
  gestures?: boolean;
}

export function GameBoard({ maxCell = 40, gestures = false }: GameBoardProps) {
  const controller = useController();
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const cellRef = useRef(24);
  const gestureRef = useRef<GestureState | null>(null);

  // Canvas ownership and sizing.
  useEffect(() => {
    const canvas = canvasRef.current;
    const board = boardRef.current;
    const composition = board?.parentElement;
    const slot = board?.closest<HTMLElement>(".board-slot");
    const layout = board?.closest<HTMLElement>(".layout");
    if (!canvas || !board || !composition || !slot || !layout) return;

    controller.attachBoard(canvas);
    let applied = "";

    const fit = () => {
      const sides = composition.querySelectorAll<HTMLElement>(":scope > [data-side]");
      let sideWidth = 0;
      sides.forEach((side) => (sideWidth += side.offsetWidth));
      const gap = parseFloat(getComputedStyle(composition).columnGap) || 0;
      const availableWidth = slot.clientWidth - sideWidth - gap * sides.length;
      const availableHeight = slot.clientHeight;
      const cell = Math.max(
        8,
        Math.min(maxCell, Math.floor(Math.min(availableWidth / BOARD_WIDTH, availableHeight / RENDER_ROWS))),
      );
      const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
      const key = `${cell}@${dpr}`;
      if (key === applied) return;
      applied = key;

      const cssCell = controller.resizeBoard(cell, dpr);
      cellRef.current = cssCell;
      board.style.width = `${cssCell * BOARD_WIDTH}px`;
      board.style.height = `${cssCell * RENDER_ROWS}px`;
      layout.style.setProperty("--cell", `${cssCell}px`);
      layout.style.setProperty("--board-w", `${cssCell * BOARD_WIDTH}px`);
    };

    const observer = new ResizeObserver(fit);
    observer.observe(slot);
    window.addEventListener("resize", fit);
    fit();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
      controller.detachBoard(canvas);
    };
  }, [controller, maxCell]);

  // Frame pulse on level up, a small jolt on impacts.
  useEffect(() => {
    return controller.onUiEvent((event) => {
      const reduced = controller.getSnapshot().settings.effects === "reduced";
      if (event.type === "levelUp" && frameRef.current) {
        const frame = frameRef.current;
        frame.removeAttribute("data-level-pulse");
        void frame.offsetWidth;
        frame.setAttribute("data-level-pulse", "");
      } else if (event.type === "impact" && !reduced && boardRef.current) {
        const depth = event.strength > 1 ? 5 : 2.5;
        boardRef.current.animate(
          [
            { transform: "translate3d(0, 0, 0)" },
            { transform: `translate3d(0, ${depth}px, 0)` },
            { transform: "translate3d(0, 0, 0)" },
          ],
          { duration: event.strength > 1 ? 240 : 130, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
        );
      }
    });
  }, [controller]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!gestures || e.pointerType === "mouse" || gestureRef.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Best-effort; the gesture still ends on pointerup/cancel.
    }
    gestureRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      stepX: e.clientX,
      stepY: e.clientY,
      startTime: e.timeStamp,
      moved: false,
      samples: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }],
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || g.id !== e.pointerId) return;
    g.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    while (g.samples.length > 2 && e.timeStamp - g.samples[1].t > VELOCITY_WINDOW_MS) g.samples.shift();
    const cell = cellRef.current;
    const stepX = cell * 0.9;
    // Drag sideways: one column per cell of travel.
    while (Math.abs(e.clientX - g.stepX) >= stepX) {
      const dir = e.clientX > g.stepX ? 1 : -1;
      controller.gesture(dir > 0 ? "right" : "left");
      g.stepX += dir * stepX;
      g.moved = true;
    }
    // Drag down: soft drop one row per cell of travel.
    while (e.clientY - g.stepY >= cell) {
      controller.gesture("down");
      g.stepY += cell;
      g.moved = true;
    }
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || g.id !== e.pointerId) return;
    gestureRef.current = null;
    if (e.type === "pointercancel") return;
    const cell = cellRef.current;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < TAP_SLOP_PX && e.timeStamp - g.startTime < TAP_MAX_MS) {
      controller.gesture("rotate");
      return;
    }
    // Release velocity: a slow drag that stops before lifting is not a flick.
    const since = g.samples.find((s) => e.timeStamp - s.t <= VELOCITY_WINDOW_MS) ?? g.samples[0];
    const vy = (e.clientY - since.y) / Math.max(1, e.timeStamp - since.t);
    const vertical = Math.abs(dy) > Math.abs(dx) * 1.4;
    if (vertical && dy > cell * 2 && vy > FLICK_DOWN_PX_PER_MS) controller.gesture("drop");
    else if (vertical && dy < -cell * 2 && vy < -FLICK_UP_PX_PER_MS) controller.gesture("hold");
  };

  return (
    <div
      ref={boardRef}
      className="board"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="TEDDIS playfield"
      />
      <div ref={frameRef} className="board-frame" aria-hidden="true" />
      <Callouts />
    </div>
  );
}
