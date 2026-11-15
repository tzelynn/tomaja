// Secret code check, sessions and throttling (plan §8.2).
import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  /** The one secret code. Syncing is closed while it is unset. */
  SIGNUP_CODE?: string;
  MAX_GARDENS?: string;
}

export type AppEnv = { Bindings: Env; Variables: { userId: string; userName: string } };

export const COOKIE = 'tomaja_session';
export const SESSION_DAYS = 365;
const DAY_MS = 86_400_000;

const enc = new TextEncoder();

export async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

export function hex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function normaliseCode(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Both sides hashed, digests compared in constant time. */
export async function secretCodeMatches(submitted: unknown, configured: string): Promise<boolean> {
  if (typeof submitted !== 'string' || submitted.length > 500) return false;
  const [a, b] = await Promise.all([sha256(normaliseCode(submitted)), sha256(normaliseCode(configured))]);
  return timingSafeEqual(a, b);
}

export function randomToken(bytes = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomId(): string {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}

export function clientIp(c: Context): string {
  return c.req.header('CF-Connecting-IP') ?? 'local';
}

// ---------- throttling ----------

export const LIMITS = {
  codeShort: { prefix: 'code:', max: 5, windowMs: 15 * 60_000 },
  codeDay: { prefix: 'codeday:', max: 20, windowMs: DAY_MS },
  create: { prefix: 'create:', max: 5, windowMs: DAY_MS },
} as const;
type Limit = (typeof LIMITS)[keyof typeof LIMITS];

/** Seconds to wait if the limit is used up, else 0. */
export async function throttled(db: D1Database, limit: Limit, ip: string, now: number): Promise<number> {
  const row = await db
    .prepare('SELECT window_start, count FROM attempts WHERE key = ?')
    .bind(limit.prefix + ip)
    .first<{ window_start: number; count: number }>();
  if (!row || now - row.window_start >= limit.windowMs || row.count < limit.max) return 0;
  return Math.ceil((row.window_start + limit.windowMs - now) / 1000);
}

export function recordAttempt(db: D1Database, limit: Limit, ip: string, now: number): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO attempts (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN ?2 - window_start >= ?3 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN ?2 - window_start >= ?3 THEN ?2 ELSE window_start END`,
    )
    .bind(limit.prefix + ip, now, limit.windowMs);
}

// ---------- sessions ----------

export async function startSession(c: Context<AppEnv>, userId: string): Promise<void> {
  const token = randomToken();
  const now = Date.now();
  await c.env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(hex(await sha256(token)), userId, now, now + SESSION_DAYS * DAY_MS)
    .run();
  setSessionCookie(c, token);
}

function setSessionCookie(c: Context, token: string) {
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/api',
    maxAge: SESSION_DAYS * 86_400,
  });
}

/** Resolves the session cookie to a user, renewing it on use. */
export async function currentUser(c: Context<AppEnv>): Promise<{ id: string; name: string; tokenHash: string } | null> {
  const token = getCookie(c, COOKIE);
  if (!token || token.length > 100) return null;
  const tokenHash = hex(await sha256(token));
  const now = Date.now();
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.name, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(tokenHash, now)
    .first<{ id: string; name: string; expires_at: number }>();
  if (!row) return null;
  // Renew at most once a day to keep writes low.
  if (row.expires_at - now < (SESSION_DAYS - 1) * DAY_MS) {
    await c.env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
      .bind(now + SESSION_DAYS * DAY_MS, tokenHash)
      .run();
    setSessionCookie(c, token);
  }
  return { id: row.id, name: row.name, tokenHash };
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, COOKIE, { path: '/api', secure: true });
}
