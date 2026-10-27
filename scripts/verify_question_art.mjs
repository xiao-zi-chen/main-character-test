import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { questions } from '../src/data/questions.js';
import { questionCopy } from '../src/data/question-copy.js';
import { questionReactions } from '../src/data/question-reactions.js';

const root = new URL('../public/question-art/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
if (manifest.importType === 'workbook-images') {
  const { verifyWorkbookQuestionArt } = await import('./verify_workbook_question_art.mjs');
  await verifyWorkbookQuestionArt({ manifest, root, questions, questionCopy, questionReactions });
  process.exit(0);
}
const prompts = JSON.parse(await readFile(new URL('../content/question-art-production.json', import.meta.url), 'utf8'));
const directions = JSON.parse(await readFile(new URL('../content/question-art-directions.json', import.meta.url), 'utf8'));
assert.equal(Object.keys(manifest.questions).length, questions.length, 'Artwork must cover the entire question bank');
assert.equal(prompts.questions.length, questions.length, 'Keep every production prompt');
const hashes = new Set();
const styleIds = new Set();
const protagonists = new Set();
let bytes = 0;
for (const question of questions) {
  const entry = manifest.questions[question.id];
  const prompt = prompts.questions.find(item => item.id === question.id);
  assert.ok(entry && prompt, `Missing artwork or prompt: ${question.id}`);
  assert.equal(prompt.prompt, questionCopy[question.id].prompt);
  assert.deepEqual(prompt.options, questionCopy[question.id].options, `Choice order changed: ${question.id}`);
  assert.deepEqual(prompt.artDirection, directions[question.id], `Stale art direction: ${question.id}`);
  assert.deepEqual(entry.artDirection, directions[question.id], `Wrong generated style: ${question.id}`);
  assert.equal(prompt.artDirection.family, 'photography', `Expected realistic photography: ${question.id}`);
  assert.ok(prompt.artDirection.protagonist.includes('Chinese'), `Expected Chinese everyday characters: ${question.id}`);
  assert.ok(prompt.generationPrompt.includes(directions[question.id].medium), `Style missing from actual prompt: ${question.id}`);
  styleIds.add(prompt.artDirection.id);
  protagonists.add(prompt.artDirection.protagonist);
  assert.equal(questionReactions[question.id].length, 5);
  assert.equal(new Set(questionReactions[question.id].map(item => item.face)).size, 5, `Expressions must vary across all five degrees: ${question.id}`);
  assert.equal(new Set(questionReactions[question.id].map(item => item.caption)).size, 5);
  for (const kind of ['scene', 'left', 'right', 'scale-0', 'scale-1', 'scale-2', 'scale-3', 'scale-4']) {
    const asset = entry.assets[kind];
    assert.ok(prompt.assets[kind].prompt.includes(prompt.assets[kind].action.replace(/(?:GREEN|green|BLUE|blue|CORAL|coral)-clad protagonist/g,'protagonist')));
    assert.equal(asset.seed, prompt.assets[kind].seed);
    assert.equal(asset.promptSha256, createHash('sha256').update(prompt.assets[kind].prompt).digest('hex'), `Prompt provenance mismatch: ${question.id}/${kind}`);
    assert.ok(asset.promptId, `Missing generated provenance: ${question.id}/${kind}`);
    const expectedPath = `${question.id.replace('.', '-')}/${kind}.webp`;
    assert.equal(asset.file, expectedPath);
    const file = new URL(asset.file, root);
    const buffer = await readFile(file);
    const hash = createHash('sha256').update(buffer).digest('hex');
    assert.equal(hash, asset.sha256, `Changed image: ${asset.file}`);
    assert.ok(!hashes.has(hash), `Duplicated image: ${asset.file}`);
    hashes.add(hash);
    assert.ok(asset.size[0] >= 1000 && asset.size[1] >= 500, `Undersized image: ${asset.file}`);
    assert.equal(buffer.subarray(8, 12).toString(), 'WEBP', `Invalid format: ${asset.file}`);
    assert.equal((await stat(file)).size, asset.bytes);
    bytes += buffer.length;
  }
}
assert.equal(styleIds.size, questions.length, 'Each question needs its own art direction');
assert.equal(protagonists.size, questions.length, 'Do not reuse one protagonist across the whole bank');
console.log(`Verified ${questions.length} individual art directions, ${hashes.size} distinct WebP images, ${(bytes / 1024 / 1024).toFixed(2)} MiB, matching prompts and A/B order.`);
