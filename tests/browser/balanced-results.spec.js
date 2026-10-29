import { test, expect } from '@playwright/test';
import { dimensions } from '../../src/data/questions.js';
import { regularRoles as roles } from '../../src/data/roles.js';
import { getResult, STORAGE_KEY } from '../../src/engine.js';
import { drawQuestions, questionById } from '../../src/question-session.js';
import { sampleDimensionUnits, seededRandom } from '../../scripts/lib/role-samples.mjs';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/collect', route => route.fulfill({ json: { ok: true } }));
});

test('the built website uses calibrated matching and keeps results stable after refresh', async ({ page }) => {
  const random = seededRandom(829611);
  const questionIds = drawQuestions(random);
  let answers, result;
  for (let sample = 0; sample < 100; sample++) {
    answers = {};
    for (const d of dimensions) {
      const ids = questionIds.filter(id => questionById[id].dimension === d.id);
      const values = sampleDimensionUnits(random, 'uniform15', ids.length);
      ids.forEach((id, i) => { answers[id] = questionById[id].highAnswer === 'A' ? 14 - values[i] : values[i]; });
    }
    result = getResult(answers, { questionIds });
    const original = [...result.ranking].sort((a, b) => a.distance - b.distance || a.role.number.localeCompare(b.role.number))[0];
    if (result.role.id !== original.role.id) break;
  }
  const original = [...result.ranking].sort((a, b) => a.distance - b.distance || a.role.number.localeCompare(b.role.number))[0];
  expect(result.role.id).not.toBe(original.role.id); // Catches a stale frontend bundle.
  await page.addInitScript(({ key, questionIds, answers }) => {
    localStorage.setItem(key, JSON.stringify({ version: 5, questionIds, answers, index: 19, submitted: true }));
  }, { key: STORAGE_KEY, questionIds, answers });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/result');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(result.role.name);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(result.role.name);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).answers, STORAGE_KEY)).toEqual(answers);
  expect(errors).toEqual([]);
});

test('every character still renders as itself for a matching completed answer sheet', async ({ page }) => {
  test.setTimeout(120000);
  const questionIds = drawQuestions(seededRandom(248031));
  const profiles = {};
  for (const role of roles) {
    profiles[role.id] = Object.fromEntries(questionIds.map(id => {
      const question = questionById[id];
      const dimension = dimensions.findIndex(d => d.id === question.dimension);
      const units = Math.round(role.profile[dimension] * 14 / 100);
      return [id, question.highAnswer === 'A' ? 14 - units : units];
    }));
  }
  await page.addInitScript(({ key, questionIds, profiles }) => {
    const answers = profiles[new URL(location.href).searchParams.get('matchingCheck')];
    if (answers) localStorage.setItem(key, JSON.stringify({ version: 5, questionIds, answers, index: 19, submitted: true }));
  }, { key: STORAGE_KEY, questionIds, profiles });
  for (const role of roles) {
    await page.goto(`/?matchingCheck=${role.id}#/result`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(role.name);
  }
});
