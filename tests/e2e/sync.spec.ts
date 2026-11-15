import { expect, test, type Page } from '@playwright/test';
import { playSession } from './helpers';

const CODE = 'local test garden code'; // matches .dev.vars

async function openSettingsForm(page: Page, which: 'Start a new garden' | 'Open an existing garden', name: string, code = CODE) {
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('button', { name: which }).click();
  await page.getByLabel('Garden name').fill(name);
  await page.getByLabel('Secret code').fill(code);
  await page.getByRole('button', { name: /Create garden|Open garden/ }).click();
}

async function plantOnce(page: Page) {
  await page.getByRole('link', { name: 'Garden' }).click();
  await page.getByRole('button', { name: /Plant/ }).first().click();
  await playSession(page);
  await page.getByRole('button', { name: /Back to the garden/ }).click();
}

test('a garden cannot be created without the secret code', async ({ page }) => {
  await page.goto('/');
  await openSettingsForm(page, 'Start a new garden', `nope-${Date.now() % 1e6}`, 'wrong code');
  await expect(page.getByRole('alert')).toContainText('secret code');
});

test('two devices converge after studying offline', async ({ browser }) => {
  const name = `e2e-${Date.now().toString(36)}`;
  const a = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const b = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

  await a.goto('/');
  await plantOnce(a); // あ row as a guest
  await openSettingsForm(a, 'Start a new garden', name);
  await expect(a.getByText(`Garden name: ${name}`)).toBeVisible();
  await expect(a.getByText('Synced just now')).toBeVisible();

  await b.goto('/');
  await openSettingsForm(b, 'Open an existing garden', name);
  await expect(b.getByText(/Merged your garden: 5 plants/)).toBeVisible();

  // Both study offline.
  await a.context().setOffline(true);
  await b.context().setOffline(true);
  await plantOnce(a); // か row
  await plantOnce(b); // also か row on B (the later review wins per item)
  await a.context().setOffline(false);
  await b.context().setOffline(false);

  for (const p of [a, b, a]) {
    await p.getByRole('link', { name: 'Settings' }).click();
    await p.getByRole('button', { name: 'Sync now' }).click();
    await expect(p.getByText('Synced just now')).toBeVisible();
  }
  for (const p of [a, b]) {
    await p.getByRole('link', { name: 'Garden' }).click();
    await expect(p.getByRole('heading', { name: /Hiragana 10\/46/ })).toBeVisible();
  }

  // Deleting the garden frees the server rows; the device keeps its copy.
  await a.getByRole('link', { name: 'Settings' }).click();
  await a.getByRole('button', { name: 'Delete synced garden…' }).click();
  await a.getByRole('button', { name: 'Delete garden' }).click();
  await expect(a.getByRole('button', { name: 'Start a new garden' })).toBeVisible();
});
