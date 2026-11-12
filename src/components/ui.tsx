import type { ListingStatus } from "@/generated/prisma/enums";

export function VerifiedBadge({ small = false }: { small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 font-semibold text-emerald-800 ring-1 ring-emerald-200 ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}>
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
        <path d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1 3 1 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1L2.7 15.5l1-3-1-3 2.8-1.6.9-3.1 3.2.3L12 2Zm-1.2 13.6 5.7-5.7-1.4-1.4-4.3 4.3-2.1-2.1-1.4 1.4 3.5 3.5Z" />
      </svg>
      Verified USC student
    </span>
  );
}

const statusStyle: Record<ListingStatus, string> = {
  LISTED: "bg-sky-50 text-sky-800 ring-sky-200",
  PAYMENT_HELD: "bg-amber-50 text-amber-800 ring-amber-200",
  TRANSFERRED: "bg-violet-50 text-violet-800 ring-violet-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-stone-100 text-stone-600 ring-stone-200",
  DISPUTED: "bg-red-50 text-red-800 ring-red-200",
};
const statusLabel: Record<ListingStatus, string> = {
  LISTED: "Listed",
  PAYMENT_HELD: "Payment held",
  TRANSFERRED: "Transferred",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
};

export function StatusPill({ status }: { status: ListingStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusStyle[status]}`}>
      {statusLabel[status]}
    </span>
  );
}

export function Alert({ kind = "info", children }: { kind?: "info" | "error" | "success" | "warn"; children: React.ReactNode }) {
  const s = {
    info: "bg-sky-50 text-sky-900 ring-sky-200",
    error: "bg-red-50 text-red-900 ring-red-200",
    success: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    warn: "bg-amber-50 text-amber-900 ring-amber-200",
  }[kind];
  return <div role={kind === "error" ? "alert" : "status"} className={`rounded-xl px-3 py-2.5 text-sm ring-1 ${s}`}>{children}</div>;
}

/** Pseudonymous seller handle so buyers never see names or student IDs. */
export function sellerHandle(sellerId: string) {
  let h = 0;
  for (const c of sellerId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `Trojan #${(h % 9000) + 1000}`;
}
