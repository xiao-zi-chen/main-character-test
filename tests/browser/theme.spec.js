import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { STORAGE_KEY } from '../../src/engine.js';

test.beforeEach(async ({ page }) => {
  // Theme previews and deployment checks must not create questionnaire records.
  await page.route('**/api/collect', route => route.fulfill({ json: { ok: true } }));
});

async function expectTheme(page, theme) {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('.theme-toggle')).toHaveCount(1);
  await expect(page.locator('.theme-toggle')).toBeVisible();
  await expect(page.locator('.theme-toggle')).toHaveAccessibleName(theme === 'dark' ? '切换到明亮模式' : '切换到暗夜模式');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(theme);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /^#[0-9a-f]{6}$/i);
}

async function chooseTheme(page, theme) {
  if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('.theme-toggle').click();
  await expectTheme(page, theme);
}

async function expectNoOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function waitForImages(page, selector) {
  const images = page.locator(selector);
  const count = await images.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index++) {
    await images.nth(index).scrollIntoViewIfNeeded();
    await expect.poll(() => images.nth(index).evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

test('theme follows the system until manually chosen, then survives reload and system changes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expectTheme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme(page, 'light');
  const lightColor = await page.locator('body').evaluate(body => getComputedStyle(body).backgroundColor);
  await page.locator('.theme-toggle').click();
  await expectTheme(page, 'dark');
  const darkColor = await page.locator('body').evaluate(body => getComputedStyle(body).backgroundColor);
  expect(darkColor).not.toBe(lightColor);
  await page.reload();
  await expectTheme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme(page, 'dark');
  await page.locator('.theme-toggle').click();
  await page.reload();
  await expectTheme(page, 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectTheme(page, 'light');
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});

test('switching theme during the quiz preserves its draft, question position and submitted answers', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/#/test');
  await expectTheme(page, 'dark');
  await page.getByRole('slider').press('Home');
  await page.getByRole('button', { name: '下一题', exact: true }).click();
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
  await page.getByRole('slider').press('End');
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  const answerCount = () => page.evaluate(() => {
    const state = window.NBTICollector.snapshot();
    return state.runs.find(run => run.session.id === state.activeSessionId).answers.length;
  });
  expect(await answerCount()).toBe(1);
  await chooseTheme(page, 'light');
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '14');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)).toEqual(before);
  expect(await answerCount()).toBe(1);
  await expectNoOverflow(page);
  await page.reload();
  await expectTheme(page, 'light');
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '14');
  await chooseTheme(page, 'dark');
  await page.getByRole('button', { name: '上一题', exact: true }).click();
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '0');
  expect(await answerCount()).toBe(1);
});

test('theme remains switchable when browser storage access is blocked', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Blocked', 'SecurityError'); },
    });
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expectTheme(page, 'light');
  await chooseTheme(page, 'dark');
  await page.getByRole('button', { name: '测测我的主角人设', exact: true }).click();
  await expectTheme(page, 'dark');
  await chooseTheme(page, 'light');
  await expect(page.getByRole('slider')).toBeVisible();
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});

test('both themes render home, quiz, character profile and sharing without horizontal overflow', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await mkdir('.work/themes', { recursive: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Keep the sharing preview deterministic and avoid launching an OS share sheet.
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }));
  const capture = async (theme, screen) => {
    await expectNoOverflow(page);
    await page.screenshot({ path: `.work/themes/${testInfo.project.name}-${theme}-${screen}.png`, fullPage: true });
  };
  for (const theme of ['dark', 'light']) {
    await page.goto('/');
    await chooseTheme(page, theme);
    await waitForImages(page, '.opening-image');
    await capture(theme, 'home');
    await page.goto('/#/test');
    await expectTheme(page, theme);
    await page.getByRole('slider').press('End');
    await waitForImages(page, '.question-content .question-art img');
    await expect(page.getByRole('button', { name: '上一题', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '下一题', exact: true })).toBeEnabled();
    await capture(theme, 'quiz');
    await page.getByRole('button', { name: '放大当前画面', exact: true }).click();
    const zoom = page.getByRole('dialog', { name: '查看画面', exact: true });
    await expect(zoom.getByRole('button', { name: '保存图片', exact: true })).toBeVisible();
    await capture(theme, 'image');
    await zoom.getByRole('button', { name: '关闭弹窗', exact: true }).click();
    await page.goto('/#/role/plot-rewriter');
    await expectTheme(page, theme);
    await expect(page.locator('.result-copy h1')).toHaveText('心之所向');
    await waitForImages(page, '.result-page img');
    await capture(theme, 'result');
    await page.locator('.result-more>summary').click();
    await expect(page.locator('.result-detail-grid')).toBeVisible();
    await capture(theme, 'details');
    await page.getByRole('button', { name: '分享剧本', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: '分享剧本', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: '角色分享邀请' })).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
    await capture(theme, 'share');
    await dialog.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  }
  expect(errors).toEqual([]);
});
