import { test, expect } from '@playwright/test';

test('homepage uses the server display, new authors and a shared short-lived request', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/participation', async route => {
    requests++;
    await route.fulfill({ json: { displayCount: '12.4k' } });
  });
  await page.goto('/');
  await expect(page.locator('.opening-participation')).toHaveText('目前 12.4k+ 人次完成测试');
  await expect(page.locator('.simple-footer > span')).toHaveText('十一不停/always0512/Utakata/Le Prince Grenouille');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const position = await page.evaluate(() => ({
    captionBottom: document.querySelector('.opening-participation').getBoundingClientRect().bottom,
    imageTop: document.querySelector('.opening-scene').getBoundingClientRect().top,
  }));
  expect(position.captionBottom).toBeLessThanOrEqual(position.imageTop);
  await page.evaluate(() => { location.hash = '/characters'; });
  await expect(page.locator('.simple-gallery')).toBeVisible();
  await page.locator('.gallery-back').click();
  await expect(page.locator('.opening-participation-number')).toHaveText('12.4k+');
  expect(requests).toBe(1);
});

test('homepage renders the server w suffix without recomputing it', async ({ page }) => {
  await page.route('**/api/participation', route => route.fulfill({ json: { displayCount: '10.0w' } }));
  await page.goto('/');
  await expect(page.locator('.opening-participation-number')).toHaveText('10.0w+');
});

for (const failure of ['unavailable', 'invalid']) {
  test(`homepage remains usable when participation display is ${failure}`, async ({ page }) => {
    await page.route('**/api/participation', route => route.fulfill(failure === 'unavailable'
      ? { status: 503, json: { error: 'Unavailable' } }
      : { json: { displayCount: '<img src=x onerror=alert(1)>' } }));
    const response = page.waitForResponse('**/api/participation');
    await page.goto('/');
    await response;
    await expect(page.locator('.opening-participation')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '测测我的主角人设', exact: true })).toBeVisible();
  });
}
