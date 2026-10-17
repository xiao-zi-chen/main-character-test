import test from 'node:test';
import assert from 'node:assert/strict';
import { roles, regularRoles, hiddenRoles, roleById } from '../src/data/roles.js';
import { hiddenRoleForScores, readHiddenState, saveHiddenState, canViewRole } from '../src/hidden-rules.js';

test('the selected spreadsheet publishes all 28 characters with valid reciprocal partners',()=>{
  assert.equal(roles.length,28); assert.equal(regularRoles.length,28); assert.equal(hiddenRoles.length,0);
  assert.equal(new Set(roles.map(role=>role.id)).size,28);
  for(const role of roles) { assert.ok(roleById[role.partner]); assert.equal(roleById[role.partner].partner,role.id); }
});
test('retired hidden rules and stored unlocks cannot introduce characters outside the spreadsheet',()=>{
  const scores=Object.entries({logic:100,order:100,freedom:100,focus:100,social:0}).map(([id,value])=>({id,value}));
  assert.equal(hiddenRoleForScores(scores),null);
  assert.equal(hiddenRoleForScores([]),null);
  assert.deepEqual(readHiddenState({getItem:()=>JSON.stringify({version:1,enabled:true,unlocked:['heaven-admin','cosmic-director']})}),{enabled:true,unlocked:[]});
  for(const role of roles) assert.equal(canViewRole(role,{enabled:false,unlocked:[]}),true);
  assert.equal(canViewRole(undefined,{}),false);
  assert.deepEqual(readHiddenState({getItem:()=>'{broken'}),{enabled:false,unlocked:[]});
  assert.equal(saveHiddenState({setItem(){throw Error('blocked');}},{enabled:true,unlocked:[]}),false);
});
