import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { buyBlockReason } from "@/lib/escrow";
import { usd } from "@/lib/money";
import { fmtKickoff } from "@/lib/time";
import { getStripe } from "@/lib/stripe";
import { Alert } from "@/components/ui";
import { MockCardForm } from "./MockCardForm";

// Mock checkout, used only when no Stripe test key is configured.
export default async function CheckoutPage({ params }: PageProps<"/checkout/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  if (getStripe()) redirect(`/games`);
  const l = await db.listing.findUnique({ where: { id }, include: { game: true, ticket: true } });
  if (!l) notFound();
  const block = await buyBlockReason(user.id, id);

  return (
    <div className="space-y-4">
      <Link href={`/games/${l.gameId}`} className="text-sm text-stone-500">← Back</Link>
      <h1 className="h1">Checkout</h1>
      <div className="card space-y-1">
        <p className="font-bold">USC vs. {l.game.opponent}</p>
        <p className="text-sm text-stone-600">{fmtKickoff(l.game.kickoff)}</p>
        <p className="text-sm text-stone-600">Sec {l.ticket.section} · Row {l.ticket.row}</p>
        <div className="flex justify-between border-t border-stone-200 pt-2 text-lg font-bold">
          <span>Total</span><span>{usd(l.priceCents)}</span>
        </div>
      </div>
      <Alert kind="info">
        <b>How escrow works:</b> your card is authorized now, but the seller isn&apos;t paid until the ticket is in your account and you confirm.
        If the seller doesn&apos;t transfer before the cutoff, you&apos;re refunded automatically.
      </Alert>
      {block ? <Alert kind="error">{block}</Alert> : <MockCardForm listingId={l.id} total={usd(l.priceCents)} />}
    </div>
  );
}
