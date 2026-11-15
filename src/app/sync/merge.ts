// Same merge rule as the server (plan §8.3): per item, greater lastReview wins whole;
// days are a set union. Items the app does not know are kept (they may come from a newer add-on).
import type { ItemId } from '../../shared/content-types';
import { newerItem, type ItemState } from '../../shared/sync-types';
import type { Progress } from '../engine/progress';

export function mergeInto(
  p: Pick<Progress, 'items' | 'days'>,
  incoming: { items: ItemState[]; days: string[] },
): { items: ItemId[]; days: string[] } {
  const items: ItemId[] = [];
  const days: string[] = [];
  for (const it of incoming.items) {
    if (newerItem(p.items.get(it.itemId), it)) {
      p.items.set(it.itemId, it);
      items.push(it.itemId);
    }
  }
  for (const d of incoming.days) {
    if (!p.days.has(d)) {
      p.days.add(d);
      days.push(d);
    }
  }
  return { items, days };
}
