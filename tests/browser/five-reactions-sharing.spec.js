import { test, expect } from '@playwright/test';
import { questions, dimensions } from '../../src/data/questions.js';
import { questionReactions } from '../../src/data/question-reactions.js';
import { STORAGE_KEY } from '../../src/engine.js';

const ids = dimensions.flatMap(d => questions.filter(q => q.dimension === d.id).slice(0, 2).map(q => q.id));
const labels = ['更接近左侧', '偏左', '中立', '偏右', '更接近右侧'];

test('each degree shows its own concrete reaction, survives reload and resets for next question', async ({ page }, testInfo) => {
  await page.addInitScript(({ key, ids }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 4, questionIds: ids, answers: {}, index: 0, submitted: false }));
  }, { key: STORAGE_KEY, ids });
  await page.goto('/#/test');
  await expect(page.locator('.illustrated-choice p,.answer-reaction-caption,.answer-scale-instruction')).toHaveCount(0);
  const image = page.locator('.question-scene img');
  await expect(image).toHaveAttribute('src', /1-1\/scene.webp/);
  for (let value = 0; value < 5; value++) {
    await page.getByRole('button', { name: labels[value], exact: true }).click();
    await expect(image).toHaveAttribute('src', new RegExp(`1-1/scale-${value}.webp`));
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth >= 1000)).toBe(true);
    await expect(image).toHaveAttribute('alt', `你的反应：${questionReactions['1.1'][value].caption}`);
    await expect(page.locator('.question-content')).not.toContainText(questionReactions['1.1'][value].caption);
    await expect(page.getByRole('button', { name: '下一幕', exact: true })).toBeInViewport();
  }
  await page.reload();
  await expect(image).toHaveAttribute('src', /scale-4.webp/);
  await page.getByRole('button', { name: '下一幕', exact: true }).click();
  await expect(image).toHaveAttribute('src', /scene.webp/);
  await expect(page.locator('.answer-reaction-caption')).toHaveCount(0);
  await page.getByRole('button', { name: '上一题', exact: true }).click();
  await expect(image).toHaveAttribute('src', /1-1\/scale-4.webp/);
  await page.route('**/1-1/scale-1.webp*', route => route.abort());
  await page.getByRole('button', { name: '偏左', exact: true }).click();
  await expect(page.locator('.question-scene .question-art-fallback')).toBeVisible();
  await page.getByRole('button', { name: '中立', exact: true }).click();
  await expect(image).toHaveAttribute('src', /scale-2.webp/);
  await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  const enlarge = page.getByRole('button', { name: '放大当前画面' });
  await enlarge.click();
  const dialog = page.getByRole('dialog', { name: '查看画面' });
  await expect(dialog.locator('img')).toHaveAttribute('src', /1-1\/scale-2.webp/);
  await expect.poll(() => dialog.locator('img').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('a');
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(page.locator('.answer-scale-track')).toHaveAttribute('aria-valuenow', '2');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(enlarge).toBeFocused();
  await page.screenshot({ path: `.work/five-reactions-${testInfo.project.name}.png`, fullPage: true });
});

test('Moments offers an actual downloadable card and native image sharing', async ({ page }) => {
  await page.addInitScript(() => {
    window.shared = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      window.shared.push({ url: data.url, text: data.text, files: data.files?.map(file => ({ name: file.name, type: file.type, size: file.size })) });
    } });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => Boolean(data.files?.length) });
  });
  await page.goto('/#/role/plot-rewriter');
  await page.getByRole('button', { name: '分享剧本', exact: true }).last().click();
  const invitation = await page.getByRole('textbox', { name: '角色分享邀请' }).inputValue();
  await page.getByRole('button', { name: '朋友圈', exact: true }).click();
  await expect(page.getByAltText(/的朋友圈分享卡$/)).toBeVisible();
  await expect(page.getByRole('link', { name: '保存分享卡' })).toHaveAttribute('href', /^blob:/);
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: '保存分享卡' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
  await page.getByRole('button', { name: '分享图片', exact: true }).click();
  const shared = await page.evaluate(() => window.shared);
  expect(shared).toHaveLength(1);
  expect(shared[0].files[0].type).toBe('image/png');
  expect(shared[0].files[0].size).toBeGreaterThan(1000);
  expect(invitation).toContain(shared[0].url);
  await page.screenshot({ path: '.work/share-moments.png' });
});

test('unavailable sharing and clipboard keep a usable invitation and WeChat instructions', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } }, configurable: true });
    Object.defineProperty(navigator, 'userAgent', { value: 'MicroMessenger', configurable: true });
  });
  await page.goto('/#/role/plot-rewriter');
  await page.getByRole('button', { name: '分享剧本', exact: true }).first().click();
  await page.getByRole('button', { name: '微信好友', exact: true }).click();
  await expect(page.locator('.share-status')).toContainText('右上角');
  await page.getByRole('button', { name: '朋友圈', exact: true }).click();
  await expect(page.locator('.share-status')).toContainText('保存角色卡');
  await page.getByRole('button', { name: '复制剧本邀请', exact: true }).click();
  await expect(page.locator('.share-status')).toContainText('手动复制');
  const input = page.getByRole('textbox', { name: '角色分享邀请' });
  await expect(input).toBeFocused();
  expect(await input.evaluate(el => el.selectionEnd - el.selectionStart)).toBe((await input.inputValue()).length);
  await page.getByRole('button', { name: '更多分享方式', exact: true }).click();
  await expect(input).toHaveValue(/#\/role\/plot-rewriter/);
});
