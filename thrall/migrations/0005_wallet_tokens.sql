ALTER TABLE products ADD COLUMN token_discount_percent INTEGER;
--> statement-breakpoint
UPDATE products SET token_discount_percent = 20 WHERE code = 'sub_monthly';
--> statement-breakpoint
UPDATE products SET token_discount_percent = 35 WHERE code = 'sub_semester';
--> statement-breakpoint
UPDATE products SET token_discount_percent = 60 WHERE code = 'sub_annual';
--> statement-breakpoint
CREATE TABLE brand_wallets (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  tokens_balance INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX brand_wallets_brand_idx ON brand_wallets(brand_id);
--> statement-breakpoint
CREATE TABLE top_services (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  tokens_cost INTEGER NOT NULL,
  duration_hours INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX top_services_code_idx ON top_services(code);
--> statement-breakpoint
CREATE TABLE profile_boosts (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES users(id),
  brand_id TEXT NOT NULL REFERENCES brands(id),
  purchased_by TEXT NOT NULL REFERENCES users(id),
  top_service_id TEXT NOT NULL REFERENCES top_services(id),
  tokens_spent INTEGER NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX profile_boosts_model_ends_idx ON profile_boosts(model_id, ends_at);
--> statement-breakpoint
CREATE INDEX profile_boosts_brand_created_idx ON profile_boosts(brand_id, created_at);
--> statement-breakpoint
CREATE TABLE wallet_transactions (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  purchase_id TEXT REFERENCES purchases(id),
  profile_boost_id TEXT REFERENCES profile_boosts(id),
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX wallet_transactions_brand_created_idx ON wallet_transactions(brand_id, created_at);
--> statement-breakpoint
INSERT INTO products (id, code, type, display_name, price_cop, tokens_granted, is_active, created_at, updated_at) VALUES
  ('prod_tokens_100',  'tokens_100',  'TOKEN_PACK', '100 tokens',  10000,  100,  1, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('prod_tokens_500',  'tokens_500',  'TOKEN_PACK', '500 tokens',  40000,  500,  1, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('prod_tokens_1500', 'tokens_1500', 'TOKEN_PACK', '1500 tokens', 100000, 1500, 1, strftime('%s','now')*1000, strftime('%s','now')*1000);
--> statement-breakpoint
INSERT INTO top_services (id, code, display_name, tokens_cost, duration_hours, is_active, created_at, updated_at) VALUES
  ('svc_top_perfil_24h', 'top_perfil_24h', 'Top perfil 24 horas', 50, 24, 1, strftime('%s','now')*1000, strftime('%s','now')*1000);
