import type { ItemState } from '../../shared/sync-types';

export const STAGES = ['seed', 'sprout', 'seedling', 'flowering', 'green', 'ripe'] as const;
export type Stage = (typeof STAGES)[number];

/**
 * Stability (days) thresholds. Tuned from spec §5.1 starting values so that a freshly planted
 * item (FSRS-7 first "good" ≈ 3.9 days) is a sprout and each successful watering grows it a stage:
 * ≈3.9 → 8.4 → 18 → 40 → 87 days.
 */
export const STAGE_THRESHOLDS = {
  seedling: 5,
  flowering: 12,
  green: 25,
  ripe: 45,
} as const;

export function stageFromStability(stability: number): Exclude<Stage, 'seed'> {
  if (stability >= STAGE_THRESHOLDS.ripe) return 'ripe';
  if (stability >= STAGE_THRESHOLDS.green) return 'green';
  if (stability >= STAGE_THRESHOLDS.flowering) return 'flowering';
  if (stability >= STAGE_THRESHOLDS.seedling) return 'seedling';
  return 'sprout';
}

export function stageOf(state: ItemState | undefined): Stage {
  if (!state || state.lastReview <= 0) return 'seed';
  return stageFromStability(state.card.stability);
}

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

/** A forgotten plant wilts until it is watered successfully. */
export function isWilting(state: ItemState | undefined): boolean {
  return !!state && state.lastReview > 0 && state.lastRating === 'again';
}

/** Grown = past the seedling stage: harder exercises (spec L7). */
export function isGrown(stage: Stage): boolean {
  return stageIndex(stage) >= stageIndex('flowering');
}

export const STAGE_LABELS: Record<Stage, string> = {
  seed: 'Seed',
  sprout: 'Sprout',
  seedling: 'Seedling',
  flowering: 'Flowering',
  green: 'Green tomato',
  ripe: 'Ripe tomato',
};
