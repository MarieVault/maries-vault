import { users, titles, customEntries, artistLinks, type User, type InsertUser, type Title, type InsertTitle, type CustomEntry, type InsertCustomEntry, type ArtistLink, type InsertArtistLink } from "@shared/schema";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getTitleByEntryId(entryId: number): Promise<Title | undefined>;
  setTitle(data: InsertTitle): Promise<Title>;
  updateTitle(entryId: number, title: string): Promise<Title | undefined>;
  getCustomEntryByEntryId(entryId: number): Promise<CustomEntry | undefined>;
  setCustomEntry(data: InsertCustomEntry): Promise<CustomEntry>;
  updateCustomEntry(entryId: number, updates: Partial<{ customImageUrl: string; customArtist: string; customTags: string[]; keywords: string[]; rating: number }>): Promise<CustomEntry | undefined>;
  getAllEntries(): Promise<any[]>;
  createEntry(entryData: { title: string; imageUrl?: string; externalLink?: string; artist: string; tags?: string[]; keywords?: string[]; type: 'comic' | 'image' | 'sequence'; sequenceImages?: string[] }): Promise<any>;
  deleteEntry(entryId: number): Promise<void>;
  getArtistLinks(artistName: string): Promise<ArtistLink[]>;
  addArtistLink(data: InsertArtistLink): Promise<ArtistLink>;
  deleteArtistLink(id: number): Promise<void>;
}



import { DatabaseStorage } from "./db-storage";

export const storage = new DatabaseStorage();
