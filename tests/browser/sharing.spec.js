import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  // Safe for local and deployed-site checks: no questionnaire writes.
  await page.route('**/api/collect', route => route.fulfill({ json: { ok: true } }));
});

async function setup(page, { native = 'success', clipboard = 'success', wechat = false, userAgent } = {}) {
  await page.addInitScript(({ native, clipboard, wechat, userAgent }) => {
    window.shareCalls = [];
    window.copyCalls = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: native === 'missing' ? undefined : async data => {
      window.shareCalls.push({ ...data, files: data.files?.map(file => ({ name: file.name, type: file.type, size: file.size })) });
      if (native === 'cancel') throw new DOMException('Cancelled', 'AbortError');
      if (native === 'failed') throw new DOMException('Not allowed', 'NotAllowedError');
    } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
      if (clipboard === 'failed') throw new DOMException('Not allowed', 'NotAllowedError');
      window.copyCalls.push(text);
    } } });
    if (userAgent || wechat) Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent || navigator.userAgent + ' MicroMessenger/8.0' });
  }, { native, clipboard, wechat, userAgent });
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
  const shareButton = dialog.getByRole('button', { name: '分享给朋友', exact: true });
  await expect(dialog.getByRole('button', { name: '保存角色卡', exact: true })).toHaveCount(0);
  await expect(dialog.locator('.share-destinations button')).toHaveCount(1);
  const rowBounds = await dialog.locator('.share-destinations').boundingBox();
  const buttonBounds = await shareButton.boundingBox();
  expect(Math.abs(buttonBounds.x - rowBounds.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(buttonBounds.width - rowBounds.width)).toBeLessThanOrEqual(1);
  await expect(dialog.locator('details')).not.toHaveAttribute('open', '');
  await expect(dialog.getByRole('textbox', { name: '角色分享邀请' })).not.toBeVisible();
  await shareButton.click();
  const calls = await page.evaluate(() => window.shareCalls);
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe(new URL('/#/role/plot-rewriter', page.url()).href);
  expect(calls[0].title).toContain('心之所向');
  expect(calls[0].text).toContain('心之所向');
  expect(calls[0].files).toBeUndefined();
  expect(JSON.stringify(calls)).not.toMatch(/private-session|private-token/);
  expect(cardRequests).toEqual([]);
  expect(await page.evaluate(() => window.copyCalls)).toEqual([]);
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.work/share-primary-${testInfo.project.name}-${colorScheme}.png` });
  }
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
  await expect(dialog.getByRole('button', { name: '保存角色卡', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '分享给朋友', exact: true })).toBeVisible();
  await expect(dialog.locator('.share-status')).not.toContainText('保存角色卡');
  await expect(dialog.getByRole('textbox', { name: '角色分享邀请' })).toBeVisible();
  await dialog.getByRole('button', { name: '复制剧本邀请', exact: true }).click();
  expect((await page.evaluate(() => window.copyCalls))[0]).toContain('/#/role/plot-rewriter');
});

test('WeChat shows only menu guidance and close control even when navigator.share is present', async ({ page }, testInfo) => {
  await setup(page, { wechat: true });
  const dialog = await openShare(page);
  await expect(dialog.locator('.wechat-share-guide')).toBeVisible();
  await expect(dialog).toContainText('右上角');
  await expect(dialog).toContainText('发送给朋友');
  await expect(dialog).toContainText('朋友圈');
  await expect(dialog.getByRole('button')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: '关闭弹窗', exact: true })).toBeVisible();
  await expect(dialog.locator('h2,.share-role-name,.modal-symbol,.share-status,details,.share-card-preview')).toHaveCount(0);
  await expect(dialog).not.toContainText('保存角色卡');
  await expect(dialog).not.toContainText('菜单转发的是当前网页');
  await expect(dialog).not.toContainText('想分享完整的人设');
  await expect(dialog).not.toContainText('心之所向');
  expect(await page.evaluate(() => window.shareCalls)).toEqual([]);
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
    const bounds = await dialog.boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(24);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height - 24);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.work/share-wechat-${testInfo.project.name}-${colorScheme}.png` });
  }
  const before = page.url();
  await dialog.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(page.url()).toBe(before);
  await page.getByRole('button', { name: '分享剧本', exact: true }).first().click();
  await dialog.locator('.wechat-share-guide').click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
  expect(page.url()).toBe(before);
});

for (const [device, userAgent] of [
  ['Android', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 MQQBrowser/6.2 TBS/046716 QQ/9.1.50.18890 Mobile'],
  ['iOS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 QQ/9.1.50.638'],
]) test(`${device} QQ shows only friend-sharing guidance and can close in both themes`, async ({ page }, testInfo) => {
  await setup(page, { userAgent });
  const dialog = await openShare(page);
  const guide = dialog.getByRole('note', { name: 'QQ 分享操作' });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('点击 QQ 右上角「···」');
  await expect(guide).toContainText('发送给好友');
  await expect(dialog.getByRole('button')).toHaveCount(1);
  await expect(dialog.locator('h2,.share-role-name,.modal-symbol,.share-status,details,.share-card-preview')).toHaveCount(0);
  await expect(dialog).not.toContainText('保存角色卡');
  await expect(dialog).not.toContainText('微信');
  expect(await page.evaluate(() => window.shareCalls)).toEqual([]);
  expect(await page.evaluate(() => window.copyCalls)).toEqual([]);
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
    const bounds = await dialog.boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(24);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height - 24);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.work/share-qq-${device}-${testInfo.project.name}-${colorScheme}.png` });
  }
  const before = page.url();
  await dialog.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(page.url()).toBe(before);
  await page.getByRole('button', { name: '分享剧本', exact: true }).first().click();
  await guide.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
  expect(page.url()).toBe(before);
});

test('standalone QQ Browser retains system sharing rather than the QQ app instructions', async ({ page }) => {
  await setup(page, { userAgent: 'Mozilla/5.0 (Linux; Android 14) MQQBrowser/15.5 Mobile Safari/537.36' });
  const dialog = await openShare(page);
  await expect(dialog.getByRole('note', { name: 'QQ 分享操作' })).toHaveCount(0);
  await dialog.getByRole('button', { name: '分享给朋友', exact: true }).click();
  expect(await page.evaluate(() => window.shareCalls)).toHaveLength(1);
});
