import type { Grammar, Item, ItemId, Kana, Rule, Vocab } from '../../shared/content-types';
import { readingOf } from '../../shared/content-types';
import { tokenizeKana } from '../../shared/tokenize';
import type { ContentDb } from './content';
import { isLearned, type Progress } from './progress';
import { pick, shuffle, type Rng } from './rng';
import { isGrown, stageIndex, stageOf, type Stage } from './stage';

export interface Prompt {
  /** Japanese text shown big. */
  ja?: string;
  /** English text (meaning or instruction). */
  en?: string;
  /** Romaji help shown under the Japanese, when allowed (spec L8). */
  romaji?: string;
  /** Reading to play. Questions that are "hear → pick" set `listen`. */
  audio?: string;
  listen?: boolean;
  /** Grammar fill: the sentence tiles with `blank` hidden. */
  sentence?: { tiles: string[]; blank: number };
}

export interface Option {
  label: string;
  ja: boolean;
}

export type QuestionMode =
  | 'kana-sound'
  | 'sound-kana'
  | 'romaji-kana'
  | 'type-romaji'
  | 'rule-romaji'
  | 'rule-type'
  | 'word-meaning'
  | 'meaning-word'
  | 'build-word'
  | 'particle'
  | 'order-sentence';

interface Base {
  itemId: ItemId;
  mode: QuestionMode;
  instruction: string;
  prompt: Prompt;
  /** Reading played on reveal (spec L6). */
  revealAudio: string;
  /** Shown after answering. */
  revealText: string;
}

export interface ChoiceQuestion extends Base {
  type: 'choice';
  options: Option[];
  answer: number;
}
export interface TypeQuestion extends Base {
  type: 'type';
  accept: string[];
  /** Canonical answer shown on reveal. */
  expected: string;
}
export interface TilesQuestion extends Base {
  type: 'tiles';
  /** Tiles to choose from (shuffled, may include distractors). */
  tiles: string[];
  answer: string[];
}
export type Question = ChoiceQuestion | TypeQuestion | TilesQuestion;

export interface ExerciseContext {
  rng: Rng;
  /** Whether an audio source exists for "hear → pick" questions. */
  canListen: (reading: string) => boolean;
  /** Force the easy (choice) exercise, e.g. the check right after an introduction. */
  easy?: boolean;
  /** Typed meanings are only offered on wide screens. */
  allowTypedMeaning?: boolean;
}

const N_OPTIONS = 4;

export function makeQuestion(db: ContentDb, p: Progress, id: ItemId, ctx: ExerciseContext): Question {
  const item = db.items.get(id);
  if (!item) throw new Error(`content not loaded for ${id}`);
  const stage = stageOf(p.items.get(id));
  const grown = !ctx.easy && isGrown(stage);
  switch (item.kind) {
    case 'kana':
      return kanaQuestion(db, p, item, grown, ctx);
    case 'rule':
      return ruleQuestion(item, grown, ctx);
    case 'vocab':
      return vocabQuestion(db, p, item, grown, ctx);
    case 'grammar':
      return grammarQuestion(db, item, grown, ctx);
  }
}

// ---------- kana ----------

function kanaQuestion(db: ContentDb, p: Progress, item: Kana, grown: boolean, ctx: ExerciseContext): Question {
  const reading = readingOf(item);
  const base = {
    itemId: item.id,
    revealAudio: reading,
    revealText: `${item.char} = ${item.romaji}`,
  };
  if (grown) {
    if (ctx.rng() < 0.25) {
      // Produce the Japanese: see the sound → pick the character.
      const opts = kanaOptions(db, p, item, ctx.rng);
      return {
        ...base,
        type: 'choice',
        mode: 'romaji-kana',
        instruction: `Which ${item.script === 'hira' ? 'hiragana' : 'katakana'} is this?`,
        prompt: { en: item.romaji },
        options: opts.items.map((k) => ({ label: k.char, ja: true })),
        answer: opts.answer,
      };
    }
    return {
      ...base,
      type: 'type',
      mode: 'type-romaji',
      instruction: 'Type the sound',
      prompt: { ja: item.char },
      accept: item.accept,
      expected: item.romaji,
    };
  }
  const opts = kanaOptions(db, p, item, ctx.rng);
  if (ctx.canListen(reading) && ctx.rng() < 0.4) {
    return {
      ...base,
      type: 'choice',
      mode: 'sound-kana',
      instruction: 'Which character did you hear?',
      prompt: { audio: reading, listen: true },
      options: opts.items.map((k) => ({ label: k.char, ja: true })),
      answer: opts.answer,
    };
  }
  return {
    ...base,
    type: 'choice',
    mode: 'kana-sound',
    instruction: 'What sound is this?',
    prompt: { ja: item.char },
    options: opts.items.map((k) => ({ label: k.romaji, ja: false })),
    answer: opts.answer,
  };
}

/**
 * Distractors (spec L5, plan §6.5): confusables first, then the same unit, then the same kind.
 * Learned items only, except when there are not enough yet (a learner's first packets).
 * Never two options with the same accepted answer.
 */
export function kanaDistractors(db: ContentDb, p: Progress, item: Kana, n: number, rng: Rng): Kana[] {
  const unit = db.entries.get(item.id)?.unit;
  const sameScript = (k: Kana) => k.script === item.script;
  const all = [...db.items.values()].filter((i): i is Kana => i.kind === 'kana' && i.id !== item.id);
  const conf = [...(db.confusablesOf.get(item.id) ?? [])]
    .map((id) => db.items.get(id))
    .filter((k): k is Kana => !!k && k.kind === 'kana');
  const tiers: Kana[][] = [
    shuffle(conf.filter((k) => sameScript(k) && isLearned(p, k.id)), rng),
    shuffle(all.filter((k) => sameScript(k) && isLearned(p, k.id) && db.entries.get(k.id)?.unit === unit), rng),
    shuffle(all.filter((k) => sameScript(k) && isLearned(p, k.id)), rng),
    // Not enough learned yet: nearest unlearned neighbours, then anything.
    nearest(db, item.id, all.filter((k) => sameScript(k) && !isLearned(p, k.id))),
    shuffle(all, rng),
  ];
  const seen = new Set(item.accept);
  const out: Kana[] = [];
  for (const tier of tiers) {
    for (const k of tier) {
      if (out.length >= n) return out;
      if (out.includes(k) || k.accept.some((a) => seen.has(a)) || k.char === item.char) continue;
      out.push(k);
      k.accept.forEach((a) => seen.add(a));
    }
  }
  return out;
}

function nearest<T extends Item>(db: ContentDb, id: ItemId, items: T[]): T[] {
  const at = db.order.get(id) ?? 0;
  return [...items].sort((a, b) => Math.abs((db.order.get(a.id) ?? 0) - at) - Math.abs((db.order.get(b.id) ?? 0) - at));
}

function kanaOptions(db: ContentDb, p: Progress, item: Kana, rng: Rng) {
  const items = shuffle([item, ...kanaDistractors(db, p, item, N_OPTIONS - 1, rng)], rng);
  return { items, answer: items.indexOf(item) };
}

// ---------- rules (small っ, long vowels, ー) ----------

function ruleQuestion(item: Rule, grown: boolean, ctx: ExerciseContext): Question {
  const ex = pick(item.examples, ctx.rng);
  const base = {
    itemId: item.id,
    revealAudio: ex.jp,
    revealText: `${ex.jp} = ${ex.romaji}`,
    prompt: { ja: ex.jp },
  };
  if (grown) {
    return { ...base, type: 'type', mode: 'rule-type', instruction: 'Type how this is read', accept: [ex.romaji], expected: ex.romaji };
  }
  const labels = shuffle([ex.romaji, ...ex.wrong.slice(0, N_OPTIONS - 1)], ctx.rng);
  return {
    ...base,
    type: 'choice',
    mode: 'rule-romaji',
    instruction: 'How is this read?',
    options: labels.map((label) => ({ label, ja: false })),
    answer: labels.indexOf(ex.romaji),
  };
}

// ---------- words ----------

/** Romaji under a word disappears once all its characters are past the seedling stage (spec L8). */
export function showRomajiFor(db: ContentDb, p: Progress, jp: string): boolean {
  if (!p.settings.romajiHelp) return false;
  return tokenizeKana(jp, db.lookup).some((t) => {
    if (!t.id) return false;
    return stageIndex(stageOf(p.items.get(t.id))) <= stageIndex('seedling' as Stage);
  });
}

function vocabDistractors(db: ContentDb, p: Progress, item: Vocab, rng: Rng): Vocab[] {
  const all = [...db.items.values()].filter((i): i is Vocab => i.kind === 'vocab' && i.id !== item.id);
  const differs = (v: Vocab) => v.meaning !== item.meaning && v.jp !== item.jp;
  const learned = shuffle(all.filter((v) => isLearned(p, v.id) && differs(v)), rng);
  const rest = nearest(db, item.id, all.filter((v) => !isLearned(p, v.id) && differs(v)));
  const out: Vocab[] = [];
  for (const v of [...learned, ...rest]) {
    if (out.length >= N_OPTIONS - 1) break;
    if (out.some((o) => o.meaning === v.meaning)) continue;
    out.push(v);
  }
  return out;
}

function vocabQuestion(db: ContentDb, p: Progress, item: Vocab, grown: boolean, ctx: ExerciseContext): Question {
  const romaji = showRomajiFor(db, p, item.jp) ? item.romaji : undefined;
  const base = {
    itemId: item.id,
    revealAudio: item.reading,
    revealText: `${item.jp} (${item.romaji}) = ${item.meaning}`,
  };
  const r = ctx.rng();
  if (grown && r < 0.75) {
    const tokens = tokenizeKana(item.jp, db.lookup).map((t) => t.text);
    return {
      ...base,
      type: 'tiles',
      mode: 'build-word',
      instruction: 'Build the word',
      prompt: { en: item.meaning },
      tiles: shuffle([...tokens, ...tileDistractors(db, p, tokens, 3, ctx.rng)], ctx.rng),
      answer: tokens,
    };
  }
  const opts = shuffle([item, ...vocabDistractors(db, p, item, ctx.rng)], ctx.rng);
  if (grown) {
    return {
      ...base,
      type: 'choice',
      mode: 'meaning-word',
      instruction: 'Which word means this?',
      prompt: { en: item.meaning },
      options: opts.map((v) => ({ label: v.jp, ja: true })),
      answer: opts.indexOf(item),
    };
  }
  return {
    ...base,
    type: 'choice',
    mode: 'word-meaning',
    instruction: 'What does this mean?',
    prompt: { ja: item.jp, romaji, audio: item.reading },
    options: opts.map((v) => ({ label: v.meaning, ja: false })),
    answer: opts.indexOf(item),
  };
}

/** Extra character tiles for building a word: look-alikes first, then other learned characters. */
function tileDistractors(db: ContentDb, p: Progress, tokens: string[], n: number, rng: Rng): string[] {
  const out: string[] = [];
  const add = (c: string | undefined) => {
    if (c && !tokens.includes(c) && !out.includes(c) && out.length < n) out.push(c);
  };
  for (const t of shuffle(tokens, rng)) {
    const id = db.lookup.byChar.get(t);
    const conf = id ? [...(db.confusablesOf.get(id) ?? [])] : [];
    const same = conf.map((c) => db.items.get(c)).find((k) => k?.kind === 'kana' && k.char && isLearned(p, k.id));
    add(same && same.kind === 'kana' ? same.char : undefined);
  }
  const script = /[゠-ヿ]/.test(tokens.join('')) ? 'kata' : 'hira';
  const learned = shuffle(
    [...db.items.values()].filter((i): i is Kana => i.kind === 'kana' && i.script === script && isLearned(p, i.id)),
    rng,
  );
  for (const k of learned) add(k.char);
  return out;
}

// ---------- grammar ----------

function grammarQuestion(db: ContentDb, item: Grammar, grown: boolean, ctx: ExerciseContext): Question {
  const withBlank = item.examples.filter((e) => e.blank !== undefined);
  if (!grown && withBlank.length) {
    const ex = pick(withBlank, ctx.rng);
    const correct = ex.tiles[ex.blank!];
    const pool = db.index.functionWords.filter((w) => w !== correct && !ex.tiles.includes(w) && w.length <= 2);
    const labels = shuffle([correct, ...shuffle(pool, ctx.rng).slice(0, N_OPTIONS - 1)], ctx.rng);
    return {
      itemId: item.id,
      type: 'choice',
      mode: 'particle',
      instruction: 'Fill the missing piece',
      prompt: { en: ex.en, sentence: { tiles: ex.tiles, blank: ex.blank! } },
      options: labels.map((label) => ({ label, ja: true })),
      answer: labels.indexOf(correct),
      revealAudio: ex.reading,
      revealText: `${ex.tiles.join(' ')} — ${ex.en}`,
    };
  }
  const ex = pick(item.examples, ctx.rng);
  let tiles = shuffle(ex.tiles, ctx.rng);
  // Make sure the shuffle actually changed something.
  for (let i = 0; i < 5 && tiles.join('|') === ex.tiles.join('|') && ex.tiles.length > 1; i++) tiles = shuffle(ex.tiles, ctx.rng);
  return {
    itemId: item.id,
    type: 'tiles',
    mode: 'order-sentence',
    instruction: 'Put the sentence in order',
    prompt: { en: ex.en },
    tiles,
    answer: ex.tiles,
    revealAudio: ex.reading,
    revealText: `${ex.tiles.join(' ')} — ${ex.en}`,
  };
}
