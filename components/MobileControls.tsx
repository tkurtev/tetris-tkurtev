"use client";

import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { GameAction } from "@/game/input";
import { useController } from "@/hooks/useGame";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  HardDropIcon,
  HoldIcon,
  RotateCcwIcon,
  RotateCwIcon,
} from "./Icons";

interface TouchButtonProps {
  action: GameAction;
  label: string;
  short: string;
  icon: ReactNode;
  area: string;
  accent?: boolean;
}

function TouchButton({ action, label, short, icon, area, accent = false }: TouchButtonProps) {
  const controller = useController();
  const pointers = useRef(new Set<number>());

  const press = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is best-effort; release still arrives via pointerup/cancel.
    }
    if (pointers.current.size === 0) {
      e.currentTarget.setAttribute("data-pressed", "");
      controller.pressAction(action);
    }
    pointers.current.add(e.pointerId);
  };

  const release = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size === 0) {
      e.currentTarget.removeAttribute("data-pressed");
      controller.releaseAction(action);
    }
  };

  return (
    <button
      type="button"
      className={`tbtn ${accent ? "tbtn-accent" : ""}`}
      style={{ gridArea: area } as CSSProperties}
      aria-label={label}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        // Keyboard / switch activation (pointer presses are handled above).
        if (e.detail === 0) {
          controller.pressAction(action);
          controller.releaseAction(action);
        }
      }}
    >
      {icon}
      <span className="tlabel">{short}</span>
    </button>
  );
}

const BUTTONS: Record<string, Omit<TouchButtonProps, "area">> = {
  left: { action: "left", label: "Move left", short: "Left", icon: <ArrowLeftIcon /> },
  right: { action: "right", label: "Move right", short: "Right", icon: <ArrowRightIcon /> },
  down: { action: "softDrop", label: "Soft drop", short: "Soft", icon: <ArrowDownIcon /> },
  drop: { action: "hardDrop", label: "Hard drop", short: "Drop", icon: <HardDropIcon />, accent: true },
  ccw: { action: "rotateCCW", label: "Rotate counter-clockwise", short: "Rot L", icon: <RotateCcwIcon /> },
  cw: { action: "rotateCW", label: "Rotate clockwise", short: "Rotate", icon: <RotateCwIcon />, accent: true },
  hold: { action: "hold", label: "Hold piece", short: "Hold", icon: <HoldIcon /> },
};

function Pad({ areas, className, style }: { areas: string[]; className: string; style: CSSProperties }) {
  const names = new Set(areas.join(" ").split(/\s+/).filter((n) => n !== "."));
  return (
    <div
      className={`touch-pad ${className}`}
      style={{ ...style, gridTemplateAreas: areas.map((row) => `"${row}"`).join(" ") }}
      role="group"
      aria-label="Game controls"
    >
      {[...names].map((name) => (
        <TouchButton key={name} area={name} {...BUTTONS[name]} />
      ))}
    </div>
  );
}

/** Portrait: movement cluster on the left, rotation cluster on the right. */
export function PortraitControls() {
  return (
    <Pad
      className="portrait-controls"
      style={{ gridTemplateColumns: "1fr 1fr 1fr 0.3fr 1.2fr 1.2fr" }}
      areas={["drop drop drop . hold hold", "left down right . ccw cw"]}
    />
  );
}

/** Handheld (landscape touch): clusters sit beside the board. */
export function HandheldControls({ side }: { side: "left" | "right" }) {
  return side === "left" ? (
    <Pad
      className="handheld-pad"
      style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
      areas={["drop drop drop", "left down right"]}
    />
  ) : (
    <Pad className="handheld-pad" style={{ gridTemplateColumns: "1fr 1fr" }} areas={["hold hold", "ccw cw"]} />
  );
}
