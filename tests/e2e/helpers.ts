import { expect, type Page } from '@playwright/test';

/** Plays through whatever lesson or review is on screen, answering correctly. */
export async function playSession(page: Page, opts: { wrongOnce?: boolean } = {}) {
  let wrong = !!opts.wrongOnce;
  const done = page.getByRole('heading', { name: /Seeds planted!|All watered!/ });
  const gotIt = page.getByRole('button', { name: 'Got it' });
  const correct = page.locator('[data-correct]:not(:disabled)');
  const cont = page.getByRole('button', { name: 'Continue' });
  const quick = { timeout: 1500 };
  for (let guard = 0; guard < 200; guard++) {
    await expect(gotIt.or(correct).or(cont).or(done).first()).toBeVisible();
    if (await done.isVisible()) return;
    // Correct answers move on by themselves; the screen may change under us, so clicks are best-effort.
    if (await gotIt.isVisible()) await gotIt.click(quick).catch(() => {});
    else if (await cont.isVisible()) await cont.click(quick).catch(() => {});
    else if (await correct.isVisible()) {
      if (wrong) {
        wrong = false;
        await page.locator('[aria-label=Answers] button:not([data-correct])').first().click(quick).catch(() => {});
      } else await correct.click(quick).catch(() => {});
      await page.waitForTimeout(1300);
    }
  }
  throw new Error('session did not finish');
}
