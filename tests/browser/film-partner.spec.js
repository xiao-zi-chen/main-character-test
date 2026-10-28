import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { roles, roleById } from '../../src/data/roles.js';
import { relationships } from '../../src/data/relationships.js';
import { STORAGE_KEY, getResult } from '../../src/engine.js';
import { drawQuestions } from '../../src/question-session.js';

const selection = JSON.parse(await readFile(new URL('../../content/selected-films.json', import.meta.url), 'utf8'));
const media = JSON.parse(await readFile(new URL('../../public/media/manifest.json', import.meta.url), 'utf8'));
const partnerById = Object.fromEntries(selection.films.flatMap(film => film.cast.map(person => [
  person.id, film.cast.length === 2 ? roleById[film.cast.find(other => other.id !== person.id).id] : null,
])));
const pairedRoles = roles.filter(role => partnerById[role.id]);

async function expectPartnerArtwork(section, partner) {
  const entry = media[partner.id];
  const portrait = section.getByRole('img', { name: `${partner.name}的角色画像`, exact: true });
  const artwork = section.locator('.film-partner-artwork');
  await expect(portrait).toHaveClass('film-partner-portrait');
  expect(await portrait.getAttribute('src')).toContain(`/media/${entry.card}?v=${entry.revision}`);
  await portrait.scrollIntoViewIfNeeded();
  await expect.poll(() => portrait.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(artwork).toHaveCSS('overflow', 'hidden');
  const crop = await artwork.evaluate(frame => {
    const image = frame.querySelector('img');
    const box = frame.getBoundingClientRect();
    const picture = image.getBoundingClientRect();
    return {
      naturalSize: [image.naturalWidth, image.naturalHeight],
      ratio: frame.clientWidth / frame.clientHeight,
      imageRatio: picture.width / picture.height,
      topOffset: picture.top - box.top,
      leftOffset: picture.left - box.left,
      widthDifference: picture.width - frame.clientWidth,
      visibleSourceHeight: frame.clientHeight / picture.height * image.naturalHeight,
      imageHeight: picture.height,
      frameHeight: frame.clientHeight,
    };
  });
  expect(crop.naturalSize).toEqual(entry.cardSize);
  expect(Math.abs(crop.ratio - entry.cardArtworkSize[0] / entry.cardArtworkSize[1])).toBeLessThan(0.01);
  expect(Math.abs(crop.imageRatio - entry.cardSize[0] / entry.cardSize[1])).toBeLessThan(0.001);
  expect(Math.abs(crop.topOffset)).toBeLessThanOrEqual(1);
  expect(Math.abs(crop.leftOffset)).toBeLessThanOrEqual(1);
  expect(Math.abs(crop.widthDifference)).toBeLessThanOrEqual(1);
  // The complete card stays undistorted; only its original artwork is visible.
  // The description and QR footer must remain outside the clipping frame.
  expect(Math.abs(crop.visibleSourceHeight - entry.cardArtworkSize[1])).toBeLessThanOrEqual(2);
  expect(crop.imageHeight).toBeGreaterThan(crop.frameHeight);
}

async function installSharing(page) {
  await page.addInitScript(() => {
    window.copiedInvitations = [];
    window.nativeInvitations = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async text => window.copiedInvitations.push(text),
    } });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => window.nativeInvitations.push(data) });
  });
}

test('all 28 public roles show only their actual film partner and every pair links both ways', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/api/') && request.method() !== 'GET') writes.push(request.url()); });
  let partnerCount = 0;
  for (const role of roles) {
    const partner = partnerById[role.id];
    await page.goto(`/#/role/${role.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(role.name);
    const section = page.locator('.film-partner');
    await expect(section).toHaveCount(partner ? 1 : 0);
    if (!partner) continue;
    partnerCount++;
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(partner.name);
    await expect(section).toContainText(relationships[role.id].bond);
    await expect(section).toContainText(relationships[partner.id].familiar);
    await expect(section).toContainText(relationships[role.id].chemistry);
    await expect(section).toContainText(relationships[role.id].prompt);
    await expect(section.locator('.film-partner-icon svg')).toHaveCount(1);
    await expectPartnerArtwork(section, partner);
    const link = section.getByRole('link', { name: '看看 TA 的剧本' });
    await expect(link).toHaveAttribute('href', `#/role/${partner.id}`);
    const progress = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    await link.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(partner.name);
    await expect(page.locator('.film-partner').getByRole('link', { name: '看看 TA 的剧本' })).toHaveAttribute('href', `#/role/${role.id}`);
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(progress);
  }
  expect(partnerCount).toBe(22);
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

test('pair invitations copy and natively share both names and the partner preview without private state', async ({ page }) => {
  test.setTimeout(120000);
  await installSharing(page);
  for (const role of pairedRoles) {
    const partner = partnerById[role.id];
    await page.goto(`/?session=private-session&token=private-token#/role/${role.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(role.name);
    const progress = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    await page.locator('.film-partner').getByRole('button', { name: '找 TA 来认领' }).click();
    const dialog = page.getByRole('dialog', { name: '分享同片搭档' });
    await expect(dialog).toBeVisible();
    const invitation = await dialog.getByRole('textbox', { name: '角色分享邀请' }).inputValue();
    const expectedUrl = new URL(`/#/role/${partner.id}`, page.url()).href;
    for (const fragment of [role.name, partner.name, relationships[role.id].chemistry, expectedUrl]) expect(invitation).toContain(fragment);
    expect(invitation).not.toMatch(/private-session|private-token|\?session=|\?token=/);
    await dialog.getByRole('button', { name: '复制剧本邀请', exact: true }).click();
    expect(await page.evaluate(() => window.copiedInvitations.at(-1))).toBe(invitation);
    await dialog.getByRole('button', { name: '更多分享方式', exact: true }).click();
    const native = await page.evaluate(() => window.nativeInvitations.at(-1));
    expect(native.title).toContain(role.name);
    expect(native.title).toContain(partner.name);
    expect(`${native.text}\n${native.url}`).toBe(invitation);
    expect(native.url).toBe(expectedUrl);
    expect(native.files).toBeUndefined();
    await dialog.getByRole('button', { name: '关闭弹窗', exact: true }).click();
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(progress);
  }
});

test('visiting and sharing a partner preserves the completed personal answer sheet', async ({ page }) => {
  await installSharing(page);
  const questionIds = drawQuestions(() => 0.4);
  const answers = Object.fromEntries(questionIds.map((id, i) => [id, i % 15]));
  const ownRole = getResult(answers, { questionIds }).role;
  await page.addInitScript(({ key, questionIds, answers }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 5, questionIds, answers, index: 19, submitted: true }));
  }, { key: STORAGE_KEY, questionIds, answers });
  const role = pairedRoles[0];
  await page.goto(`/#/role/${role.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(role.name);
  const progress = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  await page.locator('.film-partner').getByRole('link', { name: '看看 TA 的剧本' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(partnerById[role.id].name);
  await page.locator('.film-partner').getByRole('button', { name: '找 TA 来认领' }).click();
  await page.getByRole('button', { name: '复制剧本邀请', exact: true }).click();
  await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  await page.getByRole('button', { name: '返回我的结果', exact: true }).click();
  await expect(page).toHaveURL(/#\/result$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(ownRole.name);
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(progress);
});

test('partner cards and invitations fit long names on desktop and narrow phones', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const widths = testInfo.project.name === 'mobile' ? [393, 320] : [1440];
  const longestNames = [...pairedRoles].sort((a, b) => partnerById[b.id].name.length - partnerById[a.id].name.length).slice(0, 4);
  for (const width of widths) {
    await page.setViewportSize({ width, height: testInfo.project.name === 'mobile' ? 852 : 1050 });
    for (const role of longestNames) {
      await page.goto(`/#/role/${role.id}`);
      const section = page.locator('.film-partner');
      await expect(section).toBeVisible();
      await expectPartnerArtwork(section, partnerById[role.id]);
      expect(await section.evaluate(element => [...element.querySelectorAll('*')].every(child => {
        const box = child.getBoundingClientRect();
        return box.left >= -1 && box.right <= innerWidth + 1;
      }))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(section.getByRole('button', { name: '找 TA 来认领' })).toBeVisible();
      await section.getByRole('button', { name: '找 TA 来认领' }).click();
      const dialog = page.getByRole('dialog', { name: '分享同片搭档' });
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await dialog.getByRole('button', { name: '关闭弹窗', exact: true }).click();
    }
    await page.locator('.film-partner').screenshot({ path: `.work/film-partner-${testInfo.project.name}-${width}.png` });
  }
});
