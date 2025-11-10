CREATE TABLE "keyword_emojis" (
	"id" serial PRIMARY KEY NOT NULL,
	"keyword_name" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "keyword_emojis_keyword_name_unique" UNIQUE("keyword_name")
);
