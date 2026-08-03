-- Rename top_services.duration_hours → duration_minutes so 15-min boosts fit.
-- Existing rows were in hours; multiply by 60 to preserve their real duration
-- before the schema change re-interprets the column.
UPDATE top_services SET duration_hours = duration_hours * 60;
--> statement-breakpoint
ALTER TABLE top_services RENAME COLUMN duration_hours TO duration_minutes;
--> statement-breakpoint

-- Wipe the old single seed and install the four production boost tiers with
-- deliberately "specific-looking" token costs so wallet balances feel real
-- and earned instead of round.
DELETE FROM top_services;
--> statement-breakpoint
INSERT INTO top_services (id, code, display_name, tokens_cost, duration_minutes, is_active, created_at, updated_at) VALUES
  ('svc_top_15m',  'top_15m',  'Top perfil 15 min',   495,   15,   1, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('svc_top_1h',   'top_1h',   'Top perfil 1 hora',  1847,   60,   1, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('svc_top_4h',   'top_4h',   'Top perfil 4 horas', 6283,  240,   1, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('svc_top_24h',  'top_24h',  'Top perfil 24 horas', 19549, 1440, 1, strftime('%s','now')*1000, strftime('%s','now')*1000);
--> statement-breakpoint

-- Subscription prices + token discount % per plan.
UPDATE products SET price_cop = 60000,  token_discount_percent = 20, updated_at = strftime('%s','now')*1000 WHERE code = 'sub_monthly';
--> statement-breakpoint
UPDATE products SET price_cop = 250000, token_discount_percent = 35, updated_at = strftime('%s','now')*1000 WHERE code = 'sub_semester';
--> statement-breakpoint
UPDATE products SET price_cop = 500000, token_discount_percent = 60, updated_at = strftime('%s','now')*1000 WHERE code = 'sub_annual';
--> statement-breakpoint

-- Token packs: rescale so agencies see six-figure balances that feel meaningful.
-- IDs stay stable (referenced by any in-flight purchases); code/display swap.
UPDATE products SET code = 'tokens_chico',  display_name = 'Pack Chico',  price_cop = 50000,  tokens_granted = 100000, updated_at = strftime('%s','now')*1000 WHERE id = 'prod_tokens_100';
--> statement-breakpoint
UPDATE products SET code = 'tokens_medio',  display_name = 'Pack Medio',  price_cop = 90000,  tokens_granted = 200000, updated_at = strftime('%s','now')*1000 WHERE id = 'prod_tokens_500';
--> statement-breakpoint
UPDATE products SET code = 'tokens_grande', display_name = 'Pack Grande', price_cop = 150000, tokens_granted = 400000, updated_at = strftime('%s','now')*1000 WHERE id = 'prod_tokens_1500';
--> statement-breakpoint
INSERT INTO products (id, code, type, display_name, price_cop, duration_days, tokens_granted, is_active, created_at, updated_at) VALUES
  ('prod_tokens_master', 'tokens_master', 'TOKEN_PACK', 'Pack Master', 200000, NULL, 600000, 1, strftime('%s','now')*1000, strftime('%s','now')*1000);
