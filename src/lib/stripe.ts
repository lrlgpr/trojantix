import "server-only";
import Stripe from "stripe";

let client: Stripe | null | undefined;

/**
 * Returns a Stripe client only when a TEST-mode secret key is configured.
 * With no key (or a live key, which we refuse) the app uses the mock payment flow.
 */
export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    client = null;
  } else if (!key.startsWith("sk_test_")) {
    console.warn("[stripe] STRIPE_SECRET_KEY is not a test key; refusing to use it. Using mock payments.");
    client = null;
  } else {
    client = new Stripe(key);
  }
  return client;
}

export function paymentMode() {
  return getStripe() ? "stripe" : "mock";
}

/** Capture a held (authorized) payment: releases funds toward the seller. */
export async function capturePayment(provider: string | null, ref: string | null) {
  const stripe = getStripe();
  if (provider !== "stripe" || !stripe || !ref) return;
  const pi = await stripe.paymentIntents.retrieve(ref);
  if (pi.status === "requires_capture") await stripe.paymentIntents.capture(ref);
}

/** Release a hold (or refund if it was already captured). */
export async function refundPayment(provider: string | null, ref: string | null) {
  const stripe = getStripe();
  if (provider !== "stripe" || !stripe || !ref) return;
  const pi = await stripe.paymentIntents.retrieve(ref);
  if (pi.status === "requires_capture") await stripe.paymentIntents.cancel(ref);
  else if (pi.status === "succeeded") await stripe.refunds.create({ payment_intent: ref });
}
