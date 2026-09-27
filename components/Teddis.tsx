"use client";

import { useEffect, useRef, useState } from "react";
import { GameContext, useController, useHud } from "@/hooks/useGame";
import { useLayoutMode, useTouchControls } from "@/hooks/useLayout";
import { GameController } from "@/lib/controller";
import { Announcer } from "./Announcer";
import { Background } from "./Background";
import { GameOverlay } from "./GameOverlay";
import { DesktopLayout, HandheldLayout, PortraitLayout } from "./Layouts";
import { Logo } from "./Logo";

function Shell() {
  const controller = useController();
  const layout = useLayoutMode();
  const touch = useTouchControls();
  const phase = useHud((s) => s.phase);
  const effects = useHud((s) => s.settings.effects);
  const overlayOpen = phase === "title" || phase === "paused" || phase === "over";

  // Rotating a device mid-game moves the controls; pause rather than surprise the player.
  const previousLayout = useRef(layout);
  useEffect(() => {
    if (previousLayout.current !== null && layout !== previousLayout.current) controller.autoPause();
    previousLayout.current = layout;
  }, [layout, controller]);

  let content;
  if (layout === null || phase === "loading") {
    content = (
      <div className="splash">
        <Logo className="logo-glow w-[min(60vw,280px)] opacity-80" />
      </div>
    );
  } else if (layout === "desktop") {
    content = <DesktopLayout inert={overlayOpen} />;
  } else if (layout === "handheld") {
    content = <HandheldLayout inert={overlayOpen} />;
  } else {
    content = <PortraitLayout inert={overlayOpen} touch={touch} />;
  }

  return (
    <div className="app" data-effects={effects} data-overlay={overlayOpen || undefined}>
      <Background />
      {content}
      {layout !== null && <GameOverlay />}
      <Announcer />
    </div>
  );
}

/** Root client component: owns the game controller for the lifetime of the page. */
export default function Teddis() {
  const [controller] = useState(() => new GameController());
  useEffect(() => controller.mount(), [controller]);
  return (
    <GameContext.Provider value={controller}>
      <Shell />
    </GameContext.Provider>
  );
}
