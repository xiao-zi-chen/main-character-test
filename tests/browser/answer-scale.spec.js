import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { questions } from '../../src/data/questions.js';
import { STORAGE_KEY, LEGACY_STORAGE_KEY } from '../../src/engine.js';

async function start(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '测测我的主角人设', exact: true }).click();
  await expect(page.getByRole('slider')).toBeVisible();
}

test('scale requires an explicit response and supports neutral, zero, keyboard and reload', async ({ page }) => {
  await start(page);
  const slider = page.getByRole('slider');
  const next = page.getByRole('button', { name: '下一幕', exact: true });
  await expect(slider).toHaveAttribute('aria-valuenow', '7');
  await expect(slider).toHaveAttribute('data-selected', 'false');
  await expect(page.locator('.answer-scale-cell')).toHaveCount(15);
  await expect(page.locator('.answer-scale-cell.major-boundary')).toHaveCount(4);
  await expect(page.locator('.answer-scale-labels .active')).toHaveCount(0);
  await expect(next).toBeDisabled();
  await slider.focus();
  await slider.press('Enter');
  await expect(slider).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('.answer-scale-labels .active')).toHaveText('中立');
  await expect(next).toBeEnabled();
  // Enter on the slider chooses neutral locally, without submitting the answer.
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 40');
  await next.click();
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 40');
  await expect(slider).toHaveAttribute('data-selected', 'false');
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  await expect(next).toBeEnabled();
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuenow', '1');
  await slider.press('ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  // Focused arrow keys adjust the current answer instead of changing questions.
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 40');
  await next.click();
  await page.reload();
  await expect(page.locator('.quiz-counter')).toHaveText('03 / 40');
  await page.getByRole('button', { name: '上一题', exact: true }).click();
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  await expect(next).toBeEnabled();
  const progress = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(progress.version).toBe(2);
  expect(progress.answers[questions[0].id]).toBe(7);
  expect(progress.answers[questions[1].id]).toBe(0);
});

test('scale adjustments stay local; Next submits once, and returning to revise submits the final value', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    window.__scaleAnswers = [];
    const original = window.NBTICollector.answer;
    window.NBTICollector = { ...window.NBTICollector, answer: (...args) => { window.__scaleAnswers.push(args); return original(...args); } };
  });
  const slider = page.getByRole('slider');
  await slider.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const fire = (type, value) => element.dispatchEvent(new PointerEvent(type, {
      bubbles: true, pointerId: 11, isPrimary: true, button: 0,
      clientX: bounds.left + (value + .5) / 15 * bounds.width, clientY: bounds.top + 20,
    }));
    // Synthetic dispatch has no active browser pointer, so only this test shim
    // bypasses capture; production retains real pointer capture for dragging.
    element.setPointerCapture = () => {};
    fire('pointerdown', 0);
    fire('pointermove', 4);
    fire('pointermove', 9);
    fire('pointermove', 14);
  });
  await expect(slider).toHaveAttribute('aria-valuenow', '14');
  expect(await page.evaluate(() => window.__scaleAnswers.length)).toBe(0);
  await expect(page.getByRole('button', { name: '下一幕', exact: true })).toBeDisabled();
  await slider.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 11, button: 0, clientX: bounds.right - 2 }));
  });
  await expect(slider).toHaveAttribute('aria-valuenow', '14');
  expect(await page.evaluate(() => window.__scaleAnswers)).toEqual([]);
  await slider.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 12, isPrimary: true, button: 0, clientX: bounds.left + 2 }));
    element.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 12 }));
  });
  await expect(slider).toHaveAttribute('aria-valuenow', '14');
  expect(await page.evaluate(() => window.__scaleAnswers.length)).toBe(0);
  await slider.press('Home');
  await slider.press('End');
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  expect(await page.evaluate(() => window.__scaleAnswers)).toEqual([]);
  await page.getByRole('button', { name: '下一幕', exact: true }).click();
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 40');
  expect(await page.evaluate(() => window.__scaleAnswers)).toEqual([[questions[0].id, 0]]);
  await page.getByRole('button', { name: '上一题', exact: true }).click();
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  await slider.press('End');
  await expect(slider).toHaveAttribute('aria-valuenow', '14');
  expect(await page.evaluate(() => window.__scaleAnswers.length)).toBe(1);
  // Collector refusal blocks Next while retaining the locally chosen answer.
  await page.evaluate(() => {
    window.__acceptScaleAnswer = window.NBTICollector.answer;
    window.__refusedScaleCalls = 0;
    window.NBTICollector = { ...window.NBTICollector, answer: () => { window.__refusedScaleCalls++; return false; } };
  });
  await page.getByRole('button', { name: '下一幕', exact: true }).click();
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 40');
  await expect(slider).toHaveAttribute('aria-valuenow', '14');
  expect(await page.evaluate(() => window.__refusedScaleCalls)).toBe(1);
  expect(await page.evaluate(() => window.__scaleAnswers.length)).toBe(1);
  await page.evaluate(() => { window.NBTICollector = { ...window.NBTICollector, answer: window.__acceptScaleAnswer }; });
  await page.getByRole('button', { name: '下一幕', exact: true }).click();
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 40');
  expect(await page.evaluate(() => window.__scaleAnswers)).toEqual([[questions[0].id, 0], [questions[0].id, 14]]);
  const stored = await page.evaluate(() => window.NBTICollector.snapshot().runs.flatMap(run => run.answers));
  expect(stored.map(answer => answer.scaleValue)).toEqual([0, 14]);
});

test('obsolete binary browser progress is removed before a fresh scale attempt', async ({ page }) => {
  await page.addInitScript(({ legacyKey, questionId }) => {
    localStorage.setItem(legacyKey, JSON.stringify({ version: 1, answers: { [questionId]: 'B' }, index: 1 }));
  }, { legacyKey: LEGACY_STORAGE_KEY, questionId: questions[0].id });
  await start(page);
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 40');
  await expect(page.getByRole('slider')).toHaveAttribute('data-selected', 'false');
  expect(await page.evaluate(key => localStorage.getItem(key), LEGACY_STORAGE_KEY)).toBeNull();
});

test('phone scale fits; touch release selects locally and Next submits the value', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Uses the phone touch context.');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir('.work/answer-scale', { recursive: true });
  // Clear this fixture's browser state before each new document. Clearing it
  // just before navigation can be undone by the old collector's pagehide save.
  await page.addInitScript(key => {
    localStorage.removeItem(key);
    localStorage.removeItem('nbti:collector:v1');
  }, STORAGE_KEY);
  const touch = await context.newCDPSession(page);
  for (const width of [320, 393]) {
    await page.setViewportSize({ width, height: 659 });
    await start(page);
    const slider = page.getByRole('slider');
    await slider.scrollIntoViewIfNeeded();
    const bounds = await slider.boundingBox();
    const y = bounds.y + bounds.height / 2;
    const point = value => ({ x: bounds.x + (value + .5) / 15 * bounds.width, y });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(0)] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(5)] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(11)] });
    await expect(slider).toHaveAttribute('aria-valuenow', '11');
    await expect(page.locator('.answer-scale-labels .active')).toHaveText('偏右');
    await expect(slider).toHaveAttribute('data-selected', 'false');
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(slider).toHaveAttribute('data-selected', 'true');
    await expect(slider).toHaveAttribute('aria-valuenow', '11');
    expect(await page.evaluate(() => window.NBTICollector.snapshot().runs.flatMap(run => run.answers))).toEqual([]);
    const layout = await page.evaluate(() => {
      const section = document.querySelector('.question-section').getBoundingClientRect();
      const elements = [...document.querySelectorAll('.answer-scale-anchor, .answer-scale-labels span, .answer-scale-track, .answer-scale-thumb')];
      return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, left: section.left, right: section.right,
        minorDivider: parseFloat(getComputedStyle(document.querySelector('.answer-scale-cell')).borderRightWidth),
        majorDividers: [...document.querySelectorAll('.answer-scale-cell.major-boundary')].map(element => parseFloat(getComputedStyle(element).borderRightWidth)),
        bounds: elements.map(element => { const box = element.getBoundingClientRect(); return { left: box.left, right: box.right, scrollWidth: element.scrollWidth, width: element.clientWidth }; }) };
    });
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.width);
    expect(layout.majorDividers).toHaveLength(4);
    for (const divider of layout.majorDividers) expect(divider).toBeGreaterThanOrEqual(layout.minorDivider * 3);
    for (const box of layout.bounds) {
      expect(box.left).toBeGreaterThanOrEqual(layout.left);
      expect(box.right).toBeLessThanOrEqual(layout.right);
      expect(box.scrollWidth).toBeLessThanOrEqual(box.width + 1);
    }
    await page.locator('.question-section').screenshot({ path: `.work/answer-scale/phone-${width}.png`, scale: 'css' });
    await page.getByRole('button', { name: '下一幕', exact: true }).click();
    await expect(page.locator('.quiz-counter')).toHaveText('02 / 40');
    const submitted = await page.evaluate(() => window.NBTICollector.snapshot().runs.flatMap(run => run.answers));
    expect(submitted.map(answer => [answer.questionId, answer.scaleValue])).toEqual([[questions[0].id, 11]]);
  }
  await touch.detach();
  expect(errors).toEqual([]);
});
