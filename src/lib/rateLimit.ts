import "server-only";

// Simple in-memory sliding-window limiter. Fine for a single local server;
// a real deployment would back this with Redis.
type Bucket = number[];
const g = globalThis as unknown as { __ttxRate?: Map<string, Bucket> };
const buckets = (g.__ttxRate ??= new Map<string, Bucket>());

export const LIMITS = {
  login: { max: 5, windowMs: 5 * 60_000 }, // per account + IP
  loginIp: { max: 20, windowMs: 5 * 60_000 }, // per IP across all accounts
  twoFactor: { max: 8, windowMs: 5 * 60_000 },
  purchase: { max: 5, windowMs: 60_000 },
  listing: { max: 10, windowMs: 60_000 },
  gate: { max: 60, windowMs: 60_000 },
  report: { max: 5, windowMs: 10 * 60_000 },
} as const;

export type LimitName = keyof typeof LIMITS;

/** Records a hit and returns whether it is allowed plus seconds until retry. */
export function hit(name: LimitName, key: string) {
  const { max, windowMs } = LIMITS[name];
  const now = Date.now();
  const id = `${name}:${key}`;
  const recent = (buckets.get(id) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    buckets.set(id, recent);
    const retryIn = Math.ceil((windowMs - (now - recent[0])) / 1000);
    return { ok: false as const, retryIn };
  }
  recent.push(now);
  buckets.set(id, recent);
  return { ok: true as const, remaining: max - recent.length };
}

export function clearLimit(name: LimitName, key: string) {
  buckets.delete(`${name}:${key}`);
}

export function resetLimits() {
  buckets.clear();
}
