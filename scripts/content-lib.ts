// Loads /content source files and derives what both validation and the build need.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Grammar, Item, ItemId, Kana, Rule, Unit, Variety, Vocab } from '../src/shared/content-types';
import { readingOf } from '../src/shared/content-types';
import { requiredKana, type KanaLookup } from '../src/shared/tokenize';

export const ROOT = join(import.meta.dirname, '..');
export const CONTENT = join(ROOT, 'content');

export interface AudioEntry {
  file: string;
  source: string;
  checked: boolean;
}

export interface Source {
  hira: (Kana | Rule)[];
  kata: (Kana | Rule)[];
  vocab: Vocab[];
  grammar: { functionWords: string[]; patterns: Grammar[] };
  confusables: ItemId[][];
  units: Unit[];
  varieties: Variety[];
  audio: Record<string, AudioEntry>;
}

function read<T>(name: string, fallback?: T): T {
  const p = join(CONTENT, name);
  if (!existsSync(p) && fallback !== undefined) return fallback;
  return JSON.parse(readFileSync(p, 'utf8')) as T;
}

export function loadSource(): Source {
  return {
    hira: read('kana.hiragana.json'),
    kata: read('kana.katakana.json'),
    vocab: read('vocab.json', []),
    grammar: read('grammar.json', { functionWords: [], patterns: [] }),
    confusables: read('confusables.json', []),
    units: read('units.json'),
    varieties: read('varieties.json', []),
    audio: read('audio/manifest.json', {}),
  };
}

export function allItems(s: Source): Item[] {
  return [...s.hira, ...s.kata, ...s.vocab, ...s.grammar.patterns];
}

export function kanaLookup(s: Source): KanaLookup {
  const byChar = new Map<string, ItemId>();
  for (const k of [...s.hira, ...s.kata]) if (k.kind === 'kana') byChar.set(k.char, k.id);
  return { byChar };
}

/** Words of one script go in their own garden bed. */
export function vocabUnit(v: Vocab): string {
  return /[゠-ヿ]/.test(v.jp) ? 'kata-words' : 'hira-words';
}

/** Beds: the hand-written character units plus automatic word and grammar beds. */
export function allUnits(s: Source): Unit[] {
  return [
    ...s.units,
    { id: 'hira-words', title: 'Hiragana words', kind: 'vocab', packets: [] },
    { id: 'kata-words', title: 'Katakana words', kind: 'vocab', packets: [] },
    { id: 'grammar', title: 'Grammar', kind: 'grammar', packets: [] },
  ];
}

/** Prerequisites are computed, not written (plan §4). */
export function computeRequires(s: Source): Map<ItemId, { requires: ItemId[]; unknown: string[] }> {
  const lookup = kanaLookup(s);
  const out = new Map<ItemId, { requires: ItemId[]; unknown: string[] }>();
  for (const v of s.vocab) {
    const r = requiredKana(v.jp, lookup);
    out.set(v.id, { requires: r.ids, unknown: r.unknown });
  }
  const fw = new Set(s.grammar.functionWords);
  for (const g of s.grammar.patterns) {
    const req = new Set<ItemId>(g.usesVocab);
    const unknown: string[] = [];
    // Function words must be readable too.
    for (const ex of g.examples)
      for (const t of ex.tiles)
        if (fw.has(t)) {
          const r = requiredKana(t, lookup);
          r.ids.forEach((id) => req.add(id));
          unknown.push(...r.unknown);
        }
    out.set(g.id, { requires: [...req], unknown });
  }
  return out;
}

/** Ordered index entries: characters in packet order, then words, then grammar. */
export function orderedEntries(s: Source) {
  const req = computeRequires(s);
  const entries: { id: ItemId; kind: Item['kind']; unit: string; requires: ItemId[] }[] = [];
  const items = new Map(allItems(s).map((i) => [i.id, i]));
  for (const u of s.units)
    for (const p of u.packets)
      for (const id of p.items) entries.push({ id, kind: items.get(id)?.kind ?? 'kana', unit: u.id, requires: [] });
  for (const v of s.vocab) entries.push({ id: v.id, kind: 'vocab', unit: vocabUnit(v), requires: req.get(v.id)!.requires });
  for (const g of s.grammar.patterns)
    entries.push({ id: g.id, kind: 'grammar', unit: 'grammar', requires: req.get(g.id)!.requires });
  return entries;
}

/** Every reading that should have a clip (one per reading; あ and ア share). */
export function allReadings(s: Source): string[] {
  const set = new Set<string>();
  for (const k of [...s.hira, ...s.kata]) {
    if (k.kind === 'kana') set.add(readingOf(k));
    else for (const ex of k.examples) set.add(ex.jp);
  }
  for (const v of s.vocab) set.add(v.reading);
  for (const g of s.grammar.patterns) for (const ex of g.examples) set.add(ex.reading);
  return [...set];
}
