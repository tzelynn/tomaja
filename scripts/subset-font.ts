// M PLUS Rounded 1c → public/fonts/tomaja.woff2, subset to Latin + every character in content and UI.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import subsetFont from 'subset-font';
import { CONTENT, ROOT } from './content-lib';

const FONT_VERSION = 'google/fonts@main';
const WEIGHTS = { 500: 'Medium', 800: 'ExtraBold' } as const;
const CACHE = join(ROOT, '.cache');

async function download(style: string): Promise<Buffer> {
  const file = join(CACHE, `MPLUSRounded1c-${style}.ttf`);
  if (!existsSync(file)) {
    mkdirSync(CACHE, { recursive: true });
    const url = `https://github.com/google/fonts/raw/main/ofl/mplusrounded1c/MPLUSRounded1c-${style}.ttf`;
    console.log(`Downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`font download failed: ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(file);
}

function collectText(): string {
  const chars = new Set<string>();
  // Printable ASCII + a few typographic marks used in the UI.
  for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
  for (const c of '’‘“”…—–·×✓？。、「」') chars.add(c);
  const add = (s: string) => {
    for (const c of s) if (c.codePointAt(0)! > 0x7f) chars.add(c);
  };
  for (const f of readdirSync(CONTENT).filter((f) => f.endsWith('.json'))) add(readFileSync(join(CONTENT, f), 'utf8'));
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(svelte|ts)$/.test(e.name)) add(readFileSync(p, 'utf8'));
    }
  };
  walk(join(ROOT, 'src', 'app'));
  return [...chars].join('');
}

export async function buildFont() {
  const text = collectText();
  const out = join(ROOT, 'public', 'fonts');
  mkdirSync(out, { recursive: true });
  const sizes: Record<string, number> = {};
  for (const [weight, style] of Object.entries(WEIGHTS)) {
    const woff2 = await subsetFont(await download(style), text, { targetFormat: 'woff2' });
    const name = weight === '500' ? 'tomaja.woff2' : `tomaja-${weight}.woff2`;
    writeFileSync(join(out, name), woff2);
    sizes[name] = woff2.length;
  }
  return { glyphs: [...text].length, sizes, source: FONT_VERSION };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await buildFont();
  console.log(`Font subset: ${r.glyphs} characters; ${Object.entries(r.sizes).map(([k, v]) => `${k} ${(v / 1024).toFixed(1)} KB`).join(', ')}`);
}
