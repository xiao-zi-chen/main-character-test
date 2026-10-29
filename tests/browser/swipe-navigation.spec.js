import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/collect', route => route.fulfill({ json: { ok: true } }));
});

const touchSessions = new WeakMap();
async function touchSession(page) {
  if (!touchSessions.has(page)) touchSessions.set(page, page.context().newCDPSession(page));
  return touchSessions.get(page);
}

async function touchDrag(page, start, end) {
  const session = await touchSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
  for (let step = 1; step <= 6; step++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{
        x: start.x + (end.x - start.x) * step / 6,
        y: start.y + (end.y - start.y) * step / 6, id: 1,
      }],
    });
    await page.waitForTimeout(24);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function drag(page, start, end, mobile) {
  if (mobile) return touchDrag(page, start, end);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

async function dragQuestion(page, forward, mobile) {
  const surface = page.locator('.question-meta');
  await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();
  const y = box.y + box.height / 2;
  const left = box.x + box.width * .22;
  const right = box.x + box.width * .78;
  await drag(page, { x: forward ? right : left, y }, { x: forward ? left : right, y }, mobile);
}

async function collectorAnswers(page) {
  return page.evaluate(() => {
    const state = window.NBTICollector.snapshot();
    return state.runs.find(run => run.session.id === state.activeSessionId).answers;
  });
}

test('previous and next buttons navigate on desktop and mobile; preview keeps the answer local', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/test');
  const previous = page.getByRole('button', { name: '上一题', exact: true });
  const next = page.getByRole('button', { name: '下一题', exact: true });
  const slider = page.getByRole('slider');
  await expect(previous).toBeVisible();
  await expect(next).toBeVisible();
  await expect(previous).toBeDisabled();
  await expect(next).toBeDisabled();
  await expect(page.locator('.question-swipe-hint')).toHaveCount(0);
  await slider.press('End');
  await expect(next).toBeEnabled();
  expect(await collectorAnswers(page)).toHaveLength(0);
  const preview = page.getByRole('button', { name: '看看我的这一幕', exact: true });
  await preview.click();
  await expect(page.getByRole('dialog', { name: '所选反应预览' })).toBeVisible();
  if (testInfo.project.name === 'mobile') await page.touchscreen.tap(8, 8);
  else await page.mouse.click(8, 8);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  expect(await collectorAnswers(page)).toHaveLength(0);
  await next.click();
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
  await expect(previous).toBeEnabled();
  await expect(next).toBeDisabled();
  expect(await collectorAnswers(page)).toHaveLength(1);
  await previous.click();
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(previous).toBeDisabled();
  await expect(slider).toHaveAttribute('aria-valuenow', '14');
  await expect(next).toBeEnabled();
  expect(await collectorAnswers(page)).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('horizontal page drags no longer navigate; slider drags still select without submitting', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.goto('/#/test');
  const slider = page.getByRole('slider');
  await slider.scrollIntoViewIfNeeded();
  const bounds = await slider.boundingBox();
  const y = bounds.y + bounds.height / 2;
  await drag(page, { x: bounds.x + 4, y }, { x: bounds.x + bounds.width - 4, y }, mobile);
  await expect(slider).toHaveAttribute('aria-valuenow', '14');
  await expect(slider).toHaveAttribute('data-selected', 'true');
  await dragQuestion(page, true, mobile);
  await dragQuestion(page, false, mobile);
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await collectorAnswers(page)).toHaveLength(0);
  await page.getByRole('button', { name: '下一题', exact: true }).click();
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
  await slider.press('End');
  await dragQuestion(page, true, mobile);
  await dragQuestion(page, false, mobile);
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
  expect(await collectorAnswers(page)).toHaveLength(1);
});

test('navigation buttons complete all twenty questions on desktop and mobile', async ({ page }) => {
  await page.goto('/#/test');
  for (let index = 0; index < 20; index++) {
    await expect(page.locator('.quiz-counter')).toHaveText(`${String(index + 1).padStart(2, '0')} / 20`);
    await page.getByRole('slider').press('End');
    await page.getByRole('button', { name: index === 19 ? '揭晓我的主角' : '下一题', exact: true }).click();
  }
  await expect(page).toHaveURL(/#\/reveal$/);
  expect(await page.evaluate(() => {
    const state = window.NBTICollector.snapshot();
    const run = state.runs.find(run => run.session.id === state.activeSessionId);
    return { count: run.answers.length, complete: Boolean(run.session.completedAt) };
  })).toEqual({ count: 20, complete: true });
});
