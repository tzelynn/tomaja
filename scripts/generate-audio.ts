// Run by hand, never in the build (plan §7.3). Finds readings with no clip, generates them with a
// locally running VOICEVOX engine, converts to MP3 with ffmpeg, and adds them to the manifest with
// checked: false. A person then listens (tsx scripts/review-audio.ts) and marks each one checked.
//
//   1. Start VOICEVOX (app or engine; default http://localhost:50021).
//   2. tsx scripts/generate-audio.ts [--speaker 2] [--limit 46] [--only-kana]
//   3. tsx scripts/review-audio.ts   → open the page it writes, listen, then set "checked": true.
//
// Licence: check the chosen VOICEVOX character's terms allow redistributing the clips from a
// public site, and add the required credit (e.g. "VOICEVOX:<character>") to the credits page.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allReadings, CONTENT, loadSource, type AudioEntry } from './content-lib';

const ENGINE = process.env.VOICEVOX_URL ?? 'http://localhost:50021';
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const SPEAKER = Number(arg('speaker') ?? 2);
const LIMIT = Number(arg('limit') ?? Infinity);
const ONLY_KANA = process.argv.includes('--only-kana');

function fileName(reading: string): string {
  return `${[...reading].map((c) => c.codePointAt(0)!.toString(16)).join('-')}.mp3`;
}

async function synth(text: string): Promise<Buffer> {
  const q = await fetch(`${ENGINE}/audio_query?speaker=${SPEAKER}&text=${encodeURIComponent(text)}`, { method: 'POST' });
  if (!q.ok) throw new Error(`audio_query failed for ${text}: ${q.status}`);
  const query = (await q.json()) as Record<string, unknown>;
  // Slightly slower, short silences: clearer for learners and smaller files.
  Object.assign(query, { speedScale: 0.9, prePhonemeLength: 0.05, postPhonemeLength: 0.1, outputStereo: false });
  const s = await fetch(`${ENGINE}/synthesis?speaker=${SPEAKER}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!s.ok) throw new Error(`synthesis failed for ${text}: ${s.status}`);
  return Buffer.from(await s.arrayBuffer());
}

async function main() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    throw new Error('ffmpeg is required (brew install ffmpeg).');
  }
  const s = loadSource();
  const manifest: Record<string, AudioEntry> = { ...s.audio };
  const dir = join(CONTENT, 'audio');
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, '.tmp.wav');
  let todo = allReadings(s).filter((r) => !manifest[r]);
  if (ONLY_KANA) todo = todo.filter((r) => [...r].length <= 2);
  todo = todo.slice(0, LIMIT);
  console.log(`${todo.length} reading(s) to generate with VOICEVOX speaker ${SPEAKER}.`);
  for (const reading of todo) {
    writeFileSync(tmp, await synth(reading));
    const file = fileName(reading);
    // Mono, ~48 kbps, silence trimmed at both ends, loudness normalised.
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', tmp,
      '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-16:TP=-1.5',
      '-ac', '1', '-ar', '24000', '-b:a', '48k', join(dir, file),
    ]);
    manifest[reading] = { file, source: `voicevox:${SPEAKER}`, checked: false };
    process.stdout.write('.');
  }
  if (existsSync(tmp)) rmSync(tmp);
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b, 'ja')));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(sorted, null, 2) + '\n');
  console.log(`\nDone. Listen to each new clip (tsx scripts/review-audio.ts) and set "checked": true.`);
}

await main();
