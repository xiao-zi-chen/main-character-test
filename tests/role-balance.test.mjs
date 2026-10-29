import test from 'node:test';
import assert from 'node:assert/strict';
import { rankRoles } from '../src/engine.js';
import { regularRoles as roles } from '../src/data/roles.js';
import { dimensions } from '../src/data/questions.js';
import { CALIBRATION_BASIS, ROLE_DISTANCE_OFFSETS } from '../src/data/role-calibration.js';
import { SAMPLE_MODELS, sampleScores, seededRandom } from '../scripts/lib/role-samples.mjs';

test('calibration matches the current character catalog and dimension order', () => {
  assert.deepEqual(CALIBRATION_BASIS.dimensions, dimensions.map(d => d.id));
  assert.deepEqual(CALIBRATION_BASIS.profiles, roles.map(({ id, profile, weights }) => ({ id, profile, weights })),
    'Changed character profiles require node scripts/calibrate_roles.mjs and another distribution audit');
  assert.deepEqual(Object.keys(ROLE_DISTANCE_OFFSETS).sort(), roles.map(role => role.id).sort());
  assert.ok(Object.values(ROLE_DISTANCE_OFFSETS).every(Number.isFinite));
});

test('clear character profiles and small perturbations still select their own character', () => {
  for (const role of roles) {
    for (let dimension = 0; dimension < dimensions.length; dimension++) {
      for (const delta of [-2, 0, 2]) {
        const scores = dimensions.map((d, index) => ({ ...d,
          value: Math.max(0, Math.min(100, role.profile[index] + (index === dimension ? delta : 0))) }));
        assert.equal(rankRoles(scores)[0].role.id, role.id, `${role.name}: dimension ${dimension}, delta ${delta}`);
      }
    }
  }
});

for (const model of SAMPLE_MODELS) {
  test(`held-out ${model} responses reduce concentration while keeping personality distances close`, () => {
    const random = seededRandom(583204); // Independent from the calibration seed.
    const size = 12000;
    const before = Object.fromEntries(roles.map(role => [role.id, 0]));
    const after = { ...before };
    let extraDistance = 0;
    for (let sample = 0; sample < size; sample++) {
      const ranking = rankRoles(sampleScores(random, model));
      const original = [...ranking].sort((a, b) => a.distance - b.distance || a.role.number.localeCompare(b.role.number))[0];
      before[original.role.id]++;
      after[ranking[0].role.id]++;
      extraDistance += ranking[0].distance - original.distance;
    }
    const concentration = counts => Object.values(counts).reduce((sum, n) => sum + (n / size) ** 2, 0);
    // Compare excess concentration above a uniform distribution, rather than
    // requiring the same absolute decrease from already less-skewed models.
    const uniformConcentration = 1 / roles.length;
    assert.ok(concentration(after) - uniformConcentration < (concentration(before) - uniformConcentration) * .5,
      'At least half the excess concentration should be removed across answer styles');
    assert.ok(Math.max(...Object.values(after)) < Math.max(...Object.values(before)) * .7, 'No replacement dominant role');
    assert.ok(extraDistance / size < .02, 'Balance must not overwhelm personality similarity');
    if (model === 'uniform15' || model === 'fiveShortcuts') {
      assert.ok(Math.max(...Object.values(after)) / size < .08);
      assert.ok(Math.min(...Object.values(after)) / size > .003, 'Rare roles should have a meaningful share');
    }
  });
}
