"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { GameController, HudState } from "@/lib/controller";

export const GameContext = createContext<GameController | null>(null);

export function useController(): GameController {
  const controller = useContext(GameContext);
  if (!controller) throw new Error("useController must be used inside <GameContext.Provider>");
  return controller;
}

/** Subscribes to one slice of the HUD state; re-renders only when that slice changes. */
export function useHud<T>(selector: (state: HudState) => T): T {
  const controller = useController();
  const read = () => selector(controller.getSnapshot());
  return useSyncExternalStore(controller.subscribe, read, read);
}
