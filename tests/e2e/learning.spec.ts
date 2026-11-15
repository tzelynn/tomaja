import { expect, test } from '@playwright/test';
import { playSession } from './helpers';

const T0 = new Date('2026-11-16T09:00:00');

test('first lesson within two taps, progress persists, reviews come due', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', (r) => r.url().includes('/api/') && apiCalls.push(r.url()));
  await page.clock.install({ time: T0 });
  await page.goto('/');

  // Tap 1 starts the first lesson.
  await page.getByRole('button', { name: 'Plant your first seeds' }).click();
  await expect(page.getByText('New hiragana')).toBeVisible();
  await expect(page.locator('h2[lang=ja]')).toHaveText('あ');

  await playSession(page, { wrongOnce: true });
  await expect(page.getByText(/\+\d+ tomatoes/)).toBeVisible();
  await page.getByRole('button', { name: /Back to the garden/ }).click();

  // Reload: the plants are still there.
  await page.reload();
  await expect(page.getByRole('heading', { name: /Hiragana 5\/46/ })).toBeVisible();
  await expect(page.getByLabel(/\d+ tomatoes/)).toBeVisible();

  // A week later the plants are thirsty and can be watered.
  await page.clock.setSystemTime(new Date(T0.getTime() + 7 * 86_400_000));
  await page.reload();
  await page.getByRole('button', { name: /Water \d+ plants?/ }).click();
  await playSession(page);
  await expect(page.getByText(/remembered/)).toBeVisible();

  // Studying as a guest never touches the API (spec §10.6).
  expect(apiCalls).toEqual([]);
});

test('every screen renders and the catalogue opens details', async ({ page }) => {
  await page.goto('/');
  for (const tab of ['Catalogue', 'Basket', 'Settings', 'Garden']) {
    await page.getByRole('link', { name: tab }).click();
  }
  await page.getByRole('link', { name: 'Catalogue' }).click();
  await page.getByRole('gridcell', { name: /^あ a/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Plant label')).toBeVisible();
});
