"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { clientInfo } from "@/lib/request";
import { hit } from "@/lib/rateLimit";
import {
  buyBlockReason, cancelListing, confirmReceipt, createListing, markPaymentHeld,
  openDispute, resolveDispute, runCutoffSweep, sendTransfer,
} from "@/lib/escrow";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/notify";
import type { FormState } from "./auth";

/** Parse "$80", "80.5" etc. into integer cents on the server. */
function parseDollars(v: FormDataEntryValue | null) {
  const s = String(v ?? "").replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}

export async function createListingAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const rl = hit("listing", user.id);
  if (!rl.ok) return { error: `Too many listings. Try again in ${rl.retryIn}s.` };
  const res = await createListing(user.id, String(form.get("ticketId") ?? ""), parseDollars(form.get("price")), await clientInfo());
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  redirect(`/orders/${res.listingId}?listed=1`);
}

export async function cancelListingAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const res = await cancelListing(user.id, String(form.get("listingId")), await clientInfo());
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  redirect(`/orders/${String(form.get("listingId"))}?msg=cancelled`);
}

/** "Buy" button: re-check every rule server-side, then send to Stripe or the mock checkout. */
export async function startPurchaseAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const listingId = String(form.get("listingId") ?? "");
  const rl = hit("purchase", user.id);
  if (!rl.ok) {
    await logActivity({ userId: user.id, action: "PURCHASE_RATE_LIMITED", suspicious: true, ...(await clientInfo()) });
    return { error: `Too many purchase attempts. Try again in ${rl.retryIn}s.` };
  }
  const block = await buyBlockReason(user.id, listingId);
  if (block) return { error: block };

  const stripe = getStripe();
  if (!stripe) redirect(`/checkout/${listingId}`);

  const l = await db.listing.findUniqueOrThrow({ where: { id: listingId }, include: { game: true, ticket: true } });
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: l.priceCents, // from the DB, never from the client
        product_data: {
          name: `Student ticket: USC vs. ${l.game.opponent}`,
          description: `Sec ${l.ticket.section} Row ${l.ticket.row} · held in escrow until transfer`,
        },
      },
    }],
    // Authorize now, capture later = escrow hold.
    payment_intent_data: { capture_method: "manual", metadata: { listingId, buyerId: user.id } },
    metadata: { listingId, buyerId: user.id },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${base}/api/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/games/${l.gameId}?cancelled=1`,
  });
  redirect(session.url!);
}

/** Mock checkout (used when no Stripe test key is configured). */
export async function mockPayAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const listingId = String(form.get("listingId") ?? "");
  const rl = hit("purchase", user.id);
  if (!rl.ok) return { error: `Too many purchase attempts. Try again in ${rl.retryIn}s.` };
  const card = String(form.get("card") ?? "").replace(/\s/g, "");
  if (card === "4000000000000002") return { error: "Your card was declined (test card). Nothing was charged." };
  if (!/^\d{16}$/.test(card)) return { error: "Enter a 16-digit test card number." };

  const res = await markPaymentHeld(listingId, user.id, "mock", `mock_${crypto.randomUUID().slice(0, 8)}`, await clientInfo());
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  redirect(`/orders/${listingId}?paid=1`);
}

export async function sendTransferAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const res = await sendTransfer(user.id, String(form.get("listingId")), await clientInfo());
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  redirect(`/orders/${String(form.get("listingId"))}?msg=transferred`);
}

export async function confirmReceiptAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const res = await confirmReceipt(user.id, String(form.get("listingId")), await clientInfo());
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  redirect(`/orders/${String(form.get("listingId"))}?msg=confirmed`);
}

export async function disputeAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const res = await openDispute(user.id, String(form.get("listingId")), String(form.get("reason") ?? ""), await clientInfo());
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  redirect(`/orders/${String(form.get("listingId"))}?msg=disputed`);
}

export async function resolveDisputeAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const decision = form.get("decision") === "release" ? "release" : "refund";
  await resolveDispute(admin.id, String(form.get("listingId")), decision, await clientInfo());
  revalidatePath("/admin");
}

export async function runSweepAction(): Promise<void> {
  await requireAdmin();
  await runCutoffSweep(true);
  revalidatePath("/admin");
}

export async function markNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  revalidatePath("/", "layout");
}

export async function reportScamAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const rl = hit("report", user.id);
  if (!rl.ok) return { error: `You've sent several reports. Try again in ${rl.retryIn}s.` };
  const source = String(form.get("source") ?? "").slice(0, 60);
  const description = String(form.get("description") ?? "").trim().slice(0, 1000);
  const listingIdRaw = String(form.get("listingId") ?? "").trim();
  if (!source) return { error: "Tell us where this happened." };
  if (description.length < 15) return { error: "Please add a few details (at least 15 characters)." };
  const listing = listingIdRaw ? await db.listing.findUnique({ where: { id: listingIdRaw } }) : null;
  if (listingIdRaw && !listing) return { error: "That order ID wasn't found." };
  await db.scamReport.create({
    data: { reporterId: user.id, source, description, listingId: listing?.id ?? null },
  });
  await logActivity({ userId: user.id, action: "SCAM_REPORTED", detail: source, ...(await clientInfo()) });
  return { ok: "Thanks. Your report was sent to the Ticket Office. Never pay outside TrojanTix." };
}
