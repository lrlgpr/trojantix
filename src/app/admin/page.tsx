import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { usd } from "@/lib/money";
import { fmtTime, isPastCutoff } from "@/lib/time";
import { deviceLabel } from "@/lib/request";
import { resolveDisputeAction, runSweepAction } from "@/app/actions/market";
import { paymentMode } from "@/lib/stripe";

const SOLD = ["PAYMENT_HELD", "TRANSFERRED", "COMPLETED", "DISPUTED"] as const;
const IN_ESCROW = ["PAYMENT_HELD", "TRANSFERRED", "DISPUTED"] as const;

export default async function AdminPage() {
  await requireAdmin();

  const [total, active, completed, disputes, escrow, fees, games, reports, suspicious, repeat] = await Promise.all([
    db.listing.count(),
    db.listing.count({ where: { status: "LISTED" } }),
    db.listing.aggregate({ where: { status: "COMPLETED" }, _count: true, _sum: { priceCents: true } }),
    db.listing.findMany({
      where: { status: "DISPUTED" },
      include: { game: true, seller: true, buyer: true },
      orderBy: { disputedAt: "desc" },
    }),
    db.listing.aggregate({ where: { status: { in: [...IN_ESCROW] } }, _sum: { priceCents: true }, _count: true }),
    db.listing.aggregate({ where: { status: "COMPLETED" }, _sum: { feeCents: true } }),
    db.game.findMany({
      orderBy: { kickoff: "asc" },
      include: {
        _count: { select: { tickets: true } },
        listings: { select: { status: true, priceCents: true } },
      },
    }),
    db.scamReport.findMany({ include: { reporter: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.activityLog.findMany({ where: { suspicious: true }, include: { user: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.listing.groupBy({
      by: ["sellerId"],
      where: { status: { in: [...SOLD] } },
      _count: { _all: true },
      _sum: { priceCents: true },
      having: { sellerId: { _count: { gte: 2 } } },
    }),
  ]);
  const repeatUsers = await db.user.findMany({ where: { id: { in: repeat.map((r) => r.sellerId) } } });

  const perGame = games.map((g) => {
    const sold = g.listings.filter((l) => (SOLD as readonly string[]).includes(l.status));
    return {
      id: g.id,
      opponent: g.opponent,
      closed: isPastCutoff(g.kickoff),
      tickets: g._count.tickets,
      listed: g.listings.filter((l) => l.status === "LISTED").length,
      sold: sold.length,
      cancelled: g.listings.filter((l) => l.status === "CANCELLED").length,
      avg: sold.length ? Math.round(sold.reduce((s, l) => s + l.priceCents, 0) / sold.length) : null,
      face: g.faceValueCents,
    };
  });
  const maxActivity = Math.max(1, ...perGame.map((g) => g.listed + g.sold));

  const tiles = [
    { k: "Total listings", v: String(total), sub: `${active} live now` },
    { k: "Completed sales", v: String(completed._count), sub: usd(completed._sum.priceCents ?? 0) + " volume" },
    { k: "Held in escrow", v: usd(escrow._sum.priceCents ?? 0), sub: `${escrow._count} open orders` },
    { k: "Open disputes", v: String(disputes.length), sub: `${reports.filter((r) => r.status === "OPEN").length} open scam reports` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="h1">Ticket Office</h1>
          <p className="muted">Resale oversight · payments: {paymentMode() === "stripe" ? "Stripe test mode" : "mock processor"}</p>
        </div>
        <form action={runSweepAction}>
          <button className="btn-ghost px-3 py-1.5 text-xs" title="Cancel unsold listings & refund unsent orders past the 3-hour cutoff">
            Run cutoff check
          </button>
        </form>
      </div>

      <section className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.k} className="card">
            <p className="text-xs font-medium text-stone-500">{t.k}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight">{t.v}</p>
            <p className="text-xs text-stone-500">{t.sub}</p>
          </div>
        ))}
      </section>
      <p className="-mt-2 text-xs text-stone-500">Platform fees collected: {usd(fees._sum.feeCents ?? 0)}</p>

      <section className="card">
        <h2 className="font-semibold">Resale by game</h2>
        <p className="mb-3 text-xs text-stone-500">Are students flipping tickets? Bar = listings + sales for each home game.</p>
        <div className="mb-2 flex gap-4 text-xs text-stone-600">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-cardinal" />Sold</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-cardinal/35" />Listed</span>
        </div>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-stone-500">
                <th className="px-1 py-1.5 font-medium">Game</th>
                <th className="w-[38%] px-1 py-1.5 font-medium">Activity</th>
                <th className="px-1 py-1.5 text-right font-medium">Sold</th>
                <th className="px-1 py-1.5 text-right font-medium">Listed</th>
                <th className="px-1 py-1.5 text-right font-medium">Resale %</th>
                <th className="px-1 py-1.5 text-right font-medium">Avg / face</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {perGame.map((g) => (
                <tr key={g.id}>
                  <td className="px-1 py-2 font-medium">
                    {g.opponent}
                    {g.closed && <span className="ml-1 text-[10px] text-stone-400">closed</span>}
                  </td>
                  <td className="px-1 py-2">
                    <div className="flex h-3.5 gap-[2px]" title={`${g.opponent}: ${g.sold} sold, ${g.listed} listed`}>
                      {g.sold > 0 && <div className="rounded-l-[4px] bg-cardinal last:rounded-r-[4px]" style={{ width: `${(g.sold / maxActivity) * 100}%` }} />}
                      {g.listed > 0 && <div className="rounded-r-[4px] bg-cardinal/35 first:rounded-l-[4px]" style={{ width: `${(g.listed / maxActivity) * 100}%` }} />}
                    </div>
                  </td>
                  <td className="px-1 py-2 text-right tabular-nums">{g.sold}</td>
                  <td className="px-1 py-2 text-right tabular-nums">{g.listed}</td>
                  <td className="px-1 py-2 text-right tabular-nums">{g.tickets ? Math.round((g.sold / g.tickets) * 100) : 0}%</td>
                  <td className="px-1 py-2 text-right text-xs tabular-nums">{g.avg ? `${Math.round((g.avg / g.face) * 100)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 rounded-xl bg-stone-50 p-3 text-sm">
          <p className="font-semibold">Repeat sellers (2+ sales)</p>
          {repeatUsers.length === 0 ? (
            <p className="text-stone-500">None. No sign of ticket flipping.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {repeat.map((r) => {
                const u = repeatUsers.find((x) => x.id === r.sellerId)!;
                return (
                  <li key={r.sellerId} className="flex justify-between">
                    <span>{u.name} <span className="text-xs text-stone-500">ID {u.studentId}</span></span>
                    <span className="tabular-nums">{r._count._all} sales · {usd(r._sum.priceCents ?? 0)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Disputes ({disputes.length})</h2>
        {disputes.length === 0 && <p className="muted">No open disputes.</p>}
        {disputes.map((d) => (
          <div key={d.id} className="rounded-xl border border-red-200 bg-red-50/50 p-3 text-sm">
            <div className="flex justify-between gap-2">
              <Link href={`/orders/${d.id}`} className="font-semibold underline">vs. {d.game.opponent} · {usd(d.priceCents)}</Link>
              <span className="text-xs text-stone-500">{d.disputedAt && fmtTime(d.disputedAt)}</span>
            </div>
            <p className="text-xs text-stone-600">Seller {d.seller.name} → Buyer {d.buyer?.name}</p>
            <p className="mt-1 italic">“{d.disputeReason}”</p>
            <div className="mt-2 flex gap-2">
              <form action={resolveDisputeAction} className="flex-1">
                <input type="hidden" name="listingId" value={d.id} />
                <input type="hidden" name="decision" value="refund" />
                <button className="btn-danger w-full px-2 py-1.5 text-xs">Refund buyer</button>
              </form>
              <form action={resolveDisputeAction} className="flex-1">
                <input type="hidden" name="listingId" value={d.id} />
                <input type="hidden" name="decision" value="release" />
                <button className="btn-ghost w-full px-2 py-1.5 text-xs">Release to seller</button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Scam reports ({reports.length})</h2>
        <ul className="divide-y divide-stone-100 text-sm">
          {reports.map((r) => (
            <li key={r.id} className="py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-gold/30 px-2 py-0.5 text-xs font-semibold">{r.source}</span>
                <span className="text-xs text-stone-500">{fmtTime(r.createdAt)}</span>
              </div>
              <p className="mt-1 text-stone-700">{r.description}</p>
              <p className="text-xs text-stone-500">
                Reported by {r.reporter.name}
                {r.listingId && <> · <Link className="underline" href={`/orders/${r.listingId}`}>linked order</Link></>}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="font-semibold">Account-takeover signals</h2>
        <p className="mb-2 text-xs text-stone-500">Failed logins, rate-limit hits and new-device sign-ins across all accounts.</p>
        <ul className="divide-y divide-stone-100 text-sm">
          {suspicious.map((s) => (
            <li key={s.id} className="py-2">
              <div className="flex justify-between gap-2">
                <span className="font-medium text-red-800">⚠ {s.action.replaceAll("_", " ").toLowerCase()}</span>
                <span className="text-xs text-stone-500">{fmtTime(s.createdAt)}</span>
              </div>
              <p className="text-xs text-stone-600">{s.user?.name ?? s.email} · {deviceLabel(s.userAgent)} · IP {s.ip}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
