import React from "react";

type IconProps = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

function createIcon(paths: React.ReactNode) {
  return function Icon({ size = 18, className, style }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };
}

export const SendIcon = createIcon(
  <>
    <path d="M22 2L11 13" />
    <path d="M22 2l-7 20-4-9-9-4z" />
  </>
);

export const MenuIcon = createIcon(
  <path d="M3 6h18M3 12h18M3 18h18" />
);

export const PanelLeftIcon = createIcon(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
  </>
);

export const SunIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </>
);

export const MoonIcon = createIcon(
  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
);

export const ScrollIcon = createIcon(
  <>
    <path d="M8 3h11a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H8" />
    <path d="M16 21H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h11" />
    <path d="M8 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2" />
    <path d="M16 10a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2" />
  </>
);

export const LanternIcon = createIcon(
  <>
    <path d="M9 3h6" />
    <path d="M10 3v3a4 4 0 0 0-4 4v9a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-9a4 4 0 0 0-4-4V3" />
    <path d="M12 11v5" />
  </>
);

export const ChevIcon = createIcon(
  <path d="M9 6l6 6-6 6" />
);

export function Flourish() {
  return (
    <svg viewBox="0 0 200 14" width={200} height={14} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M0 7 L80 7" />
        <path d="M120 7 L200 7" />
        <circle cx="100" cy="7" r="3" />
        <path d="M92 7 L88 4 M92 7 L88 10 M108 7 L112 4 M108 7 L112 10" />
      </g>
    </svg>
  );
}
