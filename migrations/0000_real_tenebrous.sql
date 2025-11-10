CREATE TABLE "artist_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_name" text NOT NULL,
	"platform" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"custom_image_url" text,
	"custom_artist" text,
	"custom_tags" text[],
	"keywords" text[],
	"rating" integer,
	CONSTRAINT "custom_entries_entry_id_unique" UNIQUE("entry_id")
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"image_url" text NOT NULL,
	"external_link" text,
	"artist" text NOT NULL,
	"tags" text[],
	"type" text NOT NULL,
	"sequence_images" text[],
	"content" text,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tag_emojis" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag_name" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tag_emojis_tag_name_unique" UNIQUE("tag_name")
);
--> statement-breakpoint
CREATE TABLE "titles" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"title" text NOT NULL,
	CONSTRAINT "titles_entry_id_unique" UNIQUE("entry_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;