import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtTime } from "@/lib/time";
import { markNotificationsReadAction } from "@/app/actions/market";

const tone: Record<string, string> = {
  SECURITY: "bg-red-100 text-red-800",
  SOLD: "bg-amber-100 text-amber-800",
  PAYMENT_HELD: "bg-amber-100 text-amber-800",
  TRANSFERRED: "bg-violet-100 text-violet-800",
  PAYOUT: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  REFUND: "bg-sky-100 text-sky-800",
  SCANNED: "bg-stone-200 text-stone-800",
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  const unread = items.filter((n) => !n.read).length;
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="h1">Alerts</h1>
          {unread > 0 && (
            <form action={markNotificationsReadAction}>
              <button className="btn-ghost px-3 py-1.5 text-xs whitespace-nowrap">Mark all read</button>
            </form>
          )}
        </div>
        <p className="muted">You&apos;re alerted whenever your ticket is listed, sold, transferred or scanned, and on new sign-ins. Copies go to {user.email} (simulated).</p>
      </div>
      {items.length === 0 && <p className="card muted">No alerts yet.</p>}
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className={`card ${n.read ? "" : "border-cardinal/40 bg-cardinal/[0.03]"}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{!n.read && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-cardinal align-middle" />}{n.title}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone[n.kind] ?? "bg-stone-100 text-stone-700"}`}>{n.kind.replace("_", " ")}</span>
            </div>
            <p className="mt-1 text-sm text-stone-600">{n.body}</p>
            <p className="mt-1 text-xs text-stone-400">{fmtTime(n.createdAt)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
