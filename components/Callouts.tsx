"use client";

import { useEffect, useState } from "react";
import { useController } from "@/hooks/useGame";
import type { UiEvent } from "@/lib/controller";

interface Callout {
  id: number;
  main: string;
  sub?: string[];
  points?: number;
  big?: boolean;
  countdown?: boolean;
}

const LINE_NAMES = ["", "Single", "Double", "Triple", "TEDDIS"];

let nextId = 1;

function describe(event: UiEvent): Omit<Callout, "id"> | null {
  switch (event.type) {
    case "countdown":
      return { main: event.stage === "ready" ? "Ready" : "Go", countdown: true };
    case "levelUp":
      return { main: "Level up", sub: [`Level ${String(event.level).padStart(2, "0")}`] };
    case "clear": {
      const sub: string[] = [];
      if (event.backToBack) sub.push("Back-to-back");
      if (event.combo > 0) sub.push(`${event.combo} combo`);
      let main: string;
      if (event.tSpin !== "none") {
        main = `${event.tSpin === "mini" ? "Mini " : ""}T-spin${event.lines ? ` ${LINE_NAMES[event.lines]}` : ""}`;
      } else if (event.lines === 1 && sub.length === 0 && !event.perfectClear) {
        return null; // Plain singles are too frequent to announce.
      } else {
        main = LINE_NAMES[event.lines];
      }
      if (event.perfectClear) {
        sub.unshift(main);
        main = "All clear";
      }
      return {
        main,
        sub,
        points: event.points,
        big: event.perfectClear || (event.lines >= 4 && event.tSpin === "none"),
      };
    }
    default:
      return null;
  }
}

/** Transient action text over the board (clears, level ups, READY/GO). */
export function Callouts() {
  const controller = useController();
  const [items, setItems] = useState<Callout[]>([]);

  useEffect(() => {
    return controller.onUiEvent((event) => {
      if (event.type === "reset") {
        setItems([]);
        return;
      }
      const callout = describe(event);
      if (!callout) return;
      const item = { ...callout, id: nextId++ };
      // Countdown stages replace each other; other callouts stack briefly.
      setItems((list) => [...list.filter((c) => !(item.countdown && c.countdown)).slice(-1), item]);
    });
  }, [controller]);

  const remove = (id: number) => setItems((list) => list.filter((c) => c.id !== id));

  return (
    <div className="callouts" aria-hidden="true">
      {items.map((item) => (
        <div
          key={item.id}
          className={`callout flex flex-col items-center gap-0.5 ${item.countdown ? "countdown" : ""}`}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) remove(item.id);
          }}
        >
          <span className={item.big ? "callout-big" : item.countdown ? "" : "callout-main"}>{item.main}</span>
          {item.sub?.map((line) => (
            <span key={line} className="callout-sub">
              {line}
            </span>
          ))}
          {item.points ? <span className="callout-points">+{item.points.toLocaleString("en-US")}</span> : null}
        </div>
      ))}
    </div>
  );
}
