import QRCode from "qrcode";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ticketPayload } from "@/lib/totp";

export const dynamic = "force-dynamic";

// Returns the current rotating code for a ticket the caller owns.
export async function GET(_req: Request, ctx: RouteContext<"/api/tickets/[id]/code">) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const t = await db.ticket.findUnique({
    where: { id },
    include: { listings: { where: { status: { in: ["PAYMENT_HELD", "DISPUTED"] } }, select: { id: true } } },
  });
  if (!t || t.ownerId !== user.id) return Response.json({ error: "Not your ticket" }, { status: 404 });
  if (t.usedAt) return Response.json({ error: "Ticket already used" }, { status: 409 });
  if (t.listings.length) return Response.json({ error: "Ticket locked while sale is in escrow" }, { status: 423 });

  const { payload, expiresAt, step } = ticketPayload(t.id, t.qrSecret);
  const svg = await QRCode.toString(payload, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#1c1917", light: "#ffffff" },
  });
  return Response.json(
    { svg, payload, expiresAt, step, serverNow: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
