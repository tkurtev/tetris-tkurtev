"use client";

import { useHud } from "@/hooks/useGame";
import { PiecePreview } from "./PiecePreview";
import { TechPanel } from "./TechPanel";

interface NextPanelProps {
  count: number;
  className?: string;
}

/** Upcoming pieces: the nearest one large, the rest smaller. */
export function NextPanel({ count, className = "" }: NextPanelProps) {
  const next = useHud((s) => s.next);
  const [first, ...rest] = next.slice(0, count);
  return (
    <TechPanel label="Next" meta={String(count).padStart(2, "0")} className={className}>
      <ol className="flex flex-col items-center gap-2" aria-label="Upcoming pieces">
        <li className="grid place-items-center py-1">
          <PiecePreview type={first ?? null} />
        </li>
        {rest.length > 0 && (
          <li className="next-rest w-full">
            <ol className="flex flex-col items-center gap-2.5 border-t border-edge pt-2.5">
              {rest.map((type, i) => (
                <li key={i} className="grid place-items-center">
                  <PiecePreview type={type} />
                </li>
              ))}
            </ol>
          </li>
        )}
      </ol>
    </TechPanel>
  );
}
