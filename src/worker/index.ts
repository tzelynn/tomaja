// One Worker: static assets are served first by Cloudflare; only /api/* reaches this code.
import { Hono, type Context } from 'hono';
import { SYNC_LIMITS } from '../shared/sync-types';
import {
  clearSessionCookie,
  clientIp,
  currentUser,
  LIMITS,
  randomId,
  recordAttempt,
  secretCodeMatches,
  startSession,
  throttled,
  type AppEnv,
  type Env,
} from './auth';
import { BadRequest, runSync } from './sync';

export const NAME_RE = /^[A-Za-z0-9_-]{3,20}$/;
const DEFAULT_MAX_GARDENS = 500;

const app = new Hono<AppEnv>().basePath('/api');

app.onError((err, c) => {
  if (err instanceof BadRequest) return c.json({ error: 'bad_request', message: err.message }, 400);
  console.error(err);
  return c.json({ error: 'server_error' }, 500);
});

// Cheap CSRF guard: forms cannot send custom headers.
app.use('*', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.header('X-Tomaja') !== '1') {
    return c.json({ error: 'missing_header' }, 403);
  }
  await next();
});

app.get('/health', (c) => c.text('ok'));

async function readJson(c: { req: { text(): Promise<string> } }): Promise<Record<string, unknown>> {
  const text = await c.req.text();
  if (text.length > SYNC_LIMITS.maxBodyBytes) throw new BadRequest('body too large');
  try {
    const v = JSON.parse(text);
    if (v && typeof v === 'object') return v;
  } catch {}
  throw new BadRequest('invalid JSON');
}

/**
 * Shared gate for creating and opening a garden (plan §8.2):
 * 1. syncing is closed unless SIGNUP_CODE is set (503); 2. throttle (429); 3. code matches (403).
 */
async function checkSecretCode(c: Context<AppEnv>, code: unknown): Promise<Response | null> {
  const configured = c.env.SIGNUP_CODE;
  if (!configured || !configured.trim()) return c.json({ error: 'sync_closed' }, 503);
  const ip = clientIp(c);
  const now = Date.now();
  const wait = Math.max(
    await throttled(c.env.DB, LIMITS.codeShort, ip, now),
    await throttled(c.env.DB, LIMITS.codeDay, ip, now),
  );
  if (wait > 0) return c.json({ error: 'too_many_attempts' }, 429, { 'Retry-After': String(wait) });
  if (!(await secretCodeMatches(code, configured))) {
    await c.env.DB.batch([recordAttempt(c.env.DB, LIMITS.codeShort, ip, now), recordAttempt(c.env.DB, LIMITS.codeDay, ip, now)]);
    return c.json({ error: 'wrong_code' }, 403);
  }
  return null;
}

app.post('/account', async (c) => {
  const body = await readJson(c);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!NAME_RE.test(name)) return c.json({ error: 'bad_name' }, 400);
  const denied = await checkSecretCode(c, body.secretCode);
  if (denied) return denied;

  const ip = clientIp(c);
  const now = Date.now();
  const wait = await throttled(c.env.DB, LIMITS.create, ip, now);
  if (wait > 0) return c.json({ error: 'too_many_gardens' }, 429, { 'Retry-After': String(wait) });

  const max = Number(c.env.MAX_GARDENS ?? DEFAULT_MAX_GARDENS) || DEFAULT_MAX_GARDENS;
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<number>('n');
  if ((count ?? 0) >= max) return c.json({ error: 'garden_full' }, 503);

  const id = randomId();
  try {
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO users (id, name, rev, created_at) VALUES (?, ?, 0, ?)').bind(id, name, now),
      recordAttempt(c.env.DB, LIMITS.create, ip, now),
    ]);
  } catch (e) {
    if (String(e).includes('UNIQUE')) return c.json({ error: 'name_taken' }, 409);
    throw e;
  }
  await startSession(c, id);
  return c.json({ name }, 201);
});

app.post('/session', async (c) => {
  const body = await readJson(c);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const denied = await checkSecretCode(c, body.secretCode);
  if (denied) return denied;
  if (!NAME_RE.test(name)) return c.json({ error: 'no_such_garden' }, 404);
  const user = await c.env.DB.prepare('SELECT id, name FROM users WHERE name = ?').bind(name).first<{ id: string; name: string }>();
  if (!user) return c.json({ error: 'no_such_garden' }, 404);
  await startSession(c, user.id);
  return c.json({ name: user.name });
});

app.delete('/session', async (c) => {
  const user = await currentUser(c);
  if (user) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(user.tokenHash).run();
  clearSessionCookie(c);
  return c.body(null, 204);
});

app.get('/me', async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: 'signed_out' }, 401);
  return c.json({ name: user.name });
});

app.delete('/account', async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: 'signed_out' }, 401);
  const db = c.env.DB;
  await db.batch(
    ['item_state', 'days', 'profile', 'sessions'].map((t) => db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(user.id)).concat(
      db.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
    ),
  );
  clearSessionCookie(c);
  return c.body(null, 204);
});

app.post('/sync', async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: 'signed_out' }, 401);
  const body = await readJson(c);
  return c.json(await runSync(c.env.DB, user.id, body));
});

app.all('*', (c) => c.json({ error: 'not_found' }, 404));

/** Daily housekeeping: expired sessions and stale throttle rows. */
export async function housekeeping(env: Env, now = Date.now()): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
    env.DB.prepare('DELETE FROM attempts WHERE window_start < ?').bind(now - 86_400_000),
  ]);
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(housekeeping(env));
  },
} satisfies ExportedHandler<Env>;
