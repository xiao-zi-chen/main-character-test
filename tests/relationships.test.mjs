import test from 'node:test';
import assert from 'node:assert/strict';
import { roles, regularRoles, roleById } from '../src/data/roles.js';
import { relationships } from '../src/data/relationships.js';

test('the selected 28-character catalog has complete, distinct social identities and mutual regular partnerships', () => {
  assert.equal(roles.length, 28);
  assert.deepEqual(Object.keys(relationships).sort(), roles.map(role=>role.id).sort());
  assert.equal(new Set(Object.values(relationships).map(item=>item.identity)).size, 28);
  for (const role of roles) {
    for (const key of ['identity','familiar','affection','friction','bond','chemistry','prompt']) {
      assert.ok(relationships[role.id][key]?.trim(), `${role.id}: missing ${key}`);
    }
    assert.notEqual(role.id, role.partner);
  }
  for (const role of regularRoles) {
    if(role.castIds.length===1) assert.equal(role.partner,null);
    else { assert.equal(roleById[role.partner].partner,role.id); assert.equal(roleById[role.partner].filmId,role.filmId); }
  }
});
