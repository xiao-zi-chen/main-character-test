import { confirmAnswer } from './quiz-helpers.js';
import { test, expect } from '@playwright/test';
import { STORAGE_KEY } from '../../src/engine.js';
import { QUESTIONNAIRE_VERSION } from '../../src/data/answer-scale.js';
import { questions, dimensions } from '../../src/data/questions.js';

const labels = ['更接近左侧', '偏左', '中立', '偏右', '更接近右侧'];
const shortcuts = [0, 4, 7, 10, 14];
const ids = dimensions.flatMap(dimension => questions.filter(question => question.dimension === dimension.id).slice(0, 2).map(question => question.id));

test('fifteen exact choices share five reaction groups and submit only on Next', async ({ page }) => {
  await page.goto('/#/test');
  const slider = page.getByRole('slider');
  await expect(slider).toHaveAttribute('aria-valuemax', '14');
  await expect(page.locator('.answer-scale-cell')).toHaveCount(15);
  await expect(page.locator('.answer-scale-cell.major-boundary')).toHaveCount(4);
  for (let group = 0; group < labels.length; group++) {
    await page.getByRole('button', { name: labels[group], exact: true }).click();
    await expect(slider).toHaveAttribute('aria-valuenow', String(shortcuts[group]));
    await expect(page.getByRole('button', { name: labels[group], exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await slider.press('Home');
  for (let value = 0; value < 15; value++) {
    if (value) await slider.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuenow', String(value));
    const group = Math.floor(value / 3);
    await expect(page.locator('.question-scene img')).toHaveAttribute('src', /\/scene\.webp/);
    await expect(page.getByRole('region', { name: '所选反应预览' })).toHaveCount(0);
    await expect(page.locator('.answer-scale-labels .active')).toHaveText(labels[group]);
    const draft = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
    expect(draft.answers[draft.questionIds[0]]).toBe(value);
  }
  expect(await page.evaluate(() => window.NBTICollector.snapshot().runs.flatMap(run => run.answers))).toEqual([]);
  for (const value of [15, -1, 2.5]) {
    expect(await page.evaluate(value => {
      const state = window.NBTICollector.snapshot();
      const run = state.runs.find(run => run.session.id === state.activeSessionId);
      return window.NBTICollector.answer(run.questionId, value);
    }, value)).toBe(false);
  }
  await confirmAnswer(page);
  const state = await page.evaluate(() => window.NBTICollector.snapshot());
  const run = state.runs.find(run => run.session.id === state.activeSessionId);
  expect(run.answers.map(answer => answer.scaleValue)).toEqual([14]);
  expect(run.session.questionnaireVersion).toBe(QUESTIONNAIRE_VERSION);
});

test('every exact value including reaction boundaries reaches the collector unchanged', async ({ page }) => {
  await page.goto('/#/test');
  for (let value = 0; value < 15; value++) {
    const slider = page.getByRole('slider');
    await slider.press('Home');
    for (let step = 0; step < value; step++) await slider.press('ArrowRight');
    await confirmAnswer(page);
  }
  const state = await page.evaluate(() => window.NBTICollector.snapshot());
  const run = state.runs.find(run => run.session.id === state.activeSessionId);
  expect(run.answers.map(answer => answer.scaleValue)).toEqual(Array.from({ length: 15 }, (_, value) => value));
  expect(run.answers.map(answer => answer.questionId)).toEqual(run.session.questionIds.slice(0, 15));
  await expect(page.locator('.quiz-counter')).toHaveText('16 / 20');
});

test('old 20 and 40 question outboxes retain exact answers and timings without resuming old progress', async ({ page }) => {
  await page.route('**/api/collect', route => route.fulfill({ status: 503, body: 'unavailable' }));
  const oldProgress = {
    'main-character-casting:v3': { version: 3, questionIds: ids, answers: { [ids[0]]: 14 }, index: 1 },
    'main-character-casting:v4': { version: 4, questionIds: ids, answers: { [ids[0]]: 4 }, index: 1 },
  };
  const runs = [
    ['nbti-2026-10-15-sample20', ids],
    ['nbti-2026-10-02-scale15', questions.map(question => question.id)],
  ].map(([version, questionIds], index) => ({
    session: {
      id: `00000000-0000-4000-8000-00000000000${index}`, questionnaireVersion: version,
      participantId: null, ...(index === 0 ? { questionIds } : {}),
      startedAt: '2026-10-16T00:00:00Z', completedAt: null, totalElapsedMs: null,
    },
    answers: questionIds.map((questionId, position) => ({
      eventId: `00000000-0000-4000-80${index}0-${String(position).padStart(12, '0')}`,
      sequence: position + 1, questionId, scaleValue: position % 15,
      responseTimeMs: 1234 + position, answeredAt: '2026-10-16T00:02:00Z',
    })),
    syncedCount: 0, syncedSession: false, syncedCompletedAt: null, activeElapsedMs: 123456,
    questionElapsedMs: 0, questionId: questionIds[0],
  }));
  await page.addInitScript(({ oldProgress, runs }) => {
    for (const [key, value] of Object.entries(oldProgress)) localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem('nbti:collector:v1', JSON.stringify({
      version: 2, participantToken: 'a'.repeat(64), participantId: null,
      activeSessionId: runs[0].session.id, runs,
    }));
  }, { oldProgress, runs });
  await page.goto('/#/test');
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(page.getByRole('slider')).toHaveAttribute('data-selected', 'false');
  const state = await page.evaluate(() => window.NBTICollector.snapshot());
  expect(state.participantToken).toBe('a'.repeat(64));
  for (const oldRun of runs) {
    const retained = state.runs.find(run => run.session.id === oldRun.session.id);
    expect(retained.answers).toEqual(oldRun.answers);
    expect(retained.session.questionnaireVersion).toBe(oldRun.session.questionnaireVersion);
    expect(retained.session.questionIds).toEqual(oldRun.session.questionIds);
    expect(retained.activeElapsedMs).toBe(oldRun.activeElapsedMs);
    expect(state.activeSessionId).not.toBe(oldRun.session.id);
  }
  const progress = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(progress.version).toBe(5);
  expect(progress.answers).toEqual({});
  for (const [key, value] of Object.entries(oldProgress)) {
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).toEqual(value);
  }
});
