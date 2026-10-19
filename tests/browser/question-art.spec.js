import { test, expect } from '@playwright/test';
import { questions, dimensions } from '../../src/data/questions.js';
import { questionCopy } from '../../src/data/question-copy.js';
import { STORAGE_KEY } from '../../src/engine.js';

const ids = dimensions.flatMap(d => questions.filter(q => q.dimension === d.id).slice(0, 2).map(q => q.id));

test('all forty questions have eight distinct decodable images', async ({ page }) => {
  await page.goto('/');
  const assets = await page.evaluate(async ids => {
    return Promise.all(ids.map(async id => {
      const sources = ['scene', 'left', 'right', 'scale-0', 'scale-1', 'scale-2', 'scale-3', 'scale-4'].map(kind => `/question-art/${id.replace('.', '-')}/${kind}.webp`);
      const images = await Promise.all(sources.map(src => new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve({ src, width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => resolve({ src, width: 0, height: 0 });
        image.src = src;
      })));
      return { id, images };
    }));
  }, questions.map(q => q.id));
  expect(assets).toHaveLength(40);
  for (const asset of assets) {
    expect(new Set(asset.images.map(image => image.src)).size).toBe(8);
    for (const image of asset.images) {
      expect(image.width, image.src).toBeGreaterThanOrEqual(1000);
      expect(image.height, image.src).toBeGreaterThanOrEqual(500);
    }
  }
});

test('illustrated choices save the correct endpoints and a failed image leaves both choices usable', async ({ page }) => {
  const questionIds = ['9.1', ...ids.filter(id => id !== '9.1')];
  await page.addInitScript(({ key, questionIds }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 4, questionIds, answers: {}, index: 0, submitted: false }));
  }, { key: STORAGE_KEY, questionIds });
  await page.goto('/#/test');
  await expect(page.locator('.question-art img')).toHaveCount(3);
  const manifest = await (await page.request.get('/question-art/manifest.json')).json();
  const displayed = await page.locator('.question-art img').evaluateAll(images => images.map(image => image.src));
  for (const src of displayed) expect(new URL(src).searchParams.get('v')).toBe(manifest.revision);
  const left = page.getByRole('button', { name: `左侧反应：${questionCopy['9.1'].options[0]}`, exact: true });
  const right = page.getByRole('button', { name: `右侧反应：${questionCopy['9.1'].options[1]}`, exact: true });
  await left.locator('img').click();
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '0');
  await right.locator('img').click();
  await expect(right).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '4');
  await page.route('**/question-art/9-1/*.webp*', route => route.abort());
  await page.reload();
  await expect(page.locator('.question-art-fallback')).toHaveCount(3);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(questionCopy['9.1'].prompt);
  await expect(right).toHaveAttribute('aria-pressed', 'true');
  await left.click();
  await page.getByRole('button', { name: '下一幕', exact: true }).click();
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
});

test('finishing automatically shows the matched film; blocked autoplay resumes by touching the film', async ({ page }) => {
  await page.addInitScript(({ key, ids }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 4, questionIds: ids, answers: {}, index: 0, submitted: false }));
    const play = HTMLMediaElement.prototype.play;
    document.addEventListener('play', event => {
      if (!window.allowVideoPlay && event.target instanceof HTMLMediaElement) event.target.pause();
    }, true);
    HTMLMediaElement.prototype.play = function () {
      if (!window.allowVideoPlay) return Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
      return play.call(this);
    };
  }, { key: STORAGE_KEY, ids });
  await page.goto('/#/test');
  for (let index = 0; index < ids.length - 1; index++) {
    await page.getByRole('slider').press('Home');
    await page.getByRole('button', { name: '下一幕', exact: true }).click();
  }
  await page.getByRole('slider').press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '揭晓我的主角', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const roleName = await page.locator('.result-copy h1').innerText();
  await expect(dialog).toHaveAttribute('aria-label',roleName+'的短片');
  expect(await page.locator('.result-copy h1').innerText()).toBe(roleName);
  await expect(dialog.locator('button')).toHaveCount(1);
  await page.evaluate(() => { window.allowVideoPlay = true; });
  await dialog.locator('video').click();
  await expect.poll(() => dialog.locator('video').evaluate(video => !video.paused && video.currentTime > 0)).toBe(true);
  await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(roleName);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
