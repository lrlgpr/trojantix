import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { usd } from "@/lib/money";
import { cutoffFor, fmtKickoff, fmtTime, isPastCutoff } from "@/lib/time";
import { Alert, VerifiedBadge, sellerHandle } from "@/components/ui";
import { BuyButton } from "./BuyButton";

export default async function GamePage({ params, searchParams }: PageProps<"/games/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const game = await db.game.findUnique({ where: { id } });
  if (!game) notFound();

  // Select only what buyers may see: never seller name, email or student ID.
  const listings = await db.listing.findMany({
    where: { gameId: id, status: "LISTED" },
    orderBy: { priceCents: "asc" },
    select: {
      id: true, priceCents: true, sellerId: true, createdAt: true,
      ticket: { select: { section: true, row: true } },
    },
  });
  const closed = isPastCutoff(game.kickoff);
  const holds = await db.ticket.findFirst({ where: { ownerId: user.id, gameId: id }, select: { id: true } });
  const pending = await db.listing.findFirst({
    where: { buyerId: user.id, gameId: id, status: { in: ["PAYMENT_HELD", "DISPUTED"] } }, select: { id: true },
  });
  const isAdmin = user.role === "ADMIN";

  const blockFor = (sellerId: string) =>
    isAdmin ? "Ticket Office accounts can't buy."
    : closed ? "Sales closed 3 hours before kickoff."
    : sellerId === user.id ? "This is your listing."
    : holds ? "You already hold a ticket for this game."
    : pending ? "You already have a purchase in progress for this game."
    : null;

  return (
    <div className="space-y-4">
      <Link href="/games" className="text-sm text-stone-500">← All games</Link>
      <div className="rounded-3xl bg-cardinal p-5 text-white">
        <h1 className="text-2xl font-extrabold">USC vs. {game.opponent}</h1>
        <p className="text-sm text-white/80">{fmtKickoff(game.kickoff)} · {game.venue}</p>
        <p className="mt-2 text-sm">
          Face value <b>{usd(game.faceValueCents)}</b> · Resale {closed ? "closed" : `closes ${fmtTime(cutoffFor(game.kickoff))}`}
        </p>
      </div>

      {sp.cancelled && <Alert kind="info">Checkout cancelled. You weren&apos;t charged.</Alert>}
      {closed && <Alert kind="warn">Transfers stop 3 hours before kickoff, so no listings or purchases are allowed now. Unsold listings were cancelled automatically.</Alert>}
      {!closed && holds && !isAdmin && (
        <Alert kind="info">You already have a ticket for this game in <Link className="underline" href={`/tickets/${holds.id}`}>My Tickets</Link>. One ticket per student per game.</Alert>
      )}

      <h2 className="font-semibold">{listings.length} verified listing{listings.length === 1 ? "" : "s"}</h2>
      {listings.length === 0 && <p className="card muted">No tickets listed for this game right now.</p>}
      <ul className="space-y-3">
        {listings.map((l) => {
          const block = blockFor(l.sellerId);
          return (
            <li key={l.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-extrabold">{usd(l.priceCents)}</p>
                  <p className="text-sm text-stone-600">Sec {l.ticket.section} · Row {l.ticket.row} · Student section</p>
                  {l.priceCents < game.faceValueCents && (
                    <p className="text-xs font-semibold text-emerald-700">{usd(game.faceValueCents - l.priceCents)} below face value</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <VerifiedBadge small />
                  <span className="text-xs text-stone-500">{sellerHandle(l.sellerId)}</span>
                </div>
              </div>
              <BuyButton listingId={l.id} price={usd(l.priceCents)} block={block} />
            </li>
          );
        })}
      </ul>
      <p className="px-2 text-center text-xs text-stone-500">
        Seller names and student IDs are never shown. TrojanTix verified each seller&apos;s enrollment and that the ticket is in their account.
      </p>
    </div>
  );
}
