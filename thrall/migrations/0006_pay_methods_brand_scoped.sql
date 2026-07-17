ALTER TABLE pay_methods ADD COLUMN brand_id TEXT REFERENCES brands(id);
--> statement-breakpoint
UPDATE pay_methods SET brand_id = '01KVTVE51MZR7P076KB5MQ6WR4' WHERE brand_id IS NULL;
--> statement-breakpoint
DROP INDEX pay_methods_code_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX pay_methods_brand_code_idx ON pay_methods(brand_id, code);
