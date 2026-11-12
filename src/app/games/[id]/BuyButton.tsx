"use client";

import { useActionState } from "react";
import { startPurchaseAction } from "@/app/actions/market";
import { Alert } from "@/components/ui";

export function BuyButton({ listingId, price, block }: { listingId: string; price: string; block: string | null }) {
  const [state, action, pending] = useActionState(startPurchaseAction, null);
  if (block) {
    return <p className="rounded-xl bg-stone-100 px-3 py-2 text-center text-sm text-stone-600">{block}</p>;
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="listingId" value={listingId} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Checking…" : `Buy for ${price} · held in escrow`}
      </button>
    </form>
  );
}
