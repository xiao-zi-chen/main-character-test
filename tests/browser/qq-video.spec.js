import { test, expect } from '@playwright/test';

const androidQQ = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 MQQBrowser/6.2 TBS/047808 QQ/9.1.50.22050';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/collect', route => route.fulfill({ json: { ok: true } }));
  await page.addInitScript(ua => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: ua });
  }, androidQQ);
});

for (const role of ['plot-rewriter', 'royal-chef']) {
  test(`Android QQ uses native controls outside the dialog top layer: ${role}`, async ({ page }, testInfo) => {
    // Chromium cannot emulate the X5 renderer; reproduce the relevant legacy
    // API/event behavior while checking that real video frames are decoded.
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      document.addEventListener('playing', event => event.stopImmediatePropagation(), true);
      const nativePlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        nativePlay.call(this).catch(() => {});
        return undefined;
      };
    });
    await page.goto(`/#/role/${role}`);
    const trigger = page.getByRole('button', { name: /^观看.*的短片$/ });
    await trigger.click();
    const screen = page.getByRole('dialog');
    await expect(screen).toHaveClass('qq-video-screen');
    expect(await screen.evaluate(element => element.parentElement === document.body && element.tagName === 'DIV')).toBe(true);
    await expect(page.locator('dialog')).toHaveCount(0);
    const video = screen.locator('video');
    await expect(video).toHaveJSProperty('controls', true);
    await expect(video).not.toHaveAttribute('x5-video-player-type');
    await expect(video).not.toHaveAttribute('x5-playsinline');
    await expect(video).not.toHaveAttribute('playsinline');
    await expect(video).not.toHaveAttribute('webkit-playsinline');
    expect(await video.getAttribute('controlslist')).not.toContain('nofullscreen');
    await expect.poll(() => video.evaluate(element =>
      element.currentTime > 0.2 && !element.paused && !element.muted && element.videoWidth > 0
    )).toBe(true);
    await expect(page.locator('.video-card-poster')).toHaveCount(0);
    const frames = () => video.evaluate(element => {
      const quality = element.getVideoPlaybackQuality();
      return quality.totalVideoFrames - quality.droppedVideoFrames;
    });
    const first = await frames();
    await expect.poll(frames).toBeGreaterThan(first + 2);
    // A normal tap must not override native pause/fullscreen controls.
    await video.evaluate(element => element.pause());
    await video.dispatchEvent('click');
    await expect(video).toHaveJSProperty('paused', true);
    await video.evaluate(element => element.play());
    await page.screenshot({ path: `.work/qq-video-${role}-${testInfo.project.name}.png` });
    // Closing must stop the actual media, not merely hide the modal.
    const element = await video.elementHandle();
    await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
    await expect(video).toHaveCount(0);
    expect(await element.evaluate(node => node.paused)).toBe(true);
    await expect(trigger).toBeFocused();
    expect(await page.locator('#root').evaluate(element => element.inert)).toBe(false);
    expect(errors).toEqual([]);
  });
}

test('Android QQ synchronous autoplay rejection offers a usable manual play control', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const nativePlay = HTMLMediaElement.prototype.play;
    let rejectNext = true;
    HTMLMediaElement.prototype.play = function () {
      if (rejectNext) {
        rejectNext = false;
        throw new DOMException('User gesture required', 'NotAllowedError');
      }
      return nativePlay.call(this);
    };
  });
  await page.goto('/#/role/plot-rewriter');
  await page.getByRole('button', { name: '观看心之所向的短片', exact: true }).click();
  const video = page.getByRole('dialog').locator('video');
  await expect(page.locator('.video-card-poster')).toHaveCount(0);
  await expect(video).toHaveJSProperty('paused', true);
  await expect(video).toHaveJSProperty('muted', false);
  await page.getByRole('button', { name: '播放短片', exact: true }).click();
  await expect.poll(() => video.evaluate(element => element.currentTime > 0 && !element.paused && !element.muted)).toBe(true);
  await expect(page.locator('.video-card-poster')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Android QQ exposes the actual film URL and keeps controls outside the video in portrait and landscape', async ({ page }, testInfo) => {
  await page.goto('/#/role/royal-chef');
  const before = page.url();
  for (const size of [{ width: 393, height: 659 }, { width: 852, height: 393 }]) {
    await page.setViewportSize(size);
    await page.getByRole('button', { name: /^观看.*的短片$/ }).click();
    const screen = page.getByRole('dialog');
    const video = screen.locator('video');
    const close = screen.getByRole('button', { name: '关闭弹窗', exact: true });
    const fallback = screen.getByRole('link', { name: '仍无画面？单独打开短片' });
    await expect(close).toBeInViewport();
    await expect(fallback).toBeInViewport();
    const videoBox = await video.boundingBox();
    const closeBox = await close.boundingBox();
    const linkBox = await fallback.boundingBox();
    expect(videoBox.height).toBeGreaterThan(150);
    expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(videoBox.y + 1);
    expect(linkBox.y).toBeGreaterThanOrEqual(videoBox.y + videoBox.height - 1);
    expect(await fallback.getAttribute('href')).toBe(await video.getAttribute('src'));
    await expect(fallback).not.toHaveAttribute('target');
    expect(await screen.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    await page.screenshot({ path: `.work/qq-native-${testInfo.project.name}-${size.width}.png` });
    await close.click();
    await expect(screen).toHaveCount(0);
    expect(page.url()).toBe(before);
  }
});

test('Android QQ direct-film fallback pauses the embedded video before navigation', async ({ page }) => {
  await page.goto('/#/role/royal-chef');
  await page.getByRole('button', { name: /^观看.*的短片$/ }).click();
  const screen = page.getByRole('dialog');
  const video = screen.locator('video');
  await expect.poll(() => video.evaluate(element => element.currentTime > 0 && !element.paused)).toBe(true);
  // Prevent only the test navigation, after the React handler. The real anchor
  // remains a direct same-tab CDN URL, so browser Back can return to the result.
  await page.evaluate(() => document.addEventListener('click', event => {
    if (event.target.closest('.native-video-actions a')) event.preventDefault();
  }));
  await screen.getByRole('link', { name: '仍无画面？单独打开短片' }).click();
  await expect(video).toHaveJSProperty('paused', true);
});

for (const [name, ua] of [
  ['WeChat', androidQQ + ' MicroMessenger/8.0'],
  ['iOS QQ', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) QQ/9.1.50'],
  ['standalone QQ Browser', 'Mozilla/5.0 (Linux; Android 14) MQQBrowser/15.5'],
]) test(`${name} retains the existing inline video dialog`, async ({ page }) => {
  await page.addInitScript(userAgent => Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent }), ua);
  await page.goto('/#/role/plot-rewriter');
  await page.getByRole('button', { name: /^观看.*的短片$/ }).click();
  const video = page.locator('dialog video');
  await expect(page.locator('.qq-video-screen')).toHaveCount(0);
  await expect(video).toHaveAttribute('x5-video-player-type', 'h5-page');
  await expect(video).toHaveJSProperty('controls', false);
  await expect.poll(() => video.evaluate(element => element.currentTime > 0 && !element.paused && !element.muted)).toBe(true);
});
