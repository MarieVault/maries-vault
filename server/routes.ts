import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTitleSchema, insertCustomEntrySchema, insertTagEmojiSchema, entries, titles, customEntries, tagEmojis, userCollections, userArchives, userRatings } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { eq, sql, and } from "drizzle-orm";
import { handleLogin, handleLogout, handleRegister, handleMe, requireAuth, optionalAuth } from "./auth";


// Error handling middleware
function parseIntParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = parseInt(req.params[paramName], 10);
    if (isNaN(value)) {
      return res.status(400).json({ message: `Invalid ${paramName}` });
    }
    (req as any).parsedParams = { ...(req as any).parsedParams, [paramName]: value };
    next();
  };
}

function handleAsyncErrors(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function handleZodValidation<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      next(error);
    }
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes (unprotected)
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/logout", handleLogout);
  app.post("/api/auth/register", handleRegister);
  app.get("/api/auth/me", handleMe);

  // Public read-only routes (no auth required)
  // Write/upload routes are still protected below via requireAuth inline

  // ── User Collections (bookmarks) ─────────────────────────────────────────

  // Add entry to collection
  app.post("/api/collections/:entryId", requireAuth, parseIntParam('entryId'), handleAsyncErrors(async (req: any, res) => {
    const entryId = (req as any).parsedParams.entryId;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      await db.insert(userCollections).values({ userId, entryId }).onConflictDoNothing();
      res.json({ saved: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }));

  // Remove entry from collection
  app.delete("/api/collections/:entryId", requireAuth, parseIntParam('entryId'), handleAsyncErrors(async (req: any, res) => {
    const entryId = (req as any).parsedParams.entryId;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await db.delete(userCollections).where(and(eq(userCollections.userId, userId), eq(userCollections.entryId, entryId)));
    res.json({ saved: false });
  }));

  // Get user's collection
  app.get("/api/collections", requireAuth, handleAsyncErrors(async (req: any, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { db: dbI } = await import('./db');
    const saved = await dbI.execute(sql`
      SELECT e.*, uc.added_at as saved_at
      FROM user_collections uc
      JOIN entries e ON e.id = uc.entry_id
      WHERE uc.user_id = ${userId}
      ORDER BY uc.added_at DESC
    `);
    res.json(saved.rows);
  }));

  // ── User Ratings (personal per-user) ─────────────────────────────────────

  // Set or update rating
  app.post("/api/ratings/:entryId", requireAuth, parseIntParam('entryId'), handleAsyncErrors(async (req: any, res) => {
    const entryId = (req as any).parsedParams.entryId;
    const userId = req.user?.id;
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be 1-5' });
    await db.insert(userRatings).values({ userId, entryId, rating })
      .onConflictDoUpdate({ target: [userRatings.userId, userRatings.entryId], set: { rating } });
    res.json({ rating });
  }));

  // Clear rating
  app.delete("/api/ratings/:entryId", requireAuth, parseIntParam('entryId'), handleAsyncErrors(async (req: any, res) => {
    const entryId = (req as any).parsedParams.entryId;
    const userId = req.user?.id;
    await db.delete(userRatings).where(and(eq(userRatings.userId, userId), eq(userRatings.entryId, entryId)));
    res.json({ rating: null });
  }));

  // Get user's rating for an entry
  app.get("/api/ratings/:entryId", parseIntParam('entryId'), handleAsyncErrors(async (req: any, res) => {
    const entryId = (req as any).parsedParams.entryId;
    const token = req.cookies?.auth_session;
    if (!token) return res.json({ rating: null });
    try {
      const { validateSession } = await import('./auth');
      const user = await validateSession(token);
      if (!user) return res.json({ rating: null });
      const row = await db.select().from(userRatings)
        .where(and(eq(userRatings.userId, user.id), eq(userRatings.entryId, entryId)))
        .limit(1);
      res.json({ rating: row[0]?.rating ?? null });
    } catch {
      res.json({ rating: null });
    }
  }));

  // ── User Archives (personal hide) ────────────────────────────────────────

  // Toggle personal archive on an entry
  app.post("/api/archives/:entryId", requireAuth, parseIntParam('entryId'), handleAsyncErrors(async (req: any, res) => {
    const entryId = (req as any).parsedParams.entryId;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    // Check if already archived
    const existing = await db.select().from(userArchives)
      .where(and(eq(userArchives.userId, userId), eq(userArchives.entryId, entryId)))
      .limit(1);
    if (existing.length > 0) {
      await db.delete(userArchives).where(and(eq(userArchives.userId, userId), eq(userArchives.entryId, entryId)));
      res.json({ archived: false });
    } else {
      await db.insert(userArchives).values({ userId, entryId });
      res.json({ archived: true });
    }
  }));

  // Check archive status
  app.get("/api/archives/check/:entryId", parseIntParam('entryId'), handleAsyncErrors(async (req: any, res) => {
    const entryId = (req as any).parsedParams.entryId;
    const token = req.cookies?.auth_session;
    if (!token) return res.json({ archived: false });
    try {
      const { validateSession } = await import('./auth');
      const user = await validateSession(token);
      if (!user) return res.json({ archived: false });
      const row = await db.select().from(userArchives)
        .where(and(eq(userArchives.userId, user.id), eq(userArchives.entryId, entryId)))
        .limit(1);
      res.json({ archived: row.length > 0 });
    } catch {
      res.json({ archived: false });
    }
  }));

  // Check if current user has saved an entry (public endpoint, returns false if not logged in)
  app.get("/api/collections/check/:entryId", parseIntParam('entryId'), handleAsyncErrors(async (req: any, res) => {
    const entryId = (req as any).parsedParams.entryId;
    const token = req.cookies?.auth_token;
    if (!token) return res.json({ saved: false });
    // reuse requireAuth logic inline
    try {
      const { validateSession } = await import('./auth');
      const user = await validateSession(token);
      if (!user) return res.json({ saved: false });
      const row = await db.select().from(userCollections)
        .where(and(eq(userCollections.userId, user.id), eq(userCollections.entryId, entryId)))
        .limit(1);
      res.json({ saved: row.length > 0 });
    } catch {
      res.json({ saved: false });
    }
  }));

  // Get entries data from database
  app.get("/api/entries", async (req, res) => {
    try {
      const { db } = await import('./db');
      
      // Get all entries from database with their customizations
      const entriesQuery = `
        SELECT
          e.id,
          e.user_id as "userId",
          COALESCE(t.title, e.title) as title,
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
          COALESCE(e.archived, false) as archived
        FROM entries e
        LEFT JOIN titles t ON e.id = t.entry_id
        LEFT JOIN custom_entries ce ON e.id = ce.entry_id
        LEFT JOIN circles c ON e.circle_id = c.id
        WHERE COALESCE(e.archived, false) = false
        ORDER BY e.id
      `;
      
      const result = await db.execute(entriesQuery);
      
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
        archived: row.archived || false,
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
    const { db: dbI } = await import('./db');
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
        CASE WHEN uc.entry_id IS NOT NULL THEN true ELSE false END as saved
      FROM entries e
      LEFT JOIN titles t ON e.id = t.entry_id
      LEFT JOIN custom_entries ce ON e.id = ce.entry_id
      LEFT JOIN user_collections uc ON e.id = uc.entry_id AND uc.user_id = ${userId}
      WHERE (e.user_id = ${userId} OR uc.entry_id IS NOT NULL)
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
    }));

    res.json(entries);
  }));

  // Get aggregated artists list with counts
  app.get("/api/artists", async (req, res) => {
    try {
      const { db } = await import('./db');

      const artistsQuery = `
        SELECT
          COALESCE(ce.custom_artist, e.artist) as name,
          COUNT(*) as count,
          ARRAY_AGG(DISTINCT unnested_tag) FILTER (WHERE unnested_tag IS NOT NULL) as tags
        FROM entries e
        LEFT JOIN custom_entries ce ON e.id = ce.entry_id
        LEFT JOIN LATERAL unnest(COALESCE(ce.custom_tags, e.tags)) AS unnested_tag ON true
        GROUP BY COALESCE(ce.custom_artist, e.artist)
        ORDER BY name
      `;

      const result = await db.execute(artistsQuery);

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
  app.get("/api/artists/rankings", async (req, res) => {
    try {
      const { db } = await import('./db');
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

  // Get aggregated tags list with counts
  app.get("/api/tags", async (req, res) => {
    try {
      const { db } = await import('./db');

      // Include both custom_tags (or original tags) AND user_tags in the aggregation
      const tagsQuery = `
        SELECT
          unnested_tag as name,
          COUNT(*) as count,
          ARRAY_AGG(DISTINCT COALESCE(ce.custom_artist, e.artist)) as artists
        FROM entries e
        LEFT JOIN custom_entries ce ON e.id = ce.entry_id
        CROSS JOIN unnest(
          COALESCE(ce.custom_tags, e.tags) || COALESCE(ce.user_tags, ARRAY[]::text[])
        ) AS unnested_tag
        GROUP BY unnested_tag
        ORDER BY count DESC
      `;

      const result = await db.execute(tagsQuery);

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
  app.get("/api/tags/:tagName/entries", async (req, res) => {
    try {
      const tagName = decodeURIComponent(req.params.tagName).toLowerCase();
      const { db } = await import('./db');

      // Find entries where the tag appears in custom_tags, original tags, or user_tags
      const result = await db.execute(sql`
        SELECT
          e.id,
          COALESCE(t.title, e.title) as title,
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
          ce.rating
        FROM entries e
        LEFT JOIN titles t ON e.id = t.entry_id
        LEFT JOIN custom_entries ce ON e.id = ce.entry_id
        LEFT JOIN circles c ON e.circle_id = c.id
        WHERE EXISTS (
          SELECT 1 FROM unnest(COALESCE(ce.custom_tags, e.tags) || COALESCE(ce.user_tags, ARRAY[]::text[])) AS tag
          WHERE LOWER(tag) = ${tagName}
        )
        ORDER BY e.id
      `);

      const dbEntries = result.rows.map((row: any) => ({
        id: row.id,
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
      }));

      res.json(dbEntries);
    } catch (error) {
      console.error('Error loading tag entries:', error);
      res.status(500).json({ message: 'Failed to load tag entries' });
    }
  });

  // Get entries for a specific artist
  app.get("/api/artists/:artistName/entries", async (req, res) => {
    try {
      const artistName = decodeURIComponent(req.params.artistName);
      const { db } = await import('./db');

      const result = await db.execute(sql`
        SELECT
          e.id,
          COALESCE(t.title, e.title) as title,
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
          COALESCE(e.archived, false) as archived
        FROM entries e
        LEFT JOIN titles t ON e.id = t.entry_id
        LEFT JOIN custom_entries ce ON e.id = ce.entry_id
        LEFT JOIN circles c ON e.circle_id = c.id
        WHERE LOWER(COALESCE(ce.custom_artist, e.artist)) = LOWER(${artistName})
        ORDER BY e.id
      `);

      const dbEntries = result.rows.map((row: any) => ({
        id: row.id,
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
        archived: row.archived || false,
      }));

      res.json(dbEntries);
    } catch (error) {
      console.error('Error loading artist entries:', error);
      res.status(500).json({ message: 'Failed to load artist entries' });
    }
  });

  // Archive / unarchive an entry
  // Personal archive toggle — any logged-in user (redirects to user_archives)
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

  // Get individual entry by ID
  app.get("/api/entries/:id", parseIntParam('id'), handleAsyncErrors(async (req, res) => {
    const id = (req as any).parsedParams.id;
    const { db } = await import('./db');

    // Get single entry from database with its customizations
    const result = await storage.getAllEntries();
    const foundEntry = result.find((e: any) => e.id === id);

    if (!foundEntry) {
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
  app.post("/api/titles", handleZodValidation(insertTitleSchema), handleAsyncErrors(async (req, res) => {
    const validatedData = req.body;
    
    if (!validatedData.title.trim()) {
      return res.status(400).json({ message: 'Title cannot be empty' });
    }
    
    const title = await storage.setTitle({
      entryId: validatedData.entryId,
      title: validatedData.title.trim()
    });
    
    res.json(title);
  }));

  // Configure multer for image uploads - save to disk
  const uploadsDir = path.join(process.cwd(), 'uploads');

  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename: timestamp-random-originalname
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const nameWithoutExt = path.basename(file.originalname, ext);
      cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
    }
  });

  const upload = multer({
    storage: diskStorage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    },
  });

  // Upload image endpoint
  app.post("/api/upload-image", upload.single('image'), async (req, res) => {
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
  app.post('/api/share', upload.single('file'), handleAsyncErrors(async (req, res) => {
    const { title, text, url } = req.body;
    
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
          type: "image"
        });
      } else if (url) {
        // Handle shared URL
        entry = await storage.createEntry({
          title: title || text || "Shared Link",
          imageUrl: "",
          externalLink: url,
          artist: "Unknown",
          tags: ["shared", "link"],
          type: "image"
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
  app.post('/share-handler', upload.single('file'), handleAsyncErrors(async (req, res) => {
    const { title, text, url } = req.body;
    
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
          type: "image"
        });
      } else if (url) {
        // Handle shared URL
        entry = await storage.createEntry({
          title: title || text || "Shared Link",
          imageUrl: "",
          externalLink: url,
          artist: "Unknown",
          tags: ["shared", "link"],
          type: "image"
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
  app.post("/api/custom-entries", async (req, res) => {
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
  app.post("/api/entries", async (req, res) => {
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
      });

      const validatedData = schema.parse(req.body);

      // Handle backwards compatibility: merge keywords into userTags
      let userTags = validatedData.userTags;
      if (validatedData.keywords && validatedData.keywords.length > 0) {
        userTags = [...(userTags || []), ...validatedData.keywords];
      }

      const newEntry = await storage.createEntry({
        ...validatedData,
        userTags: userTags,
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

  app.get("/api/admin/users", requireAuth, handleAsyncErrors(async (req: any, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const { db: dbI } = await import('./db');
    const result = await dbI.execute(sql`
      SELECT
        u.id,
        u.username,
        u.email,
        u.role,
        u.created_at as "createdAt",
        COUNT(DISTINCT e.id) as entries,
        COUNT(DISTINCT uc.entry_id) as saved,
        COUNT(DISTINCT ur.entry_id) as ratings,
        COUNT(DISTINCT ua.entry_id) as archived
      FROM users u
      LEFT JOIN entries e ON e.user_id = u.id
      LEFT JOIN user_collections uc ON uc.user_id = u.id
      LEFT JOIN user_ratings ur ON ur.user_id = u.id
      LEFT JOIN user_archives ua ON ua.user_id = u.id
      GROUP BY u.id, u.username, u.email, u.role, u.created_at
      ORDER BY u.id
    `);
    res.json(result.rows);
  }));

  app.get("/api/admin/stats", requireAuth, handleAsyncErrors(async (req: any, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const { db: dbI } = await import('./db');
    const result = await dbI.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE role = 'admin') as admin_users,
        (SELECT COUNT(*) FROM entries) as total_entries,
        (SELECT COUNT(*) FROM user_collections) as total_saves,
        (SELECT COUNT(*) FROM user_ratings) as total_ratings,
        (SELECT COUNT(DISTINCT type) FROM entries) as entry_types,
        (SELECT COUNT(*) FROM entries WHERE type = 'comic') as comics,
        (SELECT COUNT(*) FROM entries WHERE type = 'sequence') as sequences,
        (SELECT COUNT(*) FROM entries WHERE type = 'image') as images,
        (SELECT COUNT(*) FROM entries WHERE type = 'story') as stories
    `);
    res.json(result.rows[0]);
  }));

  // Delete entry — admin only
  app.delete("/api/entries/:entryId", requireAuth, parseIntParam('entryId'), handleAsyncErrors(async (req: any, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const entryId = (req as any).parsedParams.entryId;
    await storage.deleteEntry(entryId);
    res.json({ message: 'Entry deleted successfully' });
  }));

  // Append image to sequence
  app.post("/api/entries/:entryId/sequence-images", parseIntParam('entryId'), handleAsyncErrors(async (req, res) => {
    const entryId = (req as any).parsedParams.entryId;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ message: 'Image URL is required' });
    }

    const updatedEntry = await (storage as any).appendSequenceImage(entryId, imageUrl);
    res.json({ success: true, entry: updatedEntry });
  }));

  // Append images from Twitter/X URLs to existing sequence
  app.post("/api/entries/:entryId/sequence-images/twitter", parseIntParam('entryId'), handleAsyncErrors(async (req, res) => {
    const entryId = (req as any).parsedParams.entryId;
    const { tweetUrls } = req.body;

    if (!tweetUrls || !Array.isArray(tweetUrls) || tweetUrls.length === 0) {
      return res.status(400).json({ message: 'At least one tweet URL is required' });
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
      const { extractTwitterImages } = await import('./twitter-extractor');
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
  app.get('/api/artists/:artistName/links', async (req, res) => {
    try {
      const artistName = decodeURIComponent(req.params.artistName);
      const links = await storage.getArtistLinks(artistName);
      res.json(links);
    } catch (error) {
      console.error('Error fetching artist links:', error);
      res.status(500).json({ message: 'Failed to fetch artist links' });
    }
  });

  app.post('/api/artists/:artistName/links', async (req, res) => {
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

  app.delete('/api/artist-links/:id', async (req, res) => {
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
      // Fetch all emojis in a single query
      const result = await db.execute(sql`
        SELECT tag_name, emoji FROM tag_emojis
        WHERE LOWER(tag_name) = ANY(${sql.raw(`ARRAY[${tags.map(t => `LOWER('${t.replace(/'/g, "''")}')`).join(',')}]`)})
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

  app.post("/api/tag-emojis", handleZodValidation(insertTagEmojiSchema), handleAsyncErrors(async (req, res) => {
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
  app.post("/api/extract-twitter", handleAsyncErrors(async (req, res) => {
    const { tweetUrl, title, tags, artist } = req.body;

    if (!tweetUrl) {
      return res.status(400).json({ message: 'Tweet URL is required' });
    }

    try {
      const { extractTwitterImages } = await import('./twitter-extractor');

      // Extract and download images
      const { tweetData, downloadedImages } = await extractTwitterImages(
        tweetUrl,
        path.join(process.cwd(), 'uploads')
      );

      // Prepare entry data
      const entryTitle = title || tweetData.text.substring(0, 100) || 'Twitter Image';
      const entryArtist = artist || `@${tweetData.author.screen_name}`;
      const entryTags = tags || ['twitter', 'imported'];

      // Create entry in database
      // If single image: use imageUrl
      // If multiple images: use imageUrl for first, sequenceImages for rest
      const entryData: any = {
        title: entryTitle,
        imageUrl: downloadedImages[0],
        externalLink: tweetData.url,
        artist: entryArtist,
        tags: entryTags,
        type: downloadedImages.length > 1 ? 'sequence' : (downloadedImages[0].endsWith('.mp4') ? 'video' : 'image'),
        content: tweetData.text,
      };

      if (downloadedImages.length > 1) {
        entryData.sequenceImages = downloadedImages;
      }

      const entry = await storage.createEntry(entryData);

      res.json({
        success: true,
        entry,
        message: `Successfully imported ${downloadedImages.length} media item(s) from Twitter`,
        imageCount: downloadedImages.length,
      });
    } catch (error: any) {
      console.error('Error extracting Twitter images:', error);
      res.status(500).json({
        message: 'Failed to extract images from tweet',
        error: error.message,
      });
    }
  }));

  // Extract images from multiple Twitter/X tweets and create a single entry
  app.post("/api/extract-twitter-multi", handleAsyncErrors(async (req, res) => {
    const { tweetUrls, title, tags, artist } = req.body;

    if (!tweetUrls || !Array.isArray(tweetUrls) || tweetUrls.length === 0) {
      return res.status(400).json({ message: 'At least one tweet URL is required' });
    }

    try {
      const { extractTwitterImages } = await import('./twitter-extractor');

      const allDownloadedImages: string[] = [];
      let firstTweetData: any = null;

      // Process each tweet URL sequentially to maintain order
      for (let i = 0; i < tweetUrls.length; i++) {
        const tweetUrl = tweetUrls[i];
        try {
          const { tweetData, downloadedImages } = await extractTwitterImages(
            tweetUrl,
            path.join(process.cwd(), 'uploads')
          );

          // Store first tweet's data for title/author info
          if (i === 0) {
            firstTweetData = tweetData;
          }

          // Add all images from this tweet to our collection
          allDownloadedImages.push(...downloadedImages);
        } catch (error: any) {
          console.error(`Error processing tweet ${i + 1} (${tweetUrl}):`, error);
          // Continue with other tweets, but log the error
        }
      }

      if (allDownloadedImages.length === 0) {
        return res.status(400).json({
          message: 'No media could be extracted from any of the provided tweets',
        });
      }

      // Prepare entry data using first tweet's info
      const entryTitle = title || firstTweetData?.text?.substring(0, 100) || 'Twitter Images';
      const entryArtist = artist || (firstTweetData ? `@${firstTweetData.author.screen_name}` : 'Unknown');
      const entryTags = tags || ['twitter', 'imported'];

      // Create entry in database
      // If single image: use imageUrl
      // If multiple images: use imageUrl for first, sequenceImages for all
      const entryData: any = {
        title: entryTitle,
        imageUrl: allDownloadedImages[0],
        externalLink: firstTweetData?.url || tweetUrls[0],
        artist: entryArtist,
        tags: entryTags,
        type: allDownloadedImages.length > 1 ? 'sequence' : (allDownloadedImages[0].endsWith('.mp4') ? 'video' : 'image'),
      };

      if (allDownloadedImages.length > 1) {
        entryData.sequenceImages = allDownloadedImages;
      }

      const entry = await storage.createEntry(entryData);

      res.json({
        success: true,
        entry,
        message: `Successfully imported ${allDownloadedImages.length} media item(s) from ${tweetUrls.length} tweet(s)`,
        imageCount: allDownloadedImages.length,
        tweetCount: tweetUrls.length,
      });
    } catch (error: any) {
      console.error('Error extracting Twitter images:', error);
      res.status(500).json({
        message: 'Failed to extract images from tweets',
        error: error.message,
      });
    }
  }));

  // Image Gallery — browse AI-generated images on the server
  app.get("/api/gallery", handleAsyncErrors(async (req, res) => {
    const GENERATED_DIR = '/root/.openclaw/workspace/media/generated';
    const PORTRAITS_DIR = '/root/.openclaw/workspace/attachments/characters';
    const PORTRAITS_URL_BASE = 'https://andy.mariesvault.com/portraits';

    const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

    function walkDir(dir: string): string[] {
      if (!fs.existsSync(dir)) return [];
      const results: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...walkDir(fullPath));
        } else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const files = walkDir(GENERATED_DIR);

    const items = files.map(filePath => {
      const filename = path.basename(filePath);
      const destPath = path.join(PORTRAITS_DIR, filename);

      // Copy to portraits dir if not already there
      if (!fs.existsSync(destPath)) {
        try {
          fs.mkdirSync(PORTRAITS_DIR, { recursive: true });
          fs.copyFileSync(filePath, destPath);
        } catch (e) {
          // non-fatal
        }
      }

      const stat = fs.statSync(filePath);
      return {
        filename,
        path: filePath,
        url: `${PORTRAITS_URL_BASE}/${filename}`,
        createdAt: stat.mtime.toISOString(),
      };
    });

    // Sort newest first
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(items);
  }));

  const httpServer = createServer(app);
  return httpServer;
}
