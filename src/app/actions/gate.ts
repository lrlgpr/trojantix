"use server";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { hit } from "@/lib/rateLimit";
import { parsePayload, verifyCode } from "@/lib/totp";
import { logActivity, notify } from "@/lib/notify";
import { clientInfo } from "@/lib/request";

export type ScanResult = {
  result: "VALID" | "INVALID" | "ALREADY_USED";
  reason: string;
  game?: string;
  seat?: string;
  studentIdLast4?: string;
  usedAt?: string;
};

/** Gate staff validates a scanned or pasted rotating code. */
export async function validateScanAction(raw: string): Promise<ScanResult> {
  const staff = await requireAdmin();
  const rl = hit("gate", staff.id);
  if (!rl.ok) return { result: "INVALID", reason: "Scanner rate limit hit. Wait a moment." };

  const parsed = parsePayload(String(raw ?? ""));
  if (!parsed) return { result: "INVALID", reason: "Not a TrojanTix ticket code." };

  const t = await db.ticket.findUnique({
    where: { id: parsed.ticketId },
    include: { game: true, owner: true, listings: { where: { status: { in: ["PAYMENT_HELD", "DISPUTED"] } } } },
  });
  if (!t) return { result: "INVALID", reason: "Unknown ticket." };
  const info = {
    game: `USC vs. ${t.game.opponent}`,
    seat: `Sec ${t.section} · Row ${t.row} · Seat ${t.seat}`,
  };

  const check = verifyCode(t.id, t.qrSecret, parsed.step, parsed.code);
  if (!check.ok) {
    return {
      result: "INVALID",
      ...info,
      reason: check.reason === "EXPIRED"
        ? "Code expired. This looks like a screenshot or an old code. Ask the student to open the live ticket."
        : "Code doesn't match. The ticket was transferred to someone else or the code was forged.",
    };
  }
  if (t.listings.length) return { result: "INVALID", ...info, reason: "Ticket is locked: its resale is in escrow." };
  if (t.usedAt) {
    return { result: "ALREADY_USED", ...info, usedAt: t.usedAt.toISOString(), reason: "This ticket has already entered the stadium." };
  }

  // Atomic: only one scan can win, even if two gates scan at the same instant.
  const { count } = await db.ticket.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  if (!count) return { result: "ALREADY_USED", ...info, reason: "This ticket has already entered the stadium." };

  // A used ticket can't be resold.
  await db.listing.updateMany({
    where: { ticketId: t.id, status: "LISTED" },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Ticket scanned at gate" },
  });
  const ctx = await clientInfo();
  await logActivity({ userId: t.ownerId, action: "TICKET_SCANNED", detail: `${info.game} at gate`, ...ctx });
  await notify(t.ownerId, "SCANNED", "Ticket scanned at the gate",
    `${info.game} entered the stadium. If this wasn't you, report it to the Ticket Office now.`);
  return { result: "VALID", ...info, studentIdLast4: t.owner.studentId.slice(-4), reason: "Admit one. Check student ID card matches." };
}
