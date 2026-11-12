"use client";

import { useActionState } from "react";
import { verifyAction } from "@/app/actions/auth";
import { Alert } from "@/components/ui";

export function VerifyForm() {
  const [state, action, pending] = useActionState(verifyAction, null);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <label className="label" htmlFor="code">6-digit code</label>
      <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}"
        maxLength={7} required autoFocus placeholder="123456"
        className="input text-center font-mono text-2xl tracking-[0.4em]" />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Verifying…" : "Verify & sign in"}</button>
    </form>
  );
}
