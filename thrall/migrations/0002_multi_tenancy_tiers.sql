-- Rebuild brand_subscriptions with new columns; SQLite requires table recreation
-- to drop columns / add NOT NULL columns cleanly.
CREATE TABLE brand_subscriptions_new (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  tier TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at INTEGER,
  paid_until INTEGER,
  is_grandfathered INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
-- Grandfather every pre-existing brand as PAID active.
INSERT INTO brand_subscriptions_new (id, brand_id, tier, status, paid_until, is_grandfathered, created_at, updated_at)
SELECT id, brand_id, 'paid', 'active', NULL, 1, created_at, updated_at
FROM brand_subscriptions;
--> statement-breakpoint
DROP TABLE brand_subscriptions;
--> statement-breakpoint
ALTER TABLE brand_subscriptions_new RENAME TO brand_subscriptions;
--> statement-breakpoint
CREATE UNIQUE INDEX brand_subscriptions_brand_idx ON brand_subscriptions(brand_id);
