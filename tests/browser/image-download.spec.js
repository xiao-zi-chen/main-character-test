import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const image = await readFile(new URL('../../public/question-art/1-1/scene.webp', import.meta.url));
const cdn = 'https://images.nbti-test.invalid/';

async function prepare(page, { failFetch = () => false } = {}) {
  // This suite must never submit test answers to any real collector.
  await page.route('**/api/collect', route => route.fulfill({ json: { ok: true } }));
  await page.route('**/public-config.js', route => route.fulfill({ contentType: 'application/javascript', body: `window.NBTI_PUBLIC_CONFIG={mediaBaseUrl:${JSON.stringify(cdn)}};` }));
  await page.route(`${cdn}**`, route => {
    if (route.request().resourceType() === 'fetch' && failFetch()) return route.abort('failed');
    return route.fulfill({ body: image, contentType: 'image/webp', headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.goto('/#/test');
  await expect(page.getByRole('slider')).toBeVisible();
}

async function saveImage(page, container) {
  const received = page.waitForEvent('download');
  await container.getByRole('button', { name: '保存图片', exact: true }).click();
  const download = await received;
  expect(download.suggestedFilename()).toMatch(/^NBTI-\d+\.\d+-(scene|scale-\d)\.webp$/);
  expect(await readFile(await download.path())).toEqual(image);
}

test('zoomed question image downloads from CDN without navigating away', async ({ page }) => {
  await prepare(page);
  await page.getByRole('button', { name: '放大当前画面', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '查看画面', exact: true });
  await expect(modal.locator('img')).toHaveAttribute('src', /^https:\/\/images\.nbti-test\.invalid\/question-art\//);
  const url = page.url();
  await saveImage(page, modal);
  await expect(modal).toBeVisible();
  expect(page.url()).toBe(url);
});

test('reaction image download pauses dismissal and still permits outside dismissal', async ({ page }) => {
  await prepare(page);
  await page.getByRole('slider').press('End');
  await page.getByRole('button', { name: '下一幕', exact: true }).click();
  const preview = page.getByRole('region', { name: '所选反应预览' });
  await expect(preview).toBeVisible();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await saveImage(page, preview);
  await page.clock.runFor(11000);
  await expect(preview).toBeVisible();
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await page.mouse.click(2, 2);
  await expect(preview).toHaveCount(0);
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
});

test('blocked CDN download reports failure, preserves long-press and can retry', async ({ page }) => {
  let fail = true;
  await prepare(page, { failFetch: () => fail });
  await page.getByRole('button', { name: '放大当前画面', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '查看画面', exact: true });
  const url = page.url();
  await modal.getByRole('button', { name: '保存图片', exact: true }).click();
  await expect(modal.getByRole('alert')).toHaveText('图片下载失败，请重试或长按图片保存。');
  expect(page.url()).toBe(url);
  expect(await modal.locator('img').evaluate(element => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(true);
  await expect(modal).toBeVisible();
  fail = false;
  await saveImage(page, modal);
  await expect(modal.getByRole('alert')).toHaveCount(0);
});
