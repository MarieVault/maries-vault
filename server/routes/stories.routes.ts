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
import { handlePublish, handleUnpublish, listMyPublished, listPublicStories, getStoryBySlug, incrementViews, PUBLISHED_ROOT, appHostname, storyUrlFor } from "../stories.js";

export function registerStoriesRoutes(app: Express): void {

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

}
