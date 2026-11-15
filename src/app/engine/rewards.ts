import type { ItemId, Variety } from '../../shared/content-types';
import type { ItemState, Rating } from '../../shared/sync-types';
import type { ContentDb } from './content';
import type { Progress } from './progress';
import { localDay } from './progress';
import type { Scheduler } from './scheduler';
import { stageFromStability, stageOf } from './stage';
import { unitComplete } from './unlocks';

export const TOMATO_PER_CORRECT = 1;
export const TOMATO_PER_RIPE = 5;

export interface ReviewOutcome {
  state: ItemState;
  tomatoesEarned: number;
  ripenedNow: boolean;
  grew: boolean;
}

/**
 * Applies one scheduled answer to an item. `earn` is false for answers that should not pay
 * (the second answer to the same item in a session).
 */
export function applyAnswer(
  sched: Scheduler,
  prev: ItemState | undefined,
  itemId: ItemId,
  rating: Rating,
  now: Date,
  earn = true,
): ReviewOutcome {
  const isNew = !prev || prev.lastReview <= 0;
  const card = sched.review(isNew ? sched.newCard(now) : (prev.card as never), rating, now);
  const beforeStage = stageOf(prev);
  let tomatoes = prev?.tomatoes ?? 0;
  let ripenedAt = prev?.ripenedAt ?? null;
  let earned = 0;
  if (earn && rating !== 'again') earned += TOMATO_PER_CORRECT;
  let ripenedNow = false;
  if (ripenedAt === null && stageFromStability(card.stability) === 'ripe') {
    ripenedAt = now.getTime();
    earned += TOMATO_PER_RIPE;
    ripenedNow = true;
  }
  tomatoes += earned;
  const state: ItemState = {
    itemId,
    card: card as unknown as ItemState['card'],
    lastReview: now.getTime(),
    plantedAt: isNew ? now.getTime() : prev.plantedAt,
    lastRating: rating,
    tomatoes,
    ripenedAt,
  };
  const afterStage = stageOf(state);
  return { state, tomatoesEarned: earned, ripenedNow, grew: afterStage !== beforeStage && rating !== 'again' };
}

export function totalTomatoes(p: Progress): number {
  let n = 0;
  for (const s of p.items.values()) n += s.tomatoes || 0;
  return n;
}

export function ripeCount(p: Progress): number {
  let n = 0;
  for (const s of p.items.values()) if (s.ripenedAt) n++;
  return n;
}

export function markSunnyDay(p: Progress, now: Date): string {
  const d = localDay(now);
  p.days.add(d);
  return d;
}

/** Varieties earned so far, in content order (spec §5.4). Derived, never stored. */
export function varieties(db: ContentDb, p: Progress): Variety[] {
  const total = totalTomatoes(p);
  const ripe = ripeCount(p);
  return db.index.varieties.filter((v) => {
    const c = v.condition;
    if ('tomatoes' in c) return total >= c.tomatoes;
    if ('unitComplete' in c) return unitComplete(db, p, c.unitComplete);
    if ('sunnyDays' in c) return p.days.size >= c.sunnyDays;
    if ('ripe' in c) return ripe >= c.ripe;
    if ('firstLesson' in c) return [...p.items.values()].some((s) => s.lastReview > 0);
    return false;
  });
}
