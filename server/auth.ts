/**
 * Auth module for Marie's Vault
 * Uses the existing Postgres users table (extended with email + role)
 */
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { pool } from "./db.js";

const COOKIE_NAME = "auth_session";
const SESSION_DAYS = 30;
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  // Scoped to the apex domain so stories./change./gallery. all share the session.
  ...(process.env.NODE_ENV === "production" ? { domain: ".mariesvault.com" } : {}),
};

// --- Ensure sessions table exists ---
await pool.query(`
  CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`);

// --- Session helpers ---
async function createSession(userId: number): Promise<string> {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    "INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
    [id, userId, expiresAt]
  );
  return id;
}

async function validateSession(sessionId: string | undefined) {
  if (!sessionId) return null;
  const result = await pool.query(
    `SELECT u.id, u.username, u.email, u.role, u.status
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [sessionId]
  );
  return result.rows[0] || null;
}

async function deleteSession(sessionId: string) {
  await pool.query("DELETE FROM auth_sessions WHERE id = $1", [sessionId]);
}

// --- Request origin helpers ---
function clientIp(req: Request): string | null {
  const h = req.headers;
  const pick = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : typeof v === "string" ? v : null;
  const cf = pick(h["cf-connecting-ip"]);
  if (cf) return cf;
  const real = pick(h["x-real-ip"]);
  if (real) return real;
  const fwd = pick(h["x-forwarded-for"]);
  if (fwd) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress ?? null;
}

function headerStr(req: Request, name: string): string | null {
  const v = req.headers[name];
  if (Array.isArray(v)) return v[0] ?? null;
  return typeof v === "string" ? v : null;
}

// --- Route handlers ---
export async function handleRegister(req: Request, res: Response) {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: "username, email and password required" });
  if (password.length < 8)
    return res.status(400).json({ error: "password must be at least 8 characters" });

  // Sanitize: strip HTML tags from all string inputs
  const sanitizedUsername = String(username).replace(/<[^>]*>/g, '');
  const sanitizedEmail = String(email).replace(/<[^>]*>/g, '');

  // Validate username: alphanumeric, underscore, hyphen, 1-30 chars
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(sanitizedUsername))
    return res.status(400).json({ error: "username must be 1-30 alphanumeric, underscore, or hyphen characters" });

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail))
    return res.status(400).json({ error: "invalid email format" });

  const existing = await pool.query(
    "SELECT id FROM users WHERE username = $1 OR email = $2",
    [sanitizedUsername, sanitizedEmail]
  );
  if (existing.rows.length)
    return res.status(409).json({ error: "username or email already taken" });

  const password_hash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users (username, email, password, role, status,
       signup_ip, signup_user_agent, signup_referer, signup_accept_language)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8)
     RETURNING id`,
    [
      sanitizedUsername,
      sanitizedEmail,
      password_hash,
      "user",
      clientIp(req),
      headerStr(req, "user-agent"),
      headerStr(req, "referer"),
      headerStr(req, "accept-language"),
    ]
  );
  const userId = result.rows[0].id;
  // Pending users can log in — they're gated behaviorally on first generation.
  // Creating the session immediately lets them jump straight into Choice/Change/Studio.
  const sessionId = await createSession(userId);
  res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTS);
  res.status(201).json({
    id: userId,
    username: sanitizedUsername,
    email: sanitizedEmail,
    role: "user",
    status: "pending",
  });
}

export async function handleLogin(req: Request, res: Response) {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "username and password required" });

  const result = await pool.query(
    "SELECT * FROM users WHERE username = $1 OR email = $1",
    [username]
  );
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: "invalid credentials" });

  // Rejected accounts are fully blocked. Pending accounts CAN log in — they're
  // gated behaviorally (approved on first successful NovelAI generation via
  // the ledger hook). Bots without a key can't cross that gate.
  if (user.status === "rejected")
    return res.status(403).json({ error: "This account has been denied access." });

  const sessionId = await createSession(user.id);
  res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTS);
  res.json({ id: user.id, username: user.username, email: user.email, role: user.role, status: user.status });
}

export async function handleLogout(req: Request, res: Response) {
  const sessionId = req.cookies?.[COOKIE_NAME];
  if (sessionId) await deleteSession(sessionId);
  // Must pass the same cookie options used when setting, or the browser
  // won't match and the cookie lingers.
  res.clearCookie(COOKIE_NAME, COOKIE_OPTS);
  res.json({ ok: true });
}

export async function handleMe(req: Request, res: Response) {
  const sessionId = req.cookies?.[COOKIE_NAME];
  const user = await validateSession(sessionId);
  if (!user) return res.status(401).json({ error: "not authenticated" });
  res.json(user);
}

// --- Middleware ---
export async function requireAuth(req: Request & { user?: any }, res: Response, next: NextFunction) {
  const sessionId = req.cookies?.[COOKIE_NAME];
  const user = await validateSession(sessionId);
  if (!user) return res.status(401).json({ error: "authentication required" });
  req.user = user;
  next();
}

export async function requireAdmin(req: Request & { user?: any }, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    if (req.user?.role !== "admin")
      return res.status(403).json({ error: "admin access required" });
    next();
  });
}

// Requires an approved account. Pending users get a clear 403 telling them
// what unlocks approval (first successful generation).
export async function requireApproved(req: Request & { user?: any }, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    if (req.user?.status === "pending")
      return res.status(403).json({ error: "pending", message: "Generate your first image to unlock this." });
    if (req.user?.status === "rejected")
      return res.status(403).json({ error: "rejected", message: "Account access has been revoked." });
    next();
  });
}

// Sets req.user if logged in, but never blocks the request
export async function optionalAuth(req: Request & { user?: any }, res: Response, next: NextFunction) {
  const sessionId = req.cookies?.[COOKIE_NAME];
  if (sessionId) {
    const user = await validateSession(sessionId);
    if (user) req.user = user;
  }
  next();
}

// Accepts either a valid session OR a trusted service secret (for internal
// localhost-to-localhost calls from sibling apps like social-poster).
// When the service secret is used, acts as the user whose id is in
// SERVICE_USER_ID (defaults to the first admin).
export async function requireAuthOrService(req: Request & { user?: any }, res: Response, next: NextFunction) {
  const providedSecret = req.headers["x-service-secret"];
  const expected = process.env.SERVICE_SECRET;
  if (expected && typeof providedSecret === "string" && providedSecret === expected) {
    const userId = Number(process.env.SERVICE_USER_ID);
    if (!userId) return res.status(500).json({ error: "SERVICE_USER_ID not configured" });
    const result = await pool.query(
      "SELECT id, username, email, role FROM users WHERE id = $1",
      [userId]
    );
    if (!result.rows[0]) return res.status(500).json({ error: "service user not found" });
    req.user = result.rows[0];
    return next();
  }
  return requireAuth(req, res, next);
}

// Allows access if the user is authenticated OR if the requested entry
// (identified by :id route param) has visibility='public'.
export async function requireAuthOrPublicEntry(req: Request & { user?: any }, res: Response, next: NextFunction) {
  const sessionId = req.cookies?.[COOKIE_NAME];
  const user = await validateSession(sessionId);
  if (user) {
    req.user = user;
    return next();
  }
  // Not authenticated — check if the requested entry is public
  const entryId = parseInt(req.params.id, 10);
  if (isNaN(entryId)) {
    return res.status(401).json({ error: "authentication required" });
  }
  const result = await pool.query(
    "SELECT visibility FROM entries WHERE id = $1",
    [entryId]
  );
  const entry = result.rows[0];
  if (!entry || (entry.visibility ?? 'public') !== 'public') {
    return res.status(401).json({ error: "authentication required" });
  }
  // Public entry — allow without auth
  next();
}

// Export validateSession for inline use
export { validateSession };
