import { test, expect } from '@playwright/test';
import { questions, dimensions } from '../../src/data/questions.js';
import { questionReactions } from '../../src/data/question-reactions.js';
import { STORAGE_KEY } from '../../src/engine.js';
import { confirmAnswer, finishReactionPreview } from './quiz-helpers.js';
import { readFile } from 'node:fs/promises';

const ids = dimensions.flatMap(d => questions.filter(q => q.dimension === d.id).slice(0, 2).map(q => q.id));
const labels = ['更接近左侧', '偏左', '中立', '偏右', '更接近右侧'];

test('selection keeps the scene; Next alone shows the chosen reaction, including after reload and Back', async ({ page }, testInfo) => {
  await page.addInitScript(({ key, ids }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 5, questionIds: ids, answers: {}, index: 0, submitted: false }));
  }, { key: STORAGE_KEY, ids });
  await page.goto('/#/test');
  await expect(page.locator('.answer-option-text')).toHaveCount(2);
  await expect(page.locator('.answer-reaction-caption,.answer-scale-instruction')).toHaveCount(0);
  const image = page.locator('.question-scene img');
  await expect(image).toHaveAttribute('src', /1-1\/scene.webp/);
  const preview = page.getByRole('region', { name: '所选反应预览' });
  for (let value = 0; value < 5; value++) {
    await page.getByRole('button', { name: labels[value], exact: true }).click();
    await expect(image).toHaveAttribute('src', /1-1\/scene.webp/);
    await expect(preview).toHaveCount(0);
    await page.getByRole('button', { name: '下一幕', exact: true }).click();
    await expect(preview).toBeVisible();
    await expect(preview.locator('img')).toHaveAttribute('src', new RegExp(`1-1/scale-${value}.webp`));
    await expect(preview.locator('img')).toHaveAttribute('alt', `你的反应：${questionReactions['1.1'][value].caption}`);
    await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
    await finishReactionPreview(page);
    await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
    await page.getByRole('button', { name: '上一题', exact: true }).click();
    await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
    await expect(image).toHaveAttribute('src', /1-1\/scene.webp/);
  }
  await page.reload();
  await expect(preview).toHaveCount(0);
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '14');
  await expect(image).toHaveAttribute('src', /1-1\/scene.webp/);
  await confirmAnswer(page);
  await expect(image).toHaveAttribute('src', /scene.webp/);
  await expect(page.locator('.answer-reaction-caption')).toHaveCount(0);
  await page.getByRole('button', { name: '上一题', exact: true }).click();
  await expect(image).toHaveAttribute('src', /1-1\/scene.webp/);
  await page.route('**/1-1/scale-1.webp*', route => route.abort());
  await page.getByRole('button', { name: '偏左', exact: true }).click();
  await expect(image).toHaveAttribute('src', /1-1\/scene.webp/);
  await expect(preview).toHaveCount(0);
  await page.getByRole('button', { name: '下一幕', exact: true }).click();
  await expect(preview.locator('.question-art-fallback')).toBeVisible();
  await finishReactionPreview(page);
  await page.getByRole('button', { name: '上一题', exact: true }).click();
  await page.getByRole('button', { name: '中立', exact: true }).click();
  await expect(image).toHaveAttribute('src', /1-1\/scene.webp/);
  await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  const enlarge = page.getByRole('button', { name: '放大当前画面' });
  await enlarge.click();
  const dialog = page.getByRole('dialog', { name: '查看画面' });
  await expect(dialog.locator('img')).toHaveAttribute('src', /1-1\/scene.webp/);
  await expect.poll(() => dialog.locator('img').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('a');
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(page.locator('.answer-scale-track')).toHaveAttribute('aria-valuenow', '7');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(enlarge).toBeFocused();
  await page.screenshot({ path: `.work/five-reactions-${testInfo.project.name}.png`, fullPage: true });
});

test('one Next records one answer, blocks changes during the preview and advances once automatically', async ({ page }) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/#/test');
  await page.getByRole('slider').press('End');
  await page.getByRole('button', { name: '下一幕', exact: true }).click();
  const preview = page.getByRole('region', { name: '所选反应预览' });
  await expect(preview).toBeVisible();
  await expect(preview.locator('img')).toHaveAttribute('src', /\/scale-4\.webp/);
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(page.locator('.question-actions button').last()).toBeDisabled();
  const before = await page.evaluate(() => {
    const state = window.NBTICollector.snapshot();
    return state.runs.find(run => run.session.id === state.activeSessionId);
  });
  expect(before.answers).toHaveLength(1);
  expect(before.answers[0].scaleValue).toBe(14);
  await page.keyboard.press('a');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.locator('.question-actions button').last().dispatchEvent('click');
  await expect(page.locator('.answer-scale-track')).toHaveAttribute('aria-valuenow', '14');
  await expect.poll(() => preview.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.clock.runFor(3500);
  await expect(preview).toBeVisible();
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await page.clock.runFor(500);
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
  await expect(preview).toHaveCount(0);
  const after = await page.evaluate(() => {
    const state = window.NBTICollector.snapshot();
    return state.runs.find(run => run.session.id === state.activeSessionId);
  });
  expect(after.answers).toEqual(before.answers);
  // Watching the reaction must not increase the recorded answer or session time.
  expect(after.activeElapsedMs - before.activeElapsedMs).toBeLessThan(300);
  await expect(page.getByRole('slider')).toHaveAttribute('data-selected', 'false');
  await page.keyboard.press('Escape');
  await page.clock.runFor(10000);
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
});

test('holding a reaction pauses closing; its native image menu remains available and saving keeps the image open', async ({ page }, testInfo) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/#/test');
  await page.getByRole('slider').press('End');
  await page.getByRole('button', { name: '下一幕', exact: true }).click();
  const preview = page.getByRole('region', { name: '所选反应预览' });
  const image = preview.locator('img');
  await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
  await page.clock.runFor(3000);
  const pointer = { pointerId: 1, pointerType: testInfo.project.name === 'mobile' ? 'touch' : 'mouse', button: 0, isPrimary: true };
  await image.dispatchEvent('pointerdown', pointer);
  await page.clock.runFor(10000);
  await expect(preview).toBeVisible();
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  // Chromium cannot show an iOS save sheet. Assert that the page leaves its
  // native menu event uncancelled and does not unmount the image under it.
  expect(await image.evaluate(element => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(true);
  await image.dispatchEvent('pointerup', pointer);
  await page.clock.runFor(20000);
  await expect(preview).toBeVisible();
  const imageResponse = await page.request.get(await image.getAttribute('src'));
  expect(imageResponse.ok()).toBe(true);
  const downloadPromise = page.waitForEvent('download');
  await preview.getByRole('link', { name: /保存.*图片/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.webp$/);
  expect(await readFile(await download.path())).toEqual(await imageResponse.body());
  await page.clock.runFor(20000);
  await expect(preview).toBeVisible();
  await image.click();
  await expect(preview).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(preview).toHaveCount(0);
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
  await page.clock.runFor(10000);
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
  const answers = await page.evaluate(() => {
    const state = window.NBTICollector.snapshot();
    return state.runs.find(run => run.session.id === state.activeSessionId).answers;
  });
  expect(answers).toHaveLength(1);
});

test('a short image press restarts the viewing interval and dragging out does not dismiss the preview', async ({ page }) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/#/test');
  await page.getByRole('slider').press('Home');
  await page.getByRole('button', { name: '下一幕', exact: true }).click();
  const preview = page.getByRole('region', { name: '所选反应预览' });
  const image = preview.locator('img');
  await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
  await page.clock.runFor(3000);
  await image.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0 });
  await page.clock.runFor(5000);
  await expect(preview).toBeVisible();
  await preview.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', button: 0 });
  await preview.dispatchEvent('click', { clientX: 2, clientY: 2 });
  await expect(preview).toBeVisible();
  await page.clock.runFor(3500);
  await expect(preview).toBeVisible();
  await page.clock.runFor(500);
  await expect(preview).toHaveCount(0);
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
});

test('reloading during a confirmed preview restores the current draft without opening another preview', async ({ page }) => {
  await page.goto('/#/test');
  await page.getByRole('slider').press('End');
  await page.getByRole('button', { name: '下一幕', exact: true }).click();
  await expect(page.getByRole('region', { name: '所选反应预览' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: '所选反应预览' })).toHaveCount(0);
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '14');
  await expect(page.locator('.question-scene img')).toHaveAttribute('src', /\/scene\.webp/);
  await confirmAnswer(page);
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
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
