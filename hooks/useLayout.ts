"use client";

import { useSyncExternalStore } from "react";

/**
 * desktop  — landscape with a mouse/trackpad: three-column console layout.
 * portrait — phones, tablets upright and narrow windows: stacked layout.
 * handheld — landscape touch devices: controls live beside the board.
 */
export type LayoutMode = "desktop" | "portrait" | "handheld";

function computeLayout(): LayoutMode {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (width < 600 || width / height < 0.95) return "portrait";
  if (window.matchMedia("(pointer: coarse)").matches) return "handheld";
  return "desktop";
}

function subscribeLayout(onChange: () => void): () => void {
  const pointer = window.matchMedia("(pointer: coarse)");
  window.addEventListener("resize", onChange);
  pointer.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    pointer.removeEventListener("change", onChange);
  };
}

/** Null during server rendering and hydration, then the live layout mode. */
export function useLayoutMode(): LayoutMode | null {
  return useSyncExternalStore(subscribeLayout, computeLayout, () => null);
}

let touchSeen = false;

function hasTouch(): boolean {
  return (
    touchSeen ||
    window.matchMedia("(any-pointer: coarse)").matches ||
    navigator.maxTouchPoints > 0
  );
}

function subscribeTouch(onChange: () => void): () => void {
  const query = window.matchMedia("(any-pointer: coarse)");
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType === "touch" && !touchSeen) {
      touchSeen = true;
      onChange();
    }
  };
  query.addEventListener("change", onChange);
  window.addEventListener("pointerdown", onPointer, { capture: true, passive: true });
  return () => {
    query.removeEventListener("change", onChange);
    window.removeEventListener("pointerdown", onPointer, { capture: true });
  };
}

/** Whether on-screen touch controls should be offered. */
export function useTouchControls(): boolean {
  return useSyncExternalStore(subscribeTouch, hasTouch, () => false);
}
