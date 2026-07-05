import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { db, pool } from "../db";
import { eq, sql, and, desc, inArray } from "drizzle-orm";
import { storage } from "../storage";
import { entries, titles, customEntries, tagEmojis, userCollections, userArchives, userRatings, galleryFavourites, storageEntries, insertTitleSchema, insertCustomEntrySchema, insertTagEmojiSchema } from "@shared/schema";
import { handleLogin, handleLogout, handleRegister, handleMe, requireAuth, requireAdmin, optionalAuth, requireAuthOrService, requireAuthOrPublicEntry, validateSession } from "../auth";
import { parseIntParam, handleAsyncErrors, handleZodValidation } from "../http";
import { upload } from "../upload";

// True if the user owns the entry or is an admin. Gates customisation writes
// (titles, custom_entries, sequence images) which mutate an entry's shared
// display for every viewer, so they must be restricted to the entry's owner.
async function userMayEditEntry(entryId: number, user: any): Promise<boolean> {
  if (!user) return false;
  if (user.role === "admin") return true;
  const [row] = await db.select({ userId: entries.userId }).from(entries).where(eq(entries.id, entryId)).limit(1);
  return !!row && row.userId === user.id;
}

export function registerEntriesRoutes(app: Express): void {
  app.get("/api/entries", requireAuth, async (req: any, res) => {
    try {
      const { db } = await import('../db');
      const viewerId = req.user?.id;

      // Get all entries from database with their customizations
      const result = await db.execute(sql`
        SELECT
          e.id,
          e.user_id as "userId",
          COALESCE(t.title, e.title) as title,
          e.native_title as "nativeTitle",
          COALESCE(ce.custom_image_url, e.image_url) as "imageUrl",
          e.external_link as "externalLink",
          COALESCE(ce.custom_artist, e.artist) as artist,
          e.circle_id as "circleId",
          c.name as circle,
          COALESCE(ce.custom_tags, e.tags) || COALESCE(ce.user_tags, ARRAY[]::text[]) as tags,
          e.tags as "originalTags",
          ce.user_tags as "userTags",
          e.type,
          e.sequence_images as "sequenceImages",
          ce.keywords,
          ce.rating,
          ur.rating as "userRating",
          COALESCE(e.archived, false) as archived,
          e.gallery_url as "galleryUrl",
          COALESCE(e.visibility, 'public') as visibility
        FROM entries e
        LEFT JOIN titles t ON e.id = t.entry_id
        LEFT JOIN custom_entries ce ON e.id = ce.entry_id
        LEFT JOIN user_ratings ur ON e.id = ur.entry_id AND ur.user_id = ${viewerId ?? 0}
        LEFT JOIN circles c ON e.circle_id = c.id
        WHERE COALESCE(e.archived, false) = false
          AND (COALESCE(e.visibility, 'public') = 'public' OR e.user_id = ${viewerId ?? 0})
        ORDER BY e.id
      `);

      // Convert database rows to expected format
      const dbEntries = result.rows.map((row: any) => ({
        id: row.id,
        userId: row.userId ?? null,
        title: row.title || 'Untitled',
        imageUrl: row.imageUrl || '',
        externalLink: row.externalLink || '',
        artist: row.artist || 'Unknown Artist',
        circleId: row.circleId ?? null,
        circle: row.circle || null,
        tags: Array.isArray(row.tags) ? row.tags : (row.tags ? [row.tags] : []),
        originalTags: Array.isArray(row.originalTags) ? row.originalTags : (row.originalTags ? [row.originalTags] : []),
        userTags: Array.isArray(row.userTags) ? row.userTags : (row.userTags ? [row.userTags] : []),
        type: row.type || 'image',
        sequenceImages: Array.isArray(row.sequenceImages) ? row.sequenceImages : (row.sequenceImages ? [row.sequenceImages] : []),
        keywords: Array.isArray(row.keywords) ? row.keywords : (row.keywords ? [row.keywords] : []),
        rating: row.rating || null,
        userRating: row.userRating ?? null,
        archived: row.archived || false,
        galleryUrl: row.galleryUrl || null,
        visibility: row.visibility || 'public',
      }));

      res.json(dbEntries);
    } catch (error) {
      console.error('Error loading entries:', error);
      res.status(500).json({ message: 'Failed to load entries' });
    }
  });

  // My Vault feed — owned + saved entries for current user
  app.get("/api/entries/myvault", requireAuth, handleAsyncErrors(async (req: any, res) => {
    const userId = req.user?.id;
    const { db: dbI } = await import('../db');
    const result = await dbI.execute(sql`
      SELECT DISTINCT
        e.id,
        e.user_id as "userId",
        COALESCE(t.title, e.title) as title,
        COALESCE(ce.custom_image_url, e.image_url) as "imageUrl",
        e.external_link as "externalLink",
        COALESCE(ce.custom_artist, e.artist) as artist,
        e.type,
        e.sequence_images as "sequenceImages",
        COALESCE(ce.custom_tags, e.tags) || COALESCE(ce.user_tags, ARRAY[]::text[]) as tags,
        e.tags as "originalTags",
        ce.user_tags as "userTags",
        COALESCE(e.archived, false) as archived,
        CASE WHEN uc.entry_id IS NOT NULL THEN true ELSE false END as saved,
        ur.rating as "userRating",
        e.gallery_url as "galleryUrl",
        COALESCE(e.visibility, 'public') as visibility
      FROM entries e
      LEFT JOIN titles t ON e.id = t.entry_id
      LEFT JOIN custom_entries ce ON e.id = ce.entry_id
      LEFT JOIN user_collections uc ON e.id = uc.entry_id AND uc.user_id = ${userId}
      LEFT JOIN user_ratings ur ON e.id = ur.entry_id AND ur.user_id = ${userId}
      WHERE (e.user_id = ${userId} OR uc.entry_id IS NOT NULL)
        AND (COALESCE(e.visibility, 'public') = 'public' OR e.user_id = ${userId})
        AND NOT EXISTS (
          SELECT 1 FROM user_archives ua
          WHERE ua.entry_id = e.id AND ua.user_id = ${userId}
        )
      ORDER BY e.id DESC
    `);

    const entries = result.rows.map((row: any) => ({
      id: row.id,
      userId: row.userId ?? null,
      title: row.title || 'Untitled',
      imageUrl: row.imageUrl || '',
      externalLink: row.externalLink || '',
      artist: row.artist || 'Unknown Artist',
      type: row.type || 'image',
      sequenceImages: Array.isArray(row.sequenceImages) ? row.sequenceImages : [],
      tags: Array.isArray(row.tags) ? row.tags : [],
      originalTags: Array.isArray(row.originalTags) ? row.originalTags : [],
      userTags: Array.isArray(row.userTags) ? row.userTags : [],
      archived: row.archived || false,
      saved: row.saved || false,
      userRating: row.userRating ?? null,
      galleryUrl: row.galleryUrl || null,
      visibility: row.visibility || 'public',
    }));

    res.json(entries);
  }));

  // Get aggregated artists list with counts — scoped to the current user's
  // vault (entries they own + entries they've saved to their collection).
  // Unauthenticated callers get an empty list so new users don't see Marie's
  // global artist roster.

  app.patch("/api/entries/:id/archive", requireAuth, parseIntParam('id'), handleAsyncErrors(async (req: any, res) => {
    const id = (req as any).parsedParams.id;
    const userId = req.user?.id;
    const { archived } = req.body;
    if (typeof archived !== 'boolean') return res.status(400).json({ message: 'archived must be a boolean' });
    if (archived) {
      await db.insert(userArchives).values({ userId, entryId: id }).onConflictDoNothing();
    } else {
      await db.delete(userArchives).where(and(eq(userArchives.userId, userId), eq(userArchives.entryId, id)));
    }
    res.json({ id, archived });
  }));

  // Toggle visibility (public | private). Owner-only.
  app.patch("/api/entries/:id/visibility", requireAuth, parseIntParam('id'), handleAsyncErrors(async (req: any, res) => {
    const id = (req as any).parsedParams.id;
    const userId = req.user?.id;
    const { visibility } = req.body;
    if (visibility !== 'public' && visibility !== 'private') {
      return res.status(400).json({ message: "visibility must be 'public' or 'private'" });
    }
    const [existing] = await db.select({ userId: entries.userId }).from(entries).where(eq(entries.id, id)).limit(1);
    if (!existing) return res.status(404).json({ message: 'Entry not found' });
    if (existing.userId !== userId) return res.status(403).json({ message: 'Not your entry' });
    await db.update(entries).set({ visibility }).where(eq(entries.id, id));
    res.json({ id, visibility });
  }));

  // Get individual entry by ID
  app.get("/api/entries/:id", requireAuthOrPublicEntry, parseIntParam('id'), handleAsyncErrors(async (req: any, res) => {
    const id = (req as any).parsedParams.id;
    const viewerId = req.user?.id;

    const result = await storage.getAllEntries();
    const foundEntry = result.find((e: any) => e.id === id);

    if (!foundEntry) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    // Private entries are only visible to their owner via direct link.
    const visibility = foundEntry.visibility ?? 'public';
    if (visibility !== 'public' && foundEntry.userId !== viewerId) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    res.json(foundEntry);
  }));

  // Get custom title for entry
  app.get("/api/titles/:entryId", parseIntParam('entryId'), handleAsyncErrors(async (req, res) => {
    const entryId = (req as any).parsedParams.entryId;
    const title = await storage.getTitleByEntryId(entryId);
    
    if (title) {
      res.json(title);
    } else {
      res.status(404).json({ message: 'Title not found' });
    }
  }));

  // Set/update custom title for entry
  app.post("/api/titles", requireAuth, handleZodValidation(insertTitleSchema), handleAsyncErrors(async (req: any, res) => {
    const validatedData = req.body;

    if (!validatedData.title.trim()) {
      return res.status(400).json({ message: 'Title cannot be empty' });
    }

    if (!(await userMayEditEntry(validatedData.entryId, req.user))) {
      return res.status(403).json({ message: 'Not your entry' });
    }

    const title = await storage.setTitle({
      entryId: validatedData.entryId,
      title: validatedData.title.trim()
    });
    
    res.json(title);
  }));



  // Upload image endpoint
  app.post("/api/upload-image", requireAuth, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }

      // Return the URL path to the uploaded file
      const imageUrl = `/uploads/${req.file.filename}`;

      res.json({ imageUrl });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({ message: 'Failed to upload image' });
    }
  });

  // Share handler endpoint for PWA share target
  app.post('/api/share', requireAuth, upload.single('file'), handleAsyncErrors(async (req: any, res) => {
    const { title, text, url, visibility } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
    const v = visibility === 'private' ? 'private' : 'public';

    try {
      let entry;

      if (req.file) {
        // Handle shared image - file already saved to disk by multer
        const imageUrl = `/uploads/${req.file.filename}`;

        entry = await storage.createEntry({
          title: title || "Shared Image",
          imageUrl: imageUrl,
          externalLink: url || "",
          artist: "Unknown",
          tags: ["shared"],
          type: "image",
          userId,
          visibility: v,
        });
      } else if (url) {
        // Handle shared URL
        entry = await storage.createEntry({
          title: title || text || "Shared Link",
          imageUrl: "",
          externalLink: url,
          artist: "Unknown",
          tags: ["shared", "link"],
          type: "image",
          userId,
          visibility: v,
        });
      } else {
        return res.status(400).json({ error: 'No file or URL provided' });
      }
      
      res.json({ 
        success: true, 
        entry: entry,
        message: 'Content added to vault!'
      });
    } catch (error) {
      console.error('Error processing shared content:', error);
      res.status(500).json({ error: 'Error processing shared content' });
    }
  }));

  // PWA Share Target handler - redirects to frontend share handler
  app.post('/share-handler', requireAuth, upload.single('file'), handleAsyncErrors(async (req: any, res) => {
    const { title, text, url, visibility } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.redirect('/login?next=/share-handler');
    const v = visibility === 'private' ? 'private' : 'public';

    try {
      let entry;

      if (req.file) {
        // Handle shared image - file already saved to disk by multer
        const imageUrl = `/uploads/${req.file.filename}`;

        entry = await storage.createEntry({
          title: title || "Shared Image",
          imageUrl: imageUrl,
          externalLink: url || "",
          artist: "Unknown",
          tags: ["shared"],
          type: "image",
          userId,
          visibility: v,
        });
      } else if (url) {
        // Handle shared URL
        entry = await storage.createEntry({
          title: title || text || "Shared Link",
          imageUrl: "",
          externalLink: url,
          artist: "Unknown",
          tags: ["shared", "link"],
          type: "image",
          userId,
          visibility: v,
        });
      } else {
        // Redirect to home if no valid content
        return res.redirect('/');
      }
      
      // Redirect to share handler page with success message
      res.redirect(`/share-handler?status=success&entryId=${entry.id}`);
    } catch (error) {
      console.error('Error processing shared content:', error);
      res.redirect('/share-handler?status=error&message=Failed to process shared content');
    }
  }));

  // Update custom entry (image and/or artist)

  app.post("/api/custom-entries", requireAuth, async (req: any, res) => {
    try {
      const schema = z.object({
        entryId: z.number(),
        customImageUrl: z.string().optional(),
        customArtist: z.string().optional(),
        customTags: z.array(z.string()).optional(),
        userTags: z.array(z.string()).optional(),
        keywords: z.array(z.string()).optional(), // DEPRECATED: backwards compatibility
        rating: z.number().min(1).max(5).optional(),
      });

      const validatedData = schema.parse(req.body);

      if (!(await userMayEditEntry(validatedData.entryId, req.user))) {
        return res.status(403).json({ message: 'Not your entry' });
      }

      // Handle backwards compatibility: merge keywords into userTags
      let userTags = validatedData.userTags;
      if (validatedData.keywords && validatedData.keywords.length > 0) {
        userTags = [...(userTags || []), ...validatedData.keywords];
      }

      const customEntry = await storage.updateCustomEntry(validatedData.entryId, {
        customImageUrl: validatedData.customImageUrl,
        customArtist: validatedData.customArtist,
        customTags: validatedData.customTags,
        userTags: userTags,
        rating: validatedData.rating,
      });
      
      // If no updates were made, still return success
      if (!customEntry) {
        return res.json({ message: 'No updates needed' });
      }
      
      res.json(customEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      
      console.error('Error updating custom entry:', error);
      res.status(500).json({ message: 'Failed to update entry' });
    }
  });

  // Create new entry

  app.post("/api/entries", requireAuth, async (req: any, res) => {
    try {
      const schema = z.object({
        title: z.string().min(1, "Title is required"),
        imageUrl: z.string().optional(),
        externalLink: z.string().optional(),
        artist: z.string().min(1, "Artist is required"),
        circleId: z.number().int().optional(),
        tags: z.array(z.string()).optional(),
        userTags: z.array(z.string()).optional(),
        keywords: z.array(z.string()).optional(), // DEPRECATED: backwards compatibility
        type: z.enum(['comic', 'image', 'sequence', 'story', 'video']).default('image'),
        sequenceImages: z.array(z.string()).optional(),
        content: z.string().optional(),
        visibility: z.enum(['public', 'private']).default('public'),
      });

      const validatedData = schema.parse(req.body);
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

      // Handle backwards compatibility: merge keywords into userTags
      let userTags = validatedData.userTags;
      if (validatedData.keywords && validatedData.keywords.length > 0) {
        userTags = [...(userTags || []), ...validatedData.keywords];
      }

      const newEntry = await storage.createEntry({
        ...validatedData,
        userTags: userTags,
        userId,
      });
      
      res.json(newEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      
      console.error('Error creating entry:', error);
      res.status(500).json({ message: 'Failed to create entry' });
    }
  });

  // Delete entry
  // ── Admin endpoints ───────────────────────────────────────────────────────


  app.delete("/api/entries/:entryId", requireAuth, parseIntParam('entryId'), handleAsyncErrors(async (req: any, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const entryId = (req as any).parsedParams.entryId;
    await storage.deleteEntry(entryId);
    res.json({ message: 'Entry deleted successfully' });
  }));

  // Append image to sequence
  app.post("/api/entries/:entryId/sequence-images", requireAuth, parseIntParam('entryId'), handleAsyncErrors(async (req: any, res) => {
    const entryId = (req as any).parsedParams.entryId;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ message: 'Image URL is required' });
    }

    if (!(await userMayEditEntry(entryId, req.user))) {
      return res.status(403).json({ message: 'Not your entry' });
    }

    const updatedEntry = await (storage as any).appendSequenceImage(entryId, imageUrl);
    res.json({ success: true, entry: updatedEntry });
  }));

  // Append images from Twitter/X URLs to existing sequence
  app.post("/api/entries/:entryId/sequence-images/twitter", requireAuth, parseIntParam('entryId'), handleAsyncErrors(async (req: any, res) => {
    const entryId = (req as any).parsedParams.entryId;
    const { tweetUrls } = req.body;

    if (!tweetUrls || !Array.isArray(tweetUrls) || tweetUrls.length === 0) {
      return res.status(400).json({ message: 'At least one tweet URL is required' });
    }

    if (!(await userMayEditEntry(entryId, req.user))) {
      return res.status(403).json({ message: 'Not your entry' });
    }

    // Validate entry exists and is a sequence
    const allEntries = await storage.getAllEntries();
    const entry = allEntries.find((e: any) => e.id === entryId);

    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    if (entry.type !== 'sequence' && entry.type !== 'image') {
      return res.status(400).json({ message: 'Entry must be an image or sequence to add images' });
    }

    try {
      const { extractTwitterImages } = await import('../twitter-extractor');
      const allDownloadedImages: string[] = [];

      // Process each tweet URL sequentially to maintain order
      for (const tweetUrl of tweetUrls) {
        try {
          const { downloadedImages } = await extractTwitterImages(
            tweetUrl,
            path.join(process.cwd(), 'uploads')
          );
          allDownloadedImages.push(...downloadedImages);
        } catch (error: any) {
          console.error(`Error processing tweet (${tweetUrl}):`, error);
          // Continue with other tweets
        }
      }

      if (allDownloadedImages.length === 0) {
        return res.status(400).json({
          message: 'No media could be extracted from the provided tweets',
        });
      }

      // Append all downloaded images to the sequence
      let updatedEntry;
      for (const imageUrl of allDownloadedImages) {
        updatedEntry = await (storage as any).appendSequenceImage(entryId, imageUrl);
      }

      res.json({
        success: true,
        entry: updatedEntry,
        message: `Successfully added ${allDownloadedImages.length} image(s) from ${tweetUrls.length} tweet(s)`,
        imageCount: allDownloadedImages.length,
      });
    } catch (error: any) {
      console.error('Error extracting Twitter images:', error);
      res.status(500).json({
        message: 'Failed to extract images from tweets',
        error: error.message,
      });
    }
  }));

  // Artist links routes

  app.get("/api/custom-entries/:entryId", parseIntParam('entryId'), handleAsyncErrors(async (req, res) => {
    const entryId = (req as any).parsedParams.entryId;
    const customEntry = await storage.getCustomEntryByEntryId(entryId);
    
    if (customEntry) {
      res.json(customEntry);
    } else {
      // Return empty custom entry data instead of 404 for new entries
      res.json({
        entryId: entryId,
        customImageUrl: null,
        customArtist: null,
        customTags: null,
        keywords: null,
        rating: null
      });
    }
  }));


  // Tag emoji routes
  // Batch fetch tag emojis
}
