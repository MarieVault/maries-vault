-- Server-side hearts for the gallery page.
-- Keyed by (user_id, filename). Filename matches the image filename returned by /api/gallery.

CREATE TABLE IF NOT EXISTS "gallery_favourites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"filename" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "gallery_favourites_user_filename_unique" UNIQUE("user_id", "filename")
);

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'gallery_favourites_user_id_users_id_fk'
	) THEN
		ALTER TABLE "gallery_favourites"
		ADD CONSTRAINT "gallery_favourites_user_id_users_id_fk"
		FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
		ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;

CREATE INDEX IF NOT EXISTS "gallery_favourites_user_id_idx" ON "gallery_favourites" ("user_id");
