import Link from "next/link";
import { redirect } from "next/navigation";
import { demoCodeFor, getUser, pendingChallenge } from "@/lib/auth";
import { VerifyForm } from "./VerifyForm";
import { Icon } from "@/components/Icon";

export default async function VerifyPage() {
  if (await getUser()) redirect("/tickets");
  const ch = await pendingChallenge();
  if (!ch) redirect("/login");
  const code = demoCodeFor(ch.id);
  const masked = ch.user.email.replace(/^(.).*(@.*)$/, "$1•••••$2");

  return (
    <div className="mx-auto max-w-sm space-y-4 pt-4">
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-cardinal/10 text-cardinal">
            <Icon name="shield" />
          </span>
          <div>
            <h1 className="text-lg font-bold">Two-factor check</h1>
            <p className="muted">We sent a code to the phone on file for {masked}.</p>
          </div>
        </div>
        <VerifyForm />
        <Link href="/login" className="block text-center text-sm text-stone-500 underline">Start over</Link>
      </div>

      {/* Demo stand-in for the student's phone */}
      <div className="mx-auto max-w-xs rounded-2xl bg-stone-900 p-3 text-white shadow-lg">
        <p className="text-[11px] tracking-wide text-stone-400 uppercase">Demo phone · new message</p>
        <p className="mt-1 text-sm">
          TrojanTix code: <span className="font-mono text-lg font-bold text-gold">{code ?? "(see server console)"}</span>
        </p>
        <p className="text-[11px] text-stone-400">Expires in 5 minutes. Never share this code, even with &quot;USC staff&quot;.</p>
      </div>
    </div>
  );
}
