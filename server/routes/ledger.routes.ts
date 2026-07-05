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
import archiver from "archiver";

export function registerLedgerRoutes(app: Express): void {
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
      const { pool } = await import("../db");
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
    const { pool } = await import("../db");
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
    const { pool } = await import("../db");
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
    const { pool } = await import("../db");
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

}
