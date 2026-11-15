// Writes content/audio/review.html: every clip not yet checked, with its reading and a player.
// Listen against the reading, then set "checked": true for the good ones in manifest.json
// (or run with --mark <reading> [<reading> …] to do that from the command line).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT, loadSource } from './content-lib';

const s = loadSource();
const dir = join(CONTENT, 'audio');
const markAt = process.argv.indexOf('--mark');
if (markAt > 0) {
  const readings = process.argv.slice(markAt + 1);
  for (const r of readings) {
    if (!s.audio[r]) throw new Error(`no clip for ${r}`);
    s.audio[r].checked = true;
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(s.audio, null, 2) + '\n');
  console.log(`Marked ${readings.length} clip(s) as checked.`);
} else {
  const rows = Object.entries(s.audio)
    .filter(([, a]) => !a.checked)
    .map(([r, a]) => `<tr><td lang="ja" style="font-size:2rem">${r}</td><td><audio controls preload="none" src="${a.file}"></audio></td><td><code>${r}</code></td></tr>`)
    .join('\n');
  writeFileSync(
    join(dir, 'review.html'),
    `<!doctype html><meta charset="utf-8"><title>tomaja audio review</title><body style="font-family:sans-serif"><h1>Unchecked clips</h1><p>Mark good ones with: <code>tsx scripts/review-audio.ts --mark あ い …</code></p><table>${rows}</table>`,
  );
  console.log(`Wrote ${join(dir, 'review.html')} (${rows ? rows.split('\n').length : 0} unchecked clips).`);
}
