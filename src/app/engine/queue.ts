import type { ItemId } from '../../shared/content-types';
import type { ContentDb } from './content';
import { newItemsToday, reviewsToday, type Progress } from './progress';
import { shuffle, type Rng } from './rng';
import type { Scheduler } from './scheduler';
import { nextPacket, type NextPacket } from './unlocks';

export const REVIEW_SESSION_MAX = 20;
/** New seeds are offered next to watering only when few plants are thirsty. */
export const PLANT_WITH_DUE_MAX = 5;
/** After this many waterings in a day, no new seeds: "that's plenty for today" (plan §11). */
export const PLENTY_REVIEWS = 20;

export function dueItems(p: Progress, sched: Scheduler, now: Date, known?: (id: ItemId) => boolean): ItemId[] {
  const due: { id: ItemId; at: number }[] = [];
  for (const s of p.items.values()) {
    if (s.lastReview <= 0) continue;
    if (known && !known(s.itemId)) continue; // unknown items (e.g. from a newer add-on) are kept but not shown
    if (sched.isDue(s.card as never, now)) due.push({ id: s.itemId, at: Date.parse(s.card.dueAt) });
  }
  return due.sort((a, b) => a.at - b.at).map((d) => d.id);
}

export type Action =
  | { kind: 'water'; due: number; canPlant: NextPacket | null }
  | { kind: 'plant'; packet: NextPacket }
  | { kind: 'rest'; reason: 'limit' | 'done' };

/** The home button (spec §7.1): reviews first, then new seeds within the daily limit, else rest. */
export function nextAction(db: ContentDb, p: Progress, sched: Scheduler, now: Date): Action {
  const due = dueItems(p, sched, now, (id) => db.entries.has(id)).length;
  const underLimit = newItemsToday(p, now) < p.settings.newPerDay && reviewsToday(p, now) < PLENTY_REVIEWS;
  const packet = underLimit ? nextPacket(db, p) : null;
  if (due > 0) return { kind: 'water', due, canPlant: due <= PLANT_WITH_DUE_MAX ? packet : null };
  if (packet) return { kind: 'plant', packet };
  return { kind: 'rest', reason: nextPacket(db, p) ? 'limit' : 'done' };
}

/**
 * Up to 20 due items, most overdue first, then shuffled so kinds mix and two
 * confusable items are never next to each other (spec L5).
 */
export function reviewSession(db: ContentDb, p: Progress, sched: Scheduler, now: Date, rng: Rng): ItemId[] {
  const chosen = dueItems(p, sched, now, (id) => db.entries.has(id)).slice(0, REVIEW_SESSION_MAX);
  return arrangeMixed(db, chosen, rng);
}

export function arrangeMixed(db: ContentDb, ids: ItemId[], rng: Rng): ItemId[] {
  const clash = (a: ItemId | undefined, b: ItemId) => !!a && (db.confusablesOf.get(a)?.has(b) ?? false);
  const kindOf = (id: ItemId) => db.entries.get(id)?.kind;
  let pool = shuffle(ids, rng);
  const out: ItemId[] = [];
  while (pool.length) {
    const prev = out[out.length - 1];
    // Prefer an item that is not confusable with the previous one and, if possible, a different kind.
    let idx = pool.findIndex((id) => !clash(prev, id) && kindOf(id) !== kindOf(prev ?? ''));
    if (idx < 0) idx = pool.findIndex((id) => !clash(prev, id));
    if (idx < 0) {
      // Everything left clashes with the previous item: insert the first one where it fits.
      const id = pool[0];
      const pos = out.findIndex((x, i) => !clash(x, id) && !clash(out[i + 1], id));
      if (pos >= 0) out.splice(pos + 1, 0, id);
      else out.push(id);
      pool = pool.slice(1);
      continue;
    }
    out.push(pool[idx]);
    pool = [...pool.slice(0, idx), ...pool.slice(idx + 1)];
  }
  return out;
}

// ---------- lessons ----------

export type LessonStep =
  | { type: 'intro'; id: ItemId; again?: boolean }
  | { type: 'question'; id: ItemId; phase: 'check' | 'quiz' };

export const CORRECT_TO_FINISH = 2;
const REQUEUE_GAP = 3;

/**
 * Planting (plan §6.4): introduce + check each item; a mixed mini quiz after items 3 and 5;
 * then a final mixed quiz that repeats until every item has two correct quiz answers.
 * A wrong answer re-shows the introduction and re-queues the item three places later.
 */
export class Lesson {
  readonly items: ItemId[];
  private queue: LessonStep[] = [];
  readonly quizCorrect = new Map<ItemId, number>();
  readonly mistakes = new Map<ItemId, number>();
  private rng: Rng;
  current: LessonStep | null = null;
  stepsDone = 0;

  constructor(items: ItemId[], rng: Rng) {
    this.items = items;
    this.rng = rng;
    items.forEach((id, i) => {
      this.queue.push({ type: 'intro', id }, { type: 'question', id, phase: 'check' });
      if ((i === 2 || i === 4) && i < items.length - 1) {
        for (const q of shuffle(items.slice(0, i + 1), rng)) this.queue.push({ type: 'question', id: q, phase: 'quiz' });
      }
    });
    for (const id of items) this.quizCorrect.set(id, 0);
    this.advance();
  }

  get done(): boolean {
    return this.current === null;
  }

  /** Rough progress 0..1 for the progress bar. */
  get progress(): number {
    const need = this.items.length * CORRECT_TO_FINISH;
    let have = 0;
    for (const n of this.quizCorrect.values()) have += Math.min(n, CORRECT_TO_FINISH);
    const intro = this.items.length * 2;
    return Math.min(1, (Math.min(this.stepsDone, intro) + have) / (intro + need));
  }

  /** Moves on after an intro card. */
  next(): void {
    this.stepsDone++;
    this.advance();
  }

  answer(correct: boolean): void {
    const step = this.current;
    if (!step || step.type !== 'question') throw new Error('not a question');
    this.stepsDone++;
    if (step.phase === 'quiz' && correct) this.quizCorrect.set(step.id, (this.quizCorrect.get(step.id) ?? 0) + 1);
    if (!correct) {
      this.mistakes.set(step.id, (this.mistakes.get(step.id) ?? 0) + 1);
      const at = Math.min(REQUEUE_GAP, this.queue.length);
      this.queue.splice(at, 0, { type: 'question', id: step.id, phase: 'quiz' });
      this.queue.unshift({ type: 'intro', id: step.id, again: true });
    }
    this.advance();
  }

  private advance(): void {
    if (!this.queue.length) {
      const remaining = this.items.filter((id) => (this.quizCorrect.get(id) ?? 0) < CORRECT_TO_FINISH);
      if (remaining.length) {
        let order = shuffle(remaining, this.rng);
        // Avoid asking the same item twice in a row when there is a choice.
        if (order.length > 1 && this.current?.id === order[0]) order = [...order.slice(1), order[0]];
        this.queue.push(...order.map((id) => ({ type: 'question' as const, id, phase: 'quiz' as const })));
      }
    }
    this.current = this.queue.shift() ?? null;
  }
}

/**
 * Watering: each due item is asked once and that first answer is the one scheduled.
 * A wrong answer comes back once near the end, for practice only.
 */
export class Review {
  readonly items: ItemId[];
  private queue: { id: ItemId; retry: boolean }[];
  readonly firstAnswer = new Map<ItemId, boolean>();
  current: { id: ItemId; retry: boolean } | null = null;
  answered = 0;

  constructor(items: ItemId[]) {
    this.items = items;
    this.queue = items.map((id) => ({ id, retry: false }));
    this.current = this.queue.shift() ?? null;
  }

  get done(): boolean {
    return this.current === null;
  }

  get progress(): number {
    return this.items.length ? this.firstAnswer.size / this.items.length : 1;
  }

  /** Returns true when this answer is the scheduled one. */
  answer(correct: boolean): boolean {
    const cur = this.current;
    if (!cur) throw new Error('review finished');
    const scheduled = !cur.retry && !this.firstAnswer.has(cur.id);
    if (scheduled) this.firstAnswer.set(cur.id, correct);
    if (!correct && !cur.retry) this.queue.push({ id: cur.id, retry: true });
    this.answered++;
    this.current = this.queue.shift() ?? null;
    return scheduled;
  }
}
