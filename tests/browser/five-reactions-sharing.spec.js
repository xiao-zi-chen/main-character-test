import { test, expect } from '@playwright/test';
import { questions, dimensions } from '../../src/data/questions.js';
import { questionReactions } from '../../src/data/question-reactions.js';
import { STORAGE_KEY } from '../../src/engine.js';
import { confirmAnswer, finishReactionPreview, navigateQuestion } from './quiz-helpers.js';
import { readFile } from 'node:fs/promises';

const ids = dimensions.flatMap(d => questions.filter(q => q.dimension === d.id).slice(0, 2).map(q => q.id));
const labels = ['更接近左侧', '偏左', '中立', '偏右', '更接近右侧'];
const runSnapshot = page => page.evaluate(() => {
  const state = window.NBTICollector.snapshot();
  return state.runs.find(run => run.session.id === state.activeSessionId);
});
const previewFor = page => page.getByRole('dialog', { name: '所选反应预览', exact: true });
const openPreview = page => page.getByRole('button', { name: '看看我的这一幕', exact: true }).click();

test.beforeEach(async ({ page }) => {
  await page.route('**/api/collect', route => route.fulfill({ json: { ok: true } }));
});

test('each selected reaction opens only on request; viewing, reload and back preserve the draft', async ({ page }, testInfo) => {
  await page.addInitScript(({ key, ids }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 5, questionIds: ids, answers: {}, index: 0, submitted: false }));
  }, { key: STORAGE_KEY, ids });
  await page.goto('/#/test');
  await expect(page.getByRole('button', { name: '看看我的这一幕', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '上一题', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '下一题', exact: true })).toBeDisabled();
  const image = page.locator('.question-scene img');
  const preview = previewFor(page);
  for (let value = 0; value < 5; value++) {
    await page.getByRole('button', { name: labels[value], exact: true }).click();
    await expect(image).toHaveAttribute('src', /1-1\/scene.webp/);
    await expect(preview).toHaveCount(0);
    await openPreview(page);
    await expect(preview.locator('img')).toHaveAttribute('src', new RegExp(`1-1/scale-${value}.webp`));
    await expect(preview.locator('img')).toHaveAttribute('alt', `你的反应：${questionReactions['1.1'][value].caption}`);
    await expect.poll(() => preview.locator('img').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
    await finishReactionPreview(page);
    await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
    expect((await runSnapshot(page)).answers).toHaveLength(0);
  }
  await page.reload();
  await expect(preview).toHaveCount(0);
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '14');
  await confirmAnswer(page);
  await expect(preview).toHaveCount(0);
  await navigateQuestion(page, 'previous');
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '14');
  await page.getByRole('button', { name: '中立', exact: true }).click();
  const enlarge = page.getByRole('button', { name: '放大当前画面' });
  await enlarge.click();
  const dialog = page.getByRole('dialog', { name: '查看画面' });
  await expect(dialog.locator('img')).toHaveAttribute('src', /1-1\/scene.webp/);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('a');
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(page.locator('.answer-scale-track')).toHaveAttribute('aria-valuenow', '7');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(enlarge).toBeFocused();
  await page.screenshot({ path: `.work/manual-reactions-${testInfo.project.name}.png`, fullPage: true });
});

test('preview never auto-advances or submits; viewing time is paused and next commits once', async ({ page }) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/#/test');
  await page.getByRole('slider').press('End');
  await openPreview(page);
  const preview = previewFor(page);
  const before = await runSnapshot(page);
  expect(before.answers).toHaveLength(0);
  await page.keyboard.press('a');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.clock.runFor(20000);
  await expect(preview).toBeVisible();
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(page.locator('.answer-scale-track')).toHaveAttribute('aria-valuenow', '14');
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(page.getByRole('button', { name: '看看我的这一幕', exact: true })).toBeFocused();
  const afterView = await runSnapshot(page);
  expect(afterView.answers).toHaveLength(0);
  expect(afterView.activeElapsedMs - before.activeElapsedMs).toBeLessThan(300);
  await confirmAnswer(page);
  const after = await runSnapshot(page);
  expect(after.answers).toHaveLength(1);
  expect(after.answers[0].scaleValue).toBe(14);
  expect(after.answers[0].responseTimeMs).toBeLessThan(10000);
  await expect(preview).toHaveCount(0);
  await expect(page.getByRole('slider')).toHaveAttribute('data-selected', 'false');
});

test('pure image keeps native long press and visible backdrop space; outside click only closes', async ({ page }, testInfo) => {
  await page.goto('/#/test');
  await page.getByRole('slider').press('End');
  await openPreview(page);
  const preview = previewFor(page);
  const image = preview.locator('img');
  await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(preview.locator('button,a,header,footer')).toHaveCount(0);
  expect((await preview.innerText()).trim()).toBe('');
  const bounds = await image.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds.x).toBeGreaterThanOrEqual(24);
  expect(bounds.y).toBeGreaterThanOrEqual(24);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - 24);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - 24);
  expect(await image.evaluate(element => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(true);
  await image.click();
  await expect(preview).toBeVisible();
  await page.screenshot({ path: `.work/reaction-image-only-${testInfo.project.name}.png` });
  await finishReactionPreview(page);
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  expect((await runSnapshot(page)).answers).toHaveLength(0);
});

test('dragging out from an image does not dismiss; backdrop tap and Escape do', async ({ page }) => {
  await page.goto('/#/test');
  await page.getByRole('slider').press('Home');
  await openPreview(page);
  const preview = previewFor(page);
  await preview.locator('img').dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0 });
  await preview.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', button: 0 });
  await preview.dispatchEvent('click', { clientX: 2, clientY: 2 });
  await expect(preview).toBeVisible();
  await finishReactionPreview(page);
  await openPreview(page);
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
});

test('reloading an optional preview restores the draft without saving or reopening it', async ({ page }) => {
  await page.goto('/#/test');
  await page.getByRole('slider').press('End');
  await openPreview(page);
  await expect(previewFor(page)).toBeVisible();
  await page.reload();
  await expect(previewFor(page)).toHaveCount(0);
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '14');
  expect((await runSnapshot(page)).answers).toHaveLength(0);
  await confirmAnswer(page);
  expect((await runSnapshot(page)).answers).toHaveLength(1);
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
  await page.getByRole('button', { name: '保存角色卡', exact: true }).click();
  await expect(page.getByAltText(/的朋友圈分享卡$/)).toBeVisible();
  await expect(page.getByRole('link', { name: '下载角色卡' })).toHaveAttribute('href', /^blob:/);
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载角色卡' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
  await page.getByRole('button', { name: '分享图片', exact: true }).click();
  const shared = await page.evaluate(() => window.shared);
  expect(shared).toHaveLength(1);
  expect(shared[0].files[0].type).toBe('image/png');
  expect(shared[0].files[0].size).toBeGreaterThan(1000);
  expect(shared[0].url).toBeUndefined();
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
  await page.getByRole('button', { name: '微信分享指引', exact: true }).click();
  await expect(page.locator('.wechat-share-guide')).toContainText('右上角');
  await page.getByRole('button', { name: '保存角色卡', exact: true }).click();
  await page.getByText('复制链接与文案', { exact: true }).click();
  await page.getByRole('button', { name: '复制剧本邀请', exact: true }).click();
  await expect(page.locator('.share-status')).toContainText('手动复制');
  const input = page.getByRole('textbox', { name: '角色分享邀请' });
  await expect(input).toBeFocused();
  expect(await input.evaluate(el => el.selectionEnd - el.selectionStart)).toBe((await input.inputValue()).length);
  await expect(input).toHaveValue(/#\/role\/plot-rewriter/);
});
