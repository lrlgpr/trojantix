"use client";

import { useActionState, useMemo, useState } from "react";
import { createListingAction } from "@/app/actions/market";
import { Alert } from "@/components/ui";
import { usd } from "@/lib/money";

type T = { id: string; label: string; kickoff: string; faceValueCents: number };

export function SellForm({ tickets, initialId, feeRate }: { tickets: T[]; initialId?: string; feeRate: number }) {
  const [state, action, pending] = useActionState(createListingAction, null);
  const [id, setId] = useState(tickets.some((t) => t.id === initialId) ? initialId! : tickets[0].id);
  const ticket = tickets.find((t) => t.id === id)!;
  const [price, setPrice] = useState((ticket.faceValueCents / 100).toString());

  const cents = useMemo(() => {
    const n = Number(price.replace(/[$,]/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) : NaN;
  }, [price]);
  const overCap = cents > ticket.faceValueCents;
  const invalid = !Number.isFinite(cents) || cents < 100;
  const fee = Math.round((invalid ? 0 : cents) * feeRate);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <div className="card space-y-4">
        <div>
          <label className="label" htmlFor="ticketId">Game</label>
          <select id="ticketId" name="ticketId" className="input" value={id}
            onChange={(e) => {
              setId(e.target.value);
              const t = tickets.find((x) => x.id === e.target.value)!;
              setPrice((t.faceValueCents / 100).toString());
            }}>
            {tickets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="price">Your price</label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-500">$</span>
            <input id="price" name="price" inputMode="decimal" className={`input pl-7 text-lg font-semibold ${overCap ? "border-red-400 ring-2 ring-red-100" : ""}`}
              value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <p className={`mt-1 text-xs ${overCap ? "font-semibold text-red-700" : "text-stone-500"}`}>
            Face-value cap: {usd(ticket.faceValueCents)}. {overCap ? "Lower your price to list." : "You can list at or below this."}
          </p>
        </div>
      </div>

      <div className="card space-y-2">
        <p className="text-sm font-semibold">Before you list</p>
        <Row k="Buyer pays" v={invalid ? "—" : usd(cents)} />
        <Row k={`TrojanTix fee (${Math.round(feeRate * 100)}%)`} v={invalid ? "—" : `− ${usd(fee)}`} />
        <div className="border-t border-stone-200 pt-2">
          <Row k="You receive after transfer" v={invalid ? "—" : usd(cents - fee)} bold />
        </div>
        <p className="pt-1 text-xs text-stone-500">
          The fee covers escrow and fraud protection. You&apos;ll get an alert when it sells. Unsold listings auto-cancel 3 hours before kickoff.
        </p>
      </div>

      <button className="btn-primary w-full text-base" disabled={pending || overCap || invalid}>
        {pending ? "Listing…" : "List ticket"}
      </button>
    </form>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? "text-base font-bold" : ""}`}>
      <span className={bold ? "" : "text-stone-600"}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
