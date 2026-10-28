-- Campus Auction Schema - Full PostgreSQL & PGlite compatible

CREATE TABLE IF NOT EXISTS users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name           VARCHAR(120) NOT NULL,
    display_name        VARCHAR(60) NOT NULL,
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    campus_id           VARCHAR(100),
    email_verified      BOOLEAN NOT NULL DEFAULT FALSE,
    campus_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    verification_code   VARCHAR(20),
    account_type        VARCHAR(20) NOT NULL DEFAULT 'buyer'
                        CHECK (account_type IN ('buyer', 'seller')),
    is_admin            BOOLEAN NOT NULL DEFAULT FALSE,
    account_status      VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (account_status IN ('active', 'suspended', 'disabled')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id          SMALLSERIAL PRIMARY KEY,
    name        VARCHAR(60) NOT NULL UNIQUE,
    slug        VARCHAR(70) NOT NULL UNIQUE
);

INSERT INTO categories (name, slug) VALUES
    ('Cycles', 'cycles'),
    ('Calculators', 'calculators'),
    ('Books', 'books'),
    ('Electronics', 'electronics'),
    ('Hostel Items', 'hostel-items'),
    ('Other', 'other')
ON CONFLICT (slug) DO NOTHING;

-- One row represents one item auction.
CREATE TABLE IF NOT EXISTS auctions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id               UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_id             SMALLINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    title                   VARCHAR(160) NOT NULL,
    description             TEXT NOT NULL,
    item_condition          VARCHAR(20) NOT NULL
                            CHECK (item_condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
    starting_price          NUMERIC(12,2) NOT NULL CHECK (starting_price > 0),
    min_bid_increment       NUMERIC(12,2) NOT NULL CHECK (min_bid_increment > 0),
    -- NULL means there has not been an accepted bid yet.
    current_price           NUMERIC(12,2),
    current_high_bidder_id  UUID REFERENCES users(id) ON DELETE RESTRICT,
    start_time              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time                TIMESTAMPTZ NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'scheduled', 'active', 'closed', 'cancelled')),
    cancellation_reason     TEXT,
    closed_at               TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_time > start_time),
    CHECK ((current_price IS NULL AND current_high_bidder_id IS NULL)
        OR (current_price IS NOT NULL AND current_high_bidder_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS auction_images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id      UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    image_url       TEXT NOT NULL,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public, append-only history of accepted bids. The API should not update/delete rows.
CREATE TABLE IF NOT EXISTS auto_bid_limits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id      UUID NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
    bidder_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    maximum_amount  NUMERIC(12,2) NOT NULL CHECK (maximum_amount > 0),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (auction_id, bidder_id)
);

CREATE TABLE IF NOT EXISTS bids (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id          UUID NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
    bidder_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    bid_type            VARCHAR(20) NOT NULL DEFAULT 'manual'
                        CHECK (bid_type IN ('manual', 'automatic')),
    auto_bid_limit_id   UUID REFERENCES auto_bid_limits(id) ON DELETE RESTRICT,
    request_key         UUID NOT NULL UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((bid_type = 'manual' AND auto_bid_limit_id IS NULL)
        OR (bid_type = 'automatic' AND auto_bid_limit_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS questions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id          UUID NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
    asker_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    question_text       TEXT NOT NULL CHECK (CHAR_LENGTH(question_text) BETWEEN 1 AND 1000),
    answer_text         TEXT,
    answered_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    answered_at         TIMESTAMPTZ,
    visibility          VARCHAR(20) NOT NULL DEFAULT 'visible'
                        CHECK (visibility IN ('visible', 'hidden', 'pending_review')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Criteria are explicit columns so they can be indexed and validated.
CREATE TABLE IF NOT EXISTS saved_searches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    keyword             VARCHAR(160),
    category_id         SMALLINT REFERENCES categories(id) ON DELETE SET NULL,
    item_condition      VARCHAR(20)
                        CHECK (item_condition IS NULL OR item_condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
    min_price           NUMERIC(12,2) CHECK (min_price IS NULL OR min_price >= 0),
    max_price           NUMERIC(12,2) CHECK (max_price IS NULL OR max_price >= 0),
    price_basis         VARCHAR(20) NOT NULL DEFAULT 'starting_price'
                        CHECK (price_basis IN ('starting_price', 'current_price')),
    notifications_on    BOOLEAN NOT NULL DEFAULT TRUE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (min_price IS NULL OR max_price IS NULL OR min_price <= max_price)
);

-- One row per auction outcome. For an auction with bids, insert this when it closes.
-- For a cancelled auction, create a cancelled outcome row as well as an auction event.
CREATE TABLE IF NOT EXISTS sales (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id          UUID NOT NULL UNIQUE REFERENCES auctions(id) ON DELETE RESTRICT,
    seller_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    buyer_id            UUID REFERENCES users(id) ON DELETE RESTRICT,
    winning_bid_id      UUID REFERENCES bids(id) ON DELETE RESTRICT,
    final_price         NUMERIC(12,2) CHECK (final_price IS NULL OR final_price > 0),
    status              VARCHAR(30) NOT NULL
                        CHECK (status IN ('pending_seller_approval', 'reserved', 'rejected', 'completed', 'pickup_failed', 'unsold', 'cancelled')),
    seller_decided_at   TIMESTAMPTZ,
    reserved_at         TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    failed_at           TIMESTAMPTZ,
    failure_reason      TEXT,
    outcome_notes       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Record each participant's confirmation. Mark sale completed only after both sides confirm.
CREATE TABLE IF NOT EXISTS handover_confirmations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    confirmed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note            TEXT,
    UNIQUE (sale_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type   VARCHAR(50) NOT NULL,
    title               VARCHAR(160) NOT NULL,
    body                TEXT NOT NULL,
    auction_id          UUID REFERENCES auctions(id) ON DELETE SET NULL,
    sale_id             UUID REFERENCES sales(id) ON DELETE SET NULL,
    read_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint        TEXT NOT NULL UNIQUE,
    p256dh_key      TEXT NOT NULL,
    auth_key        TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auction_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id      UUID NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
    actor_id        UUID REFERENCES users(id) ON DELETE RESTRICT,
    event_type      VARCHAR(50) NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_public       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auctions_status_end_time ON auctions(status, end_time);
CREATE INDEX IF NOT EXISTS idx_auctions_category_status ON auctions(category_id, status);
CREATE INDEX IF NOT EXISTS idx_auctions_condition ON auctions(item_condition);
CREATE INDEX IF NOT EXISTS idx_bids_auction_created ON bids(auction_id, created_at);
CREATE INDEX IF NOT EXISTS idx_questions_auction_created ON questions(auction_id, created_at);
CREATE INDEX IF NOT EXISTS idx_saved_searches_active ON saved_searches(is_active, notifications_on);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_events_auction_created ON auction_events(auction_id, created_at);
