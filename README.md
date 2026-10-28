# 🎓 CampusBid — College Peer Auction Marketplace

A full-stack, real-time peer-to-peer auction marketplace designed specifically for campus students to buy and sell college essentials (cycles, scientific calculators, textbooks, hostel gear, electronics) with **ACID transactions**, **anti-sniping deadline extension**, **automated proxy bidding**, **sales lifecycle & dual handover confirmations**, and a **context-aware AI assistant**.

---

## 🏗️ Architecture & Stack

- **Frontend**: React 18, Vite, Tailwind CSS v4, Lucide Icons, Canvas Confetti, Socket.IO Client.
- **Backend**: Node.js & Express REST API, WebSockets (Socket.IO).
- **Database**: PostgreSQL (Postgres 16 / embedded persistent PGlite with zero external dependencies, or Postgres server via `DATABASE_URL`).
- **Data Model**: Follows `campus_auction_schema.sql` with strict numeric precision `NUMERIC(12,2)`, append-only bid ledger, and audit trail in `auction_events`.

```
┌────────────────────────────────────────────────────────┐
│               Frontend — React + Vite                  │
│ Home • Discovery • Bidding • Seller Hub • AI Assistant │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP REST & WebSockets
┌──────────────────────────┴─────────────────────────────┐
│                 Backend — Node.js & Express            │
│  Auth • Auction Rules • Bidding Engine • Sales Closer  │
├──────────────────────────┬─────────────────────────────┤
│        PostgreSQL        │        Live Services        │
│ ACID Ledger & Locks      │ Socket.IO & 2.5s Closer Job │
└──────────────────────────┴─────────────────────────────┘
```

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install
npm --prefix client install

# 2. Seed database with demo students & active auctions
npm run seed

# 3. Run integration & bidding tests
npm test

# 4. Start the app
npm start
# -> App will be live at http://localhost:5000 (serves both React SPA and API)
# -> Or run both API and Vite in development mode:
# npm run dev
```

The embedded PGlite database is stored in `data/pglite_db` and persists across
server restarts and code changes. Do not delete this directory unless you
intentionally want to create a fresh database. For shared or deployed
environments, set `DATABASE_URL` to use an external PostgreSQL database.

---

## 🧑‍🎓 Pre-Seeded Demo Student Accounts

The top of the UI features an **Instant Demo Switcher Bar** so you can switch between students with 1-click without typing credentials:

| Student Name | Campus Email | Role in Demo | Notes |
| :--- | :--- | :--- | :--- |
| **Priya Sharma** | `priya.sharma@campus.edu` | Seller | Listed Hero Cycle, Mini Fridge, Kindle |
| **Rahul Verma** | `rahul.verma@campus.edu` | Buyer | Active bidder, has saved search alerts |
| **Ananya Patel** | `ananya.patel@campus.edu` | Seller / Buyer | Listed Engineering Drafter, Calculus book |
| **Vikram Singh** | `vikram.singh@campus.edu` | Buyer | Bidder on Calculator & Anti-sniping item |
| **Campus Admin** | `admin@campus.edu` | Moderator | Campus moderation privileges |

*Password for all accounts:* `password123` (Admin: `adminpassword`).

---

## 🔐 Authentication and Account Persistence

- Registration and login are handled by `server/routes/auth.js`.
- Passwords are hashed with `bcryptjs`; passwords are never stored in plain text.
- Successful login returns a JWT that is stored by the frontend in `localStorage`.
- Existing tokens in `sessionStorage` are migrated automatically.
- Sessions remain available after browser refreshes, frontend rebuilds, and server restarts.
- A session is removed only when the server reports an invalid or expired token.

For local development, user accounts and marketplace data are stored in:

```text
data/pglite_db
```

Do not delete this directory or run a clean-database script unless you intentionally
want to remove locally registered accounts. For a shared or deployed environment,
configure an external database:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=replace-with-a-long-random-secret
PORT=5000
```

---

## 🎯 Core Marketplace Flow

### 1. Atomic Bidding Engine & Concurrency
- Implemented in `server/services/auctionEngine.js`.
- Bids are executed inside a database transaction with a row lock (`SELECT * FROM auctions WHERE id = $1 FOR UPDATE`).
- Enforces:
  * First bid $\ge$ starting price.
  * Subsequent bids $\ge$ current price $+$ minimum increment.
  * Rejects self-bidding by sellers.
  * Prevents double-bidding against oneself.
  * Atomically appends to `bids` and updates `auctions.current_price` and `auctions.current_high_bidder_id`.

### 2. Anti-Sniping Rule (< 30s Extension)
- If a valid bid arrives within the **final 30 seconds** of an auction's deadline, the server automatically extends the closing time to **current server time + 60 seconds**.
- The extension is recorded in `auction_events` and broadcasted via WebSockets to all viewers in real-time.
- *Demo item:* **"⚡ Anti-Sniping Demo: Yonex Badminton Rackets"** is seeded with an ending countdown so you can test this live!

### 3. Automatic Proxy Bidding
- Buyers can specify a ceiling amount (`PUT /api/auctions/:id/auto-bid`).
- The engine automatically counters competing bids in increments of `min_bid_increment` up to the user's ceiling.

### 4. Auction Closing & Sales Lifecycle
- A background worker (`server/services/closerJob.js`) checks every 2.5 seconds for expired auctions.
- Auctions close idempotently in a transaction:
  * If no bids: recorded as `unsold` in `sales`.
  * If bids exist: winning bidder is provisional winner; status set to `pending_seller_approval`.
- **Seller Decision**: Seller can `approve` (moves to `reserved`) or `reject` (`POST /api/sales/:id/decision`).
- **Dual Handover Confirmation**: Buyer and seller both confirm physical handover (`POST /api/sales/:id/handover-confirmations`). Only when both have confirmed is the transaction marked `completed`!

### 5. AI Assistant
- Natural language query parser (`POST /api/assistant/query`) that translates prompts like *"Find a cycle under ₹2000"* or *"Compare scientific calculators"* into structured filters and side-by-side item cards.
- **Safety**: Proposes bids with explicit student confirmation required before executing.

### 6. Notifications & Saved Search Alerts
- In-app notification center with real-time badges and Socket.IO delivery.
- Buyers receive bid acceptance and outbid alerts.
- Sellers receive new-bid, auction-closed, and cancellation alerts.
- Administrators receive new-listing, bid, and moderation alerts.
- Browser notifications can be enabled from the notification menu.
- Students save search criteria (e.g. *"Calculator under ₹500"*); whenever a matching item is published, an alert is triggered automatically.

---

## 🧭 End-to-End Auction Lifecycle

```text
Seller registers/logs in
    ↓
Creates a listing with price, category, images, and duration
    ↓
Admins receive a new-listing notification
    ↓
Buyer browses and places a bid
    ↓
Bid transaction validates and records the bid
    ↓
Buyer, seller, and admins receive bid notifications
    ↓
Auction expires and the closer worker creates a sale record
    ↓
Winning buyer and seller are notified
    ↓
Seller approves or rejects the sale
    ↓
Approved sale becomes reserved
    ↓
Buyer and seller confirm physical handover
    ↓
Sale becomes completed after both confirmations
```

Auction durations are entered in hours and support fractional values:

```text
0.75 hours = 45 minutes
3 hours = 3 hours
24 hours = 1 day
```

---

## 🛡️ Administrator Controls

The admin dashboard provides:

- Marketplace overview statistics.
- User suspension and restoration.
- Auction listing cancellation.
- Transaction blocking while a sale is pending or reserved.
- Notifications for new listings, bids, and moderation activity.

Administrators cannot create listings or place bids.

---

## 🗂️ Project Structure

```text
server/
  server.js                    Express and Socket.IO startup
  db.js                        PostgreSQL/PGlite connection and transactions
  schema.sql                   Database schema
  seed.js                      Demo users and auctions
  middleware/auth.js            JWT and role authorization
  routes/                      REST API endpoints
  services/auctionEngine.js    Bid and proxy-bidding rules
  services/closerJob.js        Expired-auction worker
  services/notificationService.js
                               Persistent and real-time notifications

client/src/
  App.jsx                      Frontend view routing
  context/AuthContext.jsx      Authentication and persistent session state
  context/SocketContext.jsx    Socket.IO notifications and live updates
  pages/                       Marketplace, authentication, sales, and admin views
  components/                  Reusable cards, modals, timers, and navigation
```

---

## 🔌 Important API Endpoints

| Area | Endpoint | Purpose |
| :--- | :--- | :--- |
| Auth | `POST /api/auth/register` | Register a student |
| Auth | `POST /api/auth/login` | Sign in and receive a JWT |
| Auctions | `GET /api/auctions` | Browse and filter listings |
| Auctions | `POST /api/auctions` | Create a seller listing |
| Bids | `POST /api/auctions/:id/bids` | Place a manual bid |
| Bids | `PUT /api/auctions/:id/auto-bid` | Configure proxy bidding |
| Sales | `POST /api/sales/:id/decision` | Approve or reject a sale |
| Sales | `POST /api/sales/:id/handover-confirmations` | Confirm handover |
| Notifications | `GET /api/notifications` | Read current user's notifications |
| Admin | `PATCH /api/admin/auctions/:id/status` | Activate or cancel a listing |
| Health | `GET /api/health` | Check server availability |

Protected endpoints require:

```http
Authorization: Bearer <jwt-token>
```

---

## 🧪 Testing

Run the automated test suite:
```bash
npm test
```
This verifies seller self-bid rejection, minimum bid validation, atomic bid
execution, anti-sniping extension logging, authentication, auction details,
the AI assistant, and full-stack REST endpoint routing.

Build the production frontend with:

```bash
npm run build
```

The build runs TypeScript checking and Vite bundling, producing `client/dist`.

---

## 🧰 Troubleshooting

### Invalid email or password

Confirm that the account exists in the current database and that the correct
demo password is being used. If the embedded database was deleted, restore it
from a backup or run `npm run seed` to recreate the demo accounts.

### Server does not start

Check whether port `5000` is already in use. Stop the old Node server or use a
different `PORT` value. If PGlite reports a stale lock, restart the server; the
database helper removes its known stale lock and retries safely.

### Notifications do not appear

Refresh the browser tabs after restarting the server, sign in again if the JWT
was intentionally invalidated, and open the notification bell. In-app
notifications are persisted in the database, while live toasts require an
active Socket.IO connection.
