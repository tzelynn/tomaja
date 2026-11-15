// Splits kana text into the character items it is made of. Used by the build to compute
// prerequisites, by validation, and by the tile-building exercise.
import type { ItemId } from './content-types';

export interface KanaLookup {
  /** char (e.g. "き", "きゃ", "ト", "ー") → item id */
  byChar: Map<string, ItemId>;
}

// Small tsu is one rule, taught with hiragana; katakana ッ reuses it.
const SOKUON: Record<string, ItemId> = { 'っ': 'h:~sokuon', 'ッ': 'h:~sokuon' };
const LONG_MARK = 'ー';

export interface Token {
  text: string;
  /** Character item this token needs, or null if unknown. */
  id: ItemId | null;
}

/** Greedy longest match: combos (2 chars) before single kana. */
export function tokenizeKana(text: string, lookup: KanaLookup): Token[] {
  const out: Token[] = [];
  const chars = [...text];
  for (let i = 0; i < chars.length; ) {
    const two = chars[i] + (chars[i + 1] ?? '');
    if (chars[i + 1] && lookup.byChar.has(two)) {
      out.push({ text: two, id: lookup.byChar.get(two)! });
      i += 2;
      continue;
    }
    const c = chars[i];
    if (lookup.byChar.has(c)) out.push({ text: c, id: lookup.byChar.get(c)! });
    else if (c === LONG_MARK) out.push({ text: c, id: 'k:~long' });
    else if (SOKUON[c]) out.push({ text: c, id: SOKUON[c] });
    else out.push({ text: c, id: null });
    i += 1;
  }
  return out;
}

/** Item ids needed to read `text`, deduplicated, in order of first appearance. */
export function requiredKana(text: string, lookup: KanaLookup): { ids: ItemId[]; unknown: string[] } {
  const ids: ItemId[] = [];
  const unknown: string[] = [];
  for (const t of tokenizeKana(text, lookup)) {
    if (t.id === null) unknown.push(t.text);
    else if (!ids.includes(t.id)) ids.push(t.id);
  }
  return { ids, unknown };
}

export function isHiragana(c: string): boolean {
  return /^[ぁ-ゟ]+$/u.test(c);
}
export function isKatakana(c: string): boolean {
  return /^[゠-ヿ]+$/u.test(c);
}
