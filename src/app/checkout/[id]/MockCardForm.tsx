"use client";

import { useActionState } from "react";
import { mockPayAction } from "@/app/actions/market";
import { Alert } from "@/components/ui";

export function MockCardForm({ listingId, total }: { listingId: string; total: string }) {
  const [state, action, pending] = useActionState(mockPayAction, null);
  return (
    <form action={action} className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Card details</p>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">TEST MODE · no real charge</span>
      </div>
      <input type="hidden" name="listingId" value={listingId} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <div>
        <label className="label" htmlFor="card">Card number</label>
        <input id="card" name="card" inputMode="numeric" className="input font-mono" defaultValue="4242 4242 4242 4242" />
        <p className="mt-1 text-xs text-stone-500">Use 4242 4242 4242 4242 to succeed, 4000 0000 0000 0002 to simulate a decline.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="exp">Expiry</label><input id="exp" className="input font-mono" defaultValue="12 / 29" /></div>
        <div><label className="label" htmlFor="cvc">CVC</label><input id="cvc" className="input font-mono" defaultValue="123" /></div>
      </div>
      <button className="btn-primary w-full text-base" disabled={pending}>{pending ? "Authorizing…" : `Pay ${total} into escrow`}</button>
    </form>
  );
}
