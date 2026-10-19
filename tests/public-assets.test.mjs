import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publicAssetPaths, publicEntryPaths, questionArtPaths } from '../scripts/public-assets.mjs';

const manifest=JSON.parse(await readFile(new URL('../public/media/manifest.json',import.meta.url),'utf8'));
const art=JSON.parse(await readFile(new URL('../public/question-art/manifest.json',import.meta.url),'utf8'));

test('question release includes only the current artwork and rejects missing or unsafe assets',()=>{
  const files=questionArtPaths(art);
  assert.equal(files.length,321);
  assert.equal(new Set(files).size,321);
  assert.ok(files.includes('question-art/manifest.json'));
  assert.ok(files.includes('question-art/1-1/scale-2.webp'));
  for(const filename of ['../scene.webp','1-1/backup.webp','https://example.com/scene.webp']) {
    const changed=structuredClone(art);
    changed.questions['1.1'].assets.scene.file=filename;
    assert.throws(()=>questionArtPaths(changed),/Invalid question image/);
  }
  const missing=structuredClone(art);
  delete missing.questions['1.1'];
  assert.throws(()=>questionArtPaths(missing),/current forty questions/);
  const extra=structuredClone(art);
  extra.questions['obsolete']=extra.questions['1.1'];
  assert.throws(()=>questionArtPaths(extra),/current forty questions/);
});

test('release includes current videos and fallback images without obsolete alternatives',()=>{
  const files=publicAssetPaths(manifest);
  assert.equal(files.filter(name=>name.endsWith('.mp4')).length,17);
  assert.equal(files.filter(name=>name.startsWith('worlds/')).length,28);
  assert.equal(files.length,new Set(files).size);
  assert.deepEqual(files,[...files].sort());
  assert.ok(files.includes('media/plot-rewriter-selected.webp'));
  assert.ok(!files.includes('media/plot-rewriter.jpg'));
  assert.ok(files.includes('media/chovy-son-selected.webp'));
  assert.ok(files.includes('media/film-cultivation-support.mp4'));
  assert.ok(files.includes('media/immortal-support-selected.webp'));
  assert.ok(!files.includes('media/immortal-support_card.png'));
  assert.ok(!files.includes('media/villain-calmer_voice.m4a'));
  assert.ok(!files.includes('media/villain-calmer_portrait.png'));
  assert.ok(!files.some(name=>name.endsWith('.md')));
  assert.deepEqual(publicEntryPaths,['collector.js','public-config.js','favicon.svg','question-art-review.html']);
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
  assert.throws(()=>publicAssetPaths(changed),/current character media entries/);
  const draft=structuredClone(manifest);
  draft['plot-rewriter'].status='draft';
  assert.throws(()=>publicAssetPaths(draft),/Invalid current media entry/);
  const missing=structuredClone(manifest);
  delete missing['plot-rewriter'];
  assert.throws(()=>publicAssetPaths(missing),/current character media entries/);
  assert.throws(()=>publicAssetPaths({...manifest,'obsolete-role':manifest['plot-rewriter']}),/current character media entries/);
  for(const invalid of [null,[],false]) assert.throws(()=>publicAssetPaths(invalid),/manifest object/);
});
