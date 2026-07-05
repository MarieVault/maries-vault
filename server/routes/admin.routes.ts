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

export function registerAdminRoutes(app: Express): void {
  app.get("/api/admin/users", requireAuth, handleAsyncErrors(async (req: any, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const { db: dbI } = await import('../db');
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
    const { pool } = await import('../db');
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
    const { db: dbI } = await import('../db');
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
}
