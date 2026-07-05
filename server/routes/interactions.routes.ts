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

export function registerInteractionsRoutes(app: Express): void {
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
    const { db: dbI } = await import('../db');
    const saved = await dbI.execute(sql`
      SELECT e.*, uc.added_at as saved_at
      FROM user_collections uc
      JOIN entries e ON e.id = uc.entry_id
      WHERE uc.user_id = ${userId}
      ORDER BY uc.added_at DESC
    `);
    res.json(saved.rows);
  }));

  // Lightweight: just the current user's saved entry IDs. Lets SaveButton power
  // a whole feed with one shared query instead of one check request per card.
  // Returns [] (not 401) when unauthenticated so the shared query is harmless.
  app.get("/api/collections/ids", handleAsyncErrors(async (req: any, res) => {
    const token = req.cookies?.auth_session;
    if (!token) return res.json([]);
    const user = await validateSession(token);
    if (!user) return res.json([]);
    const rows = await db.select({ entryId: userCollections.entryId })
      .from(userCollections)
      .where(eq(userCollections.userId, user.id));
    res.json(rows.map(r => r.entryId));
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
      const { validateSession } = await import('../auth');
      const user = await validateSession(token);
      if (!user) return res.json({ ratings: {} });
      const rows = await db.select().from(userRatings)
        .where(and(
          eq(userRatings.userId, user.id),
          inArray(userRatings.entryId, entryIds)
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
      const { validateSession } = await import('../auth');
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
      const { validateSession } = await import('../auth');
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
      const { validateSession } = await import('../auth');
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
}
