import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtTime } from "@/lib/time";
import { deviceLabel } from "@/lib/request";
import { logoutOthersAction } from "@/app/actions/auth";
import { Alert } from "@/components/ui";

export default async function ActivityPage() {
  const user = await requireUser();
  const [log, sessions] = await Promise.all([
    db.activityLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 40 }),
    db.session.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  const flagged = log.filter((l) => l.suspicious).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Account activity</h1>
        <p className="muted">Every sign-in, listing and transfer on your account. Unusual events are flagged so a stolen account gets noticed fast.</p>
      </div>
      {flagged > 0 && <Alert kind="warn">{flagged} flagged event{flagged > 1 ? "s" : ""} below. If you don&apos;t recognize them, sign out other devices and report it.</Alert>}

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Signed-in devices ({sessions.length})</h2>
          {sessions.length > 1 && (
            <form action={logoutOthersAction}><button className="btn-danger px-3 py-1.5 text-xs">Sign out other devices</button></form>
          )}
        </div>
        <ul className="divide-y divide-stone-100 text-sm">
          {sessions.map((s) => (
            <li key={s.id} className="flex justify-between py-2">
              <span>{deviceLabel(s.userAgent)} · {s.ip}</span>
              <span className="text-xs text-stone-500">{s.id === user.sessionId ? "This device" : fmtTime(s.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">History</h2>
        <ul className="divide-y divide-stone-100">
          {log.map((l) => (
            <li key={l.id} className={`py-2.5 text-sm ${l.suspicious ? "-mx-2 rounded-lg bg-red-50 px-2" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">
                  {l.suspicious && <span className="mr-1 text-red-700">⚠</span>}
                  {l.action.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                </span>
                <span className="shrink-0 text-xs text-stone-500">{fmtTime(l.createdAt)}</span>
              </div>
              {l.detail && <p className="text-stone-600">{l.detail}</p>}
              {l.ip && <p className="text-xs text-stone-400">{deviceLabel(l.userAgent)} · IP {l.ip}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
