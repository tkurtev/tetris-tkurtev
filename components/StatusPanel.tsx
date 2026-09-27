"use client";

import { useHud } from "@/hooks/useGame";
import type { Phase } from "@/lib/controller";
import { ElapsedTime } from "./ScorePanel";
import { TechPanel } from "./TechPanel";

const PHASE_LABEL: Record<Phase, string> = {
  loading: "Booting",
  title: "Standby",
  countdown: "Ready",
  playing: "Active",
  paused: "Paused",
  ending: "Offline",
  over: "Offline",
};

export function StatusPanel({ className = "" }: { className?: string }) {
  const phase = useHud((s) => s.phase);
  const combo = useHud((s) => s.combo);
  const backToBack = useHud((s) => s.backToBack);
  const live = phase === "playing" || phase === "countdown";

  return (
    <TechPanel label="System" meta="STATUS" className={className}>
      <div className="flex items-center justify-between">
        <span className="stat-label">State</span>
        <span
          className={`inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] uppercase ${
            live ? "text-accent" : "text-fg-muted"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${live ? "bg-accent shadow-[0_0_8px_var(--color-accent)]" : "bg-fg-dim"}`}
            aria-hidden="true"
          />
          {PHASE_LABEL[phase]}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="stat-label">Time</span>
        <ElapsedTime className="text-[13px] text-fg" />
      </div>
      <div className="mt-2.5 flex gap-2">
        <span
          className={`flex-1 rounded-md border px-2 py-1 text-center text-[10px] font-semibold tracking-[0.16em] uppercase transition-colors ${
            combo > 0 ? "border-accent/50 bg-accent-soft text-accent" : "border-edge text-fg-dim"
          }`}
        >
          Combo {combo > 0 ? `×${combo}` : "—"}
        </span>
        <span
          className={`flex-1 rounded-md border px-2 py-1 text-center text-[10px] font-semibold tracking-[0.16em] uppercase transition-colors ${
            backToBack ? "border-gold/50 bg-gold/10 text-gold" : "border-edge text-fg-dim"
          }`}
        >
          B2B {backToBack ? "On" : "—"}
        </span>
      </div>
    </TechPanel>
  );
}
