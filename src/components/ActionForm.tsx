"use client";

import { useActionState } from "react";
import { Alert } from "./ui";
import type { FormState } from "@/app/actions/auth";

type Props = {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  className?: string;
  textarea?: { name: string; placeholder: string; label: string };
};

/** Small form that posts to a server action and shows its success/error message. */
export function ActionForm({ action, fields, label, pendingLabel, className = "btn-primary w-full", textarea }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-2">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {textarea && (
        <>
          <label className="label" htmlFor={textarea.name}>{textarea.label}</label>
          <textarea id={textarea.name} name={textarea.name} rows={3} className="input text-sm" placeholder={textarea.placeholder} />
        </>
      )}
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">{state.ok}</Alert>}
      {!state?.ok && <button className={className} disabled={pending}>{pending ? (pendingLabel ?? "Working…") : label}</button>}
    </form>
  );
}
