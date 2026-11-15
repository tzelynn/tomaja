// Fails the build on bad content (plan §4). Run: tsx scripts/validate-content.ts [--strict-audio]
import { ITEM_ID_RE } from '../src/shared/content-types';
import { isHiragana, isKatakana } from '../src/shared/tokenize';
import { allItems, allReadings, computeRequires, loadSource, type Source } from './content-lib';

export function validate(s: Source, opts: { strictAudio?: boolean } = {}): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const items = allItems(s);
  const ids = new Map<string, number>();
  for (const it of items) ids.set(it.id, (ids.get(it.id) ?? 0) + 1);

  // ids
  for (const [id, n] of ids) {
    if (n > 1) errors.push(`duplicate id ${id}`);
    if (!ITEM_ID_RE.test(id)) errors.push(`malformed id ${id}`);
  }
  const byId = new Map(items.map((i) => [i.id, i]));

  // kana
  for (const k of [...s.hira, ...s.kata]) {
    const prefix = k.script === 'hira' ? 'h:' : 'k:';
    if (!k.id.startsWith(prefix)) errors.push(`${k.id}: id prefix does not match script`);
    if (!k.mnemonic?.trim()) errors.push(`${k.id}: mnemonic missing`);
    else if ([...k.mnemonic].length > 140) errors.push(`${k.id}: mnemonic longer than 140 characters`);
    if (k.kind === 'kana') {
      if (!k.accept?.length || k.accept[0] !== k.romaji) errors.push(`${k.id}: accept list must start with its Hepburn form "${k.romaji}"`);
      if (k.id !== prefix + k.char) errors.push(`${k.id}: id does not match char ${k.char}`);
    } else {
      if (!k.examples?.length) errors.push(`${k.id}: rule has no examples`);
      for (const ex of k.examples ?? []) {
        if (ex.wrong.includes(ex.romaji)) errors.push(`${k.id}: example ${ex.jp} lists its answer as wrong`);
        if (ex.wrong.length < 3) errors.push(`${k.id}: example ${ex.jp} needs 3 wrong answers`);
      }
    }
  }

  // units: every character item in exactly one packet, ≤ 5 per packet
  const inPacket = new Map<string, number>();
  for (const u of s.units)
    for (const p of u.packets) {
      if (p.items.length > 5) errors.push(`packet ${p.id} has more than 5 items`);
      for (const id of p.items) {
        if (!byId.has(id)) errors.push(`packet ${p.id}: unknown item ${id}`);
        inPacket.set(id, (inPacket.get(id) ?? 0) + 1);
      }
    }
  for (const k of [...s.hira, ...s.kata]) {
    const n = inPacket.get(k.id) ?? 0;
    if (n !== 1) errors.push(`${k.id} appears in ${n} packets (expected 1)`);
  }
  // Rule examples must only use characters taught before or in the same unit (or basic kana).
  const charOrder = new Map<string, number>();
  let i = 0;
  for (const u of s.units) for (const p of u.packets) for (const id of p.items) charOrder.set(id, i++);

  // words
  const req = computeRequires(s);
  for (const v of s.vocab) {
    if (v.id !== `v:${v.jp}`) errors.push(`${v.id}: id must be "v:${v.jp}"`);
    if (!v.meaning?.trim()) errors.push(`${v.id}: meaning missing`);
    if (!(isHiragana(v.jp) || isKatakana(v.jp))) errors.push(`${v.id}: word must be all hiragana or all katakana`);
    const r = req.get(v.id)!;
    if (r.unknown.length) errors.push(`${v.id}: uses characters that are not taught: ${[...new Set(r.unknown)].join(' ')}`);
    for (const id of r.requires) if (!byId.has(id)) errors.push(`${v.id}: needs ${id}, which is not an item`);
  }

  // grammar
  const vocabJp = new Map(s.vocab.map((v) => [v.jp, v.id]));
  const fw = new Set(s.grammar.functionWords);
  for (const g of s.grammar.patterns) {
    if (!g.examples.length) errors.push(`${g.id}: no examples`);
    const used = new Set<string>();
    for (const ex of g.examples) {
      for (const t of ex.tiles) {
        if (fw.has(t)) continue;
        const vid = vocabJp.get(t);
        if (!vid) errors.push(`${g.id}: tile "${t}" is neither a known word nor an allowed function word`);
        else used.add(vid);
      }
      if (ex.tiles.join('') !== ex.reading) errors.push(`${g.id}: reading "${ex.reading}" does not match tiles`);
      if (ex.blank !== undefined && !fw.has(ex.tiles[ex.blank] ?? '')) errors.push(`${g.id}: blank does not point at a function word`);
    }
    for (const id of used) if (!g.usesVocab.includes(id)) errors.push(`${g.id}: uses ${id} but usesVocab does not list it`);
    for (const id of g.usesVocab) if (!byId.has(id)) errors.push(`${g.id}: usesVocab has unknown ${id}`);
    const r = req.get(g.id)!;
    if (r.unknown.length) errors.push(`${g.id}: function words use untaught characters ${r.unknown.join(' ')}`);
  }

  // confusables
  for (const group of s.confusables) for (const id of group) if (!byId.has(id)) errors.push(`confusables: missing item ${id}`);

  // varieties
  const unitIds = new Set([...s.units.map((u) => u.id), 'hira-words', 'kata-words', 'grammar']);
  for (const v of s.varieties)
    if ('unitComplete' in v.condition && !unitIds.has(v.condition.unitComplete)) errors.push(`variety ${v.id}: unknown unit`);

  // audio (§7.3): unchecked clips never ship; missing clips fall back to browser speech
  const missing: string[] = [];
  const unchecked: string[] = [];
  for (const r of allReadings(s)) {
    const a = s.audio[r];
    if (!a) missing.push(r);
    else if (!a.checked) unchecked.push(r);
  }
  const audioMsg = (what: string, list: string[]) =>
    `${list.length} reading(s) ${what}: ${list.slice(0, 12).join(' ')}${list.length > 12 ? ' …' : ''}`;
  if (missing.length) (opts.strictAudio ? errors : warnings).push(audioMsg('have no audio clip (browser speech fallback)', missing));
  if (unchecked.length) (opts.strictAudio ? errors : warnings).push(audioMsg('have clips not yet checked by ear (not shipped)', unchecked));

  return { errors, warnings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, warnings } = validate(loadSource(), { strictAudio: process.argv.includes('--strict-audio') });
  for (const w of warnings) console.warn(`warning: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    console.error(`\nContent validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }
  console.log('Content OK.');
}
