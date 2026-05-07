-- Public/private entry visibility.
-- Public entries show up in the community feed and do not count toward
-- the owner's storage quota; private entries are owner-only and count.

ALTER TABLE "entries"
  ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'public';

CREATE INDEX IF NOT EXISTS "entries_user_visibility_idx"
  ON "entries" ("user_id", "visibility");
