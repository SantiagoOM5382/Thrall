CREATE TABLE products (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  price_cop INTEGER NOT NULL,
  duration_days INTEGER,
  tokens_granted INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX products_code_idx ON products(code);
--> statement-breakpoint
CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  amount_cop INTEGER NOT NULL,
  status TEXT NOT NULL,
  wompi_reference TEXT NOT NULL,
  wompi_transaction_id TEXT,
  paid_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX purchases_wompi_reference_idx ON purchases(wompi_reference);
--> statement-breakpoint
CREATE INDEX purchases_brand_created_idx ON purchases(brand_id, created_at);
--> statement-breakpoint
INSERT INTO products (id, code, type, display_name, price_cop, duration_days, is_active, created_at, updated_at) VALUES
  ('prod_sub_monthly',  'sub_monthly',  'SUBSCRIPTION', 'Mensual',   85000,  30,  1, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('prod_sub_semester', 'sub_semester', 'SUBSCRIPTION', 'Semestral', 500000, 180, 1, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('prod_sub_annual',   'sub_annual',   'SUBSCRIPTION', 'Anual',     980000, 365, 1, strftime('%s','now')*1000, strftime('%s','now')*1000);
