import Link from "next/link";
import { Icon } from "./Icon";
import { logoutAction } from "@/app/actions/auth";

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 font-extrabold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold text-cardinal">
        <Icon name="ticket" className="h-5 w-5" />
      </span>
      <span className="text-lg">
        Trojan<span className="text-gold">Tix</span>
      </span>
    </span>
  );
}

export function Header({ user, unread }: { user: { name: string; role: string } | null; unread: number }) {
  return (
    <header className="sticky top-0 z-30 bg-cardinal text-white shadow">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <Link href={user ? "/tickets" : "/"} aria-label="TrojanTix home">
          <Wordmark />
        </Link>
        {user ? (
          <div className="flex items-center gap-1">
            <Link href="/notifications" className="relative rounded-lg p-2 hover:bg-white/10" aria-label="Notifications">
              <Icon name="bell" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-stone-900">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link href="/activity" className="rounded-lg p-2 hover:bg-white/10" aria-label="Account activity">
              <Icon name="activity" />
            </Link>
            <form action={logoutAction}>
              <button className="rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-white/10">Sign out</button>
            </form>
          </div>
        ) : (
          <Link href="/login" className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

export function BottomNav({ role }: { role: string }) {
  const items =
    role === "ADMIN"
      ? [
          { href: "/admin", label: "Dashboard", icon: "chart" },
          { href: "/gate", label: "Gate", icon: "scan" },
          { href: "/games", label: "Listings", icon: "search" },
          { href: "/report", label: "Report", icon: "flag" },
        ]
      : [
          { href: "/tickets", label: "My Tickets", icon: "ticket" },
          { href: "/games", label: "Buy", icon: "search" },
          { href: "/sell", label: "Sell", icon: "tag" },
          { href: "/orders", label: "Orders", icon: "receipt" },
          { href: "/report", label: "Report", icon: "flag" },
        ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl justify-around px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {items.map((i) => (
          <Link key={i.href} href={i.href}
            className="flex min-w-14 flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium text-stone-600 hover:text-cardinal">
            <Icon name={i.icon} />
            {i.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
