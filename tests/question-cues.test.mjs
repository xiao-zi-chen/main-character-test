import test from 'node:test';
import assert from 'node:assert/strict';
import { questions } from '../src/data/questions.js';
import { questionArtCues } from '../src/data/question-art-cues.js';
test('all forty questions have distinct nonverbal option cues and explicit redraw actions',()=>{
  assert.deepEqual(Object.keys(questionArtCues).sort(),questions.map(q=>q.id).sort());
  for(const cues of Object.values(questionArtCues)) {
    assert.equal(cues.length,2);
    assert.notEqual(cues[0].symbol,cues[1].symbol);
    assert.notEqual(cues[0].action,cues[1].action);
    for(const cue of cues) {
      assert.ok(cue.face && cue.symbol && cue.action);
      assert.doesNotMatch(cue.face+cue.symbol,/[A-Za-z\u4e00-\u9fff]/);
    }
  }
});
