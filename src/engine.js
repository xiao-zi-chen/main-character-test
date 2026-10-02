import { dimensions, questions } from './data/questions.js';
import { roles, regularRoles, roleById } from './data/roles.js';
import { hiddenRoleForScores } from './hidden-rules.js';

export const STORAGE_KEY = 'main-character-casting:v1';
export const isAnswer = value => value === 'A' || value === 'B';
export const answeredCount = answers => questions.filter(q => isAnswer(answers[q.id])).length;
export const isComplete = answers => answeredCount(answers) === questions.length;

export function cleanAnswers(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(questions.filter(q => isAnswer(input[q.id])).map(q => [q.id, input[q.id]]));
}

export function readProgress(storage) {
  try {
    const data = JSON.parse(storage.getItem(STORAGE_KEY));
    if (data?.version !== 1) return { answers: {}, index: 0 };
    const answers = cleanAnswers(data.answers);
    const firstUnanswered = questions.findIndex(q => !isAnswer(answers[q.id]));
    const maxIndex = firstUnanswered < 0 ? questions.length - 1 : firstUnanswered;
    const index = Number.isInteger(data.index) ? Math.max(0, Math.min(data.index, maxIndex)) : maxIndex;
    return { answers, index };
  } catch {
    return { answers: {}, index: 0 };
  }
}

export function saveProgress(storage, answers, index) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, answers: cleanAnswers(answers), index }));
    return true;
  } catch { return false; }
}

export function scoreAnswers(input) {
  const answers = cleanAnswers(input);
  if (!isComplete(answers)) throw new Error('请完成全部 40 道题后再揭晓角色。');
  return dimensions.map(dimension => {
    const items = questions.filter(q => q.dimension === dimension.id);
    const positive = items.filter(q => answers[q.id] === q.highAnswer).length;
    return { ...dimension, value: Math.round(positive / items.length * 100), positive, total: items.length };
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
