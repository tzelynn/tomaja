// Push/pull with retry and online detection (plan §8.3). Guests never reach this code's network calls.
import { SYNC_LIMITS, type ItemState, type SyncRequest, type SyncResponse } from '../../shared/sync-types';
import { clearOutbox, markOutbox, readOutbox, setMeta } from '../store/db';
import { app } from '../store/progress.svelte';
import { mergeInto } from './merge';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'signed-out';

export const syncState = $state({ status: 'idle' as SyncStatus, lastSyncedAt: 0, lastMerge: null as null | { items: number; days: number } });

const MIN_INTERVAL = 30_000;
let backoff = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
let lastRun = 0;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'X-Tomaja': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (!res.ok) {
    let code = 'server_error';
    try {
      code = ((await res.json()) as { error?: string }).error ?? code;
    } catch {}
    throw new ApiError(res.status, code);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

// ---------- account ----------

export async function createGarden(name: string, secretCode: string): Promise<void> {
  const r = await api<{ name: string }>('POST', '/account', { name, secretCode });
  await afterSignIn(r.name);
}

export async function openGarden(name: string, secretCode: string): Promise<void> {
  const r = await api<{ name: string }>('POST', '/session', { name, secretCode });
  await afterSignIn(r.name);
}

/** First sign-in on a device: send the full local state with cursor 0; the normal merge does the rest. */
async function afterSignIn(name: string): Promise<void> {
  await app.setAccount({ name });
  await setMeta(app.db, 'cursor', 0);
  const keys = [...app.progress.items.keys(), ...[...app.progress.days].map((d) => `day:${d}`)];
  if (app.settingsUpdatedAt) keys.push('profile');
  await markOutbox(app.db, keys);
  await syncNow(true);
}

export async function signOut(): Promise<void> {
  try {
    await api('DELETE', '/session');
  } catch {}
  await app.setAccount(null);
  syncState.status = 'idle';
}

export async function deleteGarden(): Promise<void> {
  await api('DELETE', '/account');
  await app.setAccount(null);
  syncState.status = 'idle';
}

// ---------- sync ----------

export function syncNow(force = false): Promise<void> {
  if (!app.account) return Promise.resolve();
  if (running) return running;
  if (!force && Date.now() - lastRun < MIN_INTERVAL) {
    schedule(MIN_INTERVAL - (Date.now() - lastRun));
    return Promise.resolve();
  }
  running = doSync().finally(() => {
    running = null;
  });
  return running;
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow(true);
  }, ms);
}

async function doSync(): Promise<void> {
  if (!navigator.onLine) {
    syncState.status = 'offline';
    return;
  }
  lastRun = Date.now();
  syncState.status = 'syncing';
  let mergedItems = 0;
  let mergedDays = 0;
  try {
    let more = true;
    while (more) {
      const outbox = await readOutbox(app.db);
      const itemKeys = outbox.filter((o) => !o.key.startsWith('day:') && o.key !== 'profile');
      const batch = itemKeys.slice(0, SYNC_LIMITS.maxItemsPerRequest);
      const dayKeys = outbox.filter((o) => o.key.startsWith('day:'));
      const profileKey = outbox.find((o) => o.key === 'profile');
      const sent = [...batch, ...dayKeys, ...(profileKey ? [profileKey] : [])];
      const req: SyncRequest = {
        cursor: ((await app.db.get('meta', 'cursor')) as number | undefined) ?? 0,
        items: batch.map((o) => app.progress.items.get(o.key)).filter((x): x is ItemState => !!x),
        days: dayKeys.map((o) => o.key.slice(4)),
        profile: profileKey ? { data: $state.snapshot(app.settings), updatedAt: app.settingsUpdatedAt } : undefined,
      };
      const res = await api<SyncResponse>('POST', '/sync', req);
      await clearOutbox(app.db, sent);
      const changed = mergeInto(app.progress, res);
      await app.applyRemote(
        changed.items.map((id) => app.progress.items.get(id)!),
        changed.days,
      );
      if (res.profile) await app.applyRemoteSettings(res.profile.data, res.profile.updatedAt);
      await setMeta(app.db, 'cursor', res.cursor);
      mergedItems += changed.items.length;
      mergedDays += changed.days.length;
      more = itemKeys.length > batch.length;
    }
    backoff = 0;
    syncState.status = 'synced';
    syncState.lastSyncedAt = Date.now();
    syncState.lastMerge = { items: mergedItems, days: mergedDays };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      // The garden was deleted or the session expired: keep studying locally.
      await app.setAccount(null);
      syncState.status = 'signed-out';
      return;
    }
    syncState.status = navigator.onLine ? 'error' : 'offline';
    backoff = Math.min(backoff ? backoff * 2 : 5_000, 5 * 60_000);
    schedule(backoff);
  }
}

/** Triggers: app start, session end, tab visible, back online, and every 30 s while dirty. */
export function startSyncTriggers(): void {
  app.onChange = () => void syncNow();
  window.addEventListener('online', () => void syncNow(true));
  window.addEventListener('offline', () => app.account && (syncState.status = 'offline'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  void syncNow(true);
}
