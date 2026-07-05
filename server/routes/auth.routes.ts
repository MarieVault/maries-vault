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

export function registerAuthRoutes(app: Express): void {
  // Authentication routes (unprotected)
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/logout", handleLogout);
  app.post("/api/auth/register", requireAuth, requireAdmin, handleRegister);
  app.get("/api/auth/me", handleMe);
  // SSO validator — used by sibling apps (Choice, Change Room) to resolve the
  // shared .mariesvault.com session cookie into a user without importing auth.
  app.get("/api/auth/validate", handleMe);
}
