import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { captionsBySourceImage, reactionCaptions, captionSourceLevels } from '../src/data/reaction-captions.js';
import { questions } from '../src/data/questions.js';
import { reactionIndex } from '../src/data/answer-scale.js';

const manifest = JSON.parse(readFileSync(new URL('../public/question-art/manifest.json', import.meta.url), 'utf8'));

test('all 200 source images have individual concise one-sentence captions', () => {
  assert.deepEqual(Object.keys(captionsBySourceImage).sort(), questions.map(question => question.id).sort());
  for (const [id, captions] of Object.entries(captionsBySourceImage)) {
    assert.equal(captions.length, 5, id);
    assert.equal(new Set(captions).size, 5, id);
    for (const caption of captions) {
      assert.equal(typeof caption, 'string', id);
      assert.equal(caption, caption.trim(), id);
      assert.ok(caption.length >= 8 && caption.length <= 40, `${id}: ${caption}`);
      assert.match(caption, /[。！？]$/, id);
      assert.equal((caption.match(/[。！？]/g) || []).length, 1, `${id}: ${caption}`);
      assert.doesNotMatch(caption, /主人公|主角特写|给到|更接近左侧|更接近右侧|偏左：|偏右：|中立：|[\r\n]/);
    }
  }
});

test('all fifteen answer values use the caption for the actual source image, including reordered questions', () => {
  for (const question of questions) {
    const id = question.id;
    assert.deepEqual(captionSourceLevels[id] || [1, 2, 3, 4, 5], manifest.questions[id].scaleSourceLevels, id);
    for (let value = 0; value <= 14; value++) {
      const group = reactionIndex(value);
      const asset = manifest.questions[id].assets[`scale-${group}`];
      assert.equal(reactionCaptions[id][group], captionsBySourceImage[id][asset.sourceLevel - 1], `${id} value ${value}`);
      assert.equal(asset.size[0] / asset.size[1], 1.5, `${id}: preview sizing assumes the supplied 3:2 artwork`);
    }
  }
});
