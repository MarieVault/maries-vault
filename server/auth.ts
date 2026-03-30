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
    `SELECT u.id, u.username, u.email, u.role
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

// --- Route handlers ---
export async function handleRegister(req: Request, res: Response) {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: "username, email and password required" });
  if (password.length < 8)
    return res.status(400).json({ error: "password must be at least 8 characters" });

  const existing = await pool.query(
    "SELECT id FROM users WHERE username = $1 OR email = $2",
    [username, email]
  );
  if (existing.rows.length)
    return res.status(409).json({ error: "username or email already taken" });

  const password_hash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    "INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
    [username, email, password_hash, "user"]
  );
  const userId = result.rows[0].id;
  const sessionId = await createSession(userId);
  res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTS);
  res.status(201).json({ id: userId, username, email, role: "user" });
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

  const sessionId = await createSession(user.id);
  res.cookie(COOKIE_NAME, sessionId, COOKIE_OPTS);
  res.json({ id: user.id, username: user.username, email: user.email, role: user.role });
}

export async function handleLogout(req: Request, res: Response) {
  const sessionId = req.cookies?.[COOKIE_NAME];
  if (sessionId) await deleteSession(sessionId);
  res.clearCookie(COOKIE_NAME);
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

// Sets req.user if logged in, but never blocks the request
export async function optionalAuth(req: Request & { user?: any }, res: Response, next: NextFunction) {
  const sessionId = req.cookies?.[COOKIE_NAME];
  if (sessionId) {
    const user = await validateSession(sessionId);
    if (user) req.user = user;
  }
  next();
}

// Export validateSession for inline use
export { validateSession };
