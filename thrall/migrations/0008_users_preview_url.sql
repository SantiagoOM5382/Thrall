-- Animated preview shown on illidan cards when the visitor hovers a model.
-- Accepts any mp4/webm/gif URL uploaded to Vercel Blob; NULL means fall back
-- to the first static gallery photo (existing behaviour).
ALTER TABLE users ADD COLUMN preview_url TEXT;
