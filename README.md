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
# 1. Install dependencies (already completed)
npm install
npm --prefix client install

# 2. Seed database with demo students & active auctions
npm run seed

# 3. Run integration & bidding tests
npm test

# 4. Start the app
npm start
# -> App will be live at http://localhost:5000 (serves both React SPA and API)
# -> Or run in dev mode: npm run dev
```

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

## 🎯 Verification of Key Requirements

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
- In-app notification center with real-time badges.
- Native browser push notifications using the Web Notification API.
- Students save search criteria (e.g. *"Calculator under ₹500"*); whenever a matching item is published, an alert is triggered automatically.

---

## 🧪 Testing

Run the automated test suite:
```bash
npm test
```
Verifies seller self-bid rejection, sub-increment rejection, atomic bid execution, anti-sniping extension logging, and full-stack REST endpoint routing.

