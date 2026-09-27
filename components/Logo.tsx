import { useId } from "react";

type Point = readonly [number, number];

/*
 * TEDDIS wordmark. Letters are built from separate chamfered segments on a
 * 100-unit cap height split into five 16-unit bands with 5-unit gaps, like a
 * segmented display. Coordinates are local to each letter.
 */
const STEM: Point[] = [[6, 0], [16, 0], [16, 100], [6, 100], [0, 94], [0, 6]];

const LETTERS: Array<{ x: number; parts: Point[][] }> = [
  {
    x: 0, // T
    parts: [
      [[0, 0], [76, 0], [76, 8], [68, 16], [8, 16], [0, 8]],
      [[30, 21], [46, 21], [46, 100], [30, 100]],
    ],
  },
  {
    x: 90, // E
    parts: [
      STEM,
      [[21, 0], [62, 0], [62, 8], [54, 16], [21, 16]],
      [[21, 42], [54, 42], [54, 50], [46, 58], [21, 58]],
      [[21, 84], [54, 84], [62, 92], [62, 100], [21, 100]],
    ],
  },
  ...[166, 250].map((x) => ({
    x, // D, D
    parts: [
      STEM,
      [[21, 0], [54, 0], [70, 16], [21, 16]],
      [[54, 21], [70, 21], [70, 79], [54, 79]],
      [[21, 84], [70, 84], [54, 100], [21, 100]],
    ] as Point[][],
  })),
  {
    x: 334, // I
    parts: [[[6, 0], [16, 0], [16, 94], [10, 100], [0, 100], [0, 6]]],
  },
  {
    x: 364, // S
    parts: [
      [[8, 0], [66, 0], [66, 16], [0, 16], [0, 8]],
      [[0, 21], [16, 21], [16, 37], [0, 37]],
      [[0, 42], [66, 42], [66, 58], [0, 58]],
      [[50, 63], [66, 63], [66, 79], [50, 79]],
      [[0, 84], [66, 84], [66, 92], [58, 100], [0, 100]],
    ],
  },
];

const POLYGONS = LETTERS.flatMap(({ x, parts }) =>
  parts.map((part) => part.map(([px, py]) => `${px + x},${py}`).join(" ")),
);

const LOGO_WIDTH = 430;
const LOGO_HEIGHT = 100;

interface LogoProps {
  className?: string;
  /** Animated highlight sweep (title screen). */
  shine?: boolean;
  /** Circuit-trace underline (title screen). */
  trace?: boolean;
}

export function Logo({ className, shine = false, trace = false }: LogoProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const height = trace ? 128 : LOGO_HEIGHT;
  return (
    <svg
      viewBox={`0 0 ${LOGO_WIDTH} ${height}`}
      className={className}
      role="img"
      aria-label="TEDDIS"
      overflow="visible"
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#d8f7ff" />
          <stop offset="1" stopColor="#62d8ea" />
        </linearGradient>
        {shine && (
          <>
            <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${id}-clip`}>
              {POLYGONS.map((points) => (
                <polygon key={points} points={points} />
              ))}
            </clipPath>
          </>
        )}
      </defs>
      <g fill={`url(#${id}-fill)`}>
        {POLYGONS.map((points) => (
          <polygon key={points} points={points} />
        ))}
      </g>
      {shine && (
        <g clipPath={`url(#${id}-clip)`}>
          <rect
            className="logo-shine"
            x="0"
            y="-10"
            width="70"
            height="120"
            fill={`url(#${id}-shine)`}
            opacity="0.55"
          />
        </g>
      )}
      {trace && (
        <g stroke="#3de4f2" strokeWidth="1.5" fill="none" opacity="0.7">
          <path d="M0 116 H150 L158 124 H272 L280 116 H430" />
          <circle cx="158" cy="124" r="2.5" fill="#3de4f2" stroke="none" />
          <circle cx="272" cy="124" r="2.5" fill="#3de4f2" stroke="none" />
          <rect x="207" y="120.5" width="16" height="7" fill="#3de4f2" stroke="none" opacity="0.8" />
        </g>
      )}
    </svg>
  );
}
