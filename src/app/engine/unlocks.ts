import type { ItemId } from '../../shared/content-types';
import type { ContentDb } from './content';
import { isLearned, type Progress } from './progress';

export const PACKET_SIZE = 5;
/** Words wait until a few are ready, so one character row unlocks a proper packet. */
const MIN_WORD_PACKET = 3;

/** Prerequisites learned (spec L9). Character packets are handled by order instead. */
export function requirementsMet(db: ContentDb, p: Progress, id: ItemId): boolean {
  const e = db.entries.get(id);
  return !!e && e.requires.every((r) => isLearned(p, r));
}

/** Words or grammar whose prerequisites are learned and which are not planted yet. */
export function availableOfKind(db: ContentDb, p: Progress, kind: 'vocab' | 'grammar'): ItemId[] {
  const out: ItemId[] = [];
  for (const e of db.index.items) {
    if (e.kind === kind && !isLearned(p, e.id) && requirementsMet(db, p, e.id)) out.push(e.id);
  }
  return out;
}

/** The first character packet that is not fully learned; returns its unlearned items. */
export function nextKanaPacket(db: ContentDb, p: Progress): { id: string; unit: string; items: ItemId[] } | null {
  for (const pk of db.kanaPackets) {
    const remaining = pk.items.filter((id) => !isLearned(p, id));
    if (remaining.length) return { id: pk.id, unit: pk.unit, items: remaining };
  }
  return null;
}

export type PacketKind = 'kana' | 'vocab' | 'grammar';
export interface NextPacket {
  kind: PacketKind;
  id: string;
  items: ItemId[];
}

/**
 * What to plant next. Grammar as soon as it unlocks, then words once a few are ready
 * (or there are no characters left), then the next row of characters, then any leftover words.
 */
export function nextPacket(db: ContentDb, p: Progress): NextPacket | null {
  const grammar = availableOfKind(db, p, 'grammar');
  if (grammar.length) return { kind: 'grammar', id: `g-${grammar[0]}`, items: grammar.slice(0, 1) };
  const words = availableOfKind(db, p, 'vocab');
  const kana = nextKanaPacket(db, p);
  if (words.length >= MIN_WORD_PACKET || (words.length && !kana)) {
    const items = words.slice(0, PACKET_SIZE);
    return { kind: 'vocab', id: `w-${items[0]}`, items };
  }
  if (kana) return { kind: 'kana', id: kana.id, items: kana.items };
  if (words.length) return { kind: 'vocab', id: `w-${words[0]}`, items: words.slice(0, PACKET_SIZE) };
  return null;
}

/** Words and grammar that became available because `planted` were just learned. */
export function newlyUnlocked(db: ContentDb, before: Progress, after: Progress): ItemId[] {
  const was = new Set([...availableOfKind(db, before, 'vocab'), ...availableOfKind(db, before, 'grammar')]);
  return [...availableOfKind(db, after, 'vocab'), ...availableOfKind(db, after, 'grammar')].filter(
    (id) => !was.has(id),
  );
}

/** A unit (garden bed) is complete when every item in it is learned. */
export function unitComplete(db: ContentDb, p: Progress, unitId: string): boolean {
  let any = false;
  for (const e of db.index.items) {
    if (e.unit !== unitId) continue;
    any = true;
    if (!isLearned(p, e.id)) return false;
  }
  return any;
}
