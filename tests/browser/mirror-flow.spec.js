import { test, expect } from '@playwright/test';
import { drawQuestions } from '../../src/question-session.js';
import { STORAGE_KEY } from '../../src/engine.js';
import { confirmAnswer } from './quiz-helpers.js';

const message = '你是谁照照镜子不就知道了吗？';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/collect', route => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/participation', route => route.fulfill({ json: { displayCount: '12.4k' } }));
});

async function seedCompleted(page) {
  const questionIds = drawQuestions();
  await page.addInitScript(({ key, questionIds }) => {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify({ version: 5, questionIds,
      answers: Object.fromEntries(questionIds.map(id => [id, 7])), index: 19, submitted: true }));
  }, { key: STORAGE_KEY, questionIds });
}

async function expectBlackScreen(page) {
  await expect(page.locator('.mirror-screen')).toBeVisible();
  await expect(page.locator('.mirror-surface')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(page.locator('.simple-header, .simple-footer, video')).toHaveCount(0);
  await expect(page.locator('#nbti-save-status')).toBeHidden();
  const bounds = await page.locator('.mirror-surface').boundingBox();
  const viewport = page.viewportSize();
  expect(bounds.x).toBe(0);
  expect(bounds.y).toBe(0);
  expect(bounds.width).toBe(viewport.width);
  expect(bounds.height).toBe(viewport.height);
}

test('a real twenty-answer run reveals black, returns on one tap and keeps collection complete', async ({ page }, testInfo) => {
  const errors = [];
  const mediaRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/\/media\/|\.mp4(?:\?|$)/.test(request.url())) mediaRequests.push(request.url()); });
  await page.clock.install();
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('看见你自己');
  const cover = page.locator('.opening-image');
  await expect.poll(() => cover.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '开始人格测试', exact: true }).click();
  for (let index = 0; index < 20; index++) {
    await page.getByRole('slider').press('Enter');
    await confirmAnswer(page, { final: index === 19 });
  }
  await expect(page).toHaveURL(/#\/reveal$/);
  await expect(page.locator('.reveal-loading')).toBeVisible();
  await expect(page.getByRole('heading', { name: '你的人格，即将揭晓。', exact: true })).toBeVisible();
  await expect(page.locator('.mirror-screen')).toHaveCount(0);
  await page.clock.fastForward(2000);
  await expect(page).toHaveURL(/#\/reveal$/);
  await page.clock.fastForward(2000);
  await expect(page).toHaveURL(/#\/mirror$/);
  await expectBlackScreen(page);
  await expect(page.locator('.mirror-surface')).toHaveText('');
  await expect(page.locator('.mirror-surface')).toHaveCSS('outline-style', 'none');
  const collection = await page.evaluate(() => {
    const snapshot = window.NBTICollector.snapshot();
    return snapshot.runs.find(run => run.session.id === snapshot.activeSessionId);
  });
  expect(collection.answers).toHaveLength(20);
  expect(collection.answers.every(answer => answer.scaleValue === 7)).toBe(true);
  expect(collection.session.completedAt).toBeTruthy();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).submitted, STORAGE_KEY)).toBe(true);
  await page.clock.fastForward(6000);
  await expect(page).toHaveURL(/#\/mirror$/);
  if (testInfo.project.name === 'mobile') await page.locator('.mirror-surface').tap();
  else await page.locator('.mirror-surface').click();
  await expect(page).toHaveURL(/#\/result$/);
  await expect(page.getByRole('heading', { name: '人格解析', exact: true })).toBeVisible();
  await expect(page.getByRole('meter')).toHaveCount(10);
  await expect(page.locator('.personality-overview')).toContainText('十个维度都处在中间位置');
  expect(mediaRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('reopening the card shows only the punchline above black and returns to analysis', async ({ page }, testInfo) => {
  await seedCompleted(page);
  await page.goto('./#/result');
  const reopen = page.getByRole('button', { name: '再次查看我的人格卡片', exact: true });
  await expect(reopen).toBeVisible();
  expect((await reopen.boundingBox()).y).toBeLessThan((await page.getByRole('heading', { name: '人格解析', exact: true }).boundingBox()).y);
  await reopen.click();
  await expect(page).toHaveURL(/#\/card$/);
  await expectBlackScreen(page);
  await expect(page.locator('.mirror-surface')).toHaveText(message);
  expect((await page.locator('.mirror-message').boundingBox()).y).toBeLessThan(100);
  const gif = page.getByRole('img', { name: '大笑的表情动图', exact: true });
  await expect(gif).toBeVisible();
  await expect.poll(() => gif.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  expect((await gif.boundingBox()).x).toBeGreaterThan((await page.locator('.mirror-message>span').boundingBox()).x);
  const toggle = page.getByRole('button', { name: '切换文艺版', exact: true });
  const toggleBounds = await toggle.boundingBox();
  expect(toggleBounds.x).toBeGreaterThan(page.viewportSize().width / 2);
  expect(Math.abs(toggleBounds.y + toggleBounds.height / 2 - page.viewportSize().height / 2)).toBeLessThan(2);
  await page.screenshot({ path: `.work/mirror-card-${testInfo.project.name}.png` });
  await page.reload();
  await expect(page.locator('.mirror-message')).toHaveText(message);
  await page.locator('.mirror-surface').click();
  await expect(page).toHaveURL(/#\/result$/);
  await expect(page.getByRole('meter')).toHaveCount(10);
  await page.screenshot({ path: `.work/personality-result-${testInfo.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('literary edition starts black, fades in both lines on cue and returns to the GIF card', async ({ page }, testInfo) => {
  await seedCompleted(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('./#/card');
  await page.getByRole('button', { name: '切换文艺版', exact: true }).click();
  await expect(page).toHaveURL(/#\/card$/);
  await expect(page.locator('.mirror-surface')).toHaveText('');
  await expect(page.locator('.mirror-gif, .mirror-message, .mirror-edition-toggle')).toHaveCount(0);
  await page.clock.fastForward(600);
  const line = page.locator('.mirror-literary-line');
  await expect(line).toHaveText('所以你到底希望看到什么呢？');
  await expect(line).toHaveCSS('animation-duration', '2.8s');
  await expect(line).toHaveCSS('opacity', '1');
  const lineBounds = await line.boundingBox();
  expect(Math.abs(lineBounds.x + lineBounds.width / 2 - page.viewportSize().width / 2)).toBeLessThan(2);
  expect(Math.abs(lineBounds.y + lineBounds.height / 2 - page.viewportSize().height / 2)).toBeLessThan(2);
  await page.screenshot({ path: `.work/mirror-literary-${testInfo.project.name}.png` });
  await page.locator('.mirror-surface').click();
  await expect(line).toHaveText('回答了这么多问题，想必你的心中应该已经有了答案');
  await expect(line).toHaveCSS('opacity', '1');
  await page.locator('.mirror-surface').click();
  await expect(line).toHaveClass(/mirror-literary-leave/);
  await expect(line).toHaveCSS('opacity', '0');
  await expect(page.locator('.mirror-message')).toHaveCount(0);
  await page.clock.fastForward(1200);
  await expect(page.locator('.mirror-message')).toHaveText(message);
  await expect(page.locator('.mirror-gif')).toBeVisible();
  await expect(page.getByRole('button', { name: '切换文艺版', exact: true })).toBeVisible();
  await expect(line).toHaveCount(0);
  await expect(page).toHaveURL(/#\/card$/);
});

test('literary edition can be reopened or cancelled without closing the card', async ({ page }) => {
  await seedCompleted(page);
  await page.clock.install();
  await page.goto('./#/card');
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('button', { name: '切换文艺版', exact: true }).click();
    await page.clock.fastForward(600);
    await expect(page.locator('.mirror-literary-line')).toHaveText('所以你到底希望看到什么呢？');
    await page.keyboard.press('Escape');
    await expect(page.locator('.mirror-message')).toHaveText(message);
    await expect(page).toHaveURL(/#\/card$/);
  }
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/result$/);
});

test('black stays black in light mode and supports keyboard return', async ({ page }) => {
  await seedCompleted(page);
  await page.goto('./#/mirror');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  await expectBlackScreen(page);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await page.locator('.mirror-surface').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/result$/);
  await page.getByRole('button', { name: '再次查看我的人格卡片', exact: true }).click();
  await expect(page.locator('.mirror-message')).toHaveText(message);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/result$/);
});

test('unsubmitted answers cannot open any result or card route', async ({ page }) => {
  const questionIds = drawQuestions();
  await page.addInitScript(({ key, questionIds }) => {
    localStorage.setItem(key, JSON.stringify({ version: 5, questionIds,
      answers: Object.fromEntries(questionIds.map(id => [id, 7])), index: 19, submitted: false }));
  }, { key: STORAGE_KEY, questionIds });
  for (const route of ['/result', '/card', '/reveal', '/mirror']) {
    await page.goto(`./#${route}`);
    await expect(page).toHaveURL(/#\/test$/);
    await expect(page.locator('.mirror-screen, .personality-analysis')).toHaveCount(0);
  }
});

test('editing retains the selected questions and answers and revokes result access', async ({ page }) => {
  await seedCompleted(page);
  await page.goto('./#/result');
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  await page.getByRole('button', { name: '重新测试或修改答案', exact: true }).click();
  await page.getByRole('button', { name: '保留答案，回去修改', exact: true }).click();
  await expect(page).toHaveURL(/#\/test$/);
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  const edited = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(edited.questionIds).toEqual(before.questionIds);
  expect(edited.answers).toEqual(before.answers);
  expect(edited.submitted).toBe(false);
  await page.evaluate(() => { location.hash = '/result'; });
  await expect(page).toHaveURL(/#\/test$/);
  await expect(page.locator('.personality-analysis')).toHaveCount(0);
});

test('restarting creates an empty twenty-question draft and a fresh collection session', async ({ page }) => {
  await seedCompleted(page);
  await page.goto('./#/result');
  await page.getByRole('button', { name: '重新测试或修改答案', exact: true }).click();
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await expect(page).toHaveURL(/#\/test$/);
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(page.getByRole('slider')).toHaveAttribute('data-selected', 'false');
  const draft = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(draft.answers).toEqual({});
  expect(draft.questionIds).toHaveLength(20);
  expect(new Set(draft.questionIds).size).toBe(20);
  expect(draft.submitted).toBe(false);
  const snapshot = await page.evaluate(() => window.NBTICollector.snapshot());
  expect(snapshot.runs.find(run => run.session.id === snapshot.activeSessionId).answers).toEqual([]);
});
