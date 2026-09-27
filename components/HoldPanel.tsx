"use client";

import { useHud } from "@/hooks/useGame";
import { PiecePreview } from "./PiecePreview";
import { TechPanel } from "./TechPanel";

export function HoldPanel({ className = "", showKey = true }: { className?: string; showKey?: boolean }) {
  const hold = useHud((s) => s.hold);
  const canHold = useHud((s) => s.canHold);
  return (
    <TechPanel label="Hold" meta={showKey ? "C" : undefined} className={className}>
      <div className="grid place-items-center py-1">
        <PiecePreview type={hold} dim={!canHold} />
      </div>
    </TechPanel>
  );
}
