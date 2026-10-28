import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { roleById } from '../../src/data/roles.js';
import { questions, dimensions } from '../../src/data/questions.js';
import { drawQuestions } from '../../src/question-session.js';
import { STORAGE_KEY, getResult } from '../../src/engine.js';
import { SCALE_MAX } from '../../src/data/answer-scale.js';

const role = roleById['plot-rewriter'];
const manifest = JSON.parse(await readFile(new URL('../../public/media/manifest.json', import.meta.url), 'utf8'));
const media = manifest[role.id];

test.beforeEach(async ({ page }) => {
  // Presentation checks may also run against the public site without writes.
  await page.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())
    ? route.continue() : route.fulfill({ status:200, contentType:'application/json', body:'{"ok":true}' }));
});

async function seedResult(page) {
  const questionIds = drawQuestions(() => 0.4);
  const answers = Object.fromEntries(questionIds.map(id => {
    const question = questions.find(item => item.id === id);
    const units = Math.round(role.profile[dimensions.findIndex(item => item.id === question.dimension)] * SCALE_MAX / 100);
    return [id, question.highAnswer === 'A' ? SCALE_MAX - units : units];
  }));
  expect(getResult(answers, { questionIds }).role.id).toBe(role.id);
  await page.addInitScript(({ key, questionIds, answers }) => {
    localStorage.setItem(key, JSON.stringify({ version:5, questionIds, answers, index:19, submitted:true }));
  }, { key:STORAGE_KEY, questionIds, answers });
  await page.goto('/#/result');
  await expect(page.getByRole('heading', { level:1 })).toHaveText(role.name);
}

async function expectArtwork(frame) {
  const image = frame.locator('img');
  await expect(image).toHaveAttribute('src', new RegExp(`/media/${media.card.replaceAll('.', '\\.')}\\?v=`));
  await image.evaluate(element => element.decode());
  const geometry = await frame.evaluate(element => {
    const image = element.querySelector('img');
    const frame = element.getBoundingClientRect();
    const picture = image.getBoundingClientRect();
    return {
      size:[image.naturalWidth, image.naturalHeight], width:frame.width, height:frame.height,
      imageWidth:picture.width, imageHeight:picture.height, top:picture.top-frame.top,
      overflow:getComputedStyle(element).overflow,
    };
  });
  expect(geometry.size).toEqual(media.cardSize);
  expect(geometry.overflow).toBe('hidden');
  expect(Math.abs(geometry.imageWidth-geometry.width)).toBeLessThan(1);
  expect(Math.abs(geometry.top)).toBeLessThan(1);
  expect(Math.abs(geometry.height-geometry.width*media.cardArtworkSize[1]/media.cardArtworkSize[0])).toBeLessThan(1);
  expect(Math.abs(geometry.imageHeight-geometry.imageWidth*media.cardSize[1]/media.cardSize[0])).toBeLessThan(1);
  expect(geometry.imageHeight).toBeGreaterThan(geometry.height);
}

test('complete save card fits one screen with dismissible margins and preserves the answer sheet', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await seedResult(page);
  const original = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  const sizes = testInfo.project.name === 'mobile'
    ? [{ width:393, height:852 }, { width:320, height:568 }, { width:852, height:393 }]
    : [{ width:1440, height:1050 }];
  const tap = async (x, y) => testInfo.project.name === 'mobile' ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
  for (const size of sizes) {
    await page.setViewportSize(size);
    const trigger = page.getByRole('button', { name:'保存我的角色卡', exact:true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name:'保存角色卡', exact:true });
    const image = dialog.locator('.save-role-card');
    await image.evaluate(element => element.decode());
    const frame = await dialog.boundingBox();
    const picture = await image.boundingBox();
    expect(frame.x).toBeGreaterThanOrEqual(19);
    expect(frame.y).toBeGreaterThanOrEqual(19);
    expect(frame.x+frame.width).toBeLessThanOrEqual(size.width-19);
    expect(frame.y+frame.height).toBeLessThanOrEqual(size.height-19);
    expect(picture.x).toBeGreaterThanOrEqual(frame.x);
    expect(picture.y).toBeGreaterThanOrEqual(frame.y);
    expect(picture.x+picture.width).toBeLessThanOrEqual(frame.x+frame.width+1);
    expect(picture.y+picture.height).toBeLessThanOrEqual(frame.y+frame.height+1);
    expect(Math.abs(picture.height-picture.width*media.cardSize[1]/media.cardSize[0])).toBeLessThan(1.5);
    expect(await dialog.evaluate(element => element.scrollHeight <= element.clientHeight+1)).toBe(true);
    const close = await dialog.getByRole('button', { name:'关闭弹窗', exact:true }).boundingBox();
    expect(close.y).toBeGreaterThanOrEqual(0);
    expect(close.y+close.height).toBeLessThanOrEqual(size.height);
    await page.screenshot({ path:`.work/card-presentation-${testInfo.project.name}-${size.width}.png` });
    await image.click();
    await expect(dialog).toBeVisible();
    // App code must leave the system's long-press/save-image menu available.
    expect(await image.evaluate(element => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles:true, cancelable:true })))).toBe(true);
    expect(await image.evaluate(element => getComputedStyle(element).getPropertyValue('-webkit-touch-callout'))).not.toBe('none');
    await expect(dialog).toBeVisible();
    const center = { x:picture.x+picture.width/2, y:picture.y+picture.height/2 };
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(8, center.y, { steps:4 });
    await page.mouse.up();
    await expect(dialog).toBeVisible();
    // A fresh tap on the surrounding backdrop closes the card, not the page.
    await tap(8, size.height/2);
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/#\/result$/);
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(original);
    await trigger.click();
    await image.evaluate(element => element.decode());
    const reopened = await dialog.boundingBox();
    // Padding inside the panel should work just like its surrounding margins.
    await tap(reopened.x+6, reopened.y+reopened.height-6);
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(original);
  }
});

test('result and character preview film covers use the matching card artwork without its footer', async ({ page }) => {
  await page.goto(`/#/role/${role.id}`);
  await expectArtwork(page.locator('.result-video-preview>.role-card-artwork'));
  await page.goto('/#/characters');
  await page.getByRole('button', { name:`预览${role.name}`, exact:true }).click();
  await expectArtwork(page.locator('.role-film-preview>.role-card-artwork'));
});

test('blocked autoplay shows card artwork until a manual sound-enabled play succeeds', async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    let rejectNext = true;
    HTMLMediaElement.prototype.play = function () {
      if (rejectNext) {
        rejectNext = false;
        return Promise.reject(new DOMException('User interaction required', 'NotAllowedError'));
      }
      return play.call(this);
    };
  });
  await page.goto(`/#/role/${role.id}`);
  await page.getByRole('button', { name:`观看${role.name}的短片`, exact:true }).click();
  const video = page.locator('dialog video');
  const poster = page.locator('.video-card-poster');
  await expect(poster).toBeVisible();
  await expectArtwork(poster.locator('.role-card-artwork'));
  await expect(video).toHaveJSProperty('muted', false);
  await video.click();
  await expect.poll(() => video.evaluate(element => element.currentTime>0 && !element.paused && !element.muted)).toBe(true);
  await expect(poster).toHaveCount(0);
});
