"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Alert } from "@/components/ui";

const demo = [
  { email: "alex.rivera@usc.edu", label: "Seller" },
  { email: "jordan.lee@usc.edu", label: "Buyer" },
  { email: "ticketoffice@usc.edu", label: "Ticket Office" },
  { email: "sam.graduate@usc.edu", label: "Not enrolled" },
  { email: "scammer@gmail.com", label: "Non-USC" },
];

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        {state?.error && <Alert kind="error">{state.error}</Alert>}
        <div>
          <label className="label" htmlFor="email">USC email</label>
          <input id="email" name="email" type="email" autoComplete="username" required
            placeholder="ttrojan@usc.edu" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required
            className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Checking…" : "Continue"}
        </button>
      </form>

      <div className="rounded-xl border border-dashed border-stone-300 p-3">
        <p className="mb-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">
          Demo accounts · password <code className="font-mono">fighton</code>
        </p>
        <div className="flex flex-wrap gap-2">
          {demo.map((d) => (
            <button key={d.email} type="button" className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => { setEmail(d.email); setPassword("fighton"); }}>
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
