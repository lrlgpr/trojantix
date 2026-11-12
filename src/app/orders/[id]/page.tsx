import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { usd } from "@/lib/money";
import { cutoffFor, fmtKickoff, fmtTime } from "@/lib/time";
import { Alert, StatusPill, VerifiedBadge, sellerHandle } from "@/components/ui";
import { EscrowTracker } from "@/components/EscrowTracker";
import { ActionForm } from "@/components/ActionForm";
import {
  cancelListingAction, confirmReceiptAction, disputeAction, sendTransferAction,
} from "@/app/actions/market";

const MESSAGES: Record<string, string> = {
  cancelled: "Listing cancelled. The ticket stays in your account.",
  transferred: "Ticket transferred. It's now in the buyer's account with a fresh code. Your old code no longer works.",
  confirmed: "Confirmed! The seller's payout has been released.",
  disputed: "Dispute opened. Funds are frozen until the Ticket Office reviews it.",
};

export default async function OrderPage({ params, searchParams }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const l = await db.listing.findUnique({ where: { id }, include: { game: true, ticket: true } });
  if (!l) notFound();
  const isSeller = l.sellerId === user.id;
  const isBuyer = l.buyerId === user.id;
  if (!isSeller && !isBuyer && user.role !== "ADMIN") notFound();

  const payout = l.priceCents - l.feeCents;
  const moneyWhere =
    l.status === "LISTED" ? "Not paid yet"
    : l.status === "COMPLETED" ? "Released to seller"
    : l.status === "CANCELLED" ? (l.heldAt ? "Refunded to buyer" : "No payment taken")
    : l.status === "DISPUTED" ? "Frozen in escrow"
    : "Held in escrow";
  const other = isSeller ? l.buyerId : l.sellerId;
  const ids = { listingId: l.id };

  return (
    <div className="space-y-4">
      <Link href="/orders" className="text-sm text-stone-500">← Orders</Link>
      {typeof sp.msg === "string" && MESSAGES[sp.msg] && <Alert kind="success">{MESSAGES[sp.msg]}</Alert>}
      {sp.listed && <Alert kind="success">Listed! The ticket owner (you) was alerted. We&apos;ll notify you when it sells.</Alert>}
      {sp.paid && <Alert kind="success">Payment authorized and held in escrow. The seller is not paid until the ticket reaches your account.</Alert>}

      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="muted">{isSeller ? "You're selling" : isBuyer ? "You're buying" : "Order"}</p>
            <h1 className="text-xl font-bold">USC vs. {l.game.opponent}</h1>
            <p className="text-sm text-stone-600">{fmtKickoff(l.game.kickoff)}</p>
            <p className="text-sm text-stone-600">Sec {l.ticket.section} · Row {l.ticket.row}</p>
          </div>
          <StatusPill status={l.status} />
        </div>
        {other && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-sm">
            <span className="text-stone-600">{isSeller ? "Buyer" : "Seller"}: {sellerHandle(other)}</span>
            <VerifiedBadge small />
          </div>
        )}
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold">Escrow progress</h2>
        {l.status === "CANCELLED" && <div className="mb-3"><Alert kind="warn">Cancelled: {l.cancelReason}</Alert></div>}
        {l.status === "DISPUTED" && (
          <div className="mb-3"><Alert kind="error">Disputed: “{l.disputeReason}”. Funds are frozen until the Ticket Office decides.</Alert></div>
        )}
        <EscrowTracker l={l} />
      </section>

      {/* Next step for whoever is looking */}
      <section className="card space-y-3">
        <h2 className="font-semibold">Next step</h2>
        {l.status === "LISTED" && isSeller && (
          <>
            <p className="text-sm text-stone-600">Waiting for a verified student to buy. Auto-cancels at {fmtTime(cutoffFor(l.game.kickoff))} if unsold.</p>
            <ActionForm action={cancelListingAction} fields={ids} label="Cancel listing" className="btn-ghost w-full" />
          </>
        )}
        {l.status === "PAYMENT_HELD" && isSeller && (
          <>
            <p className="text-sm text-stone-600">
              The buyer&apos;s {usd(l.priceCents)} is <b>locked in escrow</b>. Send the ticket transfer before{" "}
              <b>{fmtTime(cutoffFor(l.game.kickoff))}</b> or the buyer is refunded automatically.
            </p>
            <ActionForm action={sendTransferAction} fields={ids} label="Send ticket transfer to buyer" pendingLabel="Transferring…" />
          </>
        )}
        {l.status === "PAYMENT_HELD" && isBuyer && (
          <p className="text-sm text-stone-600">
            Your payment is held, not sent. Waiting for the seller to transfer the ticket. If they don&apos;t by{" "}
            <b>{fmtTime(cutoffFor(l.game.kickoff))}</b>, you&apos;re refunded automatically.
          </p>
        )}
        {l.status === "TRANSFERRED" && isBuyer && (
          <>
            <p className="text-sm text-stone-600">The ticket is in your account with a brand-new rotating code. Check it, then release payment.</p>
            <Link href={`/tickets/${l.ticketId}`} className="btn-gold w-full">View my ticket</Link>
            <ActionForm action={confirmReceiptAction} fields={ids} label="I have the ticket — release payment" pendingLabel="Releasing…" />
          </>
        )}
        {l.status === "TRANSFERRED" && isSeller && (
          <p className="text-sm text-stone-600">Transferred. Your payout is released when the buyer confirms, or automatically at kickoff.</p>
        )}
        {l.status === "COMPLETED" && (
          <p className="text-sm text-stone-600">
            {isSeller ? `You were paid ${usd(payout)}.` : "All set. Your ticket is in My Tickets."} Completed {l.completedAt && fmtTime(l.completedAt)}.
          </p>
        )}
        {(l.status === "CANCELLED" || l.status === "DISPUTED") && <p className="text-sm text-stone-600">No action needed from you.</p>}
        {!isSeller && !isBuyer && <p className="text-sm text-stone-600">Viewing as Ticket Office.</p>}
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold">Money</h2>
        <div className="flex justify-between"><span className="text-stone-600">Buyer pays</span><span>{usd(l.priceCents)}</span></div>
        <div className="flex justify-between"><span className="text-stone-600">TrojanTix fee (from seller)</span><span>− {usd(l.feeCents)}</span></div>
        <div className="flex justify-between font-semibold"><span>Seller receives</span><span>{usd(payout)}</span></div>
        <div className="flex justify-between border-t border-stone-200 pt-2">
          <span className="text-stone-600">Where the money is now</span>
          <span className="font-semibold text-cardinal">{moneyWhere}</span>
        </div>
        {l.paymentProvider && (
          <p className="text-xs text-stone-400">Payment: {l.paymentProvider === "stripe" ? "Stripe (test mode)" : "Mock processor"} · ref {l.paymentRef?.slice(0, 18)}</p>
        )}
      </section>

      {(isBuyer || isSeller) && (l.status === "PAYMENT_HELD" || l.status === "TRANSFERRED") && (
        <details className="card">
          <summary className="cursor-pointer font-semibold text-red-800">Something wrong? Open a dispute</summary>
          <div className="mt-3">
            <ActionForm action={disputeAction} fields={ids} label="Freeze funds & open dispute" className="btn-danger w-full"
              textarea={{ name: "reason", label: "What happened?", placeholder: "e.g. The seller asked me to pay extra on Venmo" }} />
          </div>
        </details>
      )}

      <Link href={`/report?listing=${l.id}`} className="btn-ghost w-full">Report a scam about this order</Link>
    </div>
  );
}
