-- Add circles and optional circle relation on entries

CREATE TABLE IF NOT EXISTS "circles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "circles_name_unique" UNIQUE("name")
);

ALTER TABLE "entries" ADD COLUMN IF NOT EXISTS "circle_id" integer;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'entries_circle_id_circles_id_fk'
	) THEN
		ALTER TABLE "entries"
		ADD CONSTRAINT "entries_circle_id_circles_id_fk"
		FOREIGN KEY ("circle_id")
		REFERENCES "public"."circles"("id")
		ON DELETE no action ON UPDATE no action;
	END IF;
END $$;

-- Seed Amuai circle
INSERT INTO "circles" ("name")
VALUES ('Amuai')
ON CONFLICT ("name") DO NOTHING;

-- Backfill entries with circle = Amuai and missing artist data
UPDATE "entries"
SET "circle_id" = (SELECT id FROM "circles" WHERE name = 'Amuai')
WHERE LOWER("artist") = 'amuai';

UPDATE "entries"
SET "artist" = 'Unknown Artist'
WHERE LOWER("artist") = 'amuai';
