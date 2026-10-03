import test from 'node:test';
import assert from 'node:assert/strict';
import { questions, dimensions } from '../src/data/questions.js';
import { regularRoles as roles, mediaPath } from '../src/data/roles.js';
import { mediaAsset } from '../src/media.js';
import { mediaBaseUrl } from '../src/runtime-config.js';
import { scoreAnswers, getResult, cleanAnswers, readProgress, saveProgress, isAnswer, answeredCount, isComplete, STORAGE_KEY, LEGACY_STORAGE_KEY } from '../src/engine.js';
import { SCALE_MIN, SCALE_MAX, SCALE_MID, SCALE_STEPS, QUESTIONNAIRE_VERSION } from '../src/data/answer-scale.js';

const opposite = value => value === 'A' ? 'B' : 'A';
const endpoint = value => value === 'A' ? SCALE_MIN : SCALE_MAX;
const allHigh = Object.fromEntries(questions.map(q => [q.id, endpoint(q.highAnswer)]));

function oldScores(answers) {
  return dimensions.map(dimension => {
    const items = questions.filter(q => q.dimension === dimension.id);
    const positive = items.filter(q => answers[q.id] === q.highAnswer).length;
    return { ...dimension, value: Math.round(positive / items.length * 100), positive, total: items.length };
  });
}

function oldRanking(scores) {
  return roles.map(role => {
    const totalWeight = role.weights.reduce((a, b) => a + b, 0);
    const distance = scores.reduce((sum, score, i) => sum + role.weights[i] * ((score.value - role.profile[i]) / 100) ** 2, 0) / totalWeight;
    return { role, distance };
  }).sort((a, b) => a.distance - b.distance || a.role.number.localeCompare(b.role.number));
}

test('all 40 original questions are present once, with two nonempty choices', () => {
  assert.equal(questions.length, 40);
  assert.equal(new Set(questions.map(q => q.id)).size, 40);
  assert.equal(questions.filter(q => q.source.endsWith('.docx')).length, 28);
  assert.equal(questions.filter(q => q.source.endsWith('.xlsx')).length, 12);
  assert.ok(questions.every(q => q.options.length === 2 && q.options.every(Boolean)));
  assert.ok(questions.find(q => q.id === '1.1').prompt.startsWith('逛展时两个场撞了'));
});

test('reverse-scored questions and unequal dimension sizes normalize correctly', () => {
  const high = scoreAnswers(allHigh);
  assert.ok(high.every(score => score.value === 100));
  assert.ok(scoreAnswers(Object.fromEntries(questions.map(q => [q.id, endpoint(opposite(q.highAnswer))]))).every(score => score.value === 0));
  assert.equal(high.find(s => s.id === 'social').total, 5);
  assert.equal(high.find(s => s.id === 'imagine').total, 3);
  const mixed = { ...allHigh, '4.2': SCALE_MAX - allHigh['4.2'] };
  assert.equal(scoreAnswers(mixed).find(s => s.id === 'social').value, 80);
  assert.equal(scoreAnswers(mixed).find(s => s.id === 'imagine').value, 100);
});

test('every one of the regular character endings is reachable through real answers', () => {
  for (const role of roles) {
    const answers = {};
    dimensions.forEach((dimension, index) => {
      const items = questions.filter(q => q.dimension === dimension.id);
      const highCount = Math.round(role.profile[index] / 100 * items.length);
      items.forEach((q, i) => { answers[q.id] = endpoint(i < highCount ? q.highAnswer : opposite(q.highAnswer)); });
    });
    assert.equal(getResult(answers).role.id, role.id, `${role.name} must be reachable`);
  }
});

test('all 18 regular roles are reachable with graded responses close to their original profiles', () => {
  for (const role of roles) {
    const answers = {};
    dimensions.forEach((dimension, index) => {
      const items = questions.filter(q => q.dimension === dimension.id);
      const totalUnits = Math.round(role.profile[index] / 100 * SCALE_MAX * items.length);
      const base = Math.floor(totalUnits / items.length);
      const remainder = totalUnits % items.length;
      items.forEach((q, i) => {
        const highUnits = base + (i < remainder ? 1 : 0);
        answers[q.id] = q.highAnswer === 'A' ? SCALE_MAX - highUnits : highUnits;
      });
    });
    assert.equal(getResult(answers).role.id, role.id, `${role.name} must remain reachable on the scale`);
  }
});

test('endpoint responses exactly preserve binary scores, weighted distances and every ranked role', () => {
  const records = [
    Object.fromEntries(questions.map(q => [q.id, 'A'])),
    Object.fromEntries(questions.map(q => [q.id, 'B'])),
    Object.fromEntries(questions.map(q => [q.id, q.highAnswer])),
  ];
  for (const changed of questions) {
    records.push(Object.fromEntries(questions.map(q => [q.id, q.id === changed.id ? opposite(q.highAnswer) : q.highAnswer])));
  }
  let seed = 4321;
  for (let record = 0; record < 200; record++) {
    records.push(Object.fromEntries(questions.map(q => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return [q.id, seed & 0x80000000 ? 'A' : 'B'];
    })));
  }
  for (const binary of records) {
    const answers = Object.fromEntries(Object.entries(binary).map(([id, value]) => [id, endpoint(value)]));
    const expectedScores = oldScores(binary);
    assert.deepEqual(scoreAnswers(answers), expectedScores);
    const result = getResult(answers);
    const expectedRanking = oldRanking(expectedScores);
    assert.deepEqual(result.ranking.map(item => [item.role.id, item.distance]), expectedRanking.map(item => [item.role.id, item.distance]));
    assert.equal(result.role.id, expectedRanking[0].role.id);
  }
});

test('all 15 levels score continuously, neutral is 50 and each reverse question preserves direction', () => {
  assert.equal(SCALE_STEPS, 15);
  assert.equal(QUESTIONNAIRE_VERSION, 'nbti-2026-10-02-scale15');
  for (let highUnits = SCALE_MIN; highUnits <= SCALE_MAX; highUnits++) {
    const answers = Object.fromEntries(questions.map(q => [q.id, q.highAnswer === 'A' ? SCALE_MAX - highUnits : highUnits]));
    assert.ok(scoreAnswers(answers).every(score => score.value === Math.round(highUnits / SCALE_MAX * 100)));
  }
  const neutral = Object.fromEntries(questions.map(q => [q.id, SCALE_MID]));
  assert.ok(scoreAnswers(neutral).every(score => score.value === 50));
  for (const question of questions) {
    const scores = scoreAnswers({ ...neutral, [question.id]: question.highAnswer === 'A' ? SCALE_MID - 1 : SCALE_MID + 1 });
    assert.ok(scores.find(score => score.id === question.dimension).value > 50);
    assert.ok(scores.filter(score => score.id !== question.dimension).every(score => score.value === 50));
  }
});

test('half-point rounding uses exact integer response units', () => {
  const dimension = dimensions.find(d => questions.filter(q => q.dimension === d.id).length === 4);
  const items = questions.filter(q => q.dimension === dimension.id);
  const answers = { ...allHigh };
  const highUnits = [10, 13, 13, 13];
  items.forEach((q, i) => { answers[q.id] = q.highAnswer === 'A' ? SCALE_MAX - highUnits[i] : highUnits[i]; });
  assert.equal(scoreAnswers(answers).find(score => score.id === dimension.id).value, 88);
});

test('strict numeric scale validation counts the zero endpoint and excludes forged or missing answers', () => {
  assert.ok(Array.from({ length: 15 }, (_, value) => isAnswer(value)).every(Boolean));
  for (const value of ['A', 'B', '0', '14', -1, 15, 1.5, null, undefined, true, false, NaN, Infinity, {}, []]) {
    assert.equal(isAnswer(value), false);
  }
  assert.deepEqual(cleanAnswers({ '1.1': 0, '2.1': 14, '3.1': '7', '4.1': 7.5, unknown: 7 }), { '1.1': 0, '2.1': 14 });
  assert.equal(answeredCount({ '1.1': 0 }), 1);
  assert.equal(answeredCount(), 0);
  assert.deepEqual(cleanAnswers(Object.create({ '1.1': 0 })), {});
  assert.equal(isComplete(Object.fromEntries(questions.map(q => [q.id, 0]))), true);
  assert.equal(isComplete(Object.fromEntries(questions.map(q => [q.id, 'A']))), false);
});

test('same answers give the same result; incomplete answers never produce a result', () => {
  assert.equal(getResult(allHigh).role.id, getResult({ ...allHigh }).role.id);
  assert.throws(() => getResult({}), /40/);
  const missing = { ...allHigh }; delete missing['10.4'];
  assert.equal(isComplete(missing), false);
  assert.throws(() => getResult(missing));
});

test('malformed or blocked local storage cannot break the quiz', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.deepEqual(readProgress(broken), { answers: {}, index: 0, submitted: false });
  assert.equal(saveProgress(broken, allHigh, 39), false);
  const invalid = { getItem: () => '{broken-json' };
  assert.deepEqual(readProgress(invalid), { answers: {}, index: 0, submitted: false });
  const hostile = { getItem: () => JSON.stringify({ version: 2, index: 900, answers: { '1.1': 0, '2.1': 'script', 'bogus': 14 } }) };
  assert.deepEqual(readProgress(hostile), { answers: { '1.1': 0 }, index: 1, submitted: false });
  assert.deepEqual(cleanAnswers(['A','B']), {});
  const oldVersion = { getItem: () => JSON.stringify({ version: 1, index: 0, answers: { '1.1': 0 } }) };
  assert.deepEqual(readProgress(oldVersion), { answers: {}, index: 0, submitted: false });
});

test('saved progress round-trips, including edits to previous questions', () => {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  assert.equal(saveProgress(storage, allHigh, 12), true);
  assert.deepEqual(readProgress(storage), { answers: allHigh, index: 12, submitted: false });
  assert.equal(JSON.parse(memory.get(STORAGE_KEY)).version, 2);
});

test('all 40 draft answers still require explicit final submission after reload', () => {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  saveProgress(storage, allHigh, 39);
  assert.deepEqual(readProgress(storage), { answers: allHigh, index: 39, submitted: false });
  assert.equal(JSON.parse(memory.get(STORAGE_KEY)).submitted, false);
  memory.set(STORAGE_KEY, JSON.stringify({ version: 2, answers: allHigh, index: 39 }));
  assert.equal(readProgress(storage).submitted, false);
  saveProgress(storage, allHigh, 39, true);
  assert.deepEqual(readProgress(storage), { answers: allHigh, index: 39, submitted: true });
  assert.equal(JSON.parse(memory.get(STORAGE_KEY)).submitted, true);
  assert.equal(JSON.parse(memory.get(STORAGE_KEY)).version, 2);
});

test('submission flag is strictly boolean and cannot validate incomplete or invalid drafts', () => {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const incomplete = { ...allHigh }; delete incomplete['10.4'];
  const invalid = { ...allHigh, '10.4': '14' };
  for (const answers of [incomplete, invalid]) {
    saveProgress(storage, answers, 39, true);
    assert.equal(JSON.parse(memory.get(STORAGE_KEY)).submitted, false);
    memory.set(STORAGE_KEY, JSON.stringify({ version: 2, answers, index: 39, submitted: true }));
    assert.equal(readProgress(storage).submitted, false);
  }
  for (const submitted of ['true', 1, {}, null, false]) {
    saveProgress(storage, allHigh, 39, submitted);
    assert.equal(readProgress(storage).submitted, false);
    memory.set(STORAGE_KEY, JSON.stringify({ version: 2, answers: allHigh, index: 39, submitted }));
    assert.equal(readProgress(storage).submitted, false);
  }
  const allZero = Object.fromEntries(questions.map(q => [q.id, 0]));
  saveProgress(storage, allZero, 39, true);
  assert.equal(readProgress(storage).submitted, true);
});

test('old binary progress is deleted without clearing unrelated local storage', () => {
  const memory = new Map([
    [LEGACY_STORAGE_KEY, JSON.stringify({ version: 1, answers: { '1.1': 'A' }, index: 1 })],
    ['unrelated', 'preserve'],
  ]);
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  assert.deepEqual(readProgress(storage), { answers: {}, index: 0, submitted: false });
  assert.equal(memory.has(LEGACY_STORAGE_KEY), false);
  assert.equal(memory.get('unrelated'), 'preserve');
  saveProgress(storage, { '1.1': 0 }, 0);
  storage.removeItem = () => { throw new Error('remove denied'); };
  assert.deepEqual(readProgress(storage), { answers: { '1.1': 0 }, index: 0, submitted: false });
});

test('media URLs work without a browser and use the configured COS origin', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const role = roles[0];
  try {
    delete globalThis.window;
    assert.equal(mediaBaseUrl(), './');
    assert.equal(mediaPath(role), `./media/${role.id}.mp4`);
    assert.equal(mediaAsset(role, { portrait: 'portrait.webp' }), './media/portrait.webp');
    globalThis.window = { NBTI_PUBLIC_CONFIG: { mediaBaseUrl: 'https://static.example.com/assets/' } };
    assert.equal(mediaPath(role, 'mp4', 'v 1'), `https://static.example.com/assets/media/${role.id}.mp4?v=v%201`);
    assert.equal(mediaAsset(role, { portrait: 'portrait.webp', revision: 'v 1' }), 'https://static.example.com/assets/media/portrait.webp?v=v%201');
    assert.equal(mediaAsset(role, { portrait: '../private.webp' }), `https://static.example.com/assets/media/${role.id}.jpg`);
    globalThis.window.NBTI_PUBLIC_CONFIG.mediaBaseUrl = '';
    assert.equal(mediaBaseUrl(), './');
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  }
});
