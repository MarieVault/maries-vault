// Publishing module — published_stories CRUD, slug generation, image compositing.
// Sibling apps (Choice, Change Room) POST to /api/stories/publish with a
// service secret; this module snapshots content + images so the source app
// can delete its session without breaking the share.

import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { pool } from "./db.js";

const PUBLISHED_ROOT = path.join(process.cwd(), "published");
const MIN_SCENES = 10;
const VALID_APPS = new Set(["choice", "change"]);

// Marie's account auto-enqueues published stories into the social-poster
// queue. Other users publish but don't fan out to X; Marie's workflow is the
// only one wired for now per her ask.
const MARIE_USER_ID = 7;
const SOCIAL_POSTER_BASE = process.env.SOCIAL_POSTER_BASE || "http://localhost:3006";
const PUBLIC_VIEWER_BASE = process.env.PUBLIC_VIEWER_BASE || "https://gallery.mariesvault.com";

// Per-app canonical hostname. Shared stories live at /s/<slug> on the source
// app's domain (better brand match in shared links). gallery.* still serves
// the same content but redirects humans to the canonical hostname.
export function appHostname(app: string | null | undefined): string {
  if (app === "choice") return "choice.mariesvault.com";
  if (app === "change") return "change.mariesvault.com";
  return "gallery.mariesvault.com";
}
export function storyUrlFor(app: string | null | undefined, slug: string): string {
  return `https://${appHostname(app)}/s/${slug}`;
}

async function enqueueSocialPost(opts: {
  coverPath: string;
  title: string;
  slug: string;
  app: string;
  tags?: string[] | null;
}) {
  if (!process.env.SERVICE_SECRET) return;
  const storyUrl = storyUrlFor(opts.app, opts.slug);
  const flavour = opts.app === "choice"
    ? `New Marie's Choice adventure: ${opts.title}`
    : `New Change Room transformation: ${opts.title}`;
  const caption = `${flavour}\n\n${storyUrl}`;
  const hashtags = ["#MariesVault", ...(Array.isArray(opts.tags) ? opts.tags.slice(0, 3).map(t => `#${t.replace(/\W+/g, "")}`).filter(t => t.length > 1) : [])];
  try {
    const r = await fetch(`${SOCIAL_POSTER_BASE}/api/posts/publish-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-secret": process.env.SERVICE_SECRET,
      },
      body: JSON.stringify({
        source_path: opts.coverPath,
        caption,
        hashtags,
        social_user_id: "marie",
      }),
    });
    if (!r.ok) {
      console.warn("[publish] social-poster enqueue failed:", r.status, await r.text().catch(() => ""));
    }
  } catch (err: any) {
    console.warn("[publish] social-poster enqueue error:", err.message);
  }
}

fs.mkdirSync(PUBLISHED_ROOT, { recursive: true });

function randomSlug(): string {
  // 10 chars of alphanumeric — no leading/trailing punctuation (some URL
  // parsers, notably X's card crawler, choke on slugs that begin with `-`).
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function uniqueSlug(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const s = randomSlug();
    const { rows } = await pool.query("SELECT 1 FROM published_stories WHERE slug = $1", [s]);
    if (!rows.length) return s;
  }
  throw new Error("slug collision — retry");
}

// Verify both image paths belong to this user via the ledger. Prevents a
// caller (even with the service secret) from publishing someone else's image.
async function assertOwnsPath(userId: number, absPath: string): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT 1 FROM storage_entries WHERE user_id = $1 AND path = $2 LIMIT 1",
    [userId, absPath]
  );
  return rows.length > 0;
}

// Build the OG card: 1200×630, before left, after right, both cover-fit.
// JPG at q82 — small enough for Twitter's preview fetch, good enough for eyes.
async function buildCoverImage(beforePath: string, afterPath: string, outPath: string) {
  const W = 1200, H = 630, HALF = W / 2;

  const [beforeBuf, afterBuf] = await Promise.all([
    sharp(beforePath).resize(HALF, H, { fit: "cover", position: "center" }).toBuffer(),
    sharp(afterPath).resize(HALF, H, { fit: "cover", position: "center" }).toBuffer(),
  ]);

  await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([
      { input: beforeBuf, left: 0, top: 0 },
      { input: afterBuf, left: HALF, top: 0 },
    ])
    .jpeg({ quality: 82 })
    .toFile(outPath);
}

// Hardlink the original into published/<slug>/ so the source app can delete
// its version without breaking the share. Same filesystem → zero extra disk.
function hardlinkInto(srcPath: string, destDir: string, label: string): string {
  const ext = path.extname(srcPath) || ".png";
  const destPath = path.join(destDir, `${label}${ext}`);
  try {
    fs.linkSync(srcPath, destPath);
  } catch (err: any) {
    if (err.code === "EXDEV") {
      // Cross-device (shouldn't happen on our single-host setup) — fall back to copy.
      fs.copyFileSync(srcPath, destPath);
    } else if (err.code !== "EEXIST") {
      throw err;
    }
  }
  return destPath;
}

export async function handlePublish(req: Request, res: Response) {
  // Service-secret gate: only sibling app backends can publish.
  const providedSecret = req.headers["x-service-secret"];
  if (!process.env.SERVICE_SECRET || providedSecret !== process.env.SERVICE_SECRET) {
    return res.status(401).json({ error: "service secret required" });
  }

  const {
    user_id,
    app: appName,
    source_ref,
    title,
    summary,
    content,
    before_image_path,
    after_image_path,
    tags,
    nsfw,
    scene_count,
  } = req.body ?? {};

  if (!Number.isInteger(user_id) || user_id <= 0) return res.status(400).json({ error: "user_id required" });
  if (!VALID_APPS.has(appName)) return res.status(400).json({ error: `app must be one of ${[...VALID_APPS].join(", ")}` });
  if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "title required" });
  if (!content || typeof content !== "object") return res.status(400).json({ error: "content required" });
  if (typeof before_image_path !== "string" || !before_image_path) return res.status(400).json({ error: "before_image_path required" });
  if (typeof after_image_path !== "string" || !after_image_path) return res.status(400).json({ error: "after_image_path required" });
  if (Number.isInteger(scene_count) && scene_count < MIN_SCENES) {
    return res.status(400).json({ error: `story needs at least ${MIN_SCENES} scenes to publish` });
  }

  // User must be approved (behavioral anti-bot gate).
  const { rows: userRows } = await pool.query(
    "SELECT status FROM users WHERE id = $1",
    [user_id]
  );
  if (!userRows[0]) return res.status(404).json({ error: "user not found" });
  if (userRows[0].status !== "approved") {
    return res.status(403).json({ error: "account not approved for publishing" });
  }

  // Ownership check — both images must be on this user's ledger.
  const [ownsBefore, ownsAfter] = await Promise.all([
    assertOwnsPath(user_id, before_image_path),
    assertOwnsPath(user_id, after_image_path),
  ]);
  if (!ownsBefore || !ownsAfter) {
    return res.status(403).json({ error: "one or both images are not yours" });
  }

  // Disk files must exist.
  if (!fs.existsSync(before_image_path) || !fs.existsSync(after_image_path)) {
    return res.status(410).json({ error: "source image missing on disk" });
  }

  const slug = await uniqueSlug();
  const storyDir = path.join(PUBLISHED_ROOT, slug);
  fs.mkdirSync(storyDir, { recursive: true });

  const beforeDest = hardlinkInto(before_image_path, storyDir, "before");
  const afterDest  = hardlinkInto(after_image_path,  storyDir, "after");
  const coverDest  = path.join(storyDir, "cover.jpg");

  try {
    await buildCoverImage(before_image_path, after_image_path, coverDest);
  } catch (err: any) {
    // Composite failure is non-fatal — viewer page falls back to before/after.
    console.warn("[publish] cover composite failed:", err.message);
  }

  // Hardlink every step image referenced in content.steps so the story is
  // self-contained — source app can delete its session without breaking us.
  // Rewrite each step's image_path → image_url pointing at /s/<slug>/step-N.
  // Track every source path so /storage can surface the lock icon.
  const contentCopy = JSON.parse(JSON.stringify(content));
  const sourcePaths = new Set<string>([before_image_path, after_image_path]);
  if (Array.isArray(contentCopy.steps)) {
    for (let i = 0; i < contentCopy.steps.length; i++) {
      const step = contentCopy.steps[i];
      const stepPath = step?.image_path;
      // Always strip the absolute server path — it's internal. image_url is
      // only set when the image was ownable and hardlinkable.
      if (step && "image_path" in step) delete step.image_path;
      if (typeof stepPath !== "string" || !stepPath) continue;
      if (!(await assertOwnsPath(user_id, stepPath))) continue;
      if (!fs.existsSync(stepPath)) continue;
      const ext = path.extname(stepPath) || ".png";
      try {
        hardlinkInto(stepPath, storyDir, `step-${i}`);
        step.image_url = `/s/${slug}/step-${i}${ext}`;
        sourcePaths.add(stepPath);
      } catch (err: any) {
        console.warn("[publish] step image link failed:", err.message);
      }
    }
  }

  const result = await pool.query(
    `INSERT INTO published_stories
       (slug, user_id, app, source_ref, title, summary, content,
        cover_image_path, before_image_path, after_image_path, source_paths, tags, nsfw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id, slug, created_at`,
    [
      slug, user_id, appName, source_ref ?? null,
      title.slice(0, 200), (summary ?? "").toString().slice(0, 500) || null,
      contentCopy, fs.existsSync(coverDest) ? coverDest : null,
      beforeDest, afterDest, Array.from(sourcePaths),
      Array.isArray(tags) ? tags.slice(0, 20) : null,
      !!nsfw,
    ]
  );

  // Marie-only: fire-and-forget enqueue into the social-poster pending queue.
  // Don't block the publish response on it — a queue failure shouldn't fail
  // the publish itself.
  if (user_id === MARIE_USER_ID && fs.existsSync(coverDest)) {
    enqueueSocialPost({
      coverPath: coverDest,
      title: title.slice(0, 200),
      slug,
      app: appName,
      tags: Array.isArray(tags) ? tags : null,
    });
  }

  res.status(201).json({
    id: result.rows[0].id,
    slug,
    url: storyUrlFor(appName, slug),
    createdAt: result.rows[0].created_at,
  });
}

// Look up a story by slug for the viewer/OG card. Does NOT bump views — that's
// done server-side on viewer HTML load, not on the JSON fetch (so bots
// scraping the OG card don't inflate counts).
export async function getStoryBySlug(slug: string) {
  const { rows } = await pool.query(
    `SELECT p.*, u.username
     FROM published_stories p
     JOIN users u ON u.id = p.user_id
     WHERE p.slug = $1`,
    [slug]
  );
  return rows[0] || null;
}

export async function incrementViews(slug: string) {
  await pool.query("UPDATE published_stories SET views = views + 1 WHERE slug = $1", [slug]);
}

// Unpublish: deletes the row + published/ files. Source images on the sibling
// app remain untouched (that's a separate delete the user triggers on /storage).
export async function handleUnpublish(req: Request & { user?: any }, res: Response) {
  const slug = req.params.slug;
  const { rows } = await pool.query(
    "SELECT id, user_id FROM published_stories WHERE slug = $1",
    [slug]
  );
  const story = rows[0];
  if (!story) return res.status(404).json({ error: "not found" });

  // Authorise: either the user owns it (or is admin), or service-secret was
  // presented with the same user_id in the body (sibling app acting on user's behalf).
  const isService = req.headers["x-service-secret"] === process.env.SERVICE_SECRET;
  const bodyUserId = isService ? Number((req.body || {}).user_id) : null;
  const actorIsOwner = req.user && (req.user.id === story.user_id || req.user.role === "admin");
  const serviceIsOwner = isService && bodyUserId === story.user_id;
  if (!actorIsOwner && !serviceIsOwner) {
    return res.status(403).json({ error: "not your story" });
  }

  await pool.query("DELETE FROM published_stories WHERE id = $1", [story.id]);
  const storyDir = path.join(PUBLISHED_ROOT, slug);
  try { fs.rmSync(storyDir, { recursive: true, force: true }); } catch {}
  res.json({ ok: true });
}

// Public discovery feed — every shared story across apps. No auth.
// Optional ?app= filter (choice|change), ?nsfw=0 to hide NSFW.
export async function listPublicStories(req: Request, res: Response) {
  const appFilter = typeof req.query.app === "string" ? req.query.app : null;
  const hideNsfw = req.query.nsfw === "0" || req.query.nsfw === "false";

  const params: any[] = [];
  let where = "1=1";
  if (appFilter) {
    params.push(appFilter);
    where += ` AND app = $${params.length}`;
  }
  if (hideNsfw) {
    where += " AND nsfw = false";
  }
  const { rows } = await pool.query(
    `SELECT slug, app, title, summary, cover_image_path, tags, views, nsfw, created_at
     FROM published_stories WHERE ${where} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  res.json(rows.map(r => ({
    slug: r.slug,
    app: r.app,
    title: r.title,
    summary: r.summary,
    coverUrl: r.cover_image_path ? `${storyUrlFor(r.app, r.slug)}/cover.jpg` : null,
    storyUrl: storyUrlFor(r.app, r.slug),
    tags: Array.isArray(r.tags) ? r.tags : [],
    views: r.views,
    nsfw: r.nsfw,
    createdAt: r.created_at,
  })));
}

// User's own published list. Accepts service-secret + ?user_id= so sibling
// app backends can fetch the caller's own shares without cross-domain cookies.
// Optional ?app= filter to scope to one source app (choice|change|...).
export async function listMyPublished(req: Request & { user?: any }, res: Response) {
  const isService = req.headers["x-service-secret"] === process.env.SERVICE_SECRET;
  const userId = isService ? Number(req.query.user_id || (req.body && req.body.user_id)) : req.user?.id;
  if (!userId || Number.isNaN(userId)) {
    return res.status(400).json({ error: "user_id required" });
  }
  const appFilter = typeof req.query.app === "string" ? req.query.app : null;

  const params: any[] = [userId];
  let where = "user_id = $1";
  if (appFilter) {
    params.push(appFilter);
    where += ` AND app = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT slug, app, title, summary, cover_image_path, views, nsfw, created_at, source_ref
     FROM published_stories WHERE ${where} ORDER BY created_at DESC`,
    params
  );
  res.json(rows.map(r => ({
    slug: r.slug,
    app: r.app,
    title: r.title,
    summary: r.summary,
    coverUrl: r.cover_image_path ? `${storyUrlFor(r.app, r.slug)}/cover.jpg` : null,
    views: r.views,
    nsfw: r.nsfw,
    createdAt: r.created_at,
    sourceRef: r.source_ref,
  })));
}

export { PUBLISHED_ROOT };
