// content/ → public/content/*.json (per unit, minified, hashed) + index.json, and checked clips → public/audio.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentIndex, Item, UnitContent } from '../src/shared/content-types';
import { allItems, allUnits, CONTENT, loadSource, orderedEntries, ROOT } from './content-lib';

const hash = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex').slice(0, 10);

export function buildContent(outDir = join(ROOT, 'public')) {
  const s = loadSource();
  const contentDir = join(outDir, 'content');
  const audioDir = join(outDir, 'audio');
  rmSync(contentDir, { recursive: true, force: true });
  rmSync(audioDir, { recursive: true, force: true });
  mkdirSync(contentDir, { recursive: true });
  mkdirSync(audioDir, { recursive: true });

  // Audio: only clips a person has checked are shipped.
  const audio: Record<string, string> = {};
  for (const [reading, a] of Object.entries(s.audio)) {
    if (!a.checked) continue;
    const src = join(CONTENT, 'audio', a.file);
    if (!existsSync(src)) continue;
    const name = `${hash(readFileSync(src))}.mp3`;
    copyFileSync(src, join(audioDir, name));
    audio[reading] = `/audio/${name}`;
  }

  const entries = orderedEntries(s);
  const items = new Map<string, Item>(allItems(s).map((i) => [i.id, i]));
  const units = allUnits(s);
  const unitFiles: Record<string, string> = {};
  for (const u of units) {
    const content: UnitContent = {
      unit: u.id,
      items: entries.filter((e) => e.unit === u.id).map((e) => items.get(e.id)!),
    };
    const json = JSON.stringify(content);
    const name = `${u.id}.${hash(json)}.json`;
    writeFileSync(join(contentDir, name), json);
    unitFiles[u.id] = `/content/${name}`;
  }

  const index: Omit<ContentIndex, 'version'> = {
    units,
    items: entries,
    unitFiles,
    audio,
    confusables: s.confusables,
    varieties: s.varieties,
    functionWords: s.grammar.functionWords,
  };
  const body = JSON.stringify(index);
  writeFileSync(join(contentDir, 'index.json'), JSON.stringify({ version: hash(body), ...index }));
  return { units: units.length, items: entries.length, clips: Object.keys(audio).length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = buildContent();
  console.log(`Built content: ${r.items} items in ${r.units} beds, ${r.clips} audio clips.`);
}
