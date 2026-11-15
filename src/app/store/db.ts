// IndexedDB schema (plan §5). Everything the learner does is saved here first.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ItemId } from '../../shared/content-types';
import type { ItemState } from '../../shared/sync-types';

export interface DayRow {
  day: string;
  rev: number;
}

interface TomajaDB extends DBSchema {
  items: { key: ItemId; value: ItemState };
  days: { key: string; value: DayRow };
  meta: { key: string; value: unknown };
  /** Markers for changes not yet pushed: item ids, "day:YYYY-MM-DD" or "profile". */
  outbox: { key: string; value: number };
}

export type Db = IDBPDatabase<TomajaDB>;

let dbp: Promise<Db> | null = null;

export function openStore(name = 'tomaja'): Promise<Db> {
  dbp ??= openDB<TomajaDB>(name, 1, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('items', { keyPath: 'itemId' });
        db.createObjectStore('days', { keyPath: 'day' });
        db.createObjectStore('meta');
        db.createObjectStore('outbox');
      }
    },
  });
  return dbp;
}

export async function loadAll(db: Db) {
  const [items, days, metaKeys] = await Promise.all([db.getAll('items'), db.getAll('days'), db.getAllKeys('meta')]);
  const meta: Record<string, unknown> = {};
  for (const k of metaKeys) meta[k] = await db.get('meta', k);
  return { items, days: days.map((d) => d.day), meta };
}

/** Saves item states and days and marks them for sync, in one transaction. */
export async function saveChanges(db: Db, items: ItemState[], days: string[], markOutbox: boolean): Promise<void> {
  const tx = db.transaction(['items', 'days', 'outbox'], 'readwrite');
  const now = Date.now();
  for (const it of items) {
    void tx.objectStore('items').put(it);
    if (markOutbox) void tx.objectStore('outbox').put(now, it.itemId);
  }
  for (const d of days) {
    void tx.objectStore('days').put({ day: d, rev: 0 });
    if (markOutbox) void tx.objectStore('outbox').put(now, `day:${d}`);
  }
  await tx.done;
}

export async function setMeta(db: Db, key: string, value: unknown): Promise<void> {
  await db.put('meta', value, key);
}

export async function markOutbox(db: Db, keys: string[]): Promise<void> {
  const tx = db.transaction('outbox', 'readwrite');
  for (const k of keys) void tx.store.put(Date.now(), k);
  await tx.done;
}

export async function readOutbox(db: Db): Promise<{ key: string; at: number }[]> {
  const tx = db.transaction('outbox');
  const keys = await tx.store.getAllKeys();
  const vals = await tx.store.getAll();
  return keys.map((key, i) => ({ key, at: vals[i] }));
}

/** Clears outbox markers that were sent, unless they changed again since. */
export async function clearOutbox(db: Db, sent: { key: string; at: number }[]): Promise<void> {
  const tx = db.transaction('outbox', 'readwrite');
  for (const s of sent) {
    const cur = await tx.store.get(s.key);
    if (cur === s.at) await tx.store.delete(s.key);
  }
  await tx.done;
}

export async function clearEverything(db: Db): Promise<void> {
  const tx = db.transaction(['items', 'days', 'meta', 'outbox'], 'readwrite');
  await Promise.all([
    tx.objectStore('items').clear(),
    tx.objectStore('days').clear(),
    tx.objectStore('meta').clear(),
    tx.objectStore('outbox').clear(),
  ]);
  await tx.done;
}
