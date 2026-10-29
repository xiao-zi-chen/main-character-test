import test from 'node:test';
import assert from 'node:assert/strict';
import { questions, dimensions } from '../src/data/questions.js';
import { regularRoles as roles, mediaPath } from '../src/data/roles.js';
import { mediaAsset } from '../src/media.js';
import { mediaBaseUrl } from '../src/runtime-config.js';
import { scoreAnswers, getResult, cleanAnswers, readProgress, saveProgress, isAnswer, answeredCount, isComplete, STORAGE_KEY, LEGACY_STORAGE_KEY } from '../src/engine.js';
import { SCALE_MIN, SCALE_MAX, SCALE_MID, SCALE_STEPS, SCALE_SHORTCUTS, reactionIndex, QUESTIONNAIRE_VERSION } from '../src/data/answer-scale.js';

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

test('all 28 selected characters are reachable with graded responses close to their original profiles', () => {
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

test('endpoint responses preserve binary scores and raw weighted distances while ranking by calibrated matching distance', () => {
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
    const distancesById = ranking => Object.fromEntries(ranking.map(item => [item.role.id, item.distance]));
    assert.deepEqual(distancesById(result.ranking), distancesById(expectedRanking));
    assert.ok(result.ranking.every(item => Number.isFinite(item.matchingDistance)));
    assert.ok(result.ranking.every((item, index, ranking) => index === 0 || ranking[index - 1].matchingDistance <= item.matchingDistance));
    assert.equal(result.role.id, result.ranking[0].role.id);
  }
});

test('all 15 levels score continuously, neutral is 50 and each reverse question preserves direction', () => {
  assert.equal(SCALE_STEPS, 15);
  assert.equal(QUESTIONNAIRE_VERSION, 'nbti-2026-10-20-scale15-sample20');
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
  for (const [highUnits, expected] of [[[1, 2, 2, 2], 13], [[12, 12, 12, 13], 88]]) {
    items.forEach((q, i) => { answers[q.id] = q.highAnswer === 'A' ? SCALE_MAX - highUnits[i] : highUnits[i]; });
    assert.equal(scoreAnswers(answers).find(score => score.id === dimension.id).value, expected);
  }
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

test('fifteen exact answers map to five artwork groups with explicit boundaries and shortcuts', () => {
  assert.deepEqual(SCALE_SHORTCUTS, [0, 4, 7, 10, 14]);
  assert.deepEqual(Array.from({ length: 15 }, (_, value) => reactionIndex(value)), [
    0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4,
  ]);
  for (const boundary of [3, 6, 9, 12]) {
    assert.equal(reactionIndex(boundary) - reactionIndex(boundary - 1), 1);
  }
});

test('same answers give the same result; incomplete answers never produce a result', () => {
  assert.equal(getResult(allHigh).role.id, getResult({ ...allHigh }).role.id);
  assert.throws(() => getResult({}), /40/);
  const missing = { ...allHigh }; delete missing['10.4'];
  assert.equal(isComplete(missing), false);
  assert.throws(() => getResult(missing));
});

test('media URLs work without a browser and use the configured COS origin', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const role = roles[0];
  try {
    delete globalThis.window;
    assert.equal(mediaBaseUrl(), './');
    assert.equal(mediaPath(role), `./media/${role.videoId}.mp4`);
    assert.equal(mediaAsset(role, { portrait: 'portrait.webp' }), './media/portrait.webp');
    globalThis.window = { NBTI_PUBLIC_CONFIG: { mediaBaseUrl: 'https://static.example.com/assets/' } };
    assert.equal(mediaPath(role, 'mp4', 'v 1'), `https://static.example.com/assets/media/${role.videoId}.mp4?v=v%201`);
    assert.equal(mediaAsset(role, { portrait: 'portrait.webp', revision: 'v 1' }), 'https://static.example.com/assets/media/portrait.webp?v=v%201');
    assert.equal(mediaAsset(role, { portrait: '../private.webp' }), `https://static.example.com/assets/media/${role.id}.jpg`);
    globalThis.window.NBTI_PUBLIC_CONFIG.mediaBaseUrl = '';
    assert.equal(mediaBaseUrl(), './');
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  }
});
