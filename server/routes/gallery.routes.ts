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

export function registerGalleryRoutes(app: Express): void {
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

}
