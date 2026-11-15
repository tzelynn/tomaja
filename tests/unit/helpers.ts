import type { ContentIndex, Item, UnitContent } from '../../src/shared/content-types';
import { allItems, allUnits, loadSource, orderedEntries } from '../../scripts/content-lib';
import { createContentDb, type ContentDb } from '../../src/app/engine/content';
import type { Progress } from '../../src/app/engine/progress';
import { DEFAULT_SETTINGS } from '../../src/shared/sync-types';
import { DefaultScheduler } from 'ts-fsrs';
import { SCHEDULER_CONFIG, wrap, type Scheduler } from '../../src/app/engine/scheduler';

let cached: ContentDb | null = null;
export function realContent(): ContentDb {
  if (cached) return cached;
  const s = loadSource();
  const entries = orderedEntries(s);
  const items = new Map<string, Item>(allItems(s).map((i) => [i.id, i]));
  const units = allUnits(s);
  const index: ContentIndex = {
    version: 'test', units, items: entries, unitFiles: {}, audio: {},
    confusables: s.confusables, varieties: s.varieties, functionWords: s.grammar.functionWords,
  };
  const unitContent: UnitContent[] = units.map((u) => ({
    unit: u.id, items: entries.filter((e) => e.unit === u.id).map((e) => items.get(e.id)!),
  }));
  cached = createContentDb(index, unitContent);
  return cached;
}

export function emptyProgress(): Progress {
  return { items: new Map(), days: new Set(), settings: { ...DEFAULT_SETTINGS } };
}

export async function scheduler(): Promise<Scheduler> {
  return wrap(await DefaultScheduler({ ...SCHEDULER_CONFIG }));
}
