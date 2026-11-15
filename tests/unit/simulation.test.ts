// M2 simulation: a scripted learner answering ~90% correctly every day for 60 days.
import { describe, expect, it } from 'vitest';
import { applyAnswer } from '../../src/app/engine/rewards';
import { nextAction, reviewSession } from '../../src/app/engine/queue';
import { seeded } from '../../src/app/engine/rng';
import { stageOf } from '../../src/app/engine/stage';
import { localDay } from '../../src/app/engine/progress';
import { emptyProgress, realContent, scheduler } from './helpers';

const DAYS = Number(process.env.SIM_DAYS ?? 90);
const NEW = Number(process.env.SIM_NEW ?? 10);
describe("simulation", () => {
  it('keeps daily reviews manageable and ripens plants', async () => {
    const db = realContent();
    const s = await scheduler();
    const p = emptyProgress();
    p.settings.newPerDay = NEW;
    const rng = seeded(42);
    const reviewsPerDay: number[] = [];
    let firstRipeDay = -1;
    for (let day = 0; day < DAYS; day++) {
      const now = new Date(2026, 0, 1 + day, 19, 0, 0);
      let reviews = 0;
      // Water every session until nothing is due (a learner may do a couple of sessions).
      for (let guard = 0; guard < 5; guard++) {
        const session = reviewSession(db, p, s, now, rng);
        if (!session.length) break;
        for (const id of session) {
          const ok = rng() < 0.9;
          p.items.set(id, applyAnswer(s, p.items.get(id), id, ok ? 'good' : 'again', now).state);
          reviews++;
        }
      }
      // Plant up to the daily limit.
      for (let guard = 0; guard < 5; guard++) {
        const a = nextAction(db, p, s, now);
        if (a.kind !== 'plant') break;
        for (const id of a.packet.items)
          p.items.set(id, applyAnswer(s, p.items.get(id), id, rng() < 0.85 ? 'good' : 'hard', now).state);
      }
      p.days.add(localDay(now));
      reviewsPerDay.push(reviews);
      if (firstRipeDay < 0 && [...p.items.values()].some((st) => stageOf(st) === 'ripe')) firstRipeDay = day;
    }
    const learned = [...p.items.values()].filter((st) => st.lastReview > 0).length;
    const max = Math.max(...reviewsPerDay);
    const avg = reviewsPerDay.reduce((a, b) => a + b, 0) / reviewsPerDay.length;
    console.log(`learned ${learned}, max reviews/day ${max}, avg ${avg.toFixed(1)}, first ripe on day ${firstRipeDay}`);
    const p95 = [...reviewsPerDay].sort((a, b) => a - b)[Math.floor(reviewsPerDay.length * 0.95)];
    // Everything is planted well within the run; one 20-item session covers a normal day.
    expect(learned).toBe(db.index.items.length);
    expect(avg).toBeLessThanOrEqual(20);
    expect(p95).toBeLessThanOrEqual(32);
    expect(max).toBeLessThanOrEqual(40);
    // Ripe needs ≈45 days of stability: the first plants ripen about two months in.
    expect(firstRipeDay).toBeGreaterThan(45);
    expect(firstRipeDay).toBeLessThan(90);
  });
});
