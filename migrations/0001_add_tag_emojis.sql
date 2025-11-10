CREATE TABLE IF NOT EXISTS "tag_emojis" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag_name" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tag_emojis_tag_name_unique" UNIQUE("tag_name")
);