import test from 'node:test';
import assert from 'node:assert/strict';
import { roles, regularRoles, hiddenRoles, roleById } from '../src/data/roles.js';
import { questions, dimensions } from '../src/data/questions.js';
import { getResult } from '../src/engine.js';
import { SCALE_MIN, SCALE_MAX } from '../src/data/answer-scale.js';
import { hiddenRoleForScores, readHiddenState, saveHiddenState, canViewRole } from '../src/hidden-rules.js';

function answersFor(role) {
  const answers={};
  dimensions.forEach((dimension,index)=>{
    const items=questions.filter(q=>q.dimension===dimension.id);
    const n=Math.round(role.profile[index]/100*items.length);
    items.forEach((q,i)=>{const option=i<n?q.highAnswer:q.highAnswer==='A'?'B':'A';answers[q.id]=option==='A'?SCALE_MIN:SCALE_MAX;});
  });return answers;
}

test('catalog contains 18 ordinary and 2 hidden roles with valid partners',()=>{
  assert.equal(roles.length,20);assert.equal(regularRoles.length,18);assert.equal(hiddenRoles.length,2);
  assert.equal(new Set(roles.map(r=>r.id)).size,20);
  for(const role of roles) assert.ok(roleById[role.partner]);
  for(const role of regularRoles) assert.equal(Boolean(roleById[role.partner].hidden),false);
});
test('each hidden ending requires both its answer combination and opt-in',()=>{
  for(const role of hiddenRoles) {
    const answers=answersFor(role);
    assert.equal(getResult(answers,{hiddenEnabled:true}).role.id,role.id);
    assert.equal(getResult(answers,{hiddenEnabled:true}).hiddenUnlocked,true);
    assert.equal(Boolean(getResult(answers).role.hidden),false);
    assert.equal(Boolean(getResult(answers,{hiddenEnabled:false}).role.hidden),false);
  }
  const normal=answersFor(roleById['royal-chef']);
  assert.equal(Boolean(getResult(normal,{hiddenEnabled:true}).role.hidden),false);
});
test('hidden thresholds, missing dimensions and conflicting combinations are handled explicitly',()=>{
  const scores=Object.entries({logic:75,order:75,freedom:75,focus:75,social:40}).map(([id,value])=>({id,value}));
  assert.equal(hiddenRoleForScores(scores),'heaven-admin');
  assert.equal(hiddenRoleForScores(scores.map(s=>s.id==='social'?{...s,value:41}:s)),null);
  assert.equal(hiddenRoleForScores(scores.filter(s=>s.id!=='logic')),null);
  assert.equal(hiddenRoleForScores([]),null);
});
test('only earned hidden identities can be viewed; persisted state is validated',()=>{
  const secret=hiddenRoles[0];
  assert.equal(canViewRole(secret,{enabled:true,unlocked:[]}),false);
  assert.equal(canViewRole(secret,{enabled:false,unlocked:[secret.id]}),true);
  assert.equal(canViewRole(secret,{}),false);
  assert.equal(canViewRole(undefined,{}),false);
  const storage={getItem:()=>JSON.stringify({version:1,enabled:'true',unlocked:[secret.id,'unknown',secret.id]})};
  assert.deepEqual(readHiddenState(storage),{enabled:false,unlocked:[secret.id]});
  assert.deepEqual(readHiddenState({getItem:()=>'{broken'}),{enabled:false,unlocked:[]});
  assert.equal(saveHiddenState({setItem(){throw new Error('blocked');}},{enabled:true,unlocked:[]}),false);
});
