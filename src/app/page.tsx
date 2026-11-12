import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Icon } from "@/components/Icon";

const points = [
  { icon: "user", title: "Verified students only", body: "USC sign-on plus a one-time code. Every buyer and seller is an enrolled student." },
  { icon: "lock", title: "Money held in escrow", body: "Your payment is held, not sent. The seller is paid only after the ticket lands in your account." },
  { icon: "scan", title: "Screenshots don't work", body: "Ticket QR codes rotate every 15 seconds, so a copied image is useless at the gate." },
  { icon: "tag", title: "Face-value cap", body: "No price gouging. Resale can never exceed what the ticket originally cost." },
];

export default async function Home() {
  if (await getUser()) redirect("/tickets");
  return (
    <div className="space-y-6 pt-2">
      <section className="overflow-hidden rounded-3xl bg-cardinal p-6 text-white shadow">
        <p className="text-xs font-semibold tracking-widest text-gold uppercase">Student-to-student resale</p>
        <h1 className="mt-2 text-3xl leading-tight font-extrabold">Stop getting scammed for game-day tickets.</h1>
        <p className="mt-3 text-white/85">
          No more Venmo-first deals in GroupMe chats. TrojanTix verifies both students and holds the money until the
          ticket transfer is confirmed.
        </p>
        <Link href="/login" className="btn-gold mt-5 w-full text-base sm:w-auto">Sign in with your USC account</Link>
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        {points.map((p) => (
          <div key={p.title} className="card flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/30 text-cardinal">
              <Icon name={p.icon} />
            </span>
            <div>
              <h2 className="font-semibold">{p.title}</h2>
              <p className="muted">{p.body}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
