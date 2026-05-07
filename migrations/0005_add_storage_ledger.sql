-- Storage ledger: one row per generated artifact across Choice / Change / Studio.
-- Serves as the source of truth for gallery reads, quota accounting, and hearts.

CREATE TABLE IF NOT EXISTS "storage_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"app" text NOT NULL,          -- 'choice' | 'change' | 'studio'
	"kind" text NOT NULL,         -- 'image' | 'session-json' | …
	"path" text NOT NULL,         -- R2 key or absolute local path
	"size_bytes" integer NOT NULL,
	"mime" text,
	"hearted" boolean DEFAULT false NOT NULL,
	"session_ref" text,           -- opaque app-side id to group related entries
	"meta" jsonb,                 -- prompt, seed, tags, etc.
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "storage_entries_app_path_unique" UNIQUE("app", "path")
);

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'storage_entries_user_id_users_id_fk'
	) THEN
		ALTER TABLE "storage_entries"
		ADD CONSTRAINT "storage_entries_user_id_users_id_fk"
		FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
		ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;

CREATE INDEX IF NOT EXISTS "storage_entries_user_id_idx"       ON "storage_entries" ("user_id");
CREATE INDEX IF NOT EXISTS "storage_entries_user_app_idx"      ON "storage_entries" ("user_id", "app");
CREATE INDEX IF NOT EXISTS "storage_entries_user_hearted_idx"  ON "storage_entries" ("user_id", "hearted");
CREATE INDEX IF NOT EXISTS "storage_entries_created_at_idx"    ON "storage_entries" ("created_at");
