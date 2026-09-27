"use client";

import { useEffect, useState } from "react";
import { useController, useHud } from "@/hooks/useGame";

/** Polite live region announcing the few state changes that matter off-screen. */
export function Announcer() {
  const controller = useController();
  const phase = useHud((s) => s.phase);
  const result = useHud((s) => s.result);
  const [levelMessage, setLevelMessage] = useState("");

  useEffect(() => {
    return controller.onUiEvent((event) => {
      if (event.type === "levelUp") setLevelMessage(`Level ${event.level}`);
      else if (event.type === "reset") setLevelMessage("");
    });
  }, [controller]);

  let message = levelMessage;
  if (phase === "paused") message = "Game paused";
  else if (phase === "over" && result) {
    message = `Game over. Final score ${result.score}${result.newBest && result.score > 0 ? ", a new best" : ""}.`;
  }

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}
