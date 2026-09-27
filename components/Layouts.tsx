"use client";

import { useController, useHud } from "@/hooks/useGame";
import { ControlsHelp } from "./ControlsHelp";
import { GameBoard } from "./GameBoard";
import { HoldPanel } from "./HoldPanel";
import { PauseIcon, PlayIcon, SoundOffIcon, SoundOnIcon } from "./Icons";
import { Logo } from "./Logo";
import { HandheldControls, PortraitControls } from "./MobileControls";
import { NextPanel } from "./NextPanel";
import { BestValue, LevelBlock, LevelLinesPanel, LinesBlock, ScorePanel, ScoreValue } from "./ScorePanel";
import { StatusPanel } from "./StatusPanel";
import { SystemPanel } from "./SystemPanel";
import { TechPanel } from "./TechPanel";

function PauseButton() {
  const controller = useController();
  const phase = useHud((s) => s.phase);
  const paused = phase === "paused";
  const enabled = paused || phase === "playing" || phase === "countdown";
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={paused ? "Resume" : "Pause"}
      onClick={(e) => {
        controller.togglePause();
        e.currentTarget.blur();
      }}
      disabled={!enabled}
    >
      {paused ? <PlayIcon /> : <PauseIcon />}
    </button>
  );
}

function SoundButton() {
  const controller = useController();
  const sound = useHud((s) => s.settings.sound);
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={sound ? "Mute sound" : "Unmute sound"}
      aria-pressed={!sound}
      onClick={(e) => {
        controller.setSound(!sound);
        e.currentTarget.blur();
      }}
    >
      {sound ? <SoundOnIcon /> : <SoundOffIcon />}
    </button>
  );
}

/** Widescreen console: hold + help on the left, board centre, queue + stats right. */
export function DesktopLayout({ inert }: { inert: boolean }) {
  return (
    <main className="layout layout-desktop" inert={inert}>
      <div className="board-slot">
        <div className="composition">
          <aside className="side" data-side aria-label="Hold and settings">
            <div className="flex items-center px-1 pb-1">
              <Logo className="logo-glow h-auto w-[82%]" />
            </div>
            <HoldPanel />
            <ControlsHelp className="hide-short" />
            <SystemPanel className="mt-auto" />
          </aside>
          <GameBoard maxCell={38} />
          <aside className="side" data-side aria-label="Next pieces and score">
            <NextPanel count={5} />
            <ScorePanel />
            <LevelLinesPanel />
            <StatusPanel className="hide-shorter mt-auto" />
          </aside>
        </div>
      </div>
    </main>
  );
}

/** Phones and upright tablets. */
export function PortraitLayout({ inert, touch }: { inert: boolean; touch: boolean }) {
  return (
    <main className="layout layout-portrait" inert={inert}>
      <header className="p-header">
        <Logo className="logo-glow h-auto w-[clamp(78px,24vw,150px)] flex-none" />
        <div className="ml-auto flex min-w-0 flex-col items-end leading-none">
          <span className="stat-label">Score</span>
          <ScoreValue className="mt-1 text-[clamp(17px,5vw,26px)] font-semibold text-fg" />
          <span className="mt-1 flex items-baseline gap-1.5">
            <span className="stat-label">Best</span>
            <BestValue className="text-[10px] text-fg-muted" />
          </span>
        </div>
        <div className="flex flex-none gap-2">
          <PauseButton />
          <SoundButton />
        </div>
      </header>

      <div className="board-slot">
        <div className="composition">
          <aside className="side" data-side aria-label="Hold and progress">
            <HoldPanel showKey={!touch} />
            <section className="panel flex flex-col gap-3 px-2 py-2.5" aria-label="Progress">
              <LevelBlock compact />
              <LinesBlock compact />
            </section>
          </aside>
          <GameBoard maxCell={44} gestures={touch} />
          <aside className="side" data-side aria-label="Next pieces">
            <NextPanel count={4} />
          </aside>
        </div>
      </div>

      {touch ? (
        <PortraitControls />
      ) : (
        <p className="flex-none text-center text-[10px] tracking-[0.2em] text-fg-dim uppercase">
          ← → move · ↑ rotate · space drop · C hold · P pause
        </p>
      )}
    </main>
  );
}

/** Landscape touch devices: controls sit either side of the board. */
export function HandheldLayout({ inert }: { inert: boolean }) {
  return (
    <main className="layout layout-handheld" inert={inert}>
      <div className="board-slot">
        <div className="composition">
          <aside className="side" data-side aria-label="Hold, progress and movement">
            <div className="flex items-center gap-2">
              <Logo className="logo-glow h-auto w-[60%]" />
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <HoldPanel showKey={false} />
              <TechPanel label="Stats" bodyClassName="grid grid-cols-2 gap-2">
                <LevelBlock compact />
                <LinesBlock compact />
              </TechPanel>
            </div>
            <HandheldControls side="left" />
          </aside>
          <GameBoard maxCell={44} gestures />
          <aside className="side" data-side aria-label="Next pieces, score and rotation">
            <div className="flex items-start gap-2">
              <div className="flex min-w-0 flex-1 flex-col leading-none">
                <span className="stat-label">Score</span>
                <ScoreValue className="mt-1 text-[clamp(16px,2.6vw,24px)] font-semibold text-fg" />
              </div>
              <PauseButton />
              <SoundButton />
            </div>
            <NextPanel count={3} />
            <HandheldControls side="right" />
          </aside>
        </div>
      </div>
    </main>
  );
}
