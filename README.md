# TrojanTix

**Verified, student-only resale for USC home football tickets, with escrow.**

> Student prototype for an NAE Grand Challenge (Secure Cyberspace) class project.
> **Not affiliated with USC Athletics.** No real USC logos, accounts or payments are used. All data is fake.

## The problem

Scammers pose as USC students in GroupMe chats, sell tickets that don't exist, and collect payment through
Venmo, Zelle or Apple Pay, which can't be reversed. Sellers get scammed too, with fake "payment sent" screenshots.
USC already allows student-to-student ticket transfers, but the money moves outside any protected system.

## How TrojanTix fixes it

| Threat | TrojanTix control |
|---|---|
| Fake "student" sellers | Simulated USC SSO: only `@usc.edu` and **enrolled** students, plus a 6-digit 2FA code every sign-in |
| Pay-first, never get the ticket | **Escrow**: the buyer's payment is *held*. The seller is paid only after the ticket is in the buyer's account |
| Fake payment screenshots | Sellers never act on screenshots. The order page shows where the money actually is |
| Screenshot / resold QR codes | Ticket QR **rotates every 15 s** (HMAC/TOTP from a server secret). Transfers rotate the ticket's secret, so the seller's old code dies |
| Price gouging and flipping | Server-enforced **face-value cap**, one ticket per student per game, admin view of resale per game and repeat sellers |
| Last-minute scams | **No listings or purchases within 3 h of kickoff**. Unsold listings auto-cancel; unsent paid orders auto-refund |
| Account takeover | Rate-limited login, 2FA and purchases; per-account **activity log**; new-device alerts; "sign out other devices" |
| Silent misuse of your ticket | **Alerts** whenever your ticket is listed, sold, transferred or scanned |
| Tampered requests | Every price, fee, status and rule is re-checked **on the server**; status changes use atomic compare-and-set updates |

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Prisma 7 + SQLite · Stripe (test mode, optional) · `qrcode` + `jsQR`

## Setup

Requires **Node.js 20+**.

```bash
npm install
npm run setup     # creates .env (random APP_SECRET), creates the SQLite DB and seeds demo data
npm run dev       # http://localhost:3000
```

Reset the demo data at any time (do this right before recording):

```bash
npm run db:reset
```

The seed dates games **relative to when you run it**, so the demo never goes stale. UCLA always kicks off about
2 hours after seeding, which puts it inside the 3-hour cutoff.

### Environment variables (`.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file, default `file:./prisma/dev.db` |
| `APP_SECRET` | Long random string, kept on the server and mixed into every ticket's rotating QR code. `npm run setup` generates one |
| `APP_URL` | Base URL for Stripe redirects, default `http://localhost:3000` |
| `STRIPE_SECRET_KEY` | **Optional.** A Stripe *test* key (`sk_test_…`). Leave empty to use the built-in mock checkout. Live keys are refused |

**Payments.**
- **With a Stripe test key:** "Buy" opens Stripe Checkout with `capture_method: manual`. The card is *authorized and held*, not charged. TrojanTix captures it when the order completes and cancels the hold (or refunds) when an order is cancelled or a dispute is refunded. Use test card `4242 4242 4242 4242`. Stripe releases uncaptured holds after about 7 days, which is fine for a demo.
- **Without a key:** a mock card form runs exactly the same escrow state machine. `4242 4242 4242 4242` succeeds; `4000 0000 0000 0002` simulates a decline.

## Demo accounts

Every password is **`fighton`**. The login page has one-tap buttons for each account.

| Role | Email | Notes |
|---|---|---|
| Seller | `alex.rivera@usc.edu` | Season ticket for all 7 home games (Sec 27, Row 45) |
| Buyer | `jordan.lee@usc.edu` | Only holds Notre Dame and Penn State, so those games show the "one ticket per student" rule |
| Ticket Office (admin) | `ticketoffice@usc.edu` | Dashboard and gate scanner |
| Rejected: not enrolled | `sam.graduate@usc.edu` | Shows the enrollment check |
| Rejected: non-USC | any `@gmail.com` etc. | Shows the domain check |

The 2FA code appears on screen in a "demo phone" box and in the server console (`[2FA DEMO] …`).

## 2-minute demo script

Use two browser windows side by side (or one normal and one private window): **A = seller**, **B = buyer**.
Narrow the windows (or use phone mode in dev tools) since the app is mobile-first.

**0:00 Login (15 s).** In window A, tap **Non-USC**, then Continue: *"Only @usc.edu accounts…"*. Tap **Not enrolled**: rejected.
Tap **Seller**, then Continue. The 2FA screen shows the code on the demo phone. Enter it and you land on **My Tickets**.
*Say: "Every user is a verified, enrolled student, with a second factor every time."*

**0:15 List a ticket (20 s).** Tap **Sell** and pick *vs. Michigan*. Type **150**: the field turns red and the button disables
(face-value cap $120). Type **100** and point at the fee box: *buyer pays $100, fee $5, you receive $95*. Tap **List ticket**.
The bell shows an alert: *"Your ticket was listed. Not you? …"*

**0:35 Buy (20 s).** In window B, sign in as **Buyer**, then **Buy** → *USC vs. Notre Dame*: *"You already hold a ticket for this game."*
Go back to *USC vs. Michigan*. Point out the **Verified USC student** badge and that no name or ID is shown.
Buy the **$100** listing and pay with `4242…`.

**0:55 Escrow tracker (25 s).** The order page shows **Payment held** and *"Where the money is now: Held in escrow."*
In window A open **Orders** → Michigan and tap **Send ticket transfer to buyer**.
In window B reload: **Ticket transferred**. Tap **View my ticket**, then come back and tap
**I have the ticket — release payment**. The tracker reaches **Seller paid**. Window A's bell shows *"Payout released: $95.00"*.
*Say: "The seller never gets money until the buyer has the ticket, so neither side can be scammed."*

**1:20 Rotating QR (15 s).** In window B open My Tickets → Michigan. The QR refreshes every 15 s with a countdown.
*Say: "A screenshot is useless within seconds, and the seller's old code died the moment the ticket transferred."*
Tap **Copy code (for gate demo)**.

**1:35 Gate scan (15 s).** In window A, sign out and sign in as **Ticket Office**, then tap **Gate**.
Paste the code → **VALID** (shows *Student ID ends in …* to match against the ID card). Validate the same code again → **ALREADY USED**.
To show a dead screenshot, wait 30 s and paste a code copied earlier → **INVALID: code expired**.
(**Scan with camera** also works: point a phone or webcam at window B's QR.)

**1:50 Admin dashboard (10 s).** Tap **Dashboard**: total listings, completed sales, **money held in escrow**, open disputes,
**resale by game** with repeat sellers flagged, scam reports, and account-takeover signals (the seeded credential-stuffing
attempt against Riley). Resolve the seeded Washington dispute with **Refund buyer**.

**Extras if time allows:** **Report** (scam report form with red flags) · **Activity** icon (sign-in history, new-device
flag, "sign out other devices") · *USC vs. UCLA* (inside the 3-hour cutoff, so sales are closed and the seeded listings
auto-cancelled).

## Escrow state machine

```
LISTED ──buyer pays──▶ PAYMENT_HELD ──seller transfers──▶ TRANSFERRED ──buyer confirms / kickoff──▶ COMPLETED
  │                         │                                  │
  │ seller cancels /        │ cutoff with no transfer          │
  │ 3-h cutoff              │ → refund                         │
  ▼                         ▼                                  ▼
CANCELLED ◀───────────── CANCELLED            DISPUTED (from PAYMENT_HELD or TRANSFERRED)
                                                 └─ Ticket Office: refund buyer → CANCELLED | release → COMPLETED
```

Every transition lives in `src/lib/escrow.ts`. Each one is a conditional `updateMany(where: { status: … })`, so
double-clicks and two buyers racing for the same ticket can't both succeed. The cutoff sweep runs lazily on page loads
(at most once every 5 s), and the admin dashboard has a **Run cutoff check** button.

## Project layout

```
prisma/schema.prisma      data model (User, LoginChallenge, Session, Game, Ticket, Listing/escrow order,
                          Notification, ActivityLog, ScamReport)
prisma/seed.ts            demo data
src/lib/auth.ts           simulated SSO, 2FA challenge, sessions (httpOnly cookie, hashed token), new-device detection
src/lib/escrow.ts         listing, purchase, transfer, completion, disputes, cutoff sweep (all server-side rules)
src/lib/totp.ts           rotating ticket codes (HMAC, 15-second steps, ±1 step tolerance)
src/lib/rateLimit.ts      sliding-window limiter (login, 2FA, purchase, listing, gate, reports)
src/lib/stripe.ts         Stripe test-mode client; capture / cancel / refund helpers
src/app/actions/*         server actions (auth, market, gate)
src/app/…                 pages: tickets, sell, games, checkout, orders, notifications, activity, report, gate, admin
```

## Known limitations (it's a prototype)

- SSO and 2FA are simulated. A real version would use USC's identity provider (SAML/OIDC) and Duo.
- "Transfer" moves the ticket inside TrojanTix's own database. A real version would call the official ticketing system's transfer API.
- Rate limits are in memory (single server). Production would use Redis.
- Email alerts are logged to the in-app Alerts panel and the console instead of being sent.
- The Stripe return URL is verified server-side, but there is no webhook handler. Production should also listen for `checkout.session.completed`.
