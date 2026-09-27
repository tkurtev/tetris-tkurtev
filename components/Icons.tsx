import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 9l7 7 7-7" />
  </Icon>
);

export const HardDropIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 4l6 6 6-6" />
    <path d="M6 10l6 6 6-6" />
    <path d="M5 20h14" />
  </Icon>
);

export const RotateCwIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12a8 8 0 1 1-2.35-5.66" />
    <path d="M20 4v5h-5" />
  </Icon>
);

export const RotateCcwIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12a8 8 0 1 0 2.35-5.66" />
    <path d="M4 4v5h5" />
  </Icon>
);

export const HoldIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M9 5.5h7.5a2 2 0 0 1 2 2V15" />
    <path d="M16.5 12.5l2 2.5 2-2.5" />
  </Icon>
);

export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 5v14M16 5v14" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p} fill="currentColor" stroke="none">
    <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />
  </Icon>
);

export const SoundOnIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6" />
    <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Icon>
);

export const SoundOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </Icon>
);

export const RestartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12a8 8 0 1 0 2.35-5.66L4 8.5" />
    <path d="M4 3.5v5h5" />
  </Icon>
);

export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 6l-6 6 6 6" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 6l6 6-6 6" />
  </Icon>
);
