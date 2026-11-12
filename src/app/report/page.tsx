import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtTime } from "@/lib/time";
import { ReportForm } from "./ReportForm";

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const user = await requireUser();
  const { listing } = await searchParams;
  const mine = await db.scamReport.findMany({ where: { reporterId: user.id }, orderBy: { createdAt: "desc" }, take: 5 });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Report a scam</h1>
        <p className="muted">Saw a fake seller in a GroupMe, got a fake payment screenshot, or something feels off? Tell the Ticket Office.</p>
      </div>
      <div className="rounded-2xl bg-gold/25 p-4 text-sm text-stone-800">
        <p className="font-semibold">Red flags</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>Asks for Venmo, Zelle, Apple Pay or CashApp before transferring</li>
          <li>&quot;Payment sent&quot; screenshots instead of a real transfer</li>
          <li>New accounts, prices way under face value, pressure to act now</li>
        </ul>
      </div>
      <ReportForm listingId={typeof listing === "string" ? listing : ""} />
      {mine.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-semibold">Your reports</h2>
          <ul className="divide-y divide-stone-100 text-sm">
            {mine.map((r) => (
              <li key={r.id} className="py-2">
                <div className="flex justify-between"><span className="font-medium">{r.source}</span><span className="text-xs text-stone-500">{r.status} · {fmtTime(r.createdAt)}</span></div>
                <p className="line-clamp-2 text-stone-600">{r.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
