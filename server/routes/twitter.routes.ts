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

export function registerTwitterRoutes(app: Express): void {
  app.post("/api/extract-twitter", requireAuth, handleAsyncErrors(async (req: any, res) => {
    const { tweetUrl, title, tags, artist, visibility } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });
    const v = visibility === 'private' ? 'private' : 'public';

    if (!tweetUrl) {
      return res.status(400).json({ message: 'Tweet URL is required' });
    }

    try {
      const { extractTwitterImages } = await import('../twitter-extractor');

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
      const { extractTwitterImages } = await import('../twitter-extractor');

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
}
