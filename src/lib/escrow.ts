import "server-only";
import crypto from "node:crypto";
import { db } from "./db";
import { feeFor, usd } from "./money";
import { CUTOFF_MS, isPastCutoff } from "./time";
import { logActivity, notify } from "./notify";
import { capturePayment, refundPayment } from "./stripe";
import type { ListingStatus } from "@/generated/prisma/client";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const ACTIVE: ListingStatus[] = ["LISTED", "PAYMENT_HELD", "TRANSFERRED", "DISPUTED"];
const MIN_PRICE_CENTS = 100;
const newSecret = () => crypto.randomBytes(20).toString("hex");

type Ctx = { ip: string; userAgent: string };

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export async function createListing(
  sellerId: string,
  ticketId: string,
  priceCentsRaw: unknown,
  ctx: Ctx,
): Promise<Result<{ listingId: string }>> {
  const priceCents = Number(priceCentsRaw);
  if (!Number.isInteger(priceCents) || priceCents < MIN_PRICE_CENTS) {
    return { ok: false, error: "Enter a valid price of at least $1.00." };
  }

  const ticket = await db.ticket.findUnique({ where: { id: ticketId }, include: { game: true } });
  if (!ticket || ticket.ownerId !== sellerId) return { ok: false, error: "That ticket isn't in your account." };
  if (ticket.usedAt) return { ok: false, error: "This ticket has already been scanned at the gate." };
  if (isPastCutoff(ticket.game.kickoff)) {
    return { ok: false, error: "Listings close 3 hours before kickoff. This game is past the cutoff." };
  }
  // Face-value cap: enforced here on the server no matter what the form sent.
  if (priceCents > ticket.faceValueCents) {
    return { ok: false, error: `Price can't exceed face value (${usd(ticket.faceValueCents)}).` };
  }
  const existing = await db.listing.findFirst({ where: { ticketId, status: { in: ACTIVE } } });
  if (existing) return { ok: false, error: "This ticket already has an active listing." };

  const listing = await db.listing.create({
    data: {
      ticketId,
      gameId: ticket.gameId,
      sellerId,
      priceCents,
      feeCents: feeFor(priceCents), // never trust a client-computed fee
    },
  });
  await logActivity({ userId: sellerId, action: "LISTED",
    detail: `vs. ${ticket.game.opponent} for ${usd(priceCents)}`, ...ctx });
  await notify(sellerId, "LISTED", "Your ticket was listed",
    `vs. ${ticket.game.opponent} (Sec ${ticket.section}) listed for ${usd(priceCents)}. Not you? Cancel it and secure your account.`);
  return { ok: true, listingId: listing.id };
}

export async function cancelListing(userId: string, listingId: string, ctx: Ctx): Promise<Result> {
  const l = await db.listing.findUnique({ where: { id: listingId }, include: { game: true } });
  if (!l || l.sellerId !== userId) return { ok: false, error: "Listing not found." };
  const { count } = await db.listing.updateMany({
    where: { id: listingId, status: "LISTED" },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Cancelled by seller" },
  });
  if (!count) return { ok: false, error: "Only unsold listings can be cancelled." };
  await logActivity({ userId, action: "LISTING_CANCELLED", detail: `vs. ${l.game.opponent}`, ...ctx });
  await notify(userId, "CANCELLED", "Listing cancelled", `Your vs. ${l.game.opponent} listing was removed.`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Buying
// ---------------------------------------------------------------------------

/** Why this buyer can't buy this listing (null = allowed). Used by both UI and server action. */
export async function buyBlockReason(buyerId: string, listingId: string): Promise<string | null> {
  const l = await db.listing.findUnique({ where: { id: listingId }, include: { game: true, ticket: true } });
  if (!l || l.status !== "LISTED") return "This listing is no longer available.";
  if (l.sellerId === buyerId) return "This is your own listing.";
  if (isPastCutoff(l.game.kickoff)) return "Sales close 3 hours before kickoff.";
  if (l.ticket.ownerId !== l.sellerId || l.ticket.usedAt) return "This ticket is no longer valid.";
  const holds = await db.ticket.findFirst({ where: { ownerId: buyerId, gameId: l.gameId } });
  if (holds) return "You already hold a ticket for this game (one per student).";
  const pending = await db.listing.findFirst({
    where: { buyerId, gameId: l.gameId, status: { in: ["PAYMENT_HELD", "DISPUTED"] } },
  });
  if (pending) return "You already have a purchase in progress for this game.";
  return null;
}

/**
 * Atomically moves LISTED -> PAYMENT_HELD. If another buyer got there first,
 * the update matches 0 rows and the caller must release the payment.
 */
export async function markPaymentHeld(
  listingId: string,
  buyerId: string,
  provider: "stripe" | "mock",
  paymentRef: string,
  ctx: Ctx,
): Promise<Result> {
  const block = await buyBlockReason(buyerId, listingId);
  if (block) return { ok: false, error: block };

  const { count } = await db.listing.updateMany({
    where: { id: listingId, status: "LISTED", buyerId: null },
    data: { status: "PAYMENT_HELD", buyerId, paymentProvider: provider, paymentRef, heldAt: new Date() },
  });
  if (!count) return { ok: false, error: "Someone else just bought this ticket. You were not charged." };

  const l = await db.listing.findUniqueOrThrow({ where: { id: listingId }, include: { game: true } });
  await logActivity({ userId: buyerId, action: "PURCHASED",
    detail: `vs. ${l.game.opponent} for ${usd(l.priceCents)} (held in escrow)`, ...ctx });
  await logActivity({ userId: l.sellerId, action: "SOLD", detail: `vs. ${l.game.opponent} for ${usd(l.priceCents)}` });
  await notify(l.sellerId, "SOLD", "Your ticket sold — payment held",
    `A verified student paid ${usd(l.priceCents)} for vs. ${l.game.opponent}. The money is in escrow. Send the transfer to get paid.`);
  await notify(buyerId, "PAYMENT_HELD", "Payment held in escrow",
    `${usd(l.priceCents)} for vs. ${l.game.opponent} is held. The seller is paid only after the ticket reaches your account.`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Transfer & completion
// ---------------------------------------------------------------------------

export async function sendTransfer(sellerId: string, listingId: string, ctx: Ctx): Promise<Result> {
  const l = await db.listing.findUnique({ where: { id: listingId }, include: { game: true, ticket: true } });
  if (!l || l.sellerId !== sellerId) return { ok: false, error: "Order not found." };
  if (l.status !== "PAYMENT_HELD" || !l.buyerId) return { ok: false, error: "This order isn't waiting on a transfer." };
  if (l.ticket.ownerId !== sellerId || l.ticket.usedAt) return { ok: false, error: "Ticket is no longer valid." };

  const buyerId = l.buyerId;
  await db.$transaction(async (tx) => {
    const { count } = await tx.listing.updateMany({
      where: { id: listingId, status: "PAYMENT_HELD" },
      data: { status: "TRANSFERRED", transferredAt: new Date() },
    });
    if (!count) throw new Error("state changed");
    // Move the ticket and rotate its QR secret so any code the seller kept stops working.
    await tx.ticket.update({
      where: { id: l.ticketId },
      data: { ownerId: buyerId, qrSecret: newSecret(), transferCount: { increment: 1 } },
    });
  });

  await logActivity({ userId: sellerId, action: "TRANSFERRED_OUT", detail: `vs. ${l.game.opponent}`, ...ctx });
  await logActivity({ userId: buyerId, action: "TRANSFERRED_IN", detail: `vs. ${l.game.opponent}` });
  await notify(sellerId, "TRANSFERRED", "Ticket transferred",
    `Your vs. ${l.game.opponent} ticket left your account. You'll be paid when the buyer confirms (or automatically at kickoff).`);
  await notify(buyerId, "TRANSFERRED", "Your ticket arrived",
    `The vs. ${l.game.opponent} ticket is now in My Tickets. Check it, then confirm to release payment.`);
  return { ok: true };
}

async function completeOrder(listingId: string, reason: string) {
  const l = await db.listing.findUniqueOrThrow({ where: { id: listingId }, include: { game: true } });
  await capturePayment(l.paymentProvider, l.paymentRef);
  const { count } = await db.listing.updateMany({
    where: { id: listingId, status: { in: ["TRANSFERRED", "DISPUTED"] } },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  if (!count) return false;
  const payout = l.priceCents - l.feeCents;
  await logActivity({ userId: l.sellerId, action: "PAYOUT", detail: `${usd(payout)} for vs. ${l.game.opponent} (${reason})` });
  await notify(l.sellerId, "PAYOUT", "Payout released",
    `${usd(payout)} (${usd(l.priceCents)} minus ${usd(l.feeCents)} fee) for vs. ${l.game.opponent} is on its way.`);
  if (l.buyerId) await notify(l.buyerId, "COMPLETED", "Order complete", `vs. ${l.game.opponent}: all done. Enjoy the game!`);
  return true;
}

export async function confirmReceipt(buyerId: string, listingId: string, ctx: Ctx): Promise<Result> {
  const l = await db.listing.findUnique({ where: { id: listingId }, include: { ticket: true } });
  if (!l || l.buyerId !== buyerId) return { ok: false, error: "Order not found." };
  if (l.status !== "TRANSFERRED") return { ok: false, error: "The ticket hasn't been transferred yet." };
  if (l.ticket.ownerId !== buyerId) return { ok: false, error: "Ticket isn't in your account." };
  if (!(await completeOrder(listingId, "buyer confirmed"))) return { ok: false, error: "Order already updated." };
  await logActivity({ userId: buyerId, action: "CONFIRMED_RECEIPT", detail: listingId, ...ctx });
  return { ok: true };
}

export async function openDispute(userId: string, listingId: string, reasonRaw: string, ctx: Ctx): Promise<Result> {
  const reason = reasonRaw.trim().slice(0, 500);
  if (reason.length < 10) return { ok: false, error: "Please describe the problem (at least 10 characters)." };
  const l = await db.listing.findUnique({ where: { id: listingId }, include: { game: true } });
  if (!l || (l.buyerId !== userId && l.sellerId !== userId)) return { ok: false, error: "Order not found." };
  const { count } = await db.listing.updateMany({
    where: { id: listingId, status: { in: ["PAYMENT_HELD", "TRANSFERRED"] } },
    data: { status: "DISPUTED", disputedAt: new Date(), disputeReason: reason },
  });
  if (!count) return { ok: false, error: "Disputes can only be opened while money is in escrow." };
  await logActivity({ userId, action: "DISPUTE_OPENED", detail: `vs. ${l.game.opponent}`, ...ctx });
  for (const id of [l.sellerId, l.buyerId].filter(Boolean) as string[]) {
    await notify(id, "DISPUTE", "Dispute opened",
      `The vs. ${l.game.opponent} order is frozen. Funds stay in escrow until the Ticket Office reviews it.`);
  }
  return { ok: true };
}

/** Ticket Office decision on a dispute. */
export async function resolveDispute(
  adminId: string,
  listingId: string,
  decision: "refund" | "release",
  ctx: Ctx,
): Promise<Result> {
  const l = await db.listing.findUnique({ where: { id: listingId }, include: { game: true, ticket: true } });
  if (!l || l.status !== "DISPUTED" || !l.buyerId) return { ok: false, error: "No open dispute." };
  const buyerId = l.buyerId;

  if (decision === "refund") {
    await refundPayment(l.paymentProvider, l.paymentRef);
    await db.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id: listingId },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Dispute resolved: buyer refunded" },
      });
      // If the ticket had moved, send it back to the seller with a fresh secret.
      if (l.ticket.ownerId === buyerId) {
        await tx.ticket.update({ where: { id: l.ticketId }, data: { ownerId: l.sellerId, qrSecret: newSecret() } });
      }
    });
    await notify(buyerId, "REFUND", "Refund issued", `You were refunded ${usd(l.priceCents)} for vs. ${l.game.opponent}.`);
    await notify(l.sellerId, "DISPUTE", "Dispute resolved", `The vs. ${l.game.opponent} sale was reversed by the Ticket Office.`);
  } else {
    if (l.ticket.ownerId !== buyerId) {
      await db.ticket.update({
        where: { id: l.ticketId },
        data: { ownerId: buyerId, qrSecret: newSecret(), transferCount: { increment: 1 } },
      });
      await db.listing.update({ where: { id: listingId }, data: { transferredAt: new Date() } });
    }
    await completeOrder(listingId, "dispute resolved");
  }
  await logActivity({ userId: adminId, action: "DISPUTE_RESOLVED", detail: `${decision} · vs. ${l.game.opponent}`, ...ctx });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Transfer cutoff sweep
// ---------------------------------------------------------------------------

const g = globalThis as unknown as { __ttxSweepAt?: number };

/**
 * - Unsold listings auto-cancel 3 hours before kickoff.
 * - Paid-but-not-transferred orders are refunded at the cutoff.
 * - Transferred orders the buyer never confirmed auto-complete at kickoff.
 */
export async function runCutoffSweep(force = false) {
  const nowMs = Date.now();
  if (!force && g.__ttxSweepAt && nowMs - g.__ttxSweepAt < 5_000) return { cancelled: 0, refunded: 0, completed: 0 };
  g.__ttxSweepAt = nowMs;
  const boundary = new Date(nowMs + CUTOFF_MS);
  const now = new Date(nowMs);

  const unsold = await db.listing.findMany({
    where: { status: "LISTED", game: { kickoff: { lte: boundary } } },
    include: { game: true },
  });
  for (const l of unsold) {
    const { count } = await db.listing.updateMany({
      where: { id: l.id, status: "LISTED" },
      data: { status: "CANCELLED", cancelledAt: now, cancelReason: "Transfer cutoff reached (3 hours before kickoff)" },
    });
    if (count) {
      await notify(l.sellerId, "CANCELLED", "Listing auto-cancelled",
        `Your vs. ${l.game.opponent} listing didn't sell before the 3-hour cutoff. The ticket stays in your account.`);
      await logActivity({ userId: l.sellerId, action: "LISTING_AUTO_CANCELLED", detail: `vs. ${l.game.opponent}` });
    }
  }

  const unsent = await db.listing.findMany({
    where: { status: "PAYMENT_HELD", game: { kickoff: { lte: boundary } } },
    include: { game: true },
  });
  for (const l of unsent) {
    await refundPayment(l.paymentProvider, l.paymentRef);
    const { count } = await db.listing.updateMany({
      where: { id: l.id, status: "PAYMENT_HELD" },
      data: { status: "CANCELLED", cancelledAt: now, cancelReason: "Seller didn't transfer before the cutoff; buyer refunded" },
    });
    if (count && l.buyerId) {
      await notify(l.buyerId, "REFUND", "Refunded automatically",
        `The seller didn't transfer your vs. ${l.game.opponent} ticket before the cutoff. ${usd(l.priceCents)} was returned.`);
      await notify(l.sellerId, "CANCELLED", "Sale cancelled", `You didn't transfer the vs. ${l.game.opponent} ticket in time; the buyer was refunded.`);
    }
  }

  const unconfirmed = await db.listing.findMany({
    where: { status: "TRANSFERRED", game: { kickoff: { lte: now } } },
    select: { id: true },
  });
  for (const l of unconfirmed) await completeOrder(l.id, "auto-released at kickoff");

  return { cancelled: unsold.length, refunded: unsent.length, completed: unconfirmed.length };
}
