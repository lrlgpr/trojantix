import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { usd } from "@/lib/money";
import { fmtKickoff, isPastCutoff } from "@/lib/time";
import { RotatingQR } from "./RotatingQR";
import { Alert } from "@/components/ui";

export default async function TicketView({ params }: PageProps<"/tickets/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const t = await db.ticket.findUnique({
    where: { id },
    include: { game: true, listings: { where: { status: { in: ["LISTED", "PAYMENT_HELD", "DISPUTED"] } } } },
  });
  if (!t || t.ownerId !== user.id) notFound();
  const active = t.listings[0];
  const locked = active && active.status !== "LISTED";

  return (
    <div className="space-y-4">
      <Link href="/tickets" className="text-sm text-stone-500">← My Tickets</Link>
      <div className="overflow-hidden rounded-3xl bg-white shadow">
        <div className="bg-cardinal p-5 text-white">
          <p className="text-xs tracking-widest text-gold uppercase">Home game · Student section</p>
          <h1 className="mt-1 text-2xl font-extrabold">USC vs. {t.game.opponent}</h1>
          <p className="text-sm text-white/80">{fmtKickoff(t.game.kickoff)}</p>
          <p className="text-sm text-white/80">{t.game.venue}</p>
        </div>
        <div className="grid grid-cols-3 border-b border-dashed border-stone-300 text-center">
          {[["Section", t.section], ["Row", t.row], ["Seat", t.seat]].map(([k, v]) => (
            <div key={k} className="p-3">
              <p className="text-[11px] tracking-wide text-stone-500 uppercase">{k}</p>
              <p className="text-xl font-bold">{v}</p>
            </div>
          ))}
        </div>
        <div className="p-5">
          {t.usedAt ? (
            <Alert kind="info">This ticket was scanned at the gate. Enjoy the game!</Alert>
          ) : locked ? (
            <Alert kind="warn">
              This ticket is locked while its sale is in escrow. The QR code is hidden so it can&apos;t be used and sold at the same time.
            </Alert>
          ) : (
            <RotatingQR ticketId={t.id} />
          )}
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">Face value</span>
          <span className="font-semibold">{usd(t.faceValueCents)}</span>
        </div>
        {active?.status === "LISTED" ? (
          <Alert kind="info">
            Listed for {usd(active.priceCents)}. <Link className="underline" href={`/orders/${active.id}`}>Manage listing</Link>
          </Alert>
        ) : active ? (
          <Link className="btn-ghost w-full" href={`/orders/${active.id}`}>View order</Link>
        ) : !t.usedAt && !isPastCutoff(t.game.kickoff) ? (
          <Link href={`/sell?ticket=${t.id}`} className="btn-primary w-full">Sell this ticket</Link>
        ) : (
          !t.usedAt && <p className="muted">Resale closed: transfers stop 3 hours before kickoff.</p>
        )}
      </div>
    </div>
  );
}
