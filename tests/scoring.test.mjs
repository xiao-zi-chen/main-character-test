import test from 'node:test';
import assert from 'node:assert/strict';
import { questions, dimensions } from '../src/data/questions.js';
import { regularRoles as roles } from '../src/data/roles.js';
import { scoreAnswers, getResult, cleanAnswers, readProgress, saveProgress, isComplete, STORAGE_KEY } from '../src/engine.js';

const opposite = value => value === 'A' ? 'B' : 'A';
const allHigh = Object.fromEntries(questions.map(q => [q.id, q.highAnswer]));

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
  assert.ok(scoreAnswers(Object.fromEntries(questions.map(q => [q.id, opposite(q.highAnswer)]))).every(score => score.value === 0));
  assert.equal(high.find(s => s.id === 'social').total, 5);
  assert.equal(high.find(s => s.id === 'imagine').total, 3);
  const mixed = { ...allHigh, '4.2': opposite(allHigh['4.2']) };
  assert.equal(scoreAnswers(mixed).find(s => s.id === 'social').value, 80);
  assert.equal(scoreAnswers(mixed).find(s => s.id === 'imagine').value, 100);
});

test('every one of the regular character endings is reachable through real answers', () => {
  for (const role of roles) {
    const answers = {};
    dimensions.forEach((dimension, index) => {
      const items = questions.filter(q => q.dimension === dimension.id);
      const highCount = Math.round(role.profile[index] / 100 * items.length);
      items.forEach((q, i) => { answers[q.id] = i < highCount ? q.highAnswer : opposite(q.highAnswer); });
    });
    assert.equal(getResult(answers).role.id, role.id, `${role.name} must be reachable`);
  }
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
  assert.deepEqual(readProgress(broken), { answers: {}, index: 0 });
  assert.equal(saveProgress(broken, allHigh, 39), false);
  const invalid = { getItem: () => '{broken-json' };
  assert.deepEqual(readProgress(invalid), { answers: {}, index: 0 });
  const hostile = { getItem: () => JSON.stringify({ version: 1, index: 900, answers: { '1.1': 'A', '2.1': 'script', 'bogus': 'B' } }) };
  assert.deepEqual(readProgress(hostile), { answers: { '1.1': 'A' }, index: 1 });
  assert.deepEqual(cleanAnswers(['A','B']), {});
});

test('saved progress round-trips, including edits to previous questions', () => {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  assert.equal(saveProgress(storage, allHigh, 12), true);
  assert.deepEqual(readProgress(storage), { answers: allHigh, index: 12 });
  assert.equal(JSON.parse(memory.get(STORAGE_KEY)).version, 1);
});
