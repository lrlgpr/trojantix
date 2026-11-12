"use client";

import { useActionState } from "react";
import { reportScamAction } from "@/app/actions/market";
import { Alert } from "@/components/ui";

const sources = ["GroupMe", "Instagram", "Snapchat", "Fake payment", "TrojanTix order", "Other"];

export function ReportForm({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState(reportScamAction, null);
  if (state?.ok) return <Alert kind="success">{state.ok}</Alert>;
  return (
    <form action={action} className="card space-y-3">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <div>
        <label className="label" htmlFor="source">Where did it happen?</label>
        <select id="source" name="source" className="input" defaultValue={listingId ? "TrojanTix order" : "GroupMe"}>
          {sources.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="description">What happened?</label>
        <textarea id="description" name="description" rows={4} className="input text-sm"
          placeholder="Usernames, what they asked for, amounts, dates…" />
      </div>
      <div>
        <label className="label" htmlFor="listingId">TrojanTix order ID (optional)</label>
        <input id="listingId" name="listingId" defaultValue={listingId} className="input font-mono text-sm" />
      </div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Send report"}</button>
    </form>
  );
}
