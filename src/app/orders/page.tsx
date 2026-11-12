import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { usd } from "@/lib/money";
import { fmtKickoff } from "@/lib/time";
import { Alert, StatusPill } from "@/components/ui";

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const user = await requireUser();
  const { error } = await searchParams;
  const [buying, selling] = await Promise.all([loadOrders({ buyerId: user.id }), loadOrders({ sellerId: user.id })]);

  return (
    <div className="space-y-5">
      <h1 className="h1">Orders</h1>
      {typeof error === "string" && <Alert kind="error">{error}</Alert>}
      <Section title="Buying" rows={buying} empty="No purchases yet." />
      <Section title="Selling" rows={selling} empty="You haven't listed anything." />
    </div>
  );
}

type Row = Awaited<ReturnType<typeof loadOrders>>[number];

function loadOrders(where: { buyerId: string } | { sellerId: string }) {
  return db.listing.findMany({ where, include: { game: true, ticket: true }, orderBy: { createdAt: "desc" } });
}

function Section({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 && <p className="card muted">{empty}</p>}
      {rows.map((l) => (
        <Link key={l.id} href={`/orders/${l.id}`} className="card flex items-center justify-between gap-3 hover:border-cardinal/40">
          <div>
            <p className="font-semibold">vs. {l.game.opponent}</p>
            <p className="text-xs text-stone-500">{fmtKickoff(l.game.kickoff)} · Sec {l.ticket.section}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-semibold">{usd(l.priceCents)}</span>
            <StatusPill status={l.status} />
          </div>
        </Link>
      ))}
    </section>
  );
}
