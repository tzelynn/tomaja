// FSRS wrapper. The rest of the app only sees this interface and the JSON card shape.
// ts-fsrs v6 (FSRS-7 model) — verified in M2 step 1: pure TypeScript, ~17 KB gzipped, runs in browsers.
// Its cards hold Date objects; we store ISO strings so cards round-trip through JSON/IndexedDB/D1.
import { DefaultScheduler, Rating } from 'ts-fsrs';

export type SimpleRating = 'again' | 'hard' | 'good';

/** JSON-safe FSRS card. */
export interface SchedulerCard {
  stability: number;
  stabilityFast?: number;
  difficulty: number;
  dueAt: string;
  lastReviewAt: string | null;
  state: number;
  scheduleStatus: string;
  reps: number;
  lapses: number;
  scheduledDays: number;
  learningStep: number;
  cardId?: string;
}

export interface Scheduler {
  newCard(now: Date): SchedulerCard;
  review(card: SchedulerCard, rating: SimpleRating, now: Date): SchedulerCard;
  isDue(card: SchedulerCard, now: Date): boolean;
  stability(card: SchedulerCard): number;
}

export const SCHEDULER_CONFIG = {
  desiredRetention: 0.9,
  maximumInterval: 365,
  enableFuzz: false,
} as const;

const RATINGS = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good } as const;

type Fsrs = Awaited<ReturnType<typeof DefaultScheduler>>;

function toJson(card: Record<string, unknown>): SchedulerCard {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(card)) {
    if (k === 'cardId') continue; // not needed; saves space in every synced row
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out as unknown as SchedulerCard;
}

function fromJson(card: SchedulerCard): Record<string, unknown> {
  return {
    ...card,
    cardId: card.cardId ?? 'c',
    dueAt: new Date(card.dueAt),
    lastReviewAt: card.lastReviewAt ? new Date(card.lastReviewAt) : null,
  };
}

function endOfLocalDay(now: Date): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function wrap(fsrs: Fsrs): Scheduler {
  return {
    newCard(now) {
      return toJson(fsrs.newCard({ now }) as unknown as Record<string, unknown>);
    },
    review(card, rating, now) {
      const result = fsrs.review({
        card: fromJson(card) as never,
        grade: RATINGS[rating],
        now,
      });
      return toJson(result.card as unknown as Record<string, unknown>);
    },
    isDue(card, now) {
      const due = Date.parse(card.dueAt);
      // Day-long intervals are due any time on their due day; short relearning steps are due on time.
      return card.scheduledDays >= 1 ? due <= endOfLocalDay(now) : due <= now.getTime();
    },
    stability(card) {
      return card.stability;
    },
  };
}

let instance: Promise<Scheduler> | null = null;

/** The shared scheduler. Created once; creation is async in ts-fsrs v6. */
export function getScheduler(): Promise<Scheduler> {
  instance ??= DefaultScheduler({ ...SCHEDULER_CONFIG }).then(wrap);
  return instance;
}
