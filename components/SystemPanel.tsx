"use client";

import { useController, useHud } from "@/hooks/useGame";
import { PauseIcon, PlayIcon, RestartIcon } from "./Icons";
import { TechPanel } from "./TechPanel";

export function SoundToggle({ className = "" }: { className?: string }) {
  const controller = useController();
  const sound = useHud((s) => s.settings.sound);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={sound}
      className={`toggle ${className}`}
      onClick={() => controller.setSound(!sound)}
    >
      <span>Sound</span>
      <span className="state">{sound ? "ON" : "OFF"}</span>
    </button>
  );
}

export function EffectsToggle({ className = "" }: { className?: string }) {
  const controller = useController();
  const effects = useHud((s) => s.settings.effects);
  const full = effects === "full";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={full}
      aria-label="Visual effects"
      className={`toggle ${className}`}
      onClick={() => controller.setEffects(full ? "reduced" : "full")}
    >
      <span>Effects</span>
      <span className="state">{full ? "FULL" : "LOW"}</span>
    </button>
  );
}

/** Desktop settings and session controls. */
export function SystemPanel({ className = "" }: { className?: string }) {
  const controller = useController();
  const phase = useHud((s) => s.phase);
  const paused = phase === "paused";
  const canPause = phase === "playing" || phase === "countdown" || paused;

  return (
    <TechPanel label="Session" meta="SYS" className={className}>
      <div className="flex flex-col gap-2">
        <SoundToggle />
        <EffectsToggle />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn min-h-11 gap-1.5 px-2 text-[11px] tracking-[0.14em]"
            onClick={(e) => {
              controller.togglePause();
              e.currentTarget.blur();
            }}
            disabled={!canPause}
          >
            {paused ? <PlayIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            className="btn min-h-11 gap-1.5 px-2 text-[11px] tracking-[0.14em]"
            onClick={(e) => {
              controller.play();
              e.currentTarget.blur();
            }}
            disabled={phase === "title" || phase === "loading" || phase === "ending"}
          >
            <RestartIcon className="h-4 w-4" />
            Restart
          </button>
        </div>
      </div>
    </TechPanel>
  );
}
