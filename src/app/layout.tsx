import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { runCutoffSweep } from "@/lib/escrow";
import { Header, BottomNav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "TrojanTix — verified student ticket resale",
  description: "Student prototype: verified, escrow-protected resale for student football tickets.",
};

export const viewport: Viewport = { themeColor: "#990000", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Enforce the transfer cutoff lazily on every request (no cron needed for the demo).
  await runCutoffSweep();
  const user = await getUser();
  const unread = user
    ? await db.notification.count({ where: { userId: user.id, read: false } })
    : 0;

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Header user={user ? { name: user.name, role: user.role } : null} unread={unread} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-28">{children}</main>
        <footer className="pb-24 text-center text-xs text-stone-500">
          Student prototype, not affiliated with USC Athletics. Demo data only.
        </footer>
        {user && <BottomNav role={user.role} />}
      </body>
    </html>
  );
}
