import type { ItemId } from '../../shared/content-types';
import type { ItemState, Settings } from '../../shared/sync-types';

/** Everything the engine needs to know about the learner. Plain data; the store owns persistence. */
export interface Progress {
  items: Map<ItemId, ItemState>;
  days: Set<string>;
  settings: Settings;
}

export function isLearned(p: Progress, id: ItemId): boolean {
  const s = p.items.get(id);
  return !!s && s.lastReview > 0;
}

/** Local calendar date, YYYY-MM-DD. */
export function localDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function newItemsToday(p: Progress, now: Date): number {
  const today = localDay(now);
  let n = 0;
  for (const s of p.items.values()) if (s.plantedAt && localDay(new Date(s.plantedAt)) === today) n++;
  return n;
}

/** Plants watered today that were not planted today. */
export function reviewsToday(p: Progress, now: Date): number {
  const today = localDay(now);
  let n = 0;
  for (const s of p.items.values())
    if (s.lastReview && localDay(new Date(s.lastReview)) === today && localDay(new Date(s.plantedAt)) !== today) n++;
  return n;
}
