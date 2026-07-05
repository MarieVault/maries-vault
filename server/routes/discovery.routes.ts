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

export function registerDiscoveryRoutes(app: Express): void {
  app.get("/api/artists", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.json([]);
      const { db } = await import('../db');

      const result = await db.execute(sql`
        SELECT
          COALESCE(ce.custom_artist, e.artist) as name,
          COUNT(*) as count,
          ARRAY_AGG(DISTINCT unnested_tag) FILTER (WHERE unnested_tag IS NOT NULL) as tags
        FROM entries e
        LEFT JOIN custom_entries ce ON e.id = ce.entry_id
        LEFT JOIN user_collections uc ON e.id = uc.entry_id AND uc.user_id = ${userId}
        LEFT JOIN LATERAL unnest(COALESCE(ce.custom_tags, e.tags)) AS unnested_tag ON true
        WHERE (e.user_id = ${userId} OR uc.entry_id IS NOT NULL)
          AND (COALESCE(e.visibility, 'public') = 'public' OR e.user_id = ${userId})
        GROUP BY COALESCE(ce.custom_artist, e.artist)
        ORDER BY name
      `);

      const artists = result.rows.map((row: any) => ({
        name: row.name || 'Unknown Artist',
        count: parseInt(row.count),
        tags: Array.isArray(row.tags) ? row.tags : []
      }));

      res.json(artists);
    } catch (error) {
      console.error('Error loading artists:', error);
      res.status(500).json({ message: 'Failed to load artists' });
    }
  });

  // Get artist rankings with Bayesian average
  app.get("/api/artists/rankings", requireAuth, async (req, res) => {
    try {
      const { db } = await import('../db');
      const MIN_RATED_ENTRIES = 3; // Minimum rated entries to appear in rankings

      // Calculate artist rankings using Bayesian average
      // Formula: weighted_rating = (v/(v+m)) * R + (m/(v+m)) * C
      // where: R = artist avg, v = rated count, m = min threshold, C = global avg
      const rankingsQuery = `
        WITH global_stats AS (
          SELECT
            AVG(ce.rating)::float as global_avg
          FROM entries e
          JOIN custom_entries ce ON e.id = ce.entry_id
          WHERE ce.rating IS NOT NULL
            AND COALESCE(e.visibility, 'public') = 'public'
        ),
        artist_stats AS (
          SELECT
            COALESCE(ce.custom_artist, e.artist) as name,
            COUNT(*) as total_entries,
            COUNT(ce.rating) as rated_entries,
            AVG(ce.rating)::float as avg_rating,
            ARRAY_AGG(DISTINCT unnested_tag) FILTER (WHERE unnested_tag IS NOT NULL) as tags
          FROM entries e
          LEFT JOIN custom_entries ce ON e.id = ce.entry_id
          LEFT JOIN LATERAL unnest(COALESCE(ce.custom_tags, e.tags)) AS unnested_tag ON true
          WHERE COALESCE(e.visibility, 'public') = 'public'
          GROUP BY COALESCE(ce.custom_artist, e.artist)
          HAVING COUNT(ce.rating) >= ${MIN_RATED_ENTRIES}
        )
        SELECT
          a.name,
          a.total_entries,
          a.rated_entries,
          a.avg_rating,
          a.tags,
          -- Bayesian average: (v/(v+m)) * R + (m/(v+m)) * C
          (a.rated_entries::float / (a.rated_entries + ${MIN_RATED_ENTRIES})) * a.avg_rating +
          (${MIN_RATED_ENTRIES}::float / (a.rated_entries + ${MIN_RATED_ENTRIES})) * COALESCE(g.global_avg, 3.0) as weighted_rating
        FROM artist_stats a
        CROSS JOIN global_stats g
        WHERE a.name != 'Unknown Artist' AND a.name != 'Unknown'
        ORDER BY weighted_rating DESC, a.rated_entries DESC
      `;

      const result = await db.execute(rankingsQuery);

      const rankings = result.rows.map((row: any, index: number) => ({
        rank: index + 1,
        name: row.name,
        totalEntries: parseInt(row.total_entries),
        ratedEntries: parseInt(row.rated_entries),
        averageRating: parseFloat(row.avg_rating) || 0,
        weightedRating: parseFloat(row.weighted_rating) || 0,
        tags: Array.isArray(row.tags) ? row.tags.filter(Boolean) : []
      }));

      res.json({
        rankings,
        metadata: {
          minRatedEntries: MIN_RATED_ENTRIES,
          totalRankedArtists: rankings.length
        }
      });
    } catch (error) {
      console.error('Error loading artist rankings:', error);
      res.status(500).json({ message: 'Failed to load artist rankings' });
    }
  });

  // Get aggregated tags list with counts — scoped to the current user's vault.
  app.get("/api/tags", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.json([]);
      const { db } = await import('../db');

      const result = await db.execute(sql`
        SELECT
          unnested_tag as name,
          COUNT(*) as count,
          ARRAY_AGG(DISTINCT COALESCE(ce.custom_artist, e.artist)) as artists
        FROM entries e
        LEFT JOIN custom_entries ce ON e.id = ce.entry_id
        LEFT JOIN user_collections uc ON e.id = uc.entry_id AND uc.user_id = ${userId}
        CROSS JOIN unnest(
          COALESCE(ce.custom_tags, e.tags) || COALESCE(ce.user_tags, ARRAY[]::text[])
        ) AS unnested_tag
        WHERE (e.user_id = ${userId} OR uc.entry_id IS NOT NULL)
          AND (COALESCE(e.visibility, 'public') = 'public' OR e.user_id = ${userId})
        GROUP BY unnested_tag
        ORDER BY count DESC
      `);

      const tags = result.rows.map((row: any) => ({
        name: row.name,
        count: parseInt(row.count),
        artists: Array.isArray(row.artists) ? row.artists.filter(Boolean) : []
      }));

      res.json(tags);
    } catch (error) {
      console.error('Error loading tags:', error);
      res.status(500).json({ message: 'Failed to load tags' });
    }
  });

  // Get entries for a specific tag
  app.get("/api/tags/:tagName/entries", requireAuth, async (req: any, res) => {
    try {
      const tagName = decodeURIComponent(req.params.tagName).toLowerCase();
      const viewerId = req.user?.id;
      const { db } = await import('../db');

      // Find entries where the tag appears in custom_tags, original tags, or user_tags
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
          COALESCE(e.visibility, 'public') as visibility
        FROM entries e
        LEFT JOIN titles t ON e.id = t.entry_id
        LEFT JOIN custom_entries ce ON e.id = ce.entry_id
        LEFT JOIN user_ratings ur ON e.id = ur.entry_id AND ur.user_id = ${viewerId ?? 0}
        LEFT JOIN circles c ON e.circle_id = c.id
        WHERE EXISTS (
          SELECT 1 FROM unnest(COALESCE(ce.custom_tags, e.tags) || COALESCE(ce.user_tags, ARRAY[]::text[])) AS tag
          WHERE LOWER(tag) = ${tagName}
        )
          AND (COALESCE(e.visibility, 'public') = 'public' OR e.user_id = ${viewerId ?? 0})
        ORDER BY e.id
      `);

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
        visibility: row.visibility || 'public',
      }));

      res.json(dbEntries);
    } catch (error) {
      console.error('Error loading tag entries:', error);
      res.status(500).json({ message: 'Failed to load tag entries' });
    }
  });

  // Get entries for a specific artist
  app.get("/api/artists/:artistName/entries", requireAuth, async (req: any, res) => {
    try {
      const artistName = decodeURIComponent(req.params.artistName);
      const viewerId = req.user?.id;
      const { db } = await import('../db');

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
          COALESCE(e.visibility, 'public') as visibility
        FROM entries e
        LEFT JOIN titles t ON e.id = t.entry_id
        LEFT JOIN custom_entries ce ON e.id = ce.entry_id
        LEFT JOIN user_ratings ur ON e.id = ur.entry_id AND ur.user_id = ${viewerId ?? 0}
        LEFT JOIN circles c ON e.circle_id = c.id
        WHERE LOWER(COALESCE(ce.custom_artist, e.artist)) = LOWER(${artistName})
          AND (COALESCE(e.visibility, 'public') = 'public' OR e.user_id = ${viewerId ?? 0})
        ORDER BY e.id
      `);

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
        visibility: row.visibility || 'public',
      }));

      res.json(dbEntries);
    } catch (error) {
      console.error('Error loading artist entries:', error);
      res.status(500).json({ message: 'Failed to load artist entries' });
    }
  });

  // Archive / unarchive an entry
  // Personal archive toggle — any logged-in user (redirects to user_archives)

  app.get('/api/artists/:artistName/links', requireAuth, async (req, res) => {
    try {
      const artistName = decodeURIComponent(req.params.artistName);
      const links = await storage.getArtistLinks(artistName);
      res.json(links);
    } catch (error) {
      console.error('Error fetching artist links:', error);
      res.status(500).json({ message: 'Failed to fetch artist links' });
    }
  });

  app.post('/api/artists/:artistName/links', requireAuth, async (req, res) => {
    try {
      const artistName = decodeURIComponent(req.params.artistName);
      const { platform, url } = req.body;
      
      if (!platform || !url) {
        return res.status(400).json({ message: 'Platform and URL are required' });
      }

      const linkData = { artistName, platform, url };
      const newLink = await storage.addArtistLink(linkData);
      res.json(newLink);
    } catch (error) {
      console.error('Error adding artist link:', error);
      res.status(500).json({ message: 'Failed to add artist link' });
    }
  });

  app.delete('/api/artist-links/:id', requireAuth, async (req, res) => {
    try {
      const linkId = parseInt(req.params.id);
      await storage.deleteArtistLink(linkId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting artist link:', error);
      res.status(500).json({ message: 'Failed to delete artist link' });
    }
  });

  // Get custom entry data

  app.get("/api/tag-emojis/batch", handleAsyncErrors(async (req, res) => {
    const tagNames = req.query.tags;

    if (!tagNames) {
      return res.json({});
    }

    // Parse comma-separated tag names
    const tags = typeof tagNames === 'string' ? tagNames.split(',') : [];

    if (tags.length === 0) {
      return res.json({});
    }

    try {
      // Fetch all emojis in a single query. Each lowercased tag is bound as its
      // own placeholder in an IN list — no string interpolation into SQL.
      const lowered = tags.map(t => t.toLowerCase());
      const result = await db.execute(sql`
        SELECT tag_name, emoji FROM tag_emojis
        WHERE LOWER(tag_name) IN (${sql.join(lowered.map(t => sql`${t}`), sql`, `)})
      `);

      const emojiMap: Record<string, string> = {};
      result.rows.forEach((row: any) => {
        // Match back to original casing from request
        const originalTag = tags.find(t => t.toLowerCase() === row.tag_name.toLowerCase());
        if (originalTag) {
          emojiMap[originalTag] = row.emoji;
        }
      });

      res.json(emojiMap);
    } catch (error) {
      console.error('Error fetching batch tag emojis:', error);
      res.status(500).json({ message: 'Failed to fetch tag emojis' });
    }
  }));

  app.get("/api/tag-emojis/:tagName", handleAsyncErrors(async (req, res) => {
    const tagName = req.params.tagName;
    
    if (!tagName) {
      return res.status(400).json({ message: "Tag name is required" });
    }

    // Try exact match first, then case-insensitive
    let tagEmoji = await db
      .select()
      .from(tagEmojis)
      .where(eq(tagEmojis.tagName, tagName))
      .limit(1);

    // If no exact match, try case-insensitive search
    if (tagEmoji.length === 0) {
      const result = await db.execute(sql`
        SELECT * FROM tag_emojis 
        WHERE LOWER(tag_name) = LOWER(${tagName}) 
        LIMIT 1
      `);
      
      if (result.rows.length > 0) {
        const row = result.rows[0] as any;
        tagEmoji = [{
          id: row.id,
          tagName: row.tag_name,
          emoji: row.emoji,
          createdAt: row.created_at
        }];
      }
    }

    if (tagEmoji.length > 0) {
      res.json(tagEmoji[0]);
    } else {
      res.status(404).json({ message: "Tag emoji not found" });
    }
  }));

  app.post("/api/tag-emojis", requireAdmin, handleZodValidation(insertTagEmojiSchema), handleAsyncErrors(async (req, res) => {
    const { tagName, emoji } = req.body;

    // Check if emoji already exists for this tag
    const existing = await db
      .select()
      .from(tagEmojis)
      .where(eq(tagEmojis.tagName, tagName))
      .limit(1);

    let result;
    if (existing.length > 0) {
      // Update existing emoji
      result = await db
        .update(tagEmojis)
        .set({ emoji })
        .where(eq(tagEmojis.tagName, tagName))
        .returning();
    } else {
      // Insert new emoji
      result = await db
        .insert(tagEmojis)
        .values({ tagName, emoji })
        .returning();
    }

    res.json(result[0]);
  }));


  // Extract images from Twitter/X and create entry (single URL - legacy)

  app.get("/api/mangalist", handleAsyncErrors(async (req, res) => {
    const { db } = await import('../db');
    const result = await db.execute(`
      SELECT
        e.id,
        COALESCE(t.title, e.title) AS title,
        COALESCE(ce.custom_image_url, e.image_url) AS image_url,
        COALESCE(ce.custom_artist, e.artist) AS artist,
        COALESCE(ce.custom_tags, e.tags) AS tags,
        e.type,
        e.gallery_url
      FROM entries e
      LEFT JOIN titles t ON e.id = t.entry_id
      LEFT JOIN custom_entries ce ON e.id = ce.entry_id
      WHERE e.type IN ('comic','sequence')
        AND COALESCE(e.archived, false) = false
        AND COALESCE(e.visibility, 'public') = 'public'
      ORDER BY COALESCE(t.title, e.title) ASC
    `);
    res.json(result.rows);
  }));

  // User-scoped gallery: returns every ledger-tracked artifact owned by the
  // authenticated user across Choice/Change/Studio. Marie (the "openclaw" user)
  // additionally gets the filesystem-scanned OpenClaw images unioned in, since
  // those predate the ledger and live outside the per-app backends.
}
