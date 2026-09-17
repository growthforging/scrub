/**
 * Icon set — drawn on a 24 grid with a 1.6 stroke, round caps and joins, so
 * everything optically matches at 14–20px. Emoji were doing this job before;
 * they render differently on every surface and can't take `currentColor`.
 */

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function Svg({
  size = 16,
  className,
  strokeWidth = 1.6,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const MapPin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="2.8" />
  </Svg>
);

export const Camera = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8.5A2 2 0 0 1 5 6.5h2l1.4-2.1A1 1 0 0 1 9.2 4h5.6a1 1 0 0 1 .8.4L17 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <circle cx="12" cy="13" r="3.4" />
  </Svg>
);

export const Clock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.2l3.2 2" />
  </Svg>
);

export const Wrench = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.6 6.4a4.5 4.5 0 0 0 5.8 5.8l-8 8a2.6 2.6 0 0 1-3.7-3.7Z" />
    <path d="m6.8 14.8-3-3a4.5 4.5 0 0 1 5.8-5.8" />
  </Svg>
);

export const ShieldCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 5 5.8v5.4c0 4.3 2.9 8.3 7 9.5 4.1-1.2 7-5.2 7-9.5V5.8Z" />
    <path d="m9 12 2.2 2.2L15.4 10" />
  </Svg>
);

export const ShieldAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 5 5.8v5.4c0 4.3 2.9 8.3 7 9.5 4.1-1.2 7-5.2 7-9.5V5.8Z" />
    <path d="M12 8.4v4" />
    <path d="M12 15.6h.01" />
  </Svg>
);

export const Lock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.4" />
    <path d="M8.2 10.5V7.6a3.8 3.8 0 0 1 7.6 0v2.9" />
  </Svg>
);

export const X = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
  </Svg>
);

export const ChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
  </Svg>
);

export const FolderOpen = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8V6.5a1.8 1.8 0 0 1 1.8-1.8h4L11 7h8.2A1.8 1.8 0 0 1 21 8.8V10" />
    <path d="M3 8h18.2a1 1 0 0 1 .97 1.25l-2.1 8.3a1.8 1.8 0 0 1-1.75 1.35H4.8A1.8 1.8 0 0 1 3 17.1Z" />
  </Svg>
);

export const ImageIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.6" />
    <circle cx="9" cy="9.8" r="1.6" />
    <path d="m4.4 16.6 4-3.8a1.8 1.8 0 0 1 2.5 0l3 2.9" />
    <path d="m14.8 14.2 1.6-1.5a1.8 1.8 0 0 1 2.5 0l1.6 1.5" />
  </Svg>
);

export const Film = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.6" />
    <path d="M8 4.5v15M16 4.5v15M3.5 12h17M3.5 8.2h4.5M3.5 15.8h4.5M16 8.2h4.5M16 15.8h4.5" />
  </Svg>
);

export const Copy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2.2" />
    <path d="M15 6.4A2.4 2.4 0 0 0 12.6 4H6.4A2.4 2.4 0 0 0 4 6.4v6.2A2.4 2.4 0 0 0 6.4 15" />
  </Svg>
);

export const ArrowUpRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 16 16 8M9.4 8H16v6.6" />
  </Svg>
);

export const Sun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.6v2.1M12 19.3v2.1M4.4 4.4l1.5 1.5M18.1 18.1l1.5 1.5M2.6 12h2.1M19.3 12h2.1M4.4 19.6l1.5-1.5M18.1 5.9l1.5-1.5" />
  </Svg>
);

export const Moon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 13.6A8.2 8.2 0 0 1 10.4 4a8.4 8.4 0 1 0 9.6 9.6Z" />
  </Svg>
);

export const Monitor = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4.5" width="18" height="12" rx="2.2" />
    <path d="M9 20h6M12 16.5V20" />
  </Svg>
);

export const Plus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Svg>
);

export const Trash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 7h15M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7" />
    <path d="M6.4 7l.8 11.4A1.7 1.7 0 0 0 8.9 20h6.2a1.7 1.7 0 0 0 1.7-1.6L17.6 7" />
  </Svg>
);

export const Spinner = (p: IconProps) => (
  <Svg {...p} className={`spin ${p.className ?? ""}`}>
    <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" opacity="0.9" />
  </Svg>
);

export const Inbox = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 13.5h4l1.4 2.6h6.2l1.4-2.6h4" />
    <path d="M6.3 4.9h11.4a1.8 1.8 0 0 1 1.66 1.1l2.14 5.1v6.1a2.3 2.3 0 0 1-2.3 2.3H4.8a2.3 2.3 0 0 1-2.3-2.3v-6.1l2.14-5.1a1.8 1.8 0 0 1 1.66-1.1Z" />
  </Svg>
);

export const Search = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m15.8 15.8 4 4" />
  </Svg>
);

export const Layers = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3.5 8.5 4.4-8.5 4.4-8.5-4.4Z" />
    <path d="m3.5 12.4 8.5 4.4 8.5-4.4M3.5 16.6l8.5 4.4 8.5-4.4" />
  </Svg>
);

/**
 * The check is drawn rather than faded in: the stroke length (~20 units for
 * this path) is the dasharray, so `data-state="in"` sweeps it on.
 */
export const DrawnCheck = ({
  size = 16,
  className,
  strokeWidth = 2,
  state = "in",
}: IconProps & { state?: "in" | "out" }) => (
  <span className={`drawn-check ${className ?? ""}`} data-state={state}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  </span>
);
