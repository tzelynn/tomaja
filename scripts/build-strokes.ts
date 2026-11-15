// KanjiVG → public/strokes/<codepoint>.json (only characters used in content).
// Downloads a pinned release into a git-ignored cache once; later builds work offline.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadSource, ROOT } from './content-lib';

export const KANJIVG_VERSION = 'r20260714';
const URL = `https://github.com/KanjiVG/kanjivg/releases/download/${KANJIVG_VERSION}/kanjivg-${KANJIVG_VERSION.slice(1)}.xml.gz`;
const CACHE = join(ROOT, '.cache');
const FILE = join(CACHE, `kanjivg-${KANJIVG_VERSION}.xml.gz`);

async function ensureDownloaded(): Promise<Buffer> {
  if (!existsSync(FILE)) {
    mkdirSync(CACHE, { recursive: true });
    console.log(`Downloading KanjiVG ${KANJIVG_VERSION}…`);
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`KanjiVG download failed: ${res.status}`);
    writeFileSync(FILE, Buffer.from(await res.arrayBuffer()));
  }
  return gunzipSync(readFileSync(FILE));
}

/** Every character that appears in content and may be shown with stroke order. */
function charactersInContent(): Set<string> {
  const s = loadSource();
  const chars = new Set<string>();
  for (const k of [...s.hira, ...s.kata]) for (const c of k.char) chars.add(c);
  return chars;
}

export async function buildStrokes(): Promise<{ written: number; missing: string[] }> {
  const xml = (await ensureDownloaded()).toString('utf8');
  const wanted = charactersInContent();
  const out = join(ROOT, 'public', 'strokes');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const missing: string[] = [];
  let written = 0;
  for (const ch of wanted) {
    const hex = ch.codePointAt(0)!.toString(16).padStart(5, '0');
    const start = xml.indexOf(`<kanji id="kvg:kanji_${hex}">`);
    if (start < 0) {
      if (!/[ー]/.test(ch)) missing.push(ch);
      continue;
    }
    const end = xml.indexOf('</kanji>', start);
    const block = xml.slice(start, end);
    const paths = [...block.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
    writeFileSync(join(out, `${hex}.json`), JSON.stringify(paths));
    written++;
  }
  return { written, missing };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await buildStrokes();
  console.log(`Stroke files: ${r.written}${r.missing.length ? `; no KanjiVG data for ${r.missing.join(' ')}` : ''}`);
}
