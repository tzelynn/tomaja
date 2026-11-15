// Sync (plan §8.3). One transactional D1 batch: bump the garden's rev, upsert newer items,
// add unseen days, upsert a newer profile, then read back everything the device has not seen.
import {
  DAY_PATTERN,
  ITEM_ID_PATTERN,
  SYNC_LIMITS,
  type ItemState,
  type ProfileBlob,
  type SyncRequest,
  type SyncResponse,
} from '../shared/sync-types';

export class BadRequest extends Error {}

/** Validates shape and limits. Item ids follow a general pattern, not a list of known kinds. */
export function parseSyncRequest(raw: unknown): { req: SyncRequest; itemsJson: string[] } {
  if (!raw || typeof raw !== 'object') throw new BadRequest('body must be an object');
  const r = raw as Record<string, unknown>;
  const cursor = r.cursor;
  if (typeof cursor !== 'number' || !Number.isInteger(cursor) || cursor < 0) throw new BadRequest('bad cursor');
  const items = r.items ?? [];
  const days = r.days ?? [];
  if (!Array.isArray(items) || items.length > SYNC_LIMITS.maxItemsPerRequest) throw new BadRequest('too many items');
  if (!Array.isArray(days) || days.length > SYNC_LIMITS.maxDaysPerRequest) throw new BadRequest('bad days');
  const itemsJson: string[] = [];
  for (const it of items as ItemState[]) {
    if (!it || typeof it !== 'object') throw new BadRequest('bad item');
    if (typeof it.itemId !== 'string' || !ITEM_ID_PATTERN.test(it.itemId)) throw new BadRequest('bad item id');
    if (typeof it.lastReview !== 'number' || !Number.isFinite(it.lastReview) || it.lastReview < 0)
      throw new BadRequest('bad lastReview');
    const json = JSON.stringify(it);
    if (new TextEncoder().encode(json).length > SYNC_LIMITS.maxStateBytes) throw new BadRequest('item state too large');
    itemsJson.push(json);
  }
  for (const d of days) if (typeof d !== 'string' || !DAY_PATTERN.test(d)) throw new BadRequest('bad day');
  let profile: ProfileBlob | undefined;
  if (r.profile !== undefined) {
    const p = r.profile as ProfileBlob;
    if (!p || typeof p !== 'object' || typeof p.updatedAt !== 'number' || typeof p.data !== 'object' || !p.data)
      throw new BadRequest('bad profile');
    if (JSON.stringify(p.data).length > 2048) throw new BadRequest('profile too large');
    profile = { data: p.data, updatedAt: p.updatedAt };
  }
  return { req: { cursor, items: items as ItemState[], days: days as string[], profile }, itemsJson };
}

export async function runSync(db: D1Database, userId: string, raw: unknown): Promise<SyncResponse> {
  const { req, itemsJson } = parseSyncRequest(raw);
  const REV = '(SELECT rev FROM users WHERE id = ?1)';
  const stmts: D1PreparedStatement[] = [db.prepare('UPDATE users SET rev = rev + 1 WHERE id = ?1').bind(userId)];
  if (itemsJson.length) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO item_state (user_id, item_id, state, last_review, rev)
           SELECT ?1, json_extract(value, '$.itemId'), json(value), json_extract(value, '$.lastReview'), ${REV}
           FROM json_each(?2) WHERE true
           ON CONFLICT(user_id, item_id) DO UPDATE SET
             state = excluded.state, last_review = excluded.last_review, rev = excluded.rev
           WHERE excluded.last_review > item_state.last_review`,
        )
        .bind(userId, `[${itemsJson.join(',')}]`),
    );
  }
  if (req.days.length) {
    stmts.push(
      db
        .prepare(`INSERT OR IGNORE INTO days (user_id, day, rev) SELECT ?1, value, ${REV} FROM json_each(?2) WHERE true`)
        .bind(userId, JSON.stringify(req.days)),
    );
  }
  if (req.profile) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO profile (user_id, data, updated_at, rev) VALUES (?1, ?2, ?3, ${REV})
           ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, rev = excluded.rev
           WHERE excluded.updated_at > profile.updated_at`,
        )
        .bind(userId, JSON.stringify(req.profile.data), req.profile.updatedAt),
    );
  }
  // Everything newer than the cursor that this request did not itself just write.
  const first = stmts.length;
  stmts.push(
    db.prepare(`SELECT state FROM item_state WHERE user_id = ?1 AND rev > ?2 AND rev < ${REV}`).bind(userId, req.cursor),
    db.prepare(`SELECT day FROM days WHERE user_id = ?1 AND rev > ?2 AND rev < ${REV}`).bind(userId, req.cursor),
    db
      .prepare(`SELECT data, updated_at FROM profile WHERE user_id = ?1 AND rev > ?2 AND rev < ${REV}`)
      .bind(userId, req.cursor),
    db.prepare('SELECT rev FROM users WHERE id = ?1').bind(userId),
  );
  const results = await db.batch(stmts);
  const items = (results[first].results as { state: string }[]).map((r) => JSON.parse(r.state) as ItemState);
  const days = (results[first + 1].results as { day: string }[]).map((r) => r.day);
  const prof = (results[first + 2].results as { data: string; updated_at: number }[])[0];
  const cursor = (results[first + 3].results as { rev: number }[])[0]?.rev ?? 0;
  return {
    cursor,
    items,
    days,
    profile: prof ? { data: JSON.parse(prof.data), updatedAt: prof.updated_at } : undefined,
  };
}
