import { test, expect } from '@playwright/test';
import { drawQuestions } from '../../src/question-session.js';
import { STORAGE_KEY } from '../../src/engine.js';

test.beforeEach(async ({ page }) => {
  // These tests can target a deployed subdirectory without writing real answers.
  await page.route('**/api/collect', route => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/participation', route => route.fulfill({ json: { displayCount: '12.4k' } }));
});

async function setupSharing(page, { native = true, userAgent } = {}) {
  await page.addInitScript(({ native, userAgent }) => {
    window.shareCalls = [];
    window.copyCalls = [];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: native ? async data => { window.shareCalls.push(data); } : undefined,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async text => { window.copyCalls.push(text); } },
    });
    if (userAgent) Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent });
  }, { native, userAgent });
}

async function seedCompleted(page) {
  const questionIds = drawQuestions();
  await page.addInitScript(({ key, questionIds }) => {
    localStorage.setItem(key, JSON.stringify({ version: 5, questionIds,
      answers: Object.fromEntries(questionIds.map(id => [id, 7])), index: 19, submitted: true }));
  }, { key: STORAGE_KEY, questionIds });
}

async function openResultSharing(page) {
  await seedCompleted(page);
  await page.goto('./?token=private-token&session=private-session#/result');
  await expect(page.getByRole('heading', { name: '人格解析', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '分享给朋友', exact: true }).click();
  await expect(page).toHaveURL(/#\/share$/);
  const dialog = page.getByRole('dialog', { name: '分享人格测试', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('black-mirror native sharing keeps its own public landing page and removes private query data', async ({ page }) => {
  await setupSharing(page);
  const dialog = await openResultSharing(page);
  await expect(dialog.getByRole('button', { name: '保存角色卡', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: '分享给朋友', exact: true }).click();
  const calls = await page.evaluate(() => window.shareCalls);
  expect(calls).toHaveLength(1);
  const expected = new URL('./#/share', page.url());
  expect(calls[0].url).toBe(expected.href);
  expect(new URL(calls[0].url).pathname).toBe(new URL(page.url()).pathname);
  expect(calls[0].title).toContain('看见你自己');
  expect(calls[0].files).toBeUndefined();
  expect(JSON.stringify(calls)).not.toMatch(/private-token|private-session|\/role\/|questionIds|participantId/);
  expect(await page.evaluate(() => window.copyCalls)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a friend without answers opens the public black-mirror share page and starts in the same subdirectory', async ({ page }) => {
  let writes = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/collect' && request.method() === 'POST') writes++;
  });
  await setupSharing(page);
  await page.goto('./#/share');
  const directory = new URL(page.url()).pathname;
  await expect(page.getByRole('heading', { level: 1, name: '看见你自己', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '开始人格测试', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '分享给朋友', exact: true })).toBeVisible();
  await expect(page.locator('.personality-analysis, .mirror-screen, video')).toHaveCount(0);
  expect(writes).toBe(0);
  await page.reload();
  await expect(page).toHaveURL(/#\/share$/);
  await page.getByRole('button', { name: '开始人格测试', exact: true }).click();
  await expect(page).toHaveURL(/#\/test$/);
  expect(new URL(page.url()).pathname).toBe(directory);
  await expect(page.getByRole('slider')).toBeVisible();
  await expect(page.locator('.quiz-counter')).toContainText('01');
  const progress = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(progress.submitted).toBe(false);
  expect(progress.answers).toEqual({});
  expect(writes).toBe(0);
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '看见你自己', exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(directory);
});

test('black-mirror sharing without a system sheet copies its own invitation and public URL', async ({ page }) => {
  await setupSharing(page, { native: false });
  const dialog = await openResultSharing(page);
  const invitation = dialog.getByRole('textbox', { name: '人格测试分享邀请', exact: true });
  await expect(invitation).toBeVisible();
  const text = await invitation.inputValue();
  expect(text).toContain(new URL('./#/share', page.url()).href);
  expect(text).not.toMatch(/private-token|private-session|\/role\//);
  await dialog.getByRole('button', { name: '复制测试邀请', exact: true }).click();
  expect(await page.evaluate(() => window.copyCalls)).toEqual([text]);
  expect(await page.evaluate(() => window.shareCalls)).toEqual([]);
});

for (const [app, userAgent, guideName, instruction] of [
  ['WeChat', 'Mozilla/5.0 (Linux; Android 14) Mobile MicroMessenger/8.0.50', '微信分享操作', '发送给朋友'],
  ['QQ', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 MQQBrowser/6.2 TBS/046716 QQ/9.1.50.18890 Mobile', 'QQ 分享操作', '发送给好友'],
]) test(`${app} black-mirror sharing shows only its menu instructions`, async ({ page }) => {
  await setupSharing(page, { userAgent });
  const dialog = await openResultSharing(page);
  const guide = dialog.getByRole('note', { name: guideName, exact: true });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('右上角');
  await expect(guide).toContainText(instruction);
  await expect(dialog.getByRole('button')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: '关闭弹窗', exact: true })).toBeVisible();
  await expect(dialog.locator('h2, details, .share-status')).toHaveCount(0);
  await expect(dialog).not.toContainText('保存角色卡');
  expect(await page.evaluate(() => window.shareCalls)).toEqual([]);
  expect(await page.evaluate(() => window.copyCalls)).toEqual([]);
  const directory = new URL(page.url()).pathname;
  await dialog.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe(directory);
  await expect(page).toHaveURL(/#\/share$/);
});
