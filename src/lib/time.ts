// Shared time helpers
export const CUTOFF_HOURS = 3;
export const CUTOFF_MS = CUTOFF_HOURS * 60 * 60 * 1000;

export function cutoffFor(kickoff: Date) {
  return new Date(kickoff.getTime() - CUTOFF_MS);
}

export function isPastCutoff(kickoff: Date, now = new Date()) {
  return now.getTime() >= cutoffFor(kickoff).getTime();
}

export function fmtKickoff(d: Date) {
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  });
}

export function fmtTime(d: Date) {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

export function timeUntil(target: Date, now = new Date()) {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "passed";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 48) return `${Math.floor(h / 24)} days`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}
