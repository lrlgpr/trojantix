// Shared (client + server safe) money helpers. Server code re-validates everything.
export const PLATFORM_FEE_RATE = 0.05; // 5% taken from the seller's payout

export function feeFor(priceCents: number) {
  return Math.round(priceCents * PLATFORM_FEE_RATE);
}

export function usd(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
