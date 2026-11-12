import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.now();
const secret = () => crypto.randomBytes(20).toString("hex");
const feeFor = (c: number) => Math.round(c * 0.05);

/** Kickoff N days out at a fixed local-ish time (stored in UTC). */
function kickoffIn(days: number, utcHour: number) {
  const d = new Date(now + days * DAY);
  d.setUTCHours(utcHour, 30, 0, 0);
  return d;
}

async function main() {
  // Wipe in dependency order
  await db.scamReport.deleteMany();
  await db.notification.deleteMany();
  await db.activityLog.deleteMany();
  await db.listing.deleteMany();
  await db.ticket.deleteMany();
  await db.game.deleteMany();
  await db.session.deleteMany();
  await db.loginChallenge.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash("fighton", 10);
  const mk = (email: string, name: string, studentId: string, extra: object = {}) =>
    db.user.create({ data: { email, name, studentId, passwordHash, ...extra } });

  // --- Demo users -----------------------------------------------------------
  const seller = await mk("alex.rivera@usc.edu", "Alex Rivera", "4821930576");
  const buyer = await mk("jordan.lee@usc.edu", "Jordan Lee", "7305618842");
  const admin = await mk("ticketoffice@usc.edu", "Ticket Office (Demo)", "1000000001", { role: "ADMIN" });
  await mk("sam.graduate@usc.edu", "Sam Graduate", "3390417725", { enrolled: false });

  // Supporting cast
  const casey = await mk("casey.nguyen@usc.edu", "Casey Nguyen", "5517023948");
  const morgan = await mk("morgan.patel@usc.edu", "Morgan Patel", "6640281195");
  const riley = await mk("riley.chen@usc.edu", "Riley Chen", "2298754103");
  const taylor = await mk("taylor.kim@usc.edu", "Taylor Kim", "8812640937");
  const devon = await mk("devon.brooks@usc.edu", "Devon Brooks", "9056317284");

  // --- Home games -----------------------------------------------------------
  // UCLA kicks off ~2h after seeding, so it is already inside the 3-hour cutoff.
  const uclaKick = new Date(Math.ceil((now + 2 * HOUR + 15 * 60_000) / 300_000) * 300_000);
  const gameData = [
    { opponent: "UCLA", kickoff: uclaKick, faceValueCents: 8000 },
    { opponent: "Michigan", kickoff: kickoffIn(3, 3), faceValueCents: 12000 },
    { opponent: "Notre Dame", kickoff: kickoffIn(10, 0), faceValueCents: 15000 },
    { opponent: "Oregon", kickoff: kickoffIn(17, 3), faceValueCents: 10000 },
    { opponent: "Washington", kickoff: kickoffIn(24, 20), faceValueCents: 9000 },
    { opponent: "Penn State", kickoff: kickoffIn(31, 0), faceValueCents: 11000 },
    { opponent: "Wisconsin", kickoff: kickoffIn(38, 23), faceValueCents: 7000 },
  ];
  const games = [];
  for (const g of gameData) games.push(await db.game.create({ data: g }));
  const G = Object.fromEntries(games.map((g) => [g.opponent, g]));

  // --- Season tickets (same seat every home game) ---------------------------
  const seats: Record<string, { section: string; row: string; seat: string }> = {
    [seller.id]: { section: "27", row: "45", seat: "12" },
    [casey.id]: { section: "26", row: "38", seat: "7" },
    [morgan.id]: { section: "28", row: "51", seat: "19" },
    [riley.id]: { section: "27", row: "60", seat: "3" },
  };
  const tickets: Record<string, Record<string, string>> = {}; // userId -> opponent -> ticketId
  for (const [userId, s] of Object.entries(seats)) {
    tickets[userId] = {};
    for (const g of games) {
      const t = await db.ticket.create({
        data: { gameId: g.id, ownerId: userId, ...s, faceValueCents: g.faceValueCents, qrSecret: secret() },
      });
      tickets[userId][g.opponent] = t.id;
    }
  }
  // Jordan (demo buyer) only holds Notre Dame + Penn State, so the
  // "already holds a ticket for this game" rule can be shown.
  for (const opp of ["Notre Dame", "Penn State"]) {
    await db.ticket.create({
      data: { gameId: G[opp].id, ownerId: buyer.id, section: "25", row: "22", seat: "30",
        faceValueCents: G[opp].faceValueCents, qrSecret: secret() },
    });
  }

  // --- Listings -------------------------------------------------------------
  const list = (sellerId: string, opp: string, price: number, extra: object = {}) =>
    db.listing.create({
      data: {
        ticketId: tickets[sellerId][opp], gameId: G[opp].id, sellerId,
        priceCents: price, feeCents: feeFor(price), createdAt: new Date(now - 2 * DAY), ...extra,
      },
    });

  // Open listings
  await list(casey.id, "Michigan", 9500);
  await list(morgan.id, "Michigan", 12000);
  await list(riley.id, "Michigan", 11000);
  await list(morgan.id, "Notre Dame", 14000);
  await list(riley.id, "Penn State", 10000);
  await list(casey.id, "Wisconsin", 6000);
  // These two are inside the UCLA cutoff and will be auto-cancelled on first page load.
  await list(casey.id, "UCLA", 8000);
  await list(morgan.id, "UCLA", 7500);

  // Completed sale: Casey -> Taylor, Notre Dame (ticket already moved)
  const ndTicket = tickets[casey.id]["Notre Dame"];
  await db.ticket.update({ where: { id: ndTicket }, data: { ownerId: taylor.id, transferCount: 1, qrSecret: secret() } });
  await list(casey.id, "Notre Dame", 15000, {
    buyerId: taylor.id, status: "COMPLETED", paymentProvider: "mock", paymentRef: "mock_seed_1",
    heldAt: new Date(now - 5 * DAY), transferredAt: new Date(now - 5 * DAY + 2 * HOUR),
    completedAt: new Date(now - 5 * DAY + 3 * HOUR), createdAt: new Date(now - 6 * DAY),
  });
  // Completed sale: Riley -> Devon, Oregon
  const orTicket = tickets[riley.id]["Oregon"];
  await db.ticket.update({ where: { id: orTicket }, data: { ownerId: devon.id, transferCount: 1, qrSecret: secret() } });
  await list(riley.id, "Oregon", 9000, {
    buyerId: devon.id, status: "COMPLETED", paymentProvider: "mock", paymentRef: "mock_seed_2",
    heldAt: new Date(now - 4 * DAY), transferredAt: new Date(now - 4 * DAY + HOUR),
    completedAt: new Date(now - 4 * DAY + 5 * HOUR), createdAt: new Date(now - 5 * DAY),
  });
  // Payment held in escrow: Morgan -> Taylor, Oregon (waiting on seller transfer)
  await list(morgan.id, "Oregon", 10000, {
    buyerId: taylor.id, status: "PAYMENT_HELD", paymentProvider: "mock", paymentRef: "mock_seed_3",
    heldAt: new Date(now - 6 * HOUR), createdAt: new Date(now - DAY),
  });
  // Dispute: Riley -> Devon, Washington
  await list(riley.id, "Washington", 9000, {
    buyerId: devon.id, status: "DISPUTED", paymentProvider: "mock", paymentRef: "mock_seed_4",
    heldAt: new Date(now - 2 * DAY), disputedAt: new Date(now - DAY),
    disputeReason: "Seller asked me to also send $20 on Venmo before transferring. Funds are still held.",
  });

  // --- Scam reports ---------------------------------------------------------
  await db.scamReport.createMany({
    data: [
      { reporterId: buyer.id, source: "GroupMe",
        description: "User 'USC Tix 2027' in the Class of 2027 GroupMe offered Michigan tickets for $60 via Zelle, then left the chat after another student paid.",
        createdAt: new Date(now - 3 * DAY) },
      { reporterId: taylor.id, source: "Instagram",
        description: "DM from an account created last week selling 4 Notre Dame student tickets. Wanted Apple Pay 'friends & family' only and sent a blurry screenshot as proof.",
        createdAt: new Date(now - DAY) },
      { reporterId: casey.id, source: "Fake payment",
        description: "Buyer outside TrojanTix sent me a fake Venmo 'payment complete' screenshot and asked me to transfer first.",
        createdAt: new Date(now - 10 * HOUR) },
    ],
  });

  // --- Activity history -----------------------------------------------------
  const macChrome = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const bot = "python-requests/2.31";
  const act = (userId: string | null, email: string, action: string, detail: string, ip: string, ua: string, ago: number, suspicious = false) =>
    db.activityLog.create({ data: { userId, email, action, detail, ip, userAgent: ua, suspicious, createdAt: new Date(now - ago) } });

  await act(seller.id, seller.email, "LOGIN", "Signed in with 2FA (Chrome on Mac)", "68.181.17.40", macChrome, 3 * DAY);
  await act(seller.id, seller.email, "LOGOUT", "", "68.181.17.40", macChrome, 3 * DAY - HOUR);
  await act(buyer.id, buyer.email, "LOGIN", "Signed in with 2FA (Safari on iPhone)", "68.181.22.9", iphone, 2 * DAY);
  await act(buyer.id, buyer.email, "SCAM_REPORTED", "GroupMe", "68.181.22.9", iphone, 3 * DAY);
  await act(admin.id, admin.email, "LOGIN", "Signed in with 2FA (Chrome on Mac)", "68.181.1.5", macChrome, DAY);
  // Credential-stuffing attempt against Riley, blocked by 2FA + rate limiting
  for (let i = 0; i < 4; i++) {
    await act(riley.id, riley.email, "LOGIN_FAILED", "Wrong USC NetID or password", "185.220.101.7", bot, 7 * HOUR - i * 60_000, true);
  }
  await act(null, riley.email, "LOGIN_RATE_LIMITED", "Too many sign-in attempts", "185.220.101.7", bot, 7 * HOUR - 5 * 60_000, true);
  await act(riley.id, riley.email, "LOGIN", "Signed in with 2FA (Safari on iPhone)", "68.181.30.2", iphone, 5 * HOUR);

  await db.notification.createMany({
    data: [
      { userId: riley.id, kind: "SECURITY", title: "Blocked sign-in attempts",
        body: "5 failed sign-ins from IP 185.220.101.7 were blocked. Your password was never accepted without your 2FA code." },
      { userId: taylor.id, kind: "SOLD", title: "Payment held in escrow",
        body: "Your $100.00 payment for Oregon is held. The seller has until the transfer cutoff to send the ticket." },
    ],
  });

  console.log("Seeded TrojanTix demo data:");
  console.log(`  ${games.length} home games, ${await db.ticket.count()} tickets, ${await db.listing.count()} listings`);
  console.log("  Demo logins (password: fighton)");
  console.log("    seller  alex.rivera@usc.edu");
  console.log("    buyer   jordan.lee@usc.edu");
  console.log("    admin   ticketoffice@usc.edu");
  console.log("    blocked sam.graduate@usc.edu (not enrolled)");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
