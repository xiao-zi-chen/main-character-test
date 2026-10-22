import test from 'node:test';
import assert from 'node:assert/strict';
import { questions, dimensions } from '../src/data/questions.js';
import { questionCopy } from '../src/data/question-copy.js';
import { roles } from '../src/data/roles.js';
import { drawQuestions, validQuestionIds, newProgress, questionById } from '../src/question-session.js';
import { scoreAnswers, getResult, readProgress, saveProgress, STORAGE_KEY, LEGACY_STORAGE_KEY } from '../src/engine.js';
import { SCALE_MAX, SCALE_MID } from '../src/data/answer-scale.js';

test('forty complete prompts produce balanced, distinct twenty-item draws',()=>{
  assert.equal(questions.length,40);
  assert.deepEqual(Object.keys(questionCopy).sort(),questions.map(q=>q.id).sort());
  for(const q of questions){assert.ok(questionCopy[q.id].prompt);assert.equal(questionCopy[q.id].options.length,2);}
  const draws=Array.from({length:100},()=>drawQuestions());
  assert.ok(draws.every(validQuestionIds));
  assert.ok(new Set(draws.map(ids=>ids.join(','))).size>90);
  assert.equal(new Set(draws.flat()).size,40);
  assert.equal(validQuestionIds([...draws[0].slice(0,19),draws[0][0]]),false);
  assert.equal(validQuestionIds(questions.slice(0,20).map(q=>q.id)),false);
});

test('sampled scoring ignores unselected answers and keeps every regular and hidden ending reachable',()=>{
  for(let draw=0;draw<30;draw++) {
    const questionIds=drawQuestions();
    for(const role of roles) {
      const answers=Object.fromEntries(questionIds.map(id=>{const q=questionById[id];const units=Math.round(role.profile[dimensions.findIndex(d=>d.id===q.dimension)]*SCALE_MAX/100);return [id,q.highAnswer==='A'?SCALE_MAX-units:units];}));
      const result=getResult(answers,{questionIds,hiddenEnabled:Boolean(role.hidden)});
      assert.equal(result.role.id,role.id);
      assert.ok(result.scores.every(score=>score.total===2));
      const outside=questions.find(q=>!questionIds.includes(q.id));
      assert.deepEqual(scoreAnswers({...answers,[outside.id]:0},questionIds),result.scores);
      delete answers[questionIds[0]];
      assert.throws(()=>scoreAnswers(answers,questionIds),/20/);
    }
  }
});

test('sample and answer order survive refresh, edits and explicit submission',()=>{
  const memory=new Map();
  const storage={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
  const initial=newProgress();
  const answers=Object.fromEntries(initial.questionIds.map(id=>[id,SCALE_MID]));
  assert.ok(saveProgress(storage,answers,19,false,initial.questionIds));
  assert.deepEqual(readProgress(storage),{...initial,answers,index:19});
  assert.ok(saveProgress(storage,answers,19,true,initial.questionIds));
  assert.equal(readProgress(storage).submitted,true);
  for(const submitted of [false,'true',1,null]){saveProgress(storage,answers,19,submitted,initial.questionIds);assert.equal(readProgress(storage).submitted,false);}
  delete answers[initial.questionIds[4]];
  saveProgress(storage,answers,19,true,initial.questionIds);
  assert.equal(readProgress(storage).index,4);
  assert.equal(readProgress(storage).submitted,false);
  assert.deepEqual(readProgress(storage).questionIds,initial.questionIds);
  const data=JSON.parse(memory.get(STORAGE_KEY));data.questionIds[1]=data.questionIds[0];memory.set(STORAGE_KEY,JSON.stringify(data));
  const recovered=readProgress(storage);assert.ok(validQuestionIds(recovered.questionIds));assert.deepEqual(recovered.answers,{});
  memory.set(LEGACY_STORAGE_KEY,'old');memory.set('unrelated','keep');
  readProgress(storage);assert.equal(memory.has(LEGACY_STORAGE_KEY),false);assert.equal(memory.get('unrelated'),'keep');
});

test('v5 progress never resumes v3 or v4 answers and leaves historical drafts untouched', () => {
  assert.equal(STORAGE_KEY, 'main-character-casting:v5');
  const ids = drawQuestions();
  const memory = new Map([
    ['main-character-casting:v3', JSON.stringify({ version: 3, questionIds: ids, answers: { [ids[0]]: 14 }, index: 1 })],
    ['main-character-casting:v4', JSON.stringify({ version: 4, questionIds: ids, answers: { [ids[0]]: 4 }, index: 1 })],
  ]);
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  const historical = new Map(memory);
  assert.deepEqual(readProgress(storage).answers, {});
  memory.set(STORAGE_KEY, historical.get('main-character-casting:v4'));
  assert.deepEqual(readProgress(storage).answers, {}, 'old version copied into the new key is also rejected');
  assert.ok(saveProgress(storage, { [ids[0]]: 7 }, 1, false, ids));
  assert.equal(JSON.parse(memory.get(STORAGE_KEY)).version, 5);
  assert.equal(readProgress(storage).answers[ids[0]], 7);
  for (const [key, value] of historical) assert.equal(memory.get(key), value);
});

test('blocked, malformed and old browser storage create a valid fresh session',()=>{
  for(const storage of [{getItem(){throw Error('blocked');}},{getItem:()=>'{broken'},{getItem:()=>JSON.stringify({version:2,answers:{'1.1':0}})}]) {
    const progress=readProgress(storage);
    assert.ok(validQuestionIds(progress.questionIds));assert.equal(progress.index,0);assert.equal(progress.submitted,false);assert.deepEqual(progress.answers,{});
  }
  assert.equal(saveProgress({setItem(){throw Error('full');}},{},0,false,drawQuestions()),false);
});
