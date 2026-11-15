// Renders public/icon.svg to the PNG sizes the PWA manifest needs. Run by hand: tsx scripts/make-icons.ts
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './content-lib';

const svg = readFileSync(join(ROOT, 'public', 'icon.svg'), 'utf8');
const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: join(ROOT, 'public', `icon-${size}.png`), omitBackground: false });
  await page.close();
}
await browser.close();
console.log('Icons written.');
