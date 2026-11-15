import type { ContentIndex, Item, ItemId, ItemKind, Kana, Rule, UnitContent } from '../../shared/content-types';
import type { KanaLookup } from '../../shared/tokenize';

export interface IndexEntry {
  id: ItemId;
  kind: ItemKind;
  unit: string;
  requires: ItemId[];
}

/** Content as the engine sees it: the index plus whatever unit files are loaded. */
export interface ContentDb {
  index: ContentIndex;
  entries: Map<ItemId, IndexEntry>;
  order: Map<ItemId, number>;
  items: Map<ItemId, Item>;
  confusablesOf: Map<ItemId, Set<ItemId>>;
  /** Character packets in teaching order. */
  kanaPackets: { unit: string; id: string; items: ItemId[] }[];
  lookup: KanaLookup;
}

export function createContentDb(index: ContentIndex, units: UnitContent[] = []): ContentDb {
  const entries = new Map<ItemId, IndexEntry>();
  const order = new Map<ItemId, number>();
  index.items.forEach((e, i) => {
    entries.set(e.id, e);
    order.set(e.id, i);
  });
  const confusablesOf = new Map<ItemId, Set<ItemId>>();
  for (const group of index.confusables) {
    for (const a of group) {
      const set = confusablesOf.get(a) ?? new Set();
      for (const b of group) if (b !== a) set.add(b);
      confusablesOf.set(a, set);
    }
  }
  const kanaPackets = index.units
    .filter((u) => u.kind === 'kana')
    .flatMap((u) => u.packets.map((p) => ({ unit: u.id, id: p.id, items: p.items })));
  const db: ContentDb = {
    index,
    entries,
    order,
    items: new Map(),
    confusablesOf,
    kanaPackets,
    lookup: { byChar: new Map() },
  };
  for (const u of units) addUnit(db, u);
  return db;
}

export function addUnit(db: ContentDb, unit: UnitContent): void {
  for (const item of unit.items) {
    db.items.set(item.id, item);
    if (item.kind === 'kana') db.lookup.byChar.set(item.char, item.id);
  }
}

export function getItem(db: ContentDb, id: ItemId): Item | undefined {
  return db.items.get(id);
}

export function isCharacter(item: Item): item is Kana | Rule {
  return item.kind === 'kana' || item.kind === 'rule';
}

/** All loaded items of a kind, in teaching order. */
export function itemsOfKind<K extends ItemKind>(db: ContentDb, kind: K): Extract<Item, { kind: K }>[] {
  const out: Item[] = [];
  for (const e of db.index.items) {
    if (e.kind !== kind) continue;
    const it = db.items.get(e.id);
    if (it) out.push(it);
  }
  return out as Extract<Item, { kind: K }>[];
}
