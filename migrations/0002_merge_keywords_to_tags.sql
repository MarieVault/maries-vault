-- Migration: Merge Keywords into Tags System
-- This migration consolidates the keywords system into the tags system
-- by adding a user_tags column and preserving all existing keyword data.

-- Step 1: Add user_tags column to custom_entries
ALTER TABLE custom_entries
ADD COLUMN user_tags text[] DEFAULT ARRAY[]::text[];

-- Step 2: Migrate all keyword data to user_tags
-- Copy keywords to user_tags for all entries that have keywords
UPDATE custom_entries
SET user_tags = keywords
WHERE keywords IS NOT NULL AND array_length(keywords, 1) > 0;

-- Step 3: Merge keyword emojis into tag emojis
-- Insert keyword emojis into tag_emojis, skipping conflicts (keep existing tag emoji)
INSERT INTO tag_emojis (tag_name, emoji, created_at)
SELECT keyword_name, emoji, created_at
FROM keyword_emojis
ON CONFLICT (tag_name) DO NOTHING;

-- Step 4: Drop keyword_emojis table
-- This table is no longer needed as all emojis are now in tag_emojis
DROP TABLE keyword_emojis;

-- Note: We're keeping the keywords column temporarily for rollback safety
-- It will be removed in a future migration after the system is stable
-- COMMENT ON COLUMN custom_entries.keywords IS 'DEPRECATED: Use user_tags instead. Will be removed in future migration.';
