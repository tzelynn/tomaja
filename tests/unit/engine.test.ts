import { describe, expect, it } from 'vitest';
import { applyAnswer, totalTomatoes, varieties } from '../../src/app/engine/rewards';
import { stageOf, stageIndex, isWilting } from '../../src/app/engine/stage';
import { availableOfKind, nextPacket, unitComplete } from '../../src/app/engine/unlocks';
import { arrangeMixed, Lesson, nextAction, Review, reviewSession } from '../../src/app/engine/queue';
import { matchMeaning, matchRomaji, rate } from '../../src/app/engine/grading';
import { kanaDistractors, makeQuestion } from '../../src/app/engine/exercises';
import { seeded } from '../../src/app/engine/rng';
import { mergeInto } from '../../src/app/sync/merge';
import type { Kana } from '../../src/shared/content-types';
import type { Progress } from '../../src/app/engine/progress';
import { emptyProgress, realContent, scheduler } from './helpers';

const DAY = 86_400_000;
const T0 = new Date('2026-03-02T09:00:00');

async function plant(p: Progress, ids: string[], now = T0) {
  const s = await scheduler();
  for (const id of ids) p.items.set(id, applyAnswer(s, p.items.get(id), id, 'good', now).state);
}

describe('scheduler', () => {
  it('cards round-trip through JSON', async () => {
    const s = await scheduler();
    let card = s.newCard(T0);
    let now = T0;
    for (let i = 0; i < 4; i++) {
      card = JSON.parse(JSON.stringify(s.review(card, 'good', now)));
      now = new Date(Date.parse(card.dueAt));
    }
    expect(card.reps).toBe(4);
    expect(card.stability).toBeGreaterThan(20);
  });

  it('stage grows monotonically on repeated good and a lapse lowers it', async () => {
    const s = await scheduler();
    let st = applyAnswer(s, undefined, 'h:あ', 'good', T0).state;
    expect(stageOf(st)).toBe('sprout');
    let last = stageIndex(stageOf(st));
    let now = T0;
    for (let i = 0; i < 5; i++) {
      now = new Date(Date.parse(st.card.dueAt));
      st = applyAnswer(s, st, 'h:あ', 'good', now).state;
      const idx = stageIndex(stageOf(st));
      expect(idx).toBeGreaterThanOrEqual(last);
      last = idx;
    }
    expect(stageOf(st)).toBe('ripe');
    const lapsed = applyAnswer(s, st, 'h:あ', 'again', new Date(Date.parse(st.card.dueAt))).state;
    expect(stageIndex(stageOf(lapsed))).toBeLessThan(last);
    expect(isWilting(lapsed)).toBe(true);
  });
});

describe('unlocks over the real content', () => {
  const db = realContent();
  it('the first packet is the あ row', () => {
    const p = emptyProgress();
    expect(nextPacket(db, p)).toMatchObject({ kind: 'kana', items: ['h:あ', 'h:い', 'h:う', 'h:え', 'h:お'] });
  });
  it('after packet 1, exactly the words made of あいうえお are available', async () => {
    const p = emptyProgress();
    await plant(p, ['h:あ', 'h:い', 'h:う', 'h:え', 'h:お']);
    const words = availableOfKind(db, p, 'vocab');
    const expected = [...db.items.values()]
      .filter((i) => i.kind === 'vocab' && [...i.jp].every((c) => 'あいうえお'.includes(c)))
      .map((i) => i.id);
    expect(words.sort()).toEqual(expected.sort());
    expect(words.length).toBeGreaterThan(0);
  });
  it('words never unlock before their characters', async () => {
    const p = emptyProgress();
    for (let n = 0; n < 40; n++) {
      const pk = nextPacket(db, p);
      if (!pk) break;
      for (const id of pk.items) {
        for (const r of db.entries.get(id)!.requires) expect(p.items.get(r)?.lastReview ?? 0).toBeGreaterThan(0);
      }
      await plant(p, pk.items);
    }
  });
  it('planting everything completes every bed and ends with nothing to plant', async () => {
    const p = emptyProgress();
    let guard = 0;
    for (let pk = nextPacket(db, p); pk && guard < 500; pk = nextPacket(db, p), guard++) await plant(p, pk.items);
    expect(nextPacket(db, p)).toBeNull();
    for (const u of db.index.units) expect(unitComplete(db, p, u.id)).toBe(true);
    const names = varieties(db, p).map((v) => v.id);
    expect(names).toContain('momotaro');
    expect(names).toContain('first-light');
  });
});

describe('queue', () => {
  const db = realContent();
  it('lesson finishes only after two correct quiz answers per item', () => {
    const items = ['h:あ', 'h:い', 'h:う', 'h:え', 'h:お'];
    const lesson = new Lesson(items, seeded(1));
    let guard = 0;
    let wrongOnce = false;
    while (!lesson.done && guard++ < 200) {
      const step = lesson.current!;
      if (step.type === 'intro') lesson.next();
      else if (!wrongOnce && step.phase === 'quiz') {
        wrongOnce = true;
        lesson.answer(false);
        expect(lesson.current).toMatchObject({ type: 'intro', again: true });
      } else lesson.answer(true);
    }
    expect(lesson.done).toBe(true);
    for (const id of items) expect(lesson.quizCorrect.get(id)).toBeGreaterThanOrEqual(2);
    expect([...lesson.mistakes.values()].reduce((a, b) => a + b, 0)).toBe(1);
  });

  it('review schedules only the first answer and retries a wrong one once', () => {
    const r = new Review(['a', 'b']);
    expect(r.answer(false)).toBe(true);
    expect(r.answer(true)).toBe(true);
    expect(r.current).toEqual({ id: 'a', retry: true });
    expect(r.answer(true)).toBe(false);
    expect(r.done).toBe(true);
    expect(r.firstAnswer.get('a')).toBe(false);
  });

  it('never puts two confusables next to each other when avoidable', () => {
    const ids = ['h:さ', 'h:ち', 'h:ぬ', 'h:め', 'h:ね', 'h:れ', 'h:あ', 'h:か', 'v:いえ', 'v:かお'];
    for (let seed = 0; seed < 30; seed++) {
      const out = arrangeMixed(db, ids, seeded(seed));
      expect(out.sort()).toEqual([...ids].sort());
      const arranged = arrangeMixed(db, ids, seeded(seed));
      for (let i = 1; i < arranged.length; i++) expect(db.confusablesOf.get(arranged[i - 1])?.has(arranged[i]) ?? false).toBe(false);
    }
  });

  it('home button: water when due, plant otherwise, rest at the daily limit', async () => {
    const s = await scheduler();
    const p = emptyProgress();
    expect(nextAction(db, p, s, T0).kind).toBe('plant');
    await plant(p, ['h:あ', 'h:い', 'h:う', 'h:え', 'h:お', 'h:か', 'h:き', 'h:く', 'h:け', 'h:こ']);
    expect(nextAction(db, p, s, T0)).toEqual({ kind: 'rest', reason: 'limit' });
    const later = new Date(T0.getTime() + 6 * DAY);
    const a = nextAction(db, p, s, later);
    expect(a.kind).toBe('water');
    expect(reviewSession(db, p, s, later, seeded(2)).length).toBe(10);
  });
});

describe('exercises', () => {
  const db = realContent();
  it('distractors are look-alikes first and never share an answer', async () => {
    const p = emptyProgress();
    await plant(p, ['h:あ', 'h:い', 'h:う', 'h:え', 'h:お', 'h:か', 'h:き', 'h:く', 'h:け', 'h:こ', 'h:さ', 'h:し', 'h:す', 'h:せ', 'h:そ', 'h:た', 'h:ち']);
    const sa = db.items.get('h:さ') as Kana;
    const d = kanaDistractors(db, p, sa, 3, seeded(3));
    expect(d.map((k) => k.id)).toContain('h:ち');
    const answers = [sa, ...d].map((k) => k.romaji);
    expect(new Set(answers).size).toBe(4);
  });
  it('first packet questions still get four options', () => {
    const p = emptyProgress();
    const q = makeQuestion(db, p, 'h:あ', { rng: seeded(4), canListen: () => false, easy: true });
    expect(q.type).toBe('choice');
    if (q.type === 'choice') expect(q.options).toHaveLength(4);
  });
  it('makes a question for every item', () => {
    const p = emptyProgress();
    for (const e of db.index.items) {
      const q = makeQuestion(db, p, e.id, { rng: seeded(5), canListen: () => true });
      if (q.type === 'choice') {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(new Set(q.options.map((o) => o.label)).size).toBe(q.options.length);
        expect(q.answer).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('grading', () => {
  const db = realContent();
  it('accepts romaji variants for every kana', () => {
    for (const it of db.items.values()) {
      if (it.kind !== 'kana') continue;
      for (const a of it.accept) expect(matchRomaji(` ${a.toUpperCase()} `, it.accept)).toBe(true);
    }
    const shi = db.items.get('h:し') as Kana;
    expect(matchRomaji('si', shi.accept)).toBe(true);
    expect(matchRomaji('su', shi.accept)).toBe(false);
    expect(matchRomaji('nn', (db.items.get('h:ん') as Kana).accept)).toBe(true);
    expect(matchRomaji('o', (db.items.get('h:を') as Kana).accept)).toBe(true);
  });
  it('matches meanings loosely', () => {
    expect(matchMeaning('To Eat', { meaning: 'to eat', altMeanings: [] })).toBe(true);
    expect(matchMeaning('the house', { meaning: 'house', altMeanings: [] })).toBe(true);
    expect(matchMeaning('tomatto', { meaning: 'tomato', altMeanings: [] })).toBe(true);
    expect(matchMeaning('cat', { meaning: 'dog', altMeanings: [] })).toBe(false);
  });
  it('rates answers', () => {
    expect(rate({ correct: false, usedHint: false, attempts: 1 })).toBe('again');
    expect(rate({ correct: true, usedHint: true, attempts: 1 })).toBe('hard');
    expect(rate({ correct: true, usedHint: false, attempts: 2 })).toBe('hard');
    expect(rate({ correct: true, usedHint: false, attempts: 1 })).toBe('good');
  });
});

describe('rewards', () => {
  it('+1 per correct answer, +5 once on ripening, nothing for practice', async () => {
    const s = await scheduler();
    let st = applyAnswer(s, undefined, 'h:あ', 'good', T0).state;
    expect(st.tomatoes).toBe(1);
    const noEarn = applyAnswer(s, st, 'h:あ', 'good', T0, false);
    expect(noEarn.tomatoesEarned).toBe(0);
    let ripened = 0;
    for (let i = 0; i < 6; i++) {
      const r = applyAnswer(s, st, 'h:あ', 'good', new Date(Date.parse(st.card.dueAt)));
      if (r.ripenedNow) ripened++;
      st = r.state;
    }
    expect(ripened).toBe(1);
    expect(st.tomatoes).toBe(7 + 5);
    const p = emptyProgress();
    p.items.set('h:あ', st);
    expect(totalTomatoes(p)).toBe(12);
  });
});

describe('merge', () => {
  it('greater lastReview wins whole; days are a union; unknown items kept', async () => {
    const s = await scheduler();
    const a = emptyProgress();
    const older = applyAnswer(s, undefined, 'h:あ', 'good', T0).state;
    const newer = applyAnswer(s, older, 'h:あ', 'again', new Date(T0.getTime() + 5 * DAY)).state;
    a.items.set('h:あ', newer);
    a.days.add('2026-03-02');
    const changed = mergeInto(a, { items: [older, { ...older, itemId: 'x:future' }], days: ['2026-03-03'] });
    expect(a.items.get('h:あ')).toBe(newer);
    expect(a.items.has('x:future')).toBe(true);
    expect([...a.days].sort()).toEqual(['2026-03-02', '2026-03-03']);
    expect(changed.items).toEqual(['x:future']);
  });
});
