import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publicAssetPaths, publicEntryPaths } from '../scripts/public-assets.mjs';

const manifest=JSON.parse(await readFile(new URL('../public/media/manifest.json',import.meta.url),'utf8'));

test('release includes current videos and fallback images without obsolete alternatives',()=>{
  const files=publicAssetPaths(manifest);
  assert.equal(files.filter(name=>name.endsWith('.mp4')).length,20);
  assert.equal(files.filter(name=>name.startsWith('worlds/')).length,20);
  assert.equal(files.length,new Set(files).size);
  assert.deepEqual(files,[...files].sort());
  assert.ok(files.includes('media/plot-rewriter-cover.jpg'));
  assert.ok(!files.includes('media/plot-rewriter.jpg'));
  assert.ok(files.includes('media/myth-keeper.jpg'));
  assert.ok(files.includes('media/immortal-support_voice.m4a'));
  assert.ok(files.includes('media/immortal-support.srt'));
  assert.ok(!files.includes('media/immortal-support_card.png'));
  assert.ok(!files.includes('media/villain-calmer_voice.m4a'));
  assert.ok(!files.includes('media/villain-calmer_portrait.png'));
  assert.ok(!files.some(name=>name.endsWith('.md')));
  assert.deepEqual(publicEntryPaths,['collector.js','public-config.js','favicon.svg']);
});

test('release rejects path traversal, remote paths and wrong media types',()=>{
  for(const filename of ['../old.jpg','old/cover.jpg','..\\old.jpg','https://example.com/old.jpg','C:\\old.jpg','cover.svg','cover.jpg?old=1','']) {
    const changed=structuredClone(manifest);
    changed['plot-rewriter'].portrait=filename;
    assert.throws(()=>publicAssetPaths(changed),/Invalid portrait filename/);
  }
  const changed=structuredClone(manifest);
  changed['immortal-support'].voice='../old.m4a';
  assert.throws(()=>publicAssetPaths(changed),/Invalid voice filename/);
  changed['immortal-support'].voice='immortal-support_voice.m4a';
  changed['immortal-support'].subtitles='old.js';
  assert.throws(()=>publicAssetPaths(changed),/Invalid subtitles filename/);
});

test('release rejects unsafe IDs, draft media and incomplete or extra character sets',()=>{
  const changed=structuredClone(manifest);
  changed['../plot-rewriter']=changed['plot-rewriter'];
  delete changed['plot-rewriter'];
  assert.throws(()=>publicAssetPaths(changed),/Invalid current media entry/);
  const draft=structuredClone(manifest);
  draft['plot-rewriter'].status='draft';
  assert.throws(()=>publicAssetPaths(draft),/Invalid current media entry/);
  const missing=structuredClone(manifest);
  delete missing['plot-rewriter'];
  assert.throws(()=>publicAssetPaths(missing),/twenty current media entries/);
  assert.throws(()=>publicAssetPaths({...manifest,'obsolete-role':manifest['plot-rewriter']}),/twenty current media entries/);
  for(const invalid of [null,[],false]) assert.throws(()=>publicAssetPaths(invalid),/manifest object/);
});
