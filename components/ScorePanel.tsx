"use client";

import { useEffect, useRef } from "react";
import { LINES_PER_LEVEL } from "@/game/constants";
import { useController, useHud } from "@/hooks/useGame";
import { Counter, Digits, formatTime } from "./Digits";
import { TechPanel } from "./TechPanel";

function useReduced(): boolean {
  return useHud((s) => s.settings.effects === "reduced");
}

/** Score with count-up animation. */
export function ScoreValue({ className = "" }: { className?: string }) {
  const score = useHud((s) => s.score);
  const reduced = useReduced();
  return <Counter value={score} width={7} className={className} instant={reduced} />;
}

export function BestValue({ className = "" }: { className?: string }) {
  const best = useHud((s) => s.best);
  const score = useHud((s) => s.score);
  return <Digits value={Math.max(best, score)} width={7} className={className} />;
}

/** Briefly highlights an element whenever `value` increases. */
function usePulseOnIncrease(value: number) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(value);
  useEffect(() => {
    const el = ref.current;
    if (el && value > previous.current) {
      el.classList.remove("pulse-once");
      void el.offsetWidth;
      el.classList.add("pulse-once");
    }
    previous.current = value;
  }, [value]);
  return ref;
}

export function ScorePanel({ className = "" }: { className?: string }) {
  return (
    <TechPanel label="Score" meta="PTS" className={className}>
      <ScoreValue className="block text-right text-[clamp(22px,2.1vw,30px)] font-semibold leading-none text-fg" />
      <div className="mt-2.5 flex items-baseline justify-between border-t border-edge pt-2">
        <span className="stat-label">Best</span>
        <BestValue className="text-[13px] font-medium text-fg-muted" />
      </div>
    </TechPanel>
  );
}

export function LevelBlock({ compact = false }: { compact?: boolean }) {
  const level = useHud((s) => s.level);
  const lines = useHud((s) => s.lines);
  const ref = usePulseOnIncrease(level);
  const progress = (lines % LINES_PER_LEVEL) / LINES_PER_LEVEL;
  return (
    <div ref={ref} className="rounded-md">
      <div className="stat-label">Level</div>
      <Digits
        value={level}
        width={2}
        className={`stat-value block ${compact ? "text-[clamp(16px,4.6vw,22px)]" : "text-[26px]"}`}
      />
      <div
        className="progress mt-1.5"
        role="progressbar"
        aria-label="Progress to next level"
        aria-valuemin={0}
        aria-valuemax={LINES_PER_LEVEL}
        aria-valuenow={lines % LINES_PER_LEVEL}
      >
        <span style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

export function LinesBlock({ compact = false }: { compact?: boolean }) {
  const lines = useHud((s) => s.lines);
  return (
    <div>
      <div className="stat-label">Lines</div>
      <Digits
        value={lines}
        width={3}
        className={`stat-value block ${compact ? "text-[clamp(16px,4.6vw,22px)]" : "text-[26px]"}`}
      />
    </div>
  );
}

export function LevelLinesPanel({ className = "" }: { className?: string }) {
  return (
    <TechPanel label="Progress" meta={`${LINES_PER_LEVEL}/LV`} className={className}>
      <div className="grid grid-cols-2 gap-4">
        <LevelBlock />
        <LinesBlock />
      </div>
    </TechPanel>
  );
}

/** Live elapsed time, updated a few times per second without re-rendering React. */
export function ElapsedTime({ className = "" }: { className?: string }) {
  const controller = useController();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const tick = () => {
      const text = formatTime(controller.engine.elapsedMs);
      if (ref.current && ref.current.textContent !== text) ref.current.textContent = text;
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [controller]);
  return <span ref={ref} className={`tabular ${className}`} />;
}
