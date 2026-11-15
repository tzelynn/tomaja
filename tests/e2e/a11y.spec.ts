import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const route of ['/', '/#/catalogue', '/#/basket', '/#/settings', '/#/plant']) {
  test(`no axe violations on ${route}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(route);
    await page.waitForTimeout(1200);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}

test('a lesson can be done with the keyboard alone', async ({ page }) => {
  await page.goto('/');
  const plant = page.getByRole('button', { name: 'Plant your first seeds' });
  await expect(plant).toBeVisible();
  for (let i = 0; i < 6 && !(await plant.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(plant).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).focus();
  await page.keyboard.press('Enter');
  // Number keys pick an answer; Enter continues.
  const idx = await page.locator('[aria-label=Answers] button').evaluateAll((els) => els.findIndex((e) => e.hasAttribute('data-correct')));
  await page.keyboard.press(String(idx + 1));
  await expect(page.locator('[data-correct]')).toHaveClass(/right/);
});
