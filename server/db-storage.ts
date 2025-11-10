
import { IStorage } from './storage';
import { db } from './db';
import { users, titles, customEntries, artistLinks, entries, type User, type InsertUser, type Title, type InsertTitle, type CustomEntry, type InsertCustomEntry, type ArtistLink, type InsertArtistLink } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getTitleByEntryId(entryId: number): Promise<Title | undefined> {
    const result = await db.select().from(titles).where(eq(titles.entryId, entryId)).limit(1);
    return result[0];
  }

  async setTitle(data: InsertTitle): Promise<Title> {
    const result = await db.insert(titles).values(data).onConflictDoUpdate({
      target: titles.entryId,
      set: { title: data.title }
    }).returning();
    return result[0];
  }

  async updateTitle(entryId: number, title: string): Promise<Title | undefined> {
    const result = await db.update(titles).set({ title }).where(eq(titles.entryId, entryId)).returning();
    return result[0];
  }

  async getCustomEntryByEntryId(entryId: number): Promise<CustomEntry | undefined> {
    const result = await db.select().from(customEntries).where(eq(customEntries.entryId, entryId)).limit(1);
    return result[0];
  }

  async setCustomEntry(data: InsertCustomEntry): Promise<CustomEntry> {
    const result = await db.insert(customEntries).values(data).returning();
    return result[0];
  }

  async updateCustomEntry(entryId: number, updates: Partial<{ customImageUrl: string; customArtist: string; customTags: string[]; keywords: string[]; rating: number }>): Promise<CustomEntry | undefined> {
    // Filter out undefined values, but keep empty arrays
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    
    // If no valid updates, return undefined
    if (Object.keys(filteredUpdates).length === 0) {
      return undefined;
    }
    
    const result = await db
      .insert(customEntries)
      .values({ entryId, ...filteredUpdates })
      .onConflictDoUpdate({
        target: customEntries.entryId,
        set: filteredUpdates,
      })
      .returning();
    return result[0];
  }

  async getAllEntries(): Promise<any[]> {
    const result = await db.select().from(entries);
    return result;
  }

  async createEntry(entryData: { title: string; imageUrl?: string; externalLink?: string; artist: string; tags?: string[]; keywords?: string[]; type: 'comic' | 'image' | 'sequence' | 'story'; sequenceImages?: string[]; content?: string }): Promise<any> {
    const result = await db.insert(entries).values({
      ...entryData,
      imageUrl: entryData.imageUrl || '',
      sequenceImages: entryData.sequenceImages || [],
      content: entryData.content || null,
      userId: 7 // M13 user ID
    }).returning();
    
    // If keywords are provided, save them to custom_entries table
    if (entryData.keywords && entryData.keywords.length > 0) {
      await this.setCustomEntry({
        entryId: result[0].id,
        keywords: entryData.keywords
      });
    }
    
    return result[0];
  }

  async deleteEntry(entryId: number): Promise<void> {
    await db.delete(entries).where(eq(entries.id, entryId));
  }

  async getArtistLinks(artistName: string): Promise<ArtistLink[]> {
    return await db.select().from(artistLinks).where(eq(artistLinks.artistName, artistName));
  }

  async addArtistLink(data: InsertArtistLink): Promise<ArtistLink> {
    const result = await db.insert(artistLinks).values(data).returning();
    return result[0];
  }

  async deleteArtistLink(id: number): Promise<void> {
    await db.delete(artistLinks).where(eq(artistLinks.id, id));
  }
}
