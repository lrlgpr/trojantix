import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getStripe, refundPayment } from "@/lib/stripe";
import { markPaymentHeld } from "@/lib/escrow";
import { clientInfo } from "@/lib/request";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Stripe Checkout redirects here. We never trust the redirect itself: we fetch the
 * session from Stripe server-side and check that the card was actually authorized.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = process.env.APP_URL ?? url.origin;
  const stripe = getStripe();
  const user = await getUser();
  const sessionId = url.searchParams.get("session_id");
  if (!stripe || !user || !sessionId) return NextResponse.redirect(new URL("/orders", base));

  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
  const pi = typeof session.payment_intent === "object" ? session.payment_intent : null;
  const listingId = session.metadata?.listingId;
  if (!listingId || session.metadata?.buyerId !== user.id) {
    return NextResponse.redirect(new URL("/orders", base));
  }
  if (session.status !== "complete" || !pi || pi.status !== "requires_capture") {
    return NextResponse.redirect(new URL(`/games?payment=failed`, base));
  }

  // Idempotent: a refresh of this URL must not touch an order that already succeeded.
  const existing = await db.listing.findUnique({ where: { id: listingId } });
  if (existing?.paymentRef === pi.id && existing.buyerId === user.id) {
    return NextResponse.redirect(new URL(`/orders/${listingId}`, base));
  }

  const res = await markPaymentHeld(listingId, user.id, "stripe", pi.id, await clientInfo());
  if (!res.ok) {
    // Lost a race or rule failed after paying: release the authorization immediately.
    await refundPayment("stripe", pi.id);
    return NextResponse.redirect(new URL(`/orders?error=${encodeURIComponent(res.error)}`, base));
  }
  return NextResponse.redirect(new URL(`/orders/${listingId}?paid=1`, base));
}
