import type { ListingStatus } from "@/generated/prisma/enums";
import { fmtTime } from "@/lib/time";

type L = {
  status: ListingStatus;
  createdAt: Date;
  heldAt: Date | null;
  transferredAt: Date | null;
  completedAt: Date | null;
};

const steps = [
  { key: "LISTED", title: "Listed", body: "Verified seller posted the ticket" },
  { key: "PAYMENT_HELD", title: "Payment held", body: "Buyer paid; money locked in escrow" },
  { key: "TRANSFERRED", title: "Ticket transferred", body: "Ticket moved to buyer's account" },
  { key: "COMPLETED", title: "Seller paid", body: "Transfer confirmed; payout released" },
] as const;

export function EscrowTracker({ l }: { l: L }) {
  const times = [l.createdAt, l.heldAt, l.transferredAt, l.completedAt];
  // How far the order got (cancelled/disputed orders keep their progress)
  const reached = times.reduce((n, t, i) => (t ? i : n), 0);
  const current = l.status === "COMPLETED" ? 4 : reached + 1;
  const halted = l.status === "CANCELLED" || l.status === "DISPUTED";

  return (
    <ol className="relative space-y-0">
      {steps.map((s, i) => {
        const done = i <= reached && (i < current || l.status === "COMPLETED");
        const active = i === current && !halted;
        return (
          <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && (
              <span className={`absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5 ${i < reached ? "bg-cardinal" : "bg-stone-200"}`} />
            )}
            <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ring-4 ring-white
              ${done ? "bg-cardinal text-white" : active ? "bg-gold text-stone-900" : "bg-stone-200 text-stone-500"}`}>
              {done ? "✓" : i + 1}
            </span>
            <div className="pt-1">
              <p className={`font-semibold ${!done && !active ? "text-stone-400" : ""}`}>
                {s.title}
                {active && <span className="ml-2 rounded-full bg-gold/30 px-2 py-0.5 text-[11px] font-semibold text-stone-800">Now</span>}
              </p>
              <p className="text-xs text-stone-500">
                {done && times[i] ? fmtTime(times[i]!) : s.body}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
