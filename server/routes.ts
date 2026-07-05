import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTitleSchema, insertCustomEntrySchema, insertTagEmojiSchema, entries, titles, customEntries, tagEmojis, userCollections, userArchives, userRatings, galleryFavourites, storageEntries } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import archiver from "archiver";
import { db } from "./db";
import { eq, sql, and, desc } from "drizzle-orm";
import { handleLogin, handleLogout, handleRegister, handleMe, requireAuth, requireAdmin, optionalAuth, requireAuthOrService, requireAuthOrPublicEntry } from "./auth";
import { handlePublish, handleUnpublish, listMyPublished, listPublicStories, getStoryBySlug, incrementViews, PUBLISHED_ROOT, appHostname, storyUrlFor } from "./stories.js";


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

// True if the user owns the entry or is an admin. Gates customisation writes
// (titles, custom_entries, sequence images) which mutate an entry's shared
// display for every viewer, so they must be restricted to the entry's owner.
async function userMayEditEntry(entryId: number, user: any): Promise<boolean> {
  if (!user) return false;
  if (user.role === "admin") return true;
  const [row] = await db.select({ userId: entries.userId }).from(entries).where(eq(entries.id, entryId)).limit(1);
  return !!row && row.userId === user.id;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes (unprotected)
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/logout", handleLogout);
  app.post("/api/auth/register", requireAuth, requireAdmin, handleRegister);
  app.get("/api/auth/me", handleMe);
  // SSO validator — used by sibling apps (Choice, Change Room) to resolve the
  // shared .mariesvault.com session cookie into a user without importing auth.
  app.get("/api/auth/validate", handleMe);

  // ── Published stories ────────────────────────────────────────────────────
  app.post("/api/stories/publish", handleAsyncErrors(handlePublish));
  app.get("/api/stories/mine", requireAuthOrService, handleAsyncErrors(listMyPublished));
  app.get("/api/stories/public", handleAsyncErrors(listPublicStories));
  app.delete("/api/stories/:slug", requireAuthOrService, handleAsyncErrors(handleUnpublish));

  // Public JSON read — used by the viewer page for client-side render.
  app.get("/api/stories/:slug", handleAsyncErrors(async (req: Request, res: Response) => {
    const story = await getStoryBySlug(req.params.slug);
    if (!story) return res.status(404).json({ error: "not found" });
    // Strip internal absolute paths before sending to the browser.
    const { cover_image_path, before_image_path, after_image_path, source_paths, ...rest } = story;
    res.json({
      ...rest,
      coverUrl: cover_image_path ? `/s/${story.slug}/cover.jpg` : null,
      beforeUrl: `/s/${story.slug}/before${path.extname(before_image_path)}`,
      afterUrl:  `/s/${story.slug}/after${path.extname(after_image_path)}`,
    });
  }));

  // Serve published images by slug. Locked to the published/ dir — no traversal.
  app.get("/s/:slug/:file", handleAsyncErrors(async (req: Request, res: Response) => {
    const { slug, file } = req.params;
    if (!/^[a-z0-9_-]+$/.test(slug)) return res.status(400).end();
    if (!/^(before|after|cover|step-\d+)\.(png|jpe?g|webp)$/i.test(file)) return res.status(400).end();
    const abs = path.join(PUBLISHED_ROOT, slug, file);
    if (!abs.startsWith(PUBLISHED_ROOT + path.sep)) return res.status(400).end();
    if (!fs.existsSync(abs)) return res.status(404).end();
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(abs);
  }));

  // Story viewer — sniffs bot UA for minimal OG-card HTML, otherwise falls
  // through to the SPA (which fetches /api/stories/:slug client-side).
  const BOT_UA = /bot|crawler|spider|facebookexternalhit|twitterbot|discordbot|slackbot|whatsapp|telegrambot|linkedinbot/i;
  app.get("/s/:slug", handleAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    const slug = req.params.slug;
    if (!/^[a-z0-9_-]+$/.test(slug)) return next();
    const story = await getStoryBySlug(slug);
    if (!story) {
      res.status(404);
      return next();
    }
    const ua = req.headers["user-agent"] || "";
    const reqHost = String(req.headers.host || "").toLowerCase();
    const canonicalHost = appHostname(story.app);
    // The per-app subdomain (choice./change.) is the canonical URL bots crawl
    // for the OG card — better brand match in shared links. The rich SPA
    // viewer only renders on gallery.* (its assets live there), so route
    // human clicks back to gallery while letting bots stay on the per-app URL.
    const isBot = BOT_UA.test(ua);
    if (!isBot && reqHost !== "gallery.mariesvault.com" && reqHost === canonicalHost) {
      return res.redirect(302, `https://gallery.mariesvault.com/s/${slug}`);
    }
    if (isBot) {
      const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      } as any)[c]);
      const url = `https://${canonicalHost}/s/${slug}`;
      const coverUrl = story.cover_image_path ? `${url}/cover.jpg` : `${url}/after${path.extname(story.after_image_path)}`;
      const title = esc(story.title);
      const fallbackSummary = story.app === "choice"
        ? "A choose-your-own-adventure from Marie's Choice."
        : "A transformation story from The Change Room.";
      const summary = esc(story.summary || fallbackSummary);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(`<!doctype html><html><head>
<meta charset="utf-8">
<title>${title}</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${summary}">
<meta property="og:image" content="${coverUrl}">
<meta property="og:image:secure_url" content="${coverUrl}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${title}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Marie's Vault">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${summary}">
<meta name="twitter:image" content="${coverUrl}">
<meta name="twitter:image:alt" content="${title}">
</head><body><h1>${title}</h1><p>${summary}</p><img src="${coverUrl}" alt=""></body></html>`);
    }
    // Human — count the view and let the SPA handle rendering.
    incrementViews(slug).catch(() => {});
    next();
  }));

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

  // Batch get ratings — MUST be before /:entryId to avoid route conflict
  app.get("/api/ratings/batch", handleAsyncErrors(async (req: any, res) => {
    const idsStr = req.query.ids as string;
    if (!idsStr) return res.json({ ratings: {} });
    const entryIds = idsStr.split(',').map(Number).filter(n => n > 0);
    if (entryIds.length === 0) return res.json({ ratings: {} });
    const token = req.cookies?.auth_session;
    if (!token) return res.json({ ratings: {} });
    try {
      const { validateSession } = await import('./auth');
      const user = await validateSession(token);
      if (!user) return res.json({ ratings: {} });
      const rows = await db.select().from(userRatings)
        .where(and(
          eq(userRatings.userId, user.id),
          sql`${userRatings.entryId} = ANY(${entryIds})`
        ));
      const out: Record<number, number> = {};
      for (const r of rows) out[r.entryId] = r.rating;
      res.json({ ratings: out });
    } catch {
      res.json({ ratings: {} });
    }
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
    const token = req.cookies?.auth_session;
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
  app.get("/api/entries", requireAuth, async (req: any, res) => {
    try {
      const { db } = await import('./db');
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
  app.get("/api/artists", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.json([]);
      const { db } = await import('./db');

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
      const { db } = await import('./db');

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
      const { db } = await import('./db');

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
          COALESCE(e.visibility, 'public') as visibility
        FROM entries e
        LEFT JOIN titles t ON e.id = t.entry_id
        LEFT JOIN custom_entries ce ON e.id = ce.entry_id
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
      const { db } = await import('./db');

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
          COALESCE(e.archived, false) as archived,
          COALESCE(e.visibility, 'public') as visibility
        FROM entries e
        LEFT JOIN titles t ON e.id = t.entry_id
        LEFT JOIN custom_entries ce ON e.id = ce.entry_id
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

  app.get("/api/admin/users", requireAuth, handleAsyncErrors(async (req: any, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const { db: dbI } = await import('./db');
    const result = await dbI.execute(sql`
      SELECT
        u.id,
        u.username,
        u.email,
        u.role,
        u.status,
        u.signup_ip as "signupIp",
        u.signup_user_agent as "signupUserAgent",
        u.signup_referer as "signupReferer",
        u.signup_accept_language as "signupAcceptLanguage",
        u.created_at as "createdAt",
        COUNT(DISTINCT e.id) as entries,
        COUNT(DISTINCT uc.entry_id) as saved,
        COUNT(DISTINCT ur.entry_id) as ratings,
        COUNT(DISTINCT ua.entry_id) as archived,
        COALESCE((SELECT SUM(size_bytes) FROM storage_entries WHERE user_id = u.id), 0)::bigint as "usedBytes",
        COALESCE((SELECT COUNT(*) FROM storage_entries WHERE user_id = u.id), 0)::int as "storageFiles"
      FROM users u
      LEFT JOIN entries e ON e.user_id = u.id
      LEFT JOIN user_collections uc ON uc.user_id = u.id
      LEFT JOIN user_ratings ur ON ur.user_id = u.id
      LEFT JOIN user_archives ua ON ua.user_id = u.id
      GROUP BY u.id
      ORDER BY (u.status = 'pending') DESC, u.id
    `);
    res.json(result.rows);
  }));

  app.post("/api/admin/users/:id/status", requireAuth, parseIntParam('id'), handleAsyncErrors(async (req: any, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const userId = (req as any).parsedParams.id;
    const { status } = req.body || {};
    if (!['approved', 'rejected', 'pending'].includes(status))
      return res.status(400).json({ error: 'status must be approved, rejected, or pending' });
    if (userId === req.user.id)
      return res.status(400).json({ error: 'cannot change your own status' });
    const { pool } = await import('./db');
    const result = await pool.query(
      `UPDATE users SET status = $1 WHERE id = $2 RETURNING id, username, status`,
      [status, userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'user not found' });
    // Revoke sessions if being de-approved.
    if (status !== 'approved') {
      await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [userId]);
    }
    res.json(result.rows[0]);
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
  app.post("/api/extract-twitter", requireAuth, handleAsyncErrors(async (req: any, res) => {
    const { tweetUrl, title, tags, artist, visibility } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });
    const v = visibility === 'private' ? 'private' : 'public';

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
      const entryTags = tags || ['twitter'];

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
        userId,
        visibility: v,
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
  app.post("/api/extract-twitter-multi", requireAuth, handleAsyncErrors(async (req: any, res) => {
    const { tweetUrls, title, tags, artist, visibility } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });
    const v = visibility === 'private' ? 'private' : 'public';

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
      const entryTags = tags || ['twitter'];

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
        userId,
        visibility: v,
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
  // ── Manga List — public index of all comics & sequences ──
  app.get("/api/mangalist", handleAsyncErrors(async (req, res) => {
    const { db } = await import('./db');
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
  const OPENCLAW_USER_ID = 7;
  const OPENCLAW_GENERATED_DIR = '/root/.openclaw/workspace/media/generated';
  const OPENCLAW_PORTRAITS_DIR = '/root/.openclaw/workspace/attachments/characters';
  const OPENCLAW_URL_BASE = '/portraits';
  const OPENCLAW_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
  const OPENCLAW_EXCLUDED = ['tileable', 'texture', 'seamless', 'grass', 'wood', 'bark', 'thatch', 'stone', 'leaves', 'shrine_roof', 'roof_tiles'];

  function mimeFromExt(ext: string): string {
    switch (ext.toLowerCase()) {
      case '.png': return 'image/png';
      case '.gif': return 'image/gif';
      case '.webp': return 'image/webp';
      default: return 'image/jpeg';
    }
  }

  async function scanAndUpsertOpenClaw(userId: number): Promise<Array<{ id: number; filename: string; path: string; url: string; createdAt: string; app: string; hearted: boolean }>> {
    if (!fs.existsSync(OPENCLAW_GENERATED_DIR)) return [];
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (OPENCLAW_IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) found.push(full);
      }
    };
    walk(OPENCLAW_GENERATED_DIR);

    const filtered = found.filter(fp => {
      const name = path.basename(fp).toLowerCase();
      return !OPENCLAW_EXCLUDED.some(kw => name.includes(kw));
    });

    const upserts = filtered.map(fp => {
      const filename = path.basename(fp);
      const destPath = path.join(OPENCLAW_PORTRAITS_DIR, filename);
      if (!fs.existsSync(destPath)) {
        try {
          fs.mkdirSync(OPENCLAW_PORTRAITS_DIR, { recursive: true });
          fs.copyFileSync(fp, destPath);
        } catch { /* non-fatal */ }
      }
      const stat = fs.statSync(fp);
      return {
        userId,
        app: "openclaw",
        kind: "image",
        path: fp,
        sizeBytes: stat.size,
        mime: mimeFromExt(path.extname(filename)),
        createdAt: stat.mtime,
      };
    });

    if (upserts.length) {
      await db
        .insert(storageEntries)
        .values(upserts)
        .onConflictDoNothing({ target: [storageEntries.app, storageEntries.path] });
    }

    const rows = await db
      .select({
        id: storageEntries.id,
        path: storageEntries.path,
        hearted: storageEntries.hearted,
        createdAt: storageEntries.createdAt,
      })
      .from(storageEntries)
      .where(and(eq(storageEntries.userId, userId), eq(storageEntries.app, "openclaw")));

    return rows.map(r => ({
      id: r.id,
      filename: path.basename(r.path),
      path: r.path,
      url: `${OPENCLAW_URL_BASE}/${path.basename(r.path)}`,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      app: "openclaw",
      hearted: r.hearted,
    }));
  }

  app.get("/api/gallery", requireAuthOrService, handleAsyncErrors(async (req: any, res) => {
    const userId = req.user.id;

    const rows = await db
      .select({
        id: storageEntries.id,
        app: storageEntries.app,
        kind: storageEntries.kind,
        path: storageEntries.path,
        hearted: storageEntries.hearted,
        createdAt: storageEntries.createdAt,
      })
      .from(storageEntries)
      .where(and(
        eq(storageEntries.userId, userId),
        eq(storageEntries.kind, "image"),
        sql`${storageEntries.app} <> 'openclaw'`,
      ))
      .orderBy(desc(storageEntries.createdAt));

    const ledgerItems = rows.map(r => ({
      id: r.id,
      filename: path.basename(r.path),
      path: r.path,
      url: `/api/gallery/image/${r.id}`,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      app: r.app,
      hearted: r.hearted,
    }));

    const openClawItems = userId === OPENCLAW_USER_ID ? await scanAndUpsertOpenClaw(userId) : [];

    const items = [...ledgerItems, ...openClawItems];
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Best-effort: badge items that have been posted to X by social.mariesvault.com.
    // If the lookup fails (service down, no secret), gallery still renders without badges.
    let postedMap: Record<string, string> = {};
    try {
      const r = await fetch("http://localhost:3006/api/vault/posted-ids", {
        headers: { "x-service-secret": process.env.SERVICE_SECRET || "" },
        signal: AbortSignal.timeout(2000),
      });
      if (r.ok) postedMap = await r.json();
    } catch { /* badge is optional */ }

    const annotated = items.map(it => ({
      ...it,
      postedToX: postedMap[String(it.id)] ? { tweetId: postedMap[String(it.id)] } : null,
    }));

    res.json(annotated);
  }));

  // Stream a ledger-tracked image by id after verifying ownership.
  app.get("/api/gallery/image/:id", requireAuthOrService, handleAsyncErrors(async (req: any, res) => {
    const userId = req.user.id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "bad id" });

    const [row] = await db
      .select({ path: storageEntries.path, mime: storageEntries.mime })
      .from(storageEntries)
      .where(and(eq(storageEntries.id, id), eq(storageEntries.userId, userId)))
      .limit(1);

    if (!row) return res.status(404).json({ error: "not found" });
    if (!fs.existsSync(row.path)) return res.status(410).json({ error: "file gone" });

    res.setHeader("Content-Type", row.mime || "image/png");
    res.setHeader("Cache-Control", "private, max-age=3600");
    fs.createReadStream(row.path).pipe(res);
  }));

  // ── Gallery favourites (hearts) ──────────────────────────────────────────

  app.get("/api/gallery/favourites", requireAuthOrService, handleAsyncErrors(async (req: any, res) => {
    const userId = req.user.id;
    const rows = await db
      .select({ filename: galleryFavourites.filename, createdAt: galleryFavourites.createdAt })
      .from(galleryFavourites)
      .where(eq(galleryFavourites.userId, userId));
    res.json(rows.map(r => r.filename));
  }));

  app.post("/api/gallery/favourites", requireAuthOrService, handleAsyncErrors(async (req: any, res) => {
    const userId = req.user.id;
    const raw = req.body?.filenames ?? (req.body?.filename ? [req.body.filename] : null);
    if (!Array.isArray(raw) || raw.length === 0) {
      return res.status(400).json({ error: "filename or filenames[] required" });
    }
    const filenames = raw.filter((f: unknown): f is string => typeof f === "string" && f.length > 0);
    if (!filenames.length) return res.status(400).json({ error: "no valid filenames" });

    await db
      .insert(galleryFavourites)
      .values(filenames.map(filename => ({ userId, filename })))
      .onConflictDoNothing({ target: [galleryFavourites.userId, galleryFavourites.filename] });
    res.json({ added: filenames.length });
  }));

  app.delete("/api/gallery/favourites/:filename", requireAuthOrService, handleAsyncErrors(async (req: any, res) => {
    const userId = req.user.id;
    const filename = req.params.filename;
    await db
      .delete(galleryFavourites)
      .where(and(eq(galleryFavourites.userId, userId), eq(galleryFavourites.filename, filename)));
    res.json({ ok: true });
  }));

  // ── Storage ledger ───────────────────────────────────────────────────────
  // Cross-app source of truth: every Choice/Change/Studio artifact gets a row.
  // Writes are service-secret only (backend-to-backend). Reads are session-auth.

  const VALID_APPS = new Set(["choice", "change", "studio", "openclaw", "hermes"]);
  const VALID_KINDS = new Set(["image", "session-json", "video", "audio"]);

  app.post("/api/ledger/record", handleAsyncErrors(async (req: Request, res: Response) => {
    const providedSecret = req.headers["x-service-secret"];
    if (!process.env.SERVICE_SECRET || providedSecret !== process.env.SERVICE_SECRET) {
      return res.status(401).json({ error: "service secret required" });
    }
    const { user_id, app: appName, kind, path: entryPath, size_bytes, mime, session_ref, meta } = req.body ?? {};
    if (!Number.isInteger(user_id) || user_id <= 0) return res.status(400).json({ error: "user_id required" });
    if (!VALID_APPS.has(appName))  return res.status(400).json({ error: `app must be one of ${[...VALID_APPS].join(", ")}` });
    if (!VALID_KINDS.has(kind))    return res.status(400).json({ error: `kind must be one of ${[...VALID_KINDS].join(", ")}` });
    if (typeof entryPath !== "string" || !entryPath) return res.status(400).json({ error: "path required" });
    if (!Number.isInteger(size_bytes) || size_bytes < 0) return res.status(400).json({ error: "size_bytes required" });

    const [row] = await db
      .insert(storageEntries)
      .values({
        userId: user_id,
        app: appName,
        kind,
        path: entryPath,
        sizeBytes: size_bytes,
        mime: mime ?? null,
        sessionRef: session_ref ?? null,
        meta: meta ?? null,
      })
      .onConflictDoNothing({ target: [storageEntries.app, storageEntries.path] })
      .returning({ id: storageEntries.id });

    // Behavioral anti-bot gate: first successful generation flips pending → approved.
    // Bots without a NovelAI key can't cross this line.
    if (row) {
      const { pool } = await import("./db");
      await pool.query(
        `UPDATE users SET status = 'approved' WHERE id = $1 AND status = 'pending'`,
        [user_id]
      );
    }

    res.status(row ? 201 : 200).json({ id: row?.id ?? null });
  }));

  app.get("/api/ledger/list", requireAuth, handleAsyncErrors(async (req: any, res: Response) => {
    const userId = req.user.id;
    const appFilter = typeof req.query.app === "string" ? req.query.app : null;
    const heartedOnly = req.query.hearted === "1" || req.query.hearted === "true";
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);

    // Raw SQL so we can EXISTS-join against published_stories.source_paths and
    // tag each row with isPublished / publishedSlug for the lock indicator.
    const { pool } = await import("./db");
    const where: string[] = ["s.user_id = $1"];
    const params: any[] = [userId];
    if (appFilter && VALID_APPS.has(appFilter)) { params.push(appFilter); where.push(`s.app = $${params.length}`); }
    if (heartedOnly) where.push("s.hearted = true");
    params.push(limit);

    const { rows } = await pool.query(
      `SELECT s.*,
              (SELECT slug FROM published_stories
                WHERE user_id = s.user_id AND s.path = ANY(source_paths)
                LIMIT 1) AS "publishedSlug"
         FROM storage_entries s
        WHERE ${where.join(" AND ")}
        ORDER BY s.created_at DESC
        LIMIT $${params.length}`,
      params
    );
    res.json(rows.map(r => ({
      ...r,
      userId: r.user_id,
      sizeBytes: Number(r.size_bytes || 0),
      sessionRef: r.session_ref,
      createdAt: r.created_at,
      isPublished: !!r.publishedSlug,
    })));
  }));

  const QUOTA_TIERS: Record<string, number> = {
    free: 1_073_741_824,       // 1 GB
    plus: 5_368_709_120,       // 5 GB
    pro:  16_106_127_360,      // 15 GB
  };

  async function buildQuotaPayload(userId: number) {
    const [usageRows, userRows] = await Promise.all([
      db.execute<{ app: string; count: number; bytes: number }>(sql`
        SELECT app, COUNT(*)::int AS count, COALESCE(SUM(size_bytes), 0)::bigint AS bytes
        FROM storage_entries
        WHERE user_id = ${userId}
        GROUP BY app
      `),
      db.execute<{ role: string }>(sql`SELECT role FROM users WHERE id = ${userId}`),
    ]);
    const breakdown = ((usageRows as any).rows ?? usageRows).map((r: any) => ({
      app: r.app,
      count: Number(r.count || 0),
      bytes: Number(r.bytes || 0),
    }));
    const usedBytes = breakdown.reduce((acc: number, r: any) => acc + r.bytes, 0);
    const role = (((userRows as any).rows ?? userRows)[0] as any)?.role ?? "user";
    const isAdmin = role === "admin";
    const tier = isAdmin ? "unlimited" : "free"; // TODO wire Patreon webhooks to select plus/pro
    const quotaBytes = isAdmin ? 0 : QUOTA_TIERS[tier] ?? QUOTA_TIERS.free;
    return {
      userId,
      tier,
      usedBytes,
      quotaBytes,
      percent: quotaBytes > 0 ? Math.min(1, usedBytes / quotaBytes) : 0,
      byApp: breakdown,
      manageUrl: "https://gallery.mariesvault.com/storage",
    };
  }

  app.get("/api/ledger/usage", requireAuth, handleAsyncErrors(async (req: any, res: Response) => {
    res.json(await buildQuotaPayload(req.user.id));
  }));

  app.get("/api/quota", requireAuth, handleAsyncErrors(async (req: any, res: Response) => {
    res.json(await buildQuotaPayload(req.user.id));
  }));

  app.get("/api/quota/user/:userId", handleAsyncErrors(async (req: Request, res: Response) => {
    const provided = req.headers["x-service-secret"];
    if (!provided || provided !== process.env.SERVICE_SECRET) {
      return res.status(401).json({ error: "bad service secret" });
    }
    const userId = parseInt(req.params.userId, 10);
    if (!userId) return res.status(400).json({ error: "invalid userId" });
    res.json(await buildQuotaPayload(userId));
  }));

  app.post("/api/ledger/:id/heart", requireAuth, handleAsyncErrors(async (req: any, res: Response) => {
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "invalid id" });
    const hearted = !!req.body?.hearted;
    const result = await db
      .update(storageEntries)
      .set({ hearted })
      .where(and(eq(storageEntries.id, id), eq(storageEntries.userId, userId)))
      .returning({ id: storageEntries.id });
    if (!result.length) return res.status(404).json({ error: "not found" });
    res.json({ ok: true, hearted });
  }));

  app.delete("/api/ledger/:id", requireAuth, handleAsyncErrors(async (req: any, res: Response) => {
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "invalid id" });
    const row = await db
      .select({ path: storageEntries.path })
      .from(storageEntries)
      .where(and(eq(storageEntries.id, id), eq(storageEntries.userId, userId)))
      .limit(1);
    if (!row.length) return res.status(404).json({ error: "not found" });

    // Block deletion if this file backs a published story. User must unpublish first.
    const { pool } = await import("./db");
    const lock = await pool.query(
      "SELECT slug FROM published_stories WHERE user_id = $1 AND $2 = ANY(source_paths) LIMIT 1",
      [userId, row[0].path]
    );
    if (lock.rows[0]) {
      return res.status(409).json({
        error: "locked",
        message: "This image backs a published story. Unpublish first.",
        publishedSlug: lock.rows[0].slug,
      });
    }

    const result = await db
      .delete(storageEntries)
      .where(and(eq(storageEntries.id, id), eq(storageEntries.userId, userId)))
      .returning({ id: storageEntries.id });
    if (row[0].path && path.isAbsolute(row[0].path)) {
      fs.promises.unlink(row[0].path).catch(() => {}); // tolerate ENOENT
    }
    res.json({ ok: true, deleted: result.length });
  }));

  // ── Bulk download ────────────────────────────────────────────────────────
  // Streams a ZIP of every storage_entries row owned by the user, optionally
  // filtered by app and hearted-only. Files are laid out in the zip as
  // {app}/{basename} so apps don't collide. Missing files are skipped and
  // noted in MANIFEST.txt so the user knows what didn't export.
  app.get("/api/ledger/download", requireAuth, handleAsyncErrors(async (req: any, res: Response) => {
    const userId = req.user.id;
    const appFilter = typeof req.query.app === "string" && VALID_APPS.has(req.query.app) ? req.query.app : null;
    const heartedOnly = req.query.hearted === "1" || req.query.hearted === "true";

    const conditions = [eq(storageEntries.userId, userId)];
    if (appFilter) conditions.push(eq(storageEntries.app, appFilter));
    if (heartedOnly) conditions.push(eq(storageEntries.hearted, true));

    const rows = await db
      .select()
      .from(storageEntries)
      .where(and(...conditions))
      .orderBy(desc(storageEntries.createdAt));

    if (!rows.length) return res.status(404).json({ error: "no entries match" });

    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = [appFilter, heartedOnly ? "hearted" : null].filter(Boolean).join("-") || "all";
    const filename = `mariesvault-${suffix}-${stamp}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("warning", (err) => console.warn("[zip]", err.message));
    archive.on("error", (err) => {
      console.error("[zip] fatal", err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });
    archive.pipe(res);

    const manifest: string[] = [
      `Marie's Vault — storage export`,
      `Generated: ${new Date().toISOString()}`,
      `User: ${userId}`,
      `Filters: app=${appFilter ?? "any"} hearted=${heartedOnly}`,
      `Total rows: ${rows.length}`,
      ``,
    ];
    const seen = new Set<string>();
    let included = 0, missing = 0;
    for (const r of rows) {
      if (!r.path || !path.isAbsolute(r.path)) { missing++; manifest.push(`SKIP  ${r.app}  id=${r.id}  (non-absolute path)`); continue; }
      if (!fs.existsSync(r.path)) { missing++; manifest.push(`MISS  ${r.app}  ${r.path}`); continue; }
      const base = path.basename(r.path);
      let name = `${r.app}/${base}`;
      let n = 1;
      while (seen.has(name)) { name = `${r.app}/${path.parse(base).name}-${n}${path.extname(base)}`; n++; }
      seen.add(name);
      archive.file(r.path, { name });
      manifest.push(`OK    ${name}  ${r.sizeBytes} bytes${r.hearted ? "  ♥" : ""}`);
      included++;
    }
    manifest.push(``, `Included: ${included}`, `Missing: ${missing}`);
    archive.append(manifest.join("\n"), { name: "MANIFEST.txt" });

    await archive.finalize();
  }));

  // ── Bulk delete ──────────────────────────────────────────────────────────
  // Deletes ledger rows + underlying files. Requires an explicit confirm token
  // so a stray fetch can't wipe a user's storage. Filters are the same as
  // /api/ledger/download so "export then clean up" is a two-call flow.
  app.post("/api/ledger/bulk-delete", requireAuth, handleAsyncErrors(async (req: any, res: Response) => {
    const userId = req.user.id;
    const { app: appFilter, hearted, unheartedOnly, confirm } = req.body ?? {};
    if (confirm !== "yes") return res.status(400).json({ error: "confirm must equal \"yes\"" });

    const conditions = [eq(storageEntries.userId, userId)];
    if (typeof appFilter === "string" && VALID_APPS.has(appFilter)) {
      conditions.push(eq(storageEntries.app, appFilter));
    }
    if (unheartedOnly) {
      conditions.push(eq(storageEntries.hearted, false));
    } else if (typeof hearted === "boolean") {
      conditions.push(eq(storageEntries.hearted, hearted));
    }

    const rows = await db
      .select({ id: storageEntries.id, path: storageEntries.path })
      .from(storageEntries)
      .where(and(...conditions));

    if (!rows.length) return res.json({ ok: true, deleted: 0, filesRemoved: 0, locked: 0 });

    // Exclude paths that back a published story — the user must unpublish first.
    const { pool } = await import("./db");
    const lockRes = await pool.query(
      `SELECT DISTINCT unnest(source_paths) AS path
         FROM published_stories WHERE user_id = $1`,
      [userId]
    );
    const locked = new Set<string>(lockRes.rows.map((r: any) => r.path));
    const deletable = rows.filter(r => !locked.has(r.path));
    const lockedCount = rows.length - deletable.length;

    if (!deletable.length) {
      return res.json({ ok: true, deleted: 0, filesRemoved: 0, locked: lockedCount });
    }

    const deletableIds = deletable.map(r => r.id);
    const deleted = await pool.query(
      `DELETE FROM storage_entries WHERE id = ANY($1::int[]) RETURNING id`,
      [deletableIds]
    );

    let filesRemoved = 0;
    await Promise.all(deletable.map(async (r) => {
      if (r.path && path.isAbsolute(r.path)) {
        try { await fs.promises.unlink(r.path); filesRemoved++; } catch {}
      }
    }));
    res.json({ ok: true, deleted: deleted.rowCount, filesRemoved, locked: lockedCount });
  }));

  // Service-secret endpoint used by each app to mirror a heart toggle into the
  // cross-app ledger. The app already did the local UPDATE; this just keeps
  // the Vault copy in sync so gallery.mariesvault.com reflects it.
  app.post("/api/ledger/heart-by-path", handleAsyncErrors(async (req: Request, res: Response) => {
    const provided = req.headers["x-service-secret"];
    if (!provided || provided !== process.env.SERVICE_SECRET) {
      return res.status(401).json({ error: "bad service secret" });
    }
    const { app: appName, path: entryPath, hearted } = req.body || {};
    if (!appName || !entryPath || typeof hearted !== "boolean") {
      return res.status(400).json({ error: "app, path, hearted required" });
    }
    const result = await db
      .update(storageEntries)
      .set({ hearted })
      .where(and(eq(storageEntries.app, appName), eq(storageEntries.path, entryPath)))
      .returning({ id: storageEntries.id });
    res.json({ ok: true, updated: result.length });
  }));

  const httpServer = createServer(app);
  return httpServer;
}
