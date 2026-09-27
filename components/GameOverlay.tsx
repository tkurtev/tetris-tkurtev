"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { MAX_START_LEVEL, MIN_LEVEL } from "@/game/constants";
import { useController, useHud } from "@/hooks/useGame";
import { useTouchControls } from "@/hooks/useLayout";
import { KeyList } from "./ControlsHelp";
import { Counter, Digits, formatTime } from "./Digits";
import { ChevronLeftIcon, ChevronRightIcon, MenuIcon, PlayIcon, RestartIcon } from "./Icons";
import { Logo } from "./Logo";
import { EffectsToggle, SoundToggle } from "./SystemPanel";

/** Focuses the primary action when an overlay opens. */
function useAutoFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}

function Overlay({
  labelledBy,
  children,
  className = "panel",
}: {
  labelledBy: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className={`overlay-card ${className}`}>{children}</div>
    </div>
  );
}

function StartLevelPicker() {
  const controller = useController();
  const level = useHud((s) => s.settings.startLevel);
  const change = (delta: number) => {
    controller.setStartLevel(level + delta);
    controller.uiSound();
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-[9px] border border-edge bg-ink-900/60 py-1 pr-1 pl-3">
      <span className="text-[11px] font-semibold tracking-[0.18em] text-fg-muted uppercase" id="start-level-label">
        Start level
      </span>
      <div className="flex items-center gap-1" role="group" aria-labelledby="start-level-label">
        <button
          type="button"
          className="icon-btn"
          aria-label="Lower start level"
          onClick={() => change(-1)}
          disabled={level <= MIN_LEVEL}
        >
          <ChevronLeftIcon />
        </button>
        <Digits value={level} width={2} className="w-9 text-center text-lg font-semibold text-fg" />
        <button
          type="button"
          className="icon-btn"
          aria-label="Raise start level"
          onClick={() => change(1)}
          disabled={level >= MAX_START_LEVEL}
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
}

function TouchHint() {
  return (
    <ul className="grid gap-1.5 text-left text-[11px] tracking-[0.08em] text-fg-muted">
      <li>
        <span className="text-fg">Buttons</span> — move, rotate, drop and hold. Hold ◀ ▶ to slide.
      </li>
      <li>
        <span className="text-fg">Board</span> — tap to rotate, drag to move, flick down to drop, flick up to hold.
      </li>
    </ul>
  );
}

function TitleScreen() {
  const controller = useController();
  const best = useHud((s) => s.best);
  const touch = useTouchControls();
  const playRef = useAutoFocus<HTMLButtonElement>();

  return (
    <Overlay labelledBy="title-heading" className="title-card">
      <h1 id="title-heading" className="sr-only">
        TEDDIS
      </h1>
      <div className="title-layout">
        <div className="title-hero">
          <div className="flex w-full flex-col items-center gap-3">
            <Logo className="title-logo logo-glow" shine trace />
            <p className="title-rule w-full">Falling-block protocol</p>
          </div>
          <button
            ref={playRef}
            type="button"
            className="btn btn-primary w-full max-w-72 text-[15px]"
            onClick={controller.play}
          >
            <PlayIcon className="h-4 w-4" />
            Play
          </button>
        </div>

        <div className="title-side">
          <div className="flex w-full flex-col gap-2">
            <StartLevelPicker />
            <div className="grid grid-cols-2 gap-2">
              <SoundToggle />
              <EffectsToggle />
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="stat-label">Best</span>
            <Digits value={best} width={7} className="text-base font-semibold text-fg" />
          </div>

          <div className="title-help panel w-full p-4">{touch ? <TouchHint /> : <KeyList />}</div>

          {!touch && (
            <p className="blink text-[10px] tracking-[0.3em] text-fg-dim uppercase">Press Enter to start</p>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function PauseScreen() {
  const controller = useController();
  const score = useHud((s) => s.score);
  const level = useHud((s) => s.level);
  const lines = useHud((s) => s.lines);
  const touch = useTouchControls();
  const resumeRef = useAutoFocus<HTMLButtonElement>();

  return (
    <Overlay labelledBy="pause-heading">
      <p className="stat-label short:hidden">Session suspended</p>
      <h2
        id="pause-heading"
        className="mt-2 text-[34px] leading-none font-bold tracking-[0.28em] text-fg short:mt-0 short:text-[24px]"
      >
        PAUSED
      </h2>
      <dl className="mt-5 grid grid-cols-3 gap-2 text-center short:mt-3">
        <Stat label="Score" value={<Digits value={score} width={7} />} />
        <Stat label="Level" value={<Digits value={level} width={2} />} />
        <Stat label="Lines" value={<Digits value={lines} width={3} />} />
      </dl>
      <div className="mt-6 flex flex-col gap-2.5 short:mt-3">
        <button ref={resumeRef} type="button" className="btn btn-primary" onClick={controller.resume}>
          <PlayIcon className="h-4 w-4" />
          Resume
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" className="btn px-3" onClick={controller.play}>
            <RestartIcon className="h-4 w-4" />
            Restart
          </button>
          <button type="button" className="btn px-3" onClick={controller.goToMenu}>
            <MenuIcon className="h-4 w-4" />
            Menu
          </button>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2.5">
          <SoundToggle />
          <EffectsToggle />
        </div>
      </div>
      {!touch && (
        <p className="mt-5 text-[10px] tracking-[0.24em] text-fg-dim uppercase short:hidden">P / Esc to resume</p>
      )}
    </Overlay>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-edge bg-ink-900/50 px-2 py-2.5">
      <dt className="stat-label">{label}</dt>
      <dd className="stat-value mt-1 text-[15px]">{value}</dd>
    </div>
  );
}

function GameOverScreen() {
  const controller = useController();
  const result = useHud((s) => s.result);
  const reduced = useHud((s) => s.settings.effects === "reduced");
  const againRef = useAutoFocus<HTMLButtonElement>();
  if (!result) return null;

  return (
    <Overlay labelledBy="over-heading">
      <p className="stat-label short:hidden">Signal lost</p>
      <h2
        id="over-heading"
        className="mt-2 text-[32px] leading-none font-bold tracking-[0.24em] text-fg short:mt-0 short:text-[24px]"
      >
        GAME OVER
      </h2>
      <div className="mt-6 short:mt-3">
        <div className="stat-label">Final score</div>
        <Counter
          value={result.score}
          width={7}
          instant={reduced}
          className="mt-1 block text-[clamp(34px,10vw,48px)] leading-none font-semibold text-fg short:text-[32px]"
        />
        {result.newBest && result.score > 0 ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-[11px] font-semibold tracking-[0.24em] text-gold uppercase">
            New best
          </p>
        ) : (
          <p className="mt-3 text-[11px] tracking-[0.2em] text-fg-dim uppercase">
            Best <Digits value={result.best} width={7} className="text-fg-muted" />
          </p>
        )}
      </div>
      <dl className="mt-6 grid grid-cols-3 gap-2 text-center short:mt-3">
        <Stat label="Level" value={<Digits value={result.level} width={2} />} />
        <Stat label="Lines" value={<Digits value={result.lines} width={3} />} />
        <Stat label="Time" value={<span className="tabular">{formatTime(result.timeMs)}</span>} />
      </dl>
      <div className="mt-6 flex flex-col gap-2.5 short:mt-3 short:grid short:grid-cols-2">
        <button ref={againRef} type="button" className="btn btn-primary" onClick={controller.play}>
          <RestartIcon className="h-4 w-4" />
          Play again
        </button>
        <button type="button" className="btn" onClick={controller.goToMenu}>
          <MenuIcon className="h-4 w-4" />
          Main menu
        </button>
      </div>
    </Overlay>
  );
}

export function GameOverlay() {
  const phase = useHud((s) => s.phase);
  if (phase === "title") return <TitleScreen />;
  if (phase === "paused") return <PauseScreen />;
  if (phase === "over") return <GameOverScreen />;
  return null;
}
