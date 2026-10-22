import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { roles, roleById } from '../src/data/roles.js';
import { getFilmPartner } from '../src/film-partner.js';

const selection = JSON.parse(await readFile(new URL('../content/selected-films.json', import.meta.url), 'utf8'));

test('only the 11 two-person films have reciprocal partners; six solo films have none', () => {
  assert.equal(roles.length, 28);
  assert.equal(selection.films.filter(film => film.cast.length === 2).length, 11);
  assert.equal(selection.films.filter(film => film.cast.length === 1).length, 6);
  for (const film of selection.films) {
    for (const person of film.cast) {
      const role = roleById[person.id];
      const partner = getFilmPartner(role);
      if (film.cast.length === 1) assert.equal(partner, null, role.id);
      else {
        assert.equal(partner.id, film.cast.find(item => item.id !== role.id).id, role.id);
        assert.equal(partner.filmId, role.filmId);
        assert.equal(partner.videoId, role.videoId);
        assert.equal(getFilmPartner(partner).id, role.id);
      }
    }
  }
});

test('a recommendation is never substituted for a verified co-star', () => {
  const duo = roles.find(role => role.castIds.length === 2);
  const solo = roles.find(role => role.castIds.length === 1);
  const partner = getFilmPartner(duo);
  assert.equal(getFilmPartner({ ...solo, partner: duo.id }), null);
  assert.equal(getFilmPartner({ ...duo, partner: solo.id }), partner);
  assert.equal(getFilmPartner({ ...duo, castIds: [partner.id, duo.id] }), partner);
  for (const invalid of [
    null, {}, { ...duo, castIds: undefined }, { ...duo, castIds: [duo.id] },
    { ...duo, castIds: [duo.id, duo.id] }, { ...duo, castIds: [duo.id, 'missing'] },
    { ...duo, castIds: [duo.id, solo.id] }, { ...duo, castIds: [duo.id, partner.id, solo.id] },
    { ...duo, id: 'missing' }, { ...duo, filmId: solo.filmId }, { ...duo, videoId: solo.videoId },
    { ...duo, filmId: '' }, { ...duo, videoId: '' },
  ]) assert.equal(getFilmPartner(invalid), null);
});
