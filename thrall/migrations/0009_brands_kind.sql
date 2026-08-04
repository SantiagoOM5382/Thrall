-- Distinguish agency accounts (many models, full contable) from solo model
-- accounts (one profile — herself). Everything else about the brand model
-- stays the same; only the model cap changes and signup routes decide the
-- initial kind.
ALTER TABLE brands ADD COLUMN kind TEXT NOT NULL DEFAULT 'agency';
