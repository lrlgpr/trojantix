import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { usd } from "@/lib/money";
import { fmtKickoff, isPastCutoff, timeUntil, cutoffFor } from "@/lib/time";
import { VerifiedBadge } from "@/components/ui";

export default async function MyTickets() {
  const user = await requireUser();
  if (user.role === "ADMIN") redirect("/admin");
  const tickets = await db.ticket.findMany({
    where: { ownerId: user.id },
    include: {
      game: true,
      listings: { where: { status: { in: ["LISTED", "PAYMENT_HELD", "DISPUTED"] } } },
    },
    orderBy: { game: { kickoff: "asc" } },
  });

  return (
    <div className="space-y-4">
      <section className="card flex items-center justify-between gap-3">
        <div>
          <p className="muted">Signed in as</p>
          <p className="font-semibold">{user.name}</p>
          <p className="text-xs text-stone-500">Student ID ••••••{user.studentId.slice(-4)}</p>
        </div>
        <VerifiedBadge />
      </section>

      <div className="flex items-end justify-between">
        <h1 className="h1">My Tickets</h1>
        <span className="muted">{tickets.length} home games</span>
      </div>

      {tickets.length === 0 && (
        <div className="card text-center">
          <p className="font-medium">No tickets in your account yet.</p>
          <Link href="/games" className="btn-primary mt-3">Browse verified listings</Link>
        </div>
      )}

      <ul className="space-y-3">
        {tickets.map((t) => {
          const active = t.listings[0];
          const closed = isPastCutoff(t.game.kickoff);
          return (
            <li key={t.id} className="card p-0">
              <Link href={`/tickets/${t.id}`} className="flex items-stretch">
                <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-l-2xl bg-cardinal text-white">
                  <span className="text-[10px] tracking-widest text-gold uppercase">
                    {t.game.kickoff.toLocaleString("en-US", { month: "short", timeZone: "America/Los_Angeles" })}
                  </span>
                  <span className="text-2xl font-extrabold">
                    {t.game.kickoff.toLocaleString("en-US", { day: "numeric", timeZone: "America/Los_Angeles" })}
                  </span>
                </div>
                <div className="flex-1 border-l-2 border-dashed border-stone-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">vs. {t.game.opponent}</p>
                      <p className="text-xs text-stone-500">{fmtKickoff(t.game.kickoff)}</p>
                    </div>
                    <span className="text-sm font-semibold text-stone-700">{usd(t.faceValueCents)}</span>
                  </div>
                  <p className="mt-1 text-sm text-stone-600">Sec {t.section} · Row {t.row} · Seat {t.seat}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                    {t.usedAt && <span className="rounded-full bg-stone-200 px-2 py-0.5">Scanned at gate</span>}
                    {active?.status === "LISTED" && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">Listed for {usd(active.priceCents)}</span>
                    )}
                    {active?.status === "PAYMENT_HELD" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Sold · send transfer</span>
                    )}
                    {active?.status === "DISPUTED" && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">Disputed</span>
                    )}
                    {t.transferCount > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">Bought on TrojanTix</span>
                    )}
                    {!t.usedAt && (
                      <span className={`rounded-full px-2 py-0.5 ${closed ? "bg-stone-100 text-stone-600" : "bg-gold/30 text-stone-800"}`}>
                        {closed ? "Resale closed" : `Resale closes in ${timeUntil(cutoffFor(t.game.kickoff))}`}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
