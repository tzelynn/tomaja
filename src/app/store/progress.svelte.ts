// Reactive app state over IndexedDB. Engine code stays pure; this file wires it to the UI.
import type { ContentIndex, Item, ItemId, UnitContent } from '../../shared/content-types';
import { DEFAULT_SETTINGS, type ItemState, type Settings } from '../../shared/sync-types';
import { addUnit, createContentDb, type ContentDb } from '../engine/content';
import { localDay, type Progress } from '../engine/progress';
import { getScheduler, type Scheduler } from '../engine/scheduler';
import { clearEverything, loadAll, markOutbox, openStore, saveChanges, setMeta, type Db } from './db';

export interface Account {
  name: string;
}

class AppState {
  ready = $state(false);
  loadError = $state<string | null>(null);
  /** Bumped after every change so derived views recompute. */
  version = $state(0);
  contentVersion = $state(0);
  allContentLoaded = $state(false);
  account = $state<Account | null>(null);
  settings = $state<Settings>({ ...DEFAULT_SETTINGS });
  settingsUpdatedAt = 0;

  content!: ContentDb;
  progress: Progress = { items: new Map(), days: new Set(), settings: { ...DEFAULT_SETTINGS } };
  sched!: Scheduler;
  db!: Db;
  private unitsLoading: Promise<void> | null = null;

  async init(): Promise<void> {
    try {
      const [db, sched, index] = await Promise.all([openStore(), getScheduler(), fetchJson<ContentIndex>('/content/index.json')]);
      this.db = db;
      this.sched = sched;
      this.content = createContentDb(index);
      const saved = await loadAll(db);
      for (const it of saved.items) this.progress.items.set(it.itemId, it);
      for (const d of saved.days) this.progress.days.add(d);
      const s = saved.meta.settings as { data: Settings; updatedAt: number } | undefined;
      if (s) {
        this.settings = { ...DEFAULT_SETTINGS, ...s.data };
        this.settingsUpdatedAt = s.updatedAt;
      }
      this.progress.settings = this.settings;
      this.account = (saved.meta.account as Account | undefined) ?? null;
      this.ready = true;
      this.version++;
      void this.loadAllUnits();
    } catch (e) {
      this.loadError = e instanceof Error ? e.message : String(e);
    }
  }

  /** Unit files are small; all are fetched after the garden renders, so lessons start instantly. */
  loadAllUnits(): Promise<void> {
    this.unitsLoading ??= Promise.all(
      Object.values(this.content.index.unitFiles).map(async (url) => addUnit(this.content, await fetchJson<UnitContent>(url))),
    ).then(() => {
      this.allContentLoaded = true;
      this.contentVersion++;
    });
    this.unitsLoading.catch(() => (this.unitsLoading = null));
    return this.unitsLoading;
  }

  item(id: ItemId): Item | undefined {
    return this.content.items.get(id);
  }

  /** Records new item states and today's sunny day. */
  async commit(items: ItemState[], now = new Date()): Promise<void> {
    for (const it of items) this.progress.items.set(it.itemId, it);
    const day = localDay(now);
    const newDay = items.length > 0 && !this.progress.days.has(day);
    if (newDay) this.progress.days.add(day);
    this.version++;
    await saveChanges(this.db, items, newDay ? [day] : [], !!this.account);
    this.onChange?.();
  }

  /** Applies merged state from the server (not marked for re-upload). */
  async applyRemote(items: ItemState[], days: string[]): Promise<void> {
    if (!items.length && !days.length) return;
    this.version++;
    await saveChanges(this.db, items, days, false);
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    this.settings = { ...this.settings, ...patch };
    this.progress.settings = this.settings;
    this.settingsUpdatedAt = Date.now();
    this.version++;
    await setMeta(this.db, 'settings', { data: $state.snapshot(this.settings), updatedAt: this.settingsUpdatedAt });
    if (this.account) await markOutbox(this.db, ['profile']);
    this.onChange?.();
  }

  async applyRemoteSettings(data: Settings, updatedAt: number): Promise<void> {
    if (updatedAt <= this.settingsUpdatedAt) return;
    this.settings = { ...DEFAULT_SETTINGS, ...data };
    this.progress.settings = this.settings;
    this.settingsUpdatedAt = updatedAt;
    this.version++;
    await setMeta(this.db, 'settings', { data: $state.snapshot(this.settings), updatedAt });
  }

  async setAccount(account: Account | null): Promise<void> {
    this.account = account;
    await setMeta(this.db, 'account', account ? { ...account } : null);
    if (!account) await setMeta(this.db, 'cursor', 0);
  }

  async deleteLocalData(): Promise<void> {
    await clearEverything(this.db);
    this.progress.items.clear();
    this.progress.days.clear();
    this.settings = { ...DEFAULT_SETTINGS };
    this.progress.settings = this.settings;
    this.settingsUpdatedAt = 0;
    this.account = null;
    this.version++;
  }

  /** Set by the sync client: called after local changes. */
  onChange?: () => void;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return (await res.json()) as T;
}

export const app = new AppState();
