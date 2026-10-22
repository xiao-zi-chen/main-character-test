import { dimensions, questions } from './data/questions.js';
import { regularRoles, roleById } from './data/roles.js';
import { SCALE_MIN, SCALE_MAX } from './data/answer-scale.js';
import { hiddenRoleForScores } from './hidden-rules.js';
import { allQuestionIds, questionById, validQuestionIds, newProgress } from './question-session.js';

export const STORAGE_KEY = 'main-character-casting:v5';
export const LEGACY_STORAGE_KEY = 'main-character-casting:v1';
export const isAnswer = value => Number.isInteger(value) && value >= SCALE_MIN && value <= SCALE_MAX;
export const answeredCount = (answers, questionIds = allQuestionIds) => questionIds.filter(id => Object.hasOwn(answers ?? {}, id) && isAnswer(answers[id])).length;
export const isComplete = (answers, questionIds = allQuestionIds) => questionIds.length > 0 && answeredCount(answers, questionIds) === questionIds.length;

export function cleanAnswers(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(questions.filter(q => Object.hasOwn(input, q.id) && isAnswer(input[q.id])).map(q => [q.id, input[q.id]]));
}

export function readProgress(storage) {
  // Binary progress belongs to the retired questionnaire and must not resume here.
  try { storage.removeItem?.(LEGACY_STORAGE_KEY); } catch { /* Storage may be blocked. */ }
  try {
    const data = JSON.parse(storage.getItem(STORAGE_KEY));
    if (data?.version !== 5 || !validQuestionIds(data.questionIds)) return newProgress();
    const questionIds = data.questionIds;
    const answers = Object.fromEntries(Object.entries(cleanAnswers(data.answers)).filter(([id]) => questionIds.includes(id)));
    const firstUnanswered = questionIds.findIndex(id => !isAnswer(answers[id]));
    const maxIndex = firstUnanswered < 0 ? questionIds.length - 1 : firstUnanswered;
    const index = Number.isInteger(data.index) ? Math.max(0, Math.min(data.index, maxIndex)) : maxIndex;
    return { questionIds, answers, index, submitted: data.submitted === true && isComplete(answers, questionIds) };
  } catch {
    return newProgress();
  }
}

export function saveProgress(storage, answers, index, submitted = false, questionIds) {
  try {
    if (!validQuestionIds(questionIds)) return false;
    const validAnswers = Object.fromEntries(Object.entries(cleanAnswers(answers)).filter(([id]) => questionIds.includes(id)));
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 5, questionIds, answers: validAnswers, index, submitted: submitted === true && isComplete(validAnswers, questionIds) }));
    return true;
  } catch { return false; }
}

export function scoreAnswers(input, questionIds = allQuestionIds) {
  const answers = cleanAnswers(input);
  if (questionIds !== allQuestionIds && !validQuestionIds(questionIds)) throw new Error('本轮题目无效，请重新开始。');
  if (!isComplete(answers, questionIds)) throw new Error(`请完成全部 ${questionIds.length} 道题后再揭晓角色。`);
  return dimensions.map(dimension => {
    const items = questionIds.map(id => questionById[id]).filter(q => q.dimension === dimension.id);
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
  const scores = scoreAnswers(answers, options.questionIds);
  const ranking = rankRoles(scores);
  const hiddenId = options.hiddenEnabled ? hiddenRoleForScores(scores) : null;
  return { role: hiddenId ? roleById[hiddenId] : ranking[0].role, scores, ranking, hiddenUnlocked: Boolean(hiddenId) };
}
