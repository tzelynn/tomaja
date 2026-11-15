// Content model shared by the app, the build scripts and the worker.
// Source files live in /content (hand-edited); build-content.ts emits /public/content.

/** "h:あ" "k:ト" "v:いえ" "g:wa-desu" "h:~sokuon". Pattern: <letter>:<text>. */
export type ItemId = string;
export type Script = 'hira' | 'kata';

export interface Kana {
  id: ItemId;
  kind: 'kana';
  script: Script;
  /** One kana or a combo such as きゃ. */
  char: string;
  /** Hepburn romaji, the form shown to the learner. */
  romaji: string;
  /** All typed forms accepted, Hepburn first. */
  accept: string[];
  /** ≤ 140 characters. */
  mnemonic: string;
}

/** A spelling rule taught like a character: small っ, long vowels, ー. */
export interface Rule {
  id: ItemId; // "h:~sokuon"
  kind: 'rule';
  script: Script;
  /** What is shown big: っ, ー, おう … */
  char: string;
  title: string; // "Small tsu"
  /** Short explanation shown at introduction (≤ 280 chars). */
  explain: string;
  mnemonic: string;
  /** Example readings used for exercises: see jp → pick romaji. */
  examples: { jp: string; romaji: string; wrong: string[] }[];
}

export interface Vocab {
  id: ItemId; // "v:いえ"
  kind: 'vocab';
  /** As displayed, in kana only for the MVP. */
  jp: string;
  reading: string;
  romaji: string;
  meaning: string;
  altMeanings: string[];
}

export interface GrammarExample {
  /** Tiles in order. Each tile is a word's jp or an allowed function word. */
  tiles: string[];
  /** Full kana reading as spoken (particle は is still written は). */
  reading: string;
  en: string;
  /** Index of the tile to blank out in fill-the-particle exercises. */
  blank?: number;
}

export interface Grammar {
  id: ItemId; // "g:wa-desu"
  kind: 'grammar';
  title: string; // "A は B です"
  explain: string;
  examples: GrammarExample[];
  usesVocab: ItemId[];
}

export type Item = Kana | Rule | Vocab | Grammar;
export type ItemKind = Item['kind'];

export interface Packet {
  id: string;
  items: ItemId[];
}

export interface Unit {
  id: string; // "hira-basic"
  title: string; // a garden bed
  kind: 'kana' | 'vocab' | 'grammar';
  /** Character units list packets in teaching order. Word/grammar beds are filled automatically. */
  packets: Packet[];
}

export interface Variety {
  id: string;
  name: string;
  trivia: string;
  /** Hex colours used by the drawing. */
  colour: string;
  condition:
    | { tomatoes: number }
    | { unitComplete: string }
    | { sunnyDays: number }
    | { ripe: number }
    | { firstLesson: true };
}

/** Small file loaded first: enough to render the garden. */
export interface ContentIndex {
  version: string;
  units: Unit[];
  /** Every item id in teaching order, with its kind, unit and computed prerequisites. */
  items: { id: ItemId; kind: ItemKind; unit: string; requires: ItemId[] }[];
  /** Map unit id → URL of its full content file. */
  unitFiles: Record<string, string>;
  /** reading → audio URL, for checked clips only. */
  audio: Record<string, string>;
  confusables: ItemId[][];
  varieties: Variety[];
  /** Allowed grammar function-word tiles (particles, copula …). */
  functionWords: string[];
}

export interface UnitContent {
  unit: string;
  items: Item[];
}

/** Text spoken for an item. */
export function readingOf(item: Item): string {
  switch (item.kind) {
    case 'kana':
      return toHiragana(item.char);
    case 'rule':
      return item.examples[0]?.jp ?? item.char;
    case 'vocab':
      return item.reading;
    case 'grammar':
      return item.examples[0]?.reading ?? '';
  }
}

/** Katakana → hiragana (ー is kept). Used so あ and ア share one audio clip. */
export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export const ITEM_ID_RE = /^[a-z]:.{1,40}$/u;
