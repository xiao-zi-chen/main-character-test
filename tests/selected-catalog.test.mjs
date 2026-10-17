import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { roles, roleById, mediaPath } from '../src/data/roles.js';
const selection=JSON.parse(await readFile(new URL('../content/selected-films.json',import.meta.url),'utf8'));
const manifest=JSON.parse(await readFile(new URL('../public/media/manifest.json',import.meta.url),'utf8'));
test('17 spreadsheet films map exactly to 28 named characters with distinct portraits and shared video URLs',()=>{
  assert.deepEqual(roles.map(({id,name})=>({id,name})),selection.films.flatMap(f=>f.cast));
  assert.equal(new Set(Object.values(manifest).map(m=>m.video)).size,17);
  assert.equal(new Set(Object.values(manifest).map(m=>m.portraitSha256)).size,28);
  for(const film of selection.films) {
    const members=film.cast.map(c=>roleById[c.id]);
    assert.ok(members.every(role=>role.filmId===film.id));
    assert.equal(new Set(members.map(role=>mediaPath(role,'mp4',manifest[role.id].videoRevision))).size,1);
    assert.equal(new Set(members.map(role=>manifest[role.id].portrait)).size,members.length);
    assert.equal(new Set(members.map(role=>role.description)).size,members.length);
    for(const role of members) assert.deepEqual(role.castIds,film.cast.map(c=>c.id));
  }
});
