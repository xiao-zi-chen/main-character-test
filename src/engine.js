import { dimensions, questions } from './data/questions.js';
import { regularRoles, roleById } from './data/roles.js';
import { SCALE_MIN, SCALE_MAX } from './data/answer-scale.js';
import { hiddenRoleForScores } from './hidden-rules.js';

export const STORAGE_KEY = 'main-character-casting:v2';
export const LEGACY_STORAGE_KEY = 'main-character-casting:v1';
export const isAnswer = value => Number.isInteger(value) && value >= SCALE_MIN && value <= SCALE_MAX;
export const answeredCount = answers => Object.keys(cleanAnswers(answers)).length;
export const isComplete = answers => answeredCount(answers) === questions.length;

export function cleanAnswers(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(questions.filter(q => Object.hasOwn(input, q.id) && isAnswer(input[q.id])).map(q => [q.id, input[q.id]]));
}

export function readProgress(storage) {
  // Binary progress belongs to the retired questionnaire and must not resume here.
  try { storage.removeItem?.(LEGACY_STORAGE_KEY); } catch { /* Storage may be blocked. */ }
  try {
    const data = JSON.parse(storage.getItem(STORAGE_KEY));
    if (data?.version !== 2) return { answers: {}, index: 0, submitted: false };
    const answers = cleanAnswers(data.answers);
    const firstUnanswered = questions.findIndex(q => !isAnswer(answers[q.id]));
    const maxIndex = firstUnanswered < 0 ? questions.length - 1 : firstUnanswered;
    const index = Number.isInteger(data.index) ? Math.max(0, Math.min(data.index, maxIndex)) : maxIndex;
    return { answers, index, submitted: data.submitted === true && isComplete(answers) };
  } catch {
    return { answers: {}, index: 0, submitted: false };
  }
}

export function saveProgress(storage, answers, index, submitted = false) {
  try {
    const validAnswers = cleanAnswers(answers);
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, answers: validAnswers, index, submitted: submitted === true && isComplete(validAnswers) }));
    return true;
  } catch { return false; }
}

export function scoreAnswers(input) {
  const answers = cleanAnswers(input);
  if (!isComplete(answers)) throw new Error('请完成全部 40 道题后再揭晓角色。');
  return dimensions.map(dimension => {
    const items = questions.filter(q => q.dimension === dimension.id);
    const highUnits = items.reduce((sum, q) => sum + (q.highAnswer === 'A' ? SCALE_MAX - answers[q.id] : answers[q.id] - SCALE_MIN), 0);
    const positive = highUnits / (SCALE_MAX - SCALE_MIN);
    return { ...dimension, value: Math.round(highUnits / (items.length * (SCALE_MAX - SCALE_MIN)) * 100), positive, total: items.length };
  });
}

export function rankRoles(scores) {
  return regularRoles.map(role => {
    const totalWeight = role.weights.reduce((a, b) => a + b, 0);
    const distance = scores.reduce((sum, score, i) => sum + role.weights[i] * ((score.value - role.profile[i]) / 100) ** 2, 0) / totalWeight;
    return { role, distance };
  }).sort((a, b) => a.distance - b.distance || a.role.number.localeCompare(b.role.number));
}

export function getResult(answers, options = {}) {
  const scores = scoreAnswers(answers);
  const ranking = rankRoles(scores);
  const hiddenId = options.hiddenEnabled ? hiddenRoleForScores(scores) : null;
  return { role: hiddenId ? roleById[hiddenId] : ranking[0].role, scores, ranking, hiddenUnlocked: Boolean(hiddenId) };
}
