"use client";

import { useLayoutEffect, useRef } from "react";

function split(value: number, width: number): [string, string] {
  const digits = String(Math.max(0, Math.floor(value)));
  const pad = Math.max(0, width - digits.length);
  return ["0".repeat(pad), digits];
}

interface DigitsProps {
  value: number;
  /** Minimum digit count; leading zeros are dimmed. */
  width: number;
  className?: string;
}

/** Zero-padded HUD readout. */
export function Digits({ value, width, className = "" }: DigitsProps) {
  const [zeros, digits] = split(value, width);
  return (
    <span className={`tabular ${className}`}>
      <span className="text-fg-dim/45">{zeros}</span>
      {digits}
    </span>
  );
}

interface CounterProps extends DigitsProps {
  /** Skip the count-up animation. */
  instant?: boolean;
}

/**
 * Score readout that counts up to new values. The tween writes straight to
 * the DOM so it never re-renders React while animating.
 */
export function Counter({ value, width, className = "", instant = false }: CounterProps) {
  const zerosRef = useRef<HTMLSpanElement>(null);
  const digitsRef = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);

  useLayoutEffect(() => {
    const paint = (v: number) => {
      const [zeros, digits] = split(v, width);
      if (zerosRef.current) zerosRef.current.textContent = zeros;
      if (digitsRef.current) digitsRef.current.textContent = digits;
    };
    const from = shown.current;
    if (instant || value <= from) {
      shown.current = value;
      paint(value);
      return;
    }
    const start = performance.now();
    const duration = Math.min(650, 180 + Math.sqrt(value - from) * 12);
    let raf = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const v = Math.round(from + (value - from) * (1 - Math.pow(1 - t, 3)));
      shown.current = v;
      paint(v);
      if (t < 1) raf = requestAnimationFrame(step);
    });
    paint(from);
    return () => cancelAnimationFrame(raf);
  }, [value, width, instant]);

  return (
    <span className={`tabular ${className}`}>
      <span className="sr-only">{value}</span>
      <span ref={zerosRef} className="text-fg-dim/45" aria-hidden="true" />
      <span ref={digitsRef} aria-hidden="true" />
    </span>
  );
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
