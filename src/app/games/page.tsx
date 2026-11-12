import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { usd } from "@/lib/money";
import { cutoffFor, fmtKickoff, isPastCutoff, timeUntil } from "@/lib/time";

export default async function GamesPage() {
  await requireUser();
  const games = await db.game.findMany({
    orderBy: { kickoff: "asc" },
    include: { listings: { where: { status: "LISTED" }, select: { priceCents: true } } },
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Buy tickets</h1>
        <p className="muted">Every seller is a verified, enrolled student. Your money is held until the ticket is yours.</p>
      </div>
      <ul className="space-y-3">
        {games.map((g) => {
          const closed = isPastCutoff(g.kickoff);
          const low = g.listings.length ? Math.min(...g.listings.map((l) => l.priceCents)) : null;
          return (
            <li key={g.id}>
              <Link href={`/games/${g.id}`} className="card flex items-center justify-between gap-3 hover:border-cardinal/40">
                <div>
                  <p className="font-bold">USC vs. {g.opponent}</p>
                  <p className="text-xs text-stone-500">{fmtKickoff(g.kickoff)}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    Face value {usd(g.faceValueCents)} ·{" "}
                    {closed ? <span className="font-semibold text-stone-700">Resale closed</span>
                      : <>closes in {timeUntil(cutoffFor(g.kickoff))}</>}
                  </p>
                </div>
                <div className="text-right">
                  {closed ? (
                    <span className="text-xs font-semibold text-stone-500">Cutoff passed</span>
                  ) : g.listings.length ? (
                    <>
                      <p className="text-xs text-stone-500">{g.listings.length} listed · from</p>
                      <p className="text-lg font-bold text-cardinal">{usd(low!)}</p>
                    </>
                  ) : (
                    <span className="text-xs text-stone-500">No listings</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
