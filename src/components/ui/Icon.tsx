/** Small line icons in the style of velho.io, used instead of emoji. */
const PATHS = {
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  arrowDown: "M12 5v14M19 12l-7 7-7-7",
  arrowRight: "M5 12h14M12 5l7 7-7 7",
  check: "M5 12.5l4.5 4.5L19 7",
  cross: "M6 6l12 12M18 6L6 18",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6",
  equal: "M5 9h14M5 15h14",
  flame: "M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 1-3 0 2 1 3 2 3 0-3-1-6 1-9z",
  menu: "M4 7h16M4 12h16M4 17h16",
  help: "M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  play: "M8 5.5v13l10-6.5z",
  swap: "M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4",
  calendar: "M4 7h16v13H4zM4 11h16M8 3v4M16 3v4",
  quote: "M6 7h5v5H6zM6 12c0 3-1 4.5-2.5 5.5M14 7h5v5h-5zM14 12c0 3-1 4.5-2.5 5.5",
  target: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM12 12h.01",
  clock: "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const filled = name === "play";
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={name === "more" ? 3.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
