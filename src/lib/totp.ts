import "server-only";
import crypto from "node:crypto";

// Rotating ticket codes: HMAC(APP_SECRET + ticket.qrSecret, timeStep).
// A code is only valid for its 15-second step (plus one step of clock drift),
// so a screenshot stops working within ~30 seconds.
export const STEP_SECONDS = 15;

function appSecret() {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) throw new Error("APP_SECRET missing or too short; see .env.example");
  return s;
}

export function currentStep(now = Date.now()) {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

function codeFor(ticketId: string, qrSecret: string, step: number) {
  const mac = crypto
    .createHmac("sha256", `${appSecret()}:${qrSecret}`)
    .update(`${ticketId}:${step}`)
    .digest();
  // 8-digit dynamic truncation (RFC 4226 style)
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = (mac.readUInt32BE(offset) & 0x7fffffff) % 100_000_000;
  return bin.toString().padStart(8, "0");
}

/** Payload encoded into the QR: TTX1.<ticketId>.<step>.<code> */
export function ticketPayload(ticketId: string, qrSecret: string, now = Date.now()) {
  const step = currentStep(now);
  const code = codeFor(ticketId, qrSecret, step);
  const expiresAt = (step + 1) * STEP_SECONDS * 1000;
  return { payload: `TTX1.${ticketId}.${step}.${code}`, step, expiresAt };
}

export function parsePayload(raw: string) {
  const m = /^TTX1\.([a-z0-9]+)\.(\d+)\.(\d{8})$/i.exec(raw.trim());
  if (!m) return null;
  return { ticketId: m[1], step: Number(m[2]), code: m[3] };
}

/** True when the code matches and its step is the current one (or one step old). */
export function verifyCode(
  ticketId: string,
  qrSecret: string,
  step: number,
  code: string,
  now = Date.now(),
) {
  const cur = currentStep(now);
  if (step > cur || cur - step > 1) return { ok: false as const, reason: "EXPIRED" as const };
  const expected = codeFor(ticketId, qrSecret, step);
  const ok =
    expected.length === code.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code));
  return ok ? { ok: true as const } : { ok: false as const, reason: "BAD_CODE" as const };
}
