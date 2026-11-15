import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker, { housekeeping } from '../../src/worker/index';
import type { Env } from '../../src/worker/auth';
import type { ItemState, SyncResponse } from '../../src/shared/sync-types';

const E = env as unknown as Env;
const CODE = 'ripe tomato garden'; // configured as "Ripe Tomato Garden": comparison is trimmed + lowercased
let ipCounter = 0;
const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} } as unknown as ExecutionContext;

interface Opts {
  body?: unknown;
  cookie?: string;
  ip?: string;
  env?: Partial<Env>;
  header?: boolean;
}

async function call(method: string, path: string, o: Opts = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'CF-Connecting-IP': o.ip ?? `10.0.0.${++ipCounter}` };
  if (o.header !== false) headers['X-Tomaja'] = '1';
  if (o.cookie) headers.cookie = o.cookie;
  const res = await worker.fetch(
    new Request(`https://tomaja.test/api${path}`, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) }),
    { ...E, ...o.env } as Env,
    ctx,
  );
  const setCookie = res.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0];
  return { res, cookie };
}

let n = 0;
const uniqueName = () => `garden-${Date.now().toString(36)}-${++n}`;

async function createGarden(name = uniqueName()) {
  const { res, cookie } = await call('POST', '/account', { body: { name, secretCode: CODE } });
  expect(res.status).toBe(201);
  expect(cookie).toMatch(/^tomaja_session=/);
  return { name, cookie };
}

function item(id: string, lastReview: number, extra: Partial<ItemState> = {}): ItemState {
  return {
    itemId: id,
    card: { stability: 4, dueAt: new Date(lastReview + 4 * 86_400_000).toISOString(), scheduledDays: 4, reps: 1, lapses: 0 },
    lastReview,
    plantedAt: lastReview,
    lastRating: 'good',
    tomatoes: 1,
    ripenedAt: null,
    ...extra,
  };
}

async function sync(cookie: string, body: unknown) {
  const { res } = await call('POST', '/sync', { cookie, body });
  expect(res.status).toBe(200);
  return (await res.json()) as SyncResponse;
}

describe('accounts', () => {
  it('health', async () => {
    const { res } = await call('GET', '/health');
    expect(await res.text()).toBe('ok');
  });

  it('create → sign in on another device round trip', async () => {
    const { name, cookie } = await createGarden();
    expect(await (await call('GET', '/me', { cookie })).res.json()).toEqual({ name });
    const second = await call('POST', '/session', { body: { name: name.toUpperCase(), secretCode: `  ${CODE.toUpperCase()} ` } });
    expect(second.res.status).toBe(200);
    expect((await call('GET', '/me', { cookie: second.cookie })).res.status).toBe(200);
  });

  it('refuses create and sign-in with a wrong secret code', async () => {
    const { name } = await createGarden();
    expect((await call('POST', '/account', { body: { name: uniqueName(), secretCode: 'nope' } })).res.status).toBe(403);
    expect((await call('POST', '/session', { body: { name, secretCode: 'nope' } })).res.status).toBe(403);
  });

  it('syncing is closed when SIGNUP_CODE is unset', async () => {
    const { name } = await createGarden();
    const off = { SIGNUP_CODE: undefined };
    expect((await call('POST', '/account', { body: { name: uniqueName(), secretCode: CODE }, env: off })).res.status).toBe(503);
    expect((await call('POST', '/session', { body: { name, secretCode: CODE }, env: off })).res.status).toBe(503);
  });

  it('refuses create at MAX_GARDENS', async () => {
    await createGarden();
    const count = await E.DB.prepare('SELECT COUNT(*) AS n FROM users').first<number>('n');
    const { res } = await call('POST', '/account', { body: { name: uniqueName(), secretCode: CODE }, env: { MAX_GARDENS: String(count) } });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'garden_full' });
  });

  it('name rules and taken names', async () => {
    const { name } = await createGarden();
    expect((await call('POST', '/account', { body: { name, secretCode: CODE } })).res.status).toBe(409);
    expect((await call('POST', '/account', { body: { name: 'a b', secretCode: CODE } })).res.status).toBe(400);
  });

  it('sign-in to an unknown garden is 404', async () => {
    expect((await call('POST', '/session', { body: { name: 'no-such-garden-x', secretCode: CODE } })).res.status).toBe(404);
  });

  it('throttles wrong secret codes', async () => {
    const ip = '192.0.2.77';
    for (let i = 0; i < 5; i++) expect((await call('POST', '/session', { ip, body: { name: 'x-y-z', secretCode: 'bad' } })).res.status).toBe(403);
    const { res } = await call('POST', '/session', { ip, body: { name: 'x-y-z', secretCode: CODE } });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('an existing session still works after the secret code changes', async () => {
    const { name, cookie } = await createGarden();
    const changed = { SIGNUP_CODE: 'a brand new code' };
    expect((await call('GET', '/me', { cookie, env: changed })).res.status).toBe(200);
    expect((await call('POST', '/session', { body: { name, secretCode: CODE }, env: changed })).res.status).toBe(403);
  });

  it('requires the X-Tomaja header on state-changing routes', async () => {
    expect((await call('POST', '/account', { body: { name: uniqueName(), secretCode: CODE }, header: false })).res.status).toBe(403);
  });

  it('cron removes expired sessions and stale attempts', async () => {
    const { cookie } = await createGarden();
    await E.DB.prepare('INSERT INTO attempts (key, window_start, count) VALUES (?, ?, 1)').bind('code:old', 1).run();
    await E.DB.prepare('UPDATE sessions SET expires_at = 1').run();
    await housekeeping(E);
    expect(await E.DB.prepare('SELECT COUNT(*) AS n FROM sessions').first('n')).toBe(0);
    expect(await E.DB.prepare("SELECT COUNT(*) AS n FROM attempts WHERE key = 'code:old'").first('n')).toBe(0);
    expect((await call('GET', '/me', { cookie })).res.status).toBe(401);
  });
});

describe('sync', () => {
  it('unauthenticated sync is 401', async () => {
    expect((await call('POST', '/sync', { body: { cursor: 0, items: [], days: [] } })).res.status).toBe(401);
  });

  it('is idempotent and returns only unseen rows', async () => {
    const { cookie } = await createGarden();
    const body = { cursor: 0, items: [item('h:あ', 1000), item('h:い', 1000)], days: ['2026-03-01'] };
    const r1 = await sync(cookie, body);
    expect(r1.items).toEqual([]);
    expect(r1.days).toEqual([]);
    const r2 = await sync(cookie, { ...body, cursor: r1.cursor });
    expect(r2.items).toEqual([]);
    // A device that has seen nothing gets everything.
    const r3 = await sync(cookie, { cursor: 0, items: [], days: [] });
    expect(r3.items.map((i) => i.itemId).sort()).toEqual(['h:あ', 'h:い']);
    expect(r3.days).toEqual(['2026-03-01']);
    const r4 = await sync(cookie, { cursor: r3.cursor, items: [], days: [] });
    expect(r4.items).toEqual([]);
  });

  it('last review wins in both orders', async () => {
    for (const order of [
      [100, 200],
      [200, 100],
    ]) {
      const { cookie } = await createGarden();
      await sync(cookie, { cursor: 0, items: [item('h:う', order[0], { tomatoes: order[0] })], days: [] });
      const r = await sync(cookie, { cursor: 0, items: [item('h:う', order[1], { tomatoes: order[1] })], days: [] });
      const all = await sync(cookie, { cursor: 0, items: [], days: [] });
      expect(all.items[0].tomatoes).toBe(200);
      // If the incoming one lost, the server sends back the winner.
      if (order[1] < order[0]) expect(r.items[0].tomatoes).toBe(200);
    }
  });

  it('round-trips items whose id kind it does not know', async () => {
    const { cookie } = await createGarden();
    await sync(cookie, { cursor: 0, items: [item('j:日', 5)], days: [] });
    const all = await sync(cookie, { cursor: 0, items: [], days: [] });
    expect(all.items[0].itemId).toBe('j:日');
  });

  it('rejects malformed input', async () => {
    const { cookie } = await createGarden();
    const bad = async (body: unknown) => (await call('POST', '/sync', { cookie, body })).res.status;
    expect(await bad({ cursor: -1, items: [], days: [] })).toBe(400);
    expect(await bad({ cursor: 0, items: [item('bad id', 1)], days: [] })).toBe(400);
    expect(await bad({ cursor: 0, items: [item('h:え', 1, { ripenedAt: 'x'.repeat(2000) as never })], days: [] })).toBe(400);
    expect(await bad({ cursor: 0, items: [], days: ['yesterday'] })).toBe(400);
  });

  it('profile is last-write-wins', async () => {
    const { cookie } = await createGarden();
    const s = { newPerDay: 10, audio: true, romajiHelp: true };
    await sync(cookie, { cursor: 0, items: [], days: [], profile: { data: { ...s, newPerDay: 5 }, updatedAt: 20 } });
    await sync(cookie, { cursor: 0, items: [], days: [], profile: { data: { ...s, newPerDay: 15 }, updatedAt: 10 } });
    const all = await sync(cookie, { cursor: 0, items: [], days: [] });
    expect(all.profile?.data.newPerDay).toBe(5);
  });

  it('deleting the garden removes all its rows', async () => {
    const { cookie, name } = await createGarden();
    await sync(cookie, { cursor: 0, items: [item('h:お', 1)], days: ['2026-01-01'] });
    const id = await E.DB.prepare('SELECT id FROM users WHERE name = ?').bind(name).first<string>('id');
    expect(id).toBeTruthy();
    expect((await call('DELETE', '/account', { cookie })).res.status).toBe(204);
    for (const t of ['item_state', 'days', 'profile', 'sessions'])
      expect(await E.DB.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`).bind(id).first('n')).toBe(0);
    expect((await call('GET', '/me', { cookie })).res.status).toBe(401);
  });
});
