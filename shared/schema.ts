import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const circles = pgTable("circles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const entries = pgTable("entries", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  imageUrl: text("image_url").notNull(),
  externalLink: text("external_link"),
  artist: text("artist").notNull(),
  circleId: integer("circle_id").references(() => circles.id),
  tags: text("tags").array(),
  type: text("type").notNull(), // 'comic' | 'image' | 'sequence' | 'story'
  sequenceImages: text("sequence_images").array(),
  content: text("content"), // For storing story text content
  userId: integer("user_id").references(() => users.id).notNull(),
  archived: boolean("archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const titles = pgTable("titles", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull().unique(),
  title: text("title").notNull(),
});

export const customEntries = pgTable("custom_entries", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull().unique(),
  customImageUrl: text("custom_image_url"),
  customArtist: text("custom_artist"),
  customTags: text("custom_tags").array(),
  userTags: text("user_tags").array(), // User-added tags (formerly keywords)
  keywords: text("keywords").array(), // DEPRECATED: Use userTags instead
  rating: integer("rating"),
});

export const artistLinks = pgTable("artist_links", {
  id: serial("id").primaryKey(),
  artistName: text("artist_name").notNull(),
  platform: text("platform").notNull(), // 'deviantart', 'twitter', 'instagram', 'pixiv', etc.
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tagEmojis = pgTable("tag_emojis", {
  id: serial("id").primaryKey(),
  tagName: text("tag_name").notNull().unique(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertTitleSchema = createInsertSchema(titles).pick({
  entryId: true,
  title: true,
});

export const insertEntrySchema = createInsertSchema(entries).pick({
  title: true,
  imageUrl: true,
  externalLink: true,
  artist: true,
  circleId: true,
  tags: true,
  type: true,
  sequenceImages: true,
  content: true,
  userId: true,
});

export const insertCustomEntrySchema = createInsertSchema(customEntries).pick({
  entryId: true,
  customImageUrl: true,
  customArtist: true,
  customTags: true,
  userTags: true,
  keywords: true, // DEPRECATED: kept for backwards compatibility
  rating: true,
});

export const insertArtistLinkSchema = createInsertSchema(artistLinks).pick({
  artistName: true,
  platform: true,
  url: true,
});

export const insertTagEmojiSchema = createInsertSchema(tagEmojis).pick({
  tagName: true,
  emoji: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertEntry = z.infer<typeof insertEntrySchema>;
export type DbEntry = typeof entries.$inferSelect;
export type Circle = typeof circles.$inferSelect;
export type InsertTitle = z.infer<typeof insertTitleSchema>;
export type Title = typeof titles.$inferSelect;
export type InsertCustomEntry = z.infer<typeof insertCustomEntrySchema>;
export type CustomEntry = typeof customEntries.$inferSelect;
export type InsertArtistLink = z.infer<typeof insertArtistLinkSchema>;
export type ArtistLink = typeof artistLinks.$inferSelect;
export type InsertTagEmoji = z.infer<typeof insertTagEmojiSchema>;
export type TagEmoji = typeof tagEmojis.$inferSelect;

// Legacy interface for compatibility - remove after migration
export interface Entry {
  id: number;
  title: string;
  imageUrl: string;
  externalLink: string;
  artist: string;
  circleId?: number | null;
  circle?: string | null;
  tags: string[]; // Combined tags (originalTags + userTags)
  originalTags?: string[]; // Tags from base entry
  userTags?: string[]; // User-added tags
  keywords?: string[]; // DEPRECATED: backwards compatibility only
  type: 'comic' | 'image' | 'sequence' | 'story' | 'video';
  sequenceImages?: string[];
  content?: string;
  rating?: number | null;
  archived?: boolean;
}
