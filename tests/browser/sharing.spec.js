import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../../public/media/manifest.json', import.meta.url), 'utf8'));
const png = await readFile(new URL(`../../public/media/${manifest['plot-rewriter'].card}`, import.meta.url));

test.beforeEach(async ({ page }) => {
  // Safe for local and deployed-site checks: no questionnaire writes.
  await page.route('**/api/collect', route => route.fulfill({ json: { ok: true } }));
});

async function setup(page, { native = 'success', clipboard = 'success', wechat = false, files = true } = {}) {
  await page.addInitScript(({ native, clipboard, wechat, files }) => {
    window.shareCalls = [];
    window.copyCalls = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: native === 'missing' ? undefined : async data => {
      window.shareCalls.push({ ...data, files: data.files?.map(file => ({ name: file.name, type: file.type, size: file.size })) });
      if (native === 'cancel') throw new DOMException('Cancelled', 'AbortError');
      if (native === 'failed') throw new DOMException('Not allowed', 'NotAllowedError');
    } });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => files && Boolean(data.files?.length) });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
      if (clipboard === 'failed') throw new DOMException('Not allowed', 'NotAllowedError');
      window.copyCalls.push(text);
    } } });
    if (wechat) Object.defineProperty(navigator, 'userAgent', { configurable: true, value: navigator.userAgent + ' MicroMessenger/8.0' });
  }, { native, clipboard, wechat, files });
}

async function openShare(page) {
  await page.goto('/?token=private-token&session=private-session#/role/plot-rewriter');
  await page.getByRole('button', { name: '分享剧本', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: '分享剧本', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('native link sharing is primary, sanitizes the URL and does not fetch a card', async ({ page }, testInfo) => {
  await setup(page);
  const cardRequests = [];
  page.on('request', request => {
    if (request.resourceType() === 'fetch' && request.url().includes('-card-')) cardRequests.push(request.url());
  });
  const dialog = await openShare(page);
  await expect(dialog.locator('details')).not.toHaveAttribute('open', '');
  await expect(dialog.getByRole('textbox', { name: '角色分享邀请' })).not.toBeVisible();
  await dialog.getByRole('button', { name: '分享给朋友', exact: true }).click();
  const calls = await page.evaluate(() => window.shareCalls);
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe(new URL('/#/role/plot-rewriter', page.url()).href);
  expect(calls[0].title).toContain('心之所向');
  expect(calls[0].text).toContain('心之所向');
  expect(calls[0].files).toBeUndefined();
  expect(JSON.stringify(calls)).not.toMatch(/private-session|private-token/);
  expect(cardRequests).toEqual([]);
  expect(await page.evaluate(() => window.copyCalls)).toEqual([]);
  await page.screenshot({ path: `.work/share-primary-${testInfo.project.name}.png` });
});

test('cancelling the system sheet stays quiet and never copies anything', async ({ page }) => {
  await setup(page, { native: 'cancel' });
  const dialog = await openShare(page);
  await dialog.getByRole('button', { name: '分享给朋友', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '分享给朋友', exact: true })).toBeEnabled();
  await expect(dialog.locator('details')).not.toHaveAttribute('open', '');
  await expect(dialog.locator('.share-status')).not.toContainText('无法');
  expect(await page.evaluate(() => window.copyCalls)).toEqual([]);
});

test('native share errors reveal fallback and denied clipboard selects the invitation', async ({ page }) => {
  await setup(page, { native: 'failed', clipboard: 'failed' });
  const dialog = await openShare(page);
  await dialog.getByRole('button', { name: '分享给朋友', exact: true }).click();
  await expect(dialog.locator('.share-status')).toContainText('无法');
  await expect(dialog.getByRole('textbox', { name: '角色分享邀请' })).toBeVisible();
  await dialog.getByRole('button', { name: '复制剧本邀请', exact: true }).click();
  const input = dialog.getByRole('textbox', { name: '角色分享邀请' });
  await expect(input).toBeFocused();
  expect(await input.evaluate(element => element.selectionEnd - element.selectionStart)).toBe((await input.inputValue()).length);
  expect(await page.evaluate(() => window.copyCalls)).toEqual([]);
});

test('browsers without native sharing offer a usable fallback', async ({ page }) => {
  await setup(page, { native: 'missing' });
  const dialog = await openShare(page);
  await expect(dialog.getByRole('button', { name: '保存角色卡', exact: true })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: '角色分享邀请' })).toBeVisible();
  await dialog.getByRole('button', { name: '复制剧本邀请', exact: true }).click();
  expect((await page.evaluate(() => window.copyCalls))[0]).toContain('/#/role/plot-rewriter');
});

test('WeChat uses explicit menu guidance even when navigator.share is present', async ({ page }, testInfo) => {
  await setup(page, { wechat: true });
  const dialog = await openShare(page);
  await dialog.getByRole('button', { name: '微信分享指引', exact: true }).click();
  await expect(dialog).toContainText('右上角');
  await expect(dialog).toContainText('发送给朋友');
  await expect(dialog).toContainText('朋友圈');
  await expect(dialog.getByRole('button', { name: '微信好友', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '朋友圈', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.shareCalls)).toEqual([]);
  await page.screenshot({ path: `.work/share-wechat-${testInfo.project.name}.png` });
  const before = page.url();
  await dialog.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(page.url()).toBe(before);
});

test('role card downloads unchanged and file-only sharing matches capability checking', async ({ page }) => {
  await setup(page);
  const dialog = await openShare(page);
  await dialog.getByRole('button', { name: '保存角色卡', exact: true }).click();
  const downloadLink = dialog.getByRole('link', { name: '下载角色卡', exact: true });
  await expect(downloadLink).toHaveAttribute('href', /^blob:/);
  const pending = page.waitForEvent('download');
  await downloadLink.click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('心之所向-主角剧本.png');
  expect(await readFile(await download.path())).toEqual(png);
  await dialog.getByRole('button', { name: '分享图片', exact: true }).click();
  const calls = await page.evaluate(() => window.shareCalls);
  expect(calls).toHaveLength(1);
  expect(calls[0].files).toEqual([{ name: '心之所向-主角剧本.png', type: 'image/png', size: png.length }]);
  expect(calls[0].url).toBeUndefined();
  expect(calls[0].text).toBeUndefined();
  const img = dialog.locator('.share-card-preview img');
  await img.scrollIntoViewIfNeeded();
  expect(await img.evaluate(element => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(true);
  const box = await img.boundingBox();
  expect(box.height).toBeLessThanOrEqual(page.viewportSize().height * 0.6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await img.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
});

test('failed card fetch can retry while the long-press image remains available', async ({ page }) => {
  await setup(page);
  let failed = true;
  await page.route(/\/media\/[^/]*-card-[^/]*\.png/, route => {
    if (failed && route.request().resourceType() === 'fetch') return route.abort('failed');
    return route.continue();
  });
  const dialog = await openShare(page);
  await dialog.getByRole('button', { name: '保存角色卡', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.locator('.share-card-preview img')).toBeVisible();
  failed = false;
  await dialog.getByRole('button', { name: '重试准备角色卡', exact: true }).click();
  await expect(dialog.getByRole('link', { name: '下载角色卡', exact: true })).toHaveAttribute('href', /^blob:/);
  await expect(dialog.getByRole('alert')).toHaveCount(0);
});
