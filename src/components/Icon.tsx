const paths: Record<string, string> = {
  ticket: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V7Z M14 5v14",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M20 20l-4-4",
  tag: "M3 12V4h8l9 9-8 8-9-9Z M7.5 7.5h.01",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Z M9 8h6 M9 12h6",
  bell: "M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7 M10 20a2 2 0 0 0 4 0",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z M9 12l2 2 4-4",
  chart: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  scan: "M4 8V5a1 1 0 0 1 1-1h3 M16 4h3a1 1 0 0 1 1 1v3 M20 16v3a1 1 0 0 1-1 1h-3 M8 20H5a1 1 0 0 1-1-1v-3 M4 12h16",
  flag: "M5 21V4 M5 4h11l-2 4 2 4H5",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  check: "M5 12l5 5 9-10",
  lock: "M6 11h12v10H6V11Z M8 11V7a4 4 0 0 1 8 0v4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  alert: "M12 3l10 18H2L12 3Z M12 10v4 M12 17h.01",
  copy: "M8 8h12v12H8V8Z M16 8V4H4v12h4",
};

export function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof paths | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name] ?? paths.ticket} />
    </svg>
  );
}
