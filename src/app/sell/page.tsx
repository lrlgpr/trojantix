import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPastCutoff } from "@/lib/time";
import { PLATFORM_FEE_RATE } from "@/lib/money";
import { SellForm } from "./SellForm";

export default async function SellPage({ searchParams }: PageProps<"/sell">) {
  const user = await requireUser();
  const { ticket } = await searchParams;
  const tickets = await db.ticket.findMany({
    where: {
      ownerId: user.id,
      usedAt: null,
      listings: { none: { status: { in: ["LISTED", "PAYMENT_HELD", "TRANSFERRED", "DISPUTED"] } } },
    },
    include: { game: true },
    orderBy: { game: { kickoff: "asc" } },
  });
  const eligible = tickets
    .filter((t) => !isPastCutoff(t.game.kickoff))
    .map((t) => ({
      id: t.id,
      label: `vs. ${t.game.opponent} · Sec ${t.section} Row ${t.row}`,
      kickoff: t.game.kickoff.toISOString(),
      faceValueCents: t.faceValueCents,
    }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Sell a ticket</h1>
        <p className="muted">Only to verified students, never above face value. You&apos;re paid once the transfer is confirmed.</p>
      </div>
      {eligible.length === 0 ? (
        <div className="card text-center">
          <p className="font-medium">No tickets available to list.</p>
          <p className="muted mt-1">Tickets already listed, sold, used or past the 3-hour cutoff can&apos;t be listed.</p>
          <Link href="/tickets" className="btn-ghost mt-3">My Tickets</Link>
        </div>
      ) : (
        <SellForm tickets={eligible} initialId={typeof ticket === "string" ? ticket : undefined} feeRate={PLATFORM_FEE_RATE} />
      )}
    </div>
  );
}
