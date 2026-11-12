import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { clearLimit, hit } from "./rateLimit";
import { logActivity, notify } from "./notify";
import { clientInfo, deviceLabel } from "./request";

const SESSION_COOKIE = "ttx_session";
const CHALLENGE_COOKIE = "ttx_challenge";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CODE_ATTEMPTS = 5;

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

// Demo only: the "phone" that receives 2FA codes. Real systems would send via Duo/SMS.
const g = globalThis as unknown as { __ttxCodes?: Map<string, string> };
const demoInbox = (g.__ttxCodes ??= new Map<string, string>());

export function demoCodeFor(challengeId: string) {
  return demoInbox.get(challengeId) ?? null;
}

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export type LoginResult = { ok: true } | { ok: false; error: string };

/** Step 1 of simulated USC SSO: email + password. */
export async function startLogin(rawEmail: string, password: string): Promise<LoginResult> {
  const email = rawEmail.trim().toLowerCase();
  const { ip, userAgent } = await clientInfo();

  const limit = hit("login", `${ip}|${email}`);
  const ipLimit = hit("loginIp", ip);
  if (!limit.ok || !ipLimit.ok) {
    const retryIn = !limit.ok ? limit.retryIn : !ipLimit.ok ? ipLimit.retryIn : 60;
    await logActivity({ email, action: "LOGIN_RATE_LIMITED", ip, userAgent, suspicious: true,
      detail: "Too many sign-in attempts" });
    return { ok: false, error: `Too many sign-in attempts. Try again in ${Math.ceil(retryIn / 60)} min.` };
  }

  if (!/^[a-z0-9._%+-]+@usc\.edu$/.test(email)) {
    await logActivity({ email, action: "LOGIN_REJECTED", ip, userAgent, detail: "Non-USC email" });
    return { ok: false, error: "Only @usc.edu accounts can use TrojanTix." };
  }

  const user = await db.user.findUnique({ where: { email } });
  // Always run bcrypt so response time doesn't reveal whether the account exists.
  const okPw = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !okPw) {
    await logActivity({ userId: user?.id, email, action: "LOGIN_FAILED", ip, userAgent,
      detail: "Wrong USC NetID or password", suspicious: !!user });
    return { ok: false, error: "Incorrect USC email or password." };
  }

  if (!user.enrolled) {
    await logActivity({ userId: user.id, email, action: "LOGIN_REJECTED", ip, userAgent,
      detail: "Not currently enrolled" });
    return {
      ok: false,
      error: "Your USC account is not currently enrolled. TrojanTix is limited to enrolled students.",
    };
  }

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const challenge = await db.loginChallenge.create({
    data: {
      userId: user.id,
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      ip,
      userAgent,
    },
  });
  demoInbox.set(challenge.id, code);
  console.log(`\n[2FA DEMO] Verification code for ${email}: ${code}\n`);

  (await cookies()).set(CHALLENGE_COOKIE, challenge.id, { ...cookieOpts, maxAge: CHALLENGE_TTL_MS / 1000 });
  return { ok: true };
}

export async function pendingChallenge() {
  const id = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!id) return null;
  const ch = await db.loginChallenge.findUnique({ where: { id }, include: { user: true } });
  if (!ch || ch.consumed || ch.expiresAt < new Date()) return null;
  return ch;
}

/** Step 2: verify the 6-digit code, then create a session. */
export async function verifyLogin(code: string): Promise<LoginResult> {
  const { ip, userAgent } = await clientInfo();
  const ch = await pendingChallenge();
  if (!ch) return { ok: false, error: "Your sign-in expired. Please start again." };

  const limit = hit("twoFactor", ch.userId);
  if (!limit.ok) return { ok: false, error: `Too many attempts. Try again in ${limit.retryIn}s.` };

  if (ch.attempts >= MAX_CODE_ATTEMPTS) {
    await db.loginChallenge.update({ where: { id: ch.id }, data: { consumed: true } });
    return { ok: false, error: "Too many wrong codes. Please sign in again." };
  }

  const clean = code.replace(/\D/g, "");
  const good =
    clean.length === 6 &&
    crypto.timingSafeEqual(Buffer.from(sha256(clean)), Buffer.from(ch.codeHash));
  if (!good) {
    await db.loginChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
    await logActivity({ userId: ch.userId, email: ch.user.email, action: "2FA_FAILED", ip, userAgent,
      suspicious: ch.attempts + 1 >= 3, detail: `Wrong verification code (attempt ${ch.attempts + 1})` });
    return { ok: false, error: `That code is incorrect. ${MAX_CODE_ATTEMPTS - ch.attempts - 1} attempts left.` };
  }

  await db.loginChallenge.update({ where: { id: ch.id }, data: { consumed: true } });
  demoInbox.delete(ch.id);
  // Successful sign-in: reset this account's failed-attempt window.
  clearLimit("login", `${ch.ip}|${ch.user.email}`);
  clearLimit("twoFactor", ch.userId);

  // Account-takeover signal: is this a device/IP we've seen this user sign in from?
  const known = await db.activityLog.findFirst({
    where: { userId: ch.userId, action: "LOGIN", userAgent, ip },
  });
  const anyPrior = await db.activityLog.count({ where: { userId: ch.userId, action: "LOGIN" } });
  const newDevice = !known && anyPrior > 0;

  const token = crypto.randomBytes(32).toString("base64url");
  await db.session.create({
    data: { id: sha256(token), userId: ch.userId, ip, userAgent, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  await logActivity({ userId: ch.userId, email: ch.user.email, action: "LOGIN", ip, userAgent,
    suspicious: newDevice,
    detail: newDevice ? `New device: ${deviceLabel(userAgent)}` : `Signed in with 2FA (${deviceLabel(userAgent)})` });
  if (newDevice) {
    await notify(ch.userId, "SECURITY", "New sign-in to your account",
      `${deviceLabel(userAgent)} from IP ${ip}. If this wasn't you, sign out all devices from your Activity page and report it.`);
  }

  const jar = await cookies();
  jar.delete(CHALLENGE_COOKIE);
  jar.set(SESSION_COOKIE, token, { ...cookieOpts, maxAge: SESSION_TTL_MS / 1000 });
  return { ok: true };
}

/** Current signed-in user, or null. Memoized per request. */
export const getUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  if (!session.user.enrolled) return null; // enrollment revoked mid-session
  return { ...session.user, sessionId: session.id };
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/tickets");
  return user;
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const s = await db.session.findUnique({ where: { id: sha256(token) } });
    if (s) {
      await db.session.delete({ where: { id: s.id } });
      const { ip, userAgent } = await clientInfo();
      await logActivity({ userId: s.userId, action: "LOGOUT", ip, userAgent });
    }
  }
  jar.delete(SESSION_COOKIE);
}

export async function logoutOtherSessions() {
  const user = await requireUser();
  const { count } = await db.session.deleteMany({
    where: { userId: user.id, NOT: { id: user.sessionId } },
  });
  const { ip, userAgent } = await clientInfo();
  await logActivity({ userId: user.id, action: "SIGNED_OUT_OTHER_DEVICES", ip, userAgent,
    detail: `${count} other session(s) ended` });
  return count;
}
