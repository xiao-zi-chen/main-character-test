import { test, expect } from '@playwright/test';
import { regularRoles as roles } from '../../src/data/roles.js';
import { readFile } from 'node:fs/promises';
import { formatPlaybackTime } from '../../src/media.js';
import { STORAGE_KEY } from '../../src/engine.js';

const media=JSON.parse(await readFile(new URL('../../public/media/manifest.json',import.meta.url),'utf8'));

test('landing, gallery filters, videos and modal keyboard controls', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('轮到你当');
  await expect(page.getByRole('button', { name: /^预览/ })).toHaveCount(18);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `.work/home-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '重生翻盘', exact: true }).click();
  await expect(page.getByRole('button', { name: '重生翻盘', exact: true })).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button', { name: '观看重生复仇女王专属预告' })).toBeVisible();
  await page.getByRole('button', { name: '古装大女主', exact: true }).click();
  await expect(page.getByRole('button', { name: /^预览/ })).toHaveCount(5);
  await page.getByRole('button', { name: /^全部剧本/ }).click();
  await expect(page.getByRole('button', { name: /^预览/ })).toHaveCount(18);
  await page.getByRole('button', { name: '预览失落神话继承人', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '播放视频', exact: true }).first().click();
  await expect.poll(() => dialog.locator('video').evaluate(video => video.currentTime > 0)).toBe(true);
  expect(await dialog.locator('video').evaluate(video => video.duration)).toBeCloseTo(media['myth-keeper'].duration, 1);
  await expect(dialog.locator('.video-duration')).toHaveText('00:10');
  await expect(dialog.locator('.video-label')).toContainText('主角高光时刻');
  await expect(dialog.locator('video')).toHaveAttribute('src',new RegExp(`myth-keeper\\.mp4\\?v=${media['myth-keeper'].revision}`));
  await dialog.getByRole('button', { name: '暂停视频' }).click();
  await dialog.getByRole('button', { name: '开启声音' }).click();
  await expect(dialog.getByRole('button', { name: '关闭声音' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('40-question journey persists, navigates back, reveals and exports a real result', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '测测我的主角人设', exact: true }).click();
  await expect(page.getByRole('button', { name: '下一幕', exact: true })).toBeDisabled();
  await page.keyboard.press('b');
  await page.keyboard.press('Enter');
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 40');
  await page.reload();
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 40');
  await page.getByRole('button', { name: '上一题', exact: true }).click();
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '14');
  await page.screenshot({ path: `.work/quiz-${testInfo.project.name}.png`, fullPage: true });
  for (let i = 0; i < 40; i++) {
    await expect(page.locator('.quiz-counter')).toHaveText(`${String(i+1).padStart(2,'0')} / 40`);
    const slider=page.getByRole('slider');
    await slider.focus();
    await slider.press(i % 3 === 0 ? 'End' : 'Home');
    if (i === 39) {
      // A locally chosen final answer is not a submitted answer sheet.
      await expect(page.locator('.header-cta')).toHaveText('继续选角');
      await expect(page.getByRole('button', { name: '我的剧本', exact: true })).toHaveCount(0);
      await page.evaluate(() => { location.hash = '/result'; });
      await expect(page).toHaveURL(/#\/test$/);
      await expect(page.locator('.quiz-counter')).toHaveText('40 / 40');
      expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).submitted, STORAGE_KEY)).toBe(false);
      await page.reload();
      await expect(page.locator('.quiz-counter')).toHaveText('40 / 40');
      await expect(slider).toHaveAttribute('aria-valuenow', '14');
      await expect(page.locator('.header-cta')).toHaveText('继续选角');
    }
    await page.getByRole('button', { name: i === 39 ? '揭晓我的主角' : '下一幕', exact: true }).click();
  }
  await expect(page).toHaveURL(/#\/result$/);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).submitted, STORAGE_KEY)).toBe(true);
  const name = await page.getByRole('heading', { level: 1 }).innerText();
  expect(roles.map(role => role.name)).toContain(name);
  await expect(page.locator('.traits .trait')).toHaveCount(5);
  await expect(page.getByRole('img', { name: /十个选择倾向雷达图/ })).toBeVisible();
  await page.getByRole('button', { name: '查看全部 10 个倾向' }).click();
  await expect(page.locator('.traits .trait')).toHaveCount(10);
  await page.getByRole('button', { name: '收起倾向' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `.work/result-${testInfo.project.name}.png`, fullPage: true });
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button', { name: '保存我的角色卡' }).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toContain(name);
  await download.saveAs(`.work/share-${testInfo.project.name}.png`);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await page.getByRole('button', { name: '再选一次，我有别的剧本' }).click();
  await page.getByRole('button', { name: '保留答案，回去修改' }).click();
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 40');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow','14');
  expect(errors).toEqual([]);
});

test('shared character links are public previews; incomplete answers cannot open personal results', async ({ page }) => {
  await page.goto('/#/result');
  await expect(page).toHaveURL(/#\/$/);
  for (const role of roles) {
    await page.goto(`/#/role/${role.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(role.name);
    await expect(page.locator('.traits')).toHaveCount(0);
    await expect.poll(() => page.locator('.result-media video').evaluate(v => v.readyState >= 2)).toBe(true);
    expect(await page.locator('.result-media video').evaluate(v => v.duration)).toBeCloseTo(media[role.id].duration, 1);
    await expect(page.locator('.video-duration')).toHaveText(formatPlaybackTime(media[role.id].duration));
    await expect(page.locator('.video-label')).toContainText('主角高光时刻');
    await expect(page.locator('.final-video-title')).toHaveCount(0);
    await page.locator('.result-media video').evaluate(video=>new Promise((resolve,reject)=>{
      video.addEventListener('seeked',resolve,{once:true});
      video.addEventListener('error',()=>reject(new Error('Could not decode the ending card')),{once:true});
      video.currentTime=video.duration-.5;
    }));
    expect(await page.locator('.result-media video').evaluate(video=>video.currentTime)).toBeGreaterThan(9);
  }
});
