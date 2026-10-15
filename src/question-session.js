import { dimensions, questions } from './data/questions.js';

export const SESSION_SIZE = 20;
export const questionById = Object.fromEntries(questions.map(question => [question.id, question]));
export const allQuestionIds = questions.map(question => question.id);

function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Cover every dimension equally before randomizing presentation order.
export function drawQuestions(random = Math.random) {
  const selected = dimensions.flatMap(dimension => {
    const pool = questions.filter(question => question.dimension === dimension.id);
    if (pool.length < 2) throw new Error(`Not enough questions for ${dimension.id}`);
    return shuffle(pool, random).slice(0, 2).map(question => question.id);
  });
  return shuffle(selected, random);
}

export function validQuestionIds(ids) {
  return Array.isArray(ids) && ids.length === SESSION_SIZE && new Set(ids).size === SESSION_SIZE &&
    ids.every(id => typeof id === 'string' && Object.hasOwn(questionById, id)) &&
    dimensions.every(dimension => ids.filter(id => questionById[id].dimension === dimension.id).length === 2);
}

export function newProgress() {
  return { questionIds: drawQuestions(), answers: {}, index: 0, submitted: false };
}
