import { test, expect } from '@playwright/test';
import { questions, dimensions } from '../../src/data/questions.js';
import { reactionCaptions } from '../../src/data/reaction-captions.js';
import { STORAGE_KEY } from '../../src/engine.js';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/collect', route => route.fulfill({ json: { ok: true } }));
});

async function seed(page, id) {
  const selection = dimensions.flatMap(dimension => {
    const pool = questions.filter(question => question.dimension === dimension.id);
    const preferred = pool.find(question => question.id === id);
    return (preferred ? [preferred, ...pool.filter(question => question !== preferred)] : pool).slice(0, 2).map(question => question.id);
  });
  const ids = [id, ...selection.filter(value => value !== id)];
  await page.addInitScript(({ ids, key }) => {
    localStorage.setItem(key, JSON.stringify({ version: 5, questionIds: ids, answers: {}, index: 0, submitted: false }));
  }, { ids, key: STORAGE_KEY });
  await page.goto('/#/test');
}

for (const id of ['7.4', '8.1']) test(`all five captions follow reordered artwork for ${id}`, async ({ page }) => {
  await seed(page, id);
  const slider = page.getByRole('slider');
  const preview = page.getByRole('dialog', { name: '所选反应预览' });
  for (let group = 0; group < 5; group++) {
    await slider.press('Home');
    for (let count = 0; count < group * 3; count++) await slider.press('ArrowRight');
    await page.getByRole('button', { name: '看看我的这一幕', exact: true }).click();
    await expect(preview.locator('img')).toHaveAttribute('src', new RegExp(`${id.replace('.', '-')}/scale-${group}.webp`));
    await expect(preview.locator('figcaption')).toHaveText(reactionCaptions[id][group]);
    // The caption is outside the image: tapping it dismisses without advancing.
    await page.locator('.reaction-preview-caption').click({ force: true });
    await expect(preview).toHaveCount(0);
    await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  }
});

test('longest caption and image fit short portrait and landscape screens in both themes', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const longest = Object.entries(reactionCaptions).flatMap(([id, captions]) => captions.map((text, group) => ({ id, text, group })))
    .sort((a, b) => b.text.length - a.text.length)[0];
  await seed(page, longest.id);
  const slider = page.getByRole('slider');
  await slider.press('Home');
  for (let i = 0; i < longest.group * 3; i++) await slider.press('ArrowRight');
  for (const size of [{ width: 320, height: 568 }, { width: 852, height: 393 }]) {
    await page.setViewportSize(size);
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme });
      await page.getByRole('button', { name: '看看我的这一幕', exact: true }).click();
      const preview = page.getByRole('dialog', { name: '所选反应预览' });
      const image = preview.locator('img');
      const caption = preview.locator('figcaption');
      await image.evaluate(element => element.decode());
      await expect(caption).toHaveText(longest.text);
      const picture = await image.boundingBox();
      const description = await caption.boundingBox();
      expect(picture.x).toBeGreaterThanOrEqual(24);
      expect(picture.y).toBeGreaterThanOrEqual(24);
      expect(description.y).toBeGreaterThan(picture.y + picture.height);
      expect(description.y + description.height).toBeLessThanOrEqual(size.height - 24);
      expect(description.x + description.width).toBeLessThanOrEqual(size.width - 24);
      expect(await preview.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
      await expect(preview.locator('button,a,header,footer')).toHaveCount(0);
      await image.click();
      await expect(preview).toBeVisible();
      await page.screenshot({ path: `.work/caption-layout-${testInfo.project.name}-${size.width}-${colorScheme}.png` });
      await page.mouse.click(8, 8);
      await expect(preview).toHaveCount(0);
    }
  }
});
