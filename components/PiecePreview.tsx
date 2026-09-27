import type { CSSProperties } from "react";
import { shapeCells } from "@/game/pieces";
import type { PieceType } from "@/game/types";
import { PIECE_COLORS, PIECE_NAMES } from "@/lib/theme";

interface PiecePreviewProps {
  type: PieceType | null;
  dim?: boolean;
  className?: string;
}

/** A piece in spawn orientation, centred in a 4×2 cell box sized by the `--pc` CSS variable. */
export function PiecePreview({ type, dim = false, className = "" }: PiecePreviewProps) {
  if (!type) return <div className={`preview ${className}`} aria-hidden="true" />;

  const cells = shapeCells(type, 0);
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const offsetX = (4 - (Math.max(...xs) - minX + 1)) / 2 - minX;
  const offsetY = (2 - (Math.max(...ys) - minY + 1)) / 2 - minY;

  return (
    <div
      className={`preview ${className}`}
      data-dim={dim || undefined}
      role="img"
      aria-label={dim ? `${PIECE_NAMES[type]} (hold used)` : PIECE_NAMES[type]}
      style={{ "--c": PIECE_COLORS[type] } as CSSProperties}
    >
      {cells.map(([x, y]) => (
        <span
          key={`${x}-${y}`}
          className="mini-block"
          style={{ "--x": x + offsetX, "--y": y + offsetY } as CSSProperties}
        />
      ))}
    </div>
  );
}
