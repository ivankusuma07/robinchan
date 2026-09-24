import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SPEECH_CHUNK_MAX, SPEECH_FIRST_CHUNK_MAX, splitForSpeech } from './speech.js';

describe('splitForSpeech', () => {
  it('keeps a short reply as one chunk', () => {
    assert.deepEqual(splitForSpeech('NVDA is up 2% today. Nothing else moved.'), [
      'NVDA is up 2% today. Nothing else moved.',
    ]);
  });

  it('packs whole sentences and never breaks one across chunks', () => {
    const sentence = 'This sentence is about forty characters.';
    const chunks = splitForSpeech(Array(12).fill(sentence).join(' '), 100);
    assert.ok(chunks.length > 1);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= 100);
      assert.match(chunk, /^This.*characters\.$/);
    }
  });

  it('cuts an overlong sentence at a space, within the limit', () => {
    const long = 'word '.repeat(80).trim();
    for (const chunk of splitForSpeech(long, 50)) {
      assert.ok(chunk.length <= 50, `${chunk.length} > 50`);
      assert.doesNotMatch(chunk, /^\s|\s$/);
    }
  });

  it('drops markdown punctuation, bullets, and raw URLs', () => {
    assert.deepEqual(
      splitForSpeech('**Heads up:** see https://example.com/x\n- first point\n- `second`'),
      ['Heads up: see first point second'],
    );
  });

  it('caps the number of chunks', () => {
    const many = Array(40).fill('Short one.').join(' ');
    assert.equal(splitForSpeech(many, 20, 3).length, 3);
  });

  it('returns nothing for text with nothing to say', () => {
    assert.deepEqual(splitForSpeech('  ** ` ## '), []);
  });

  it('keeps the first chunk short so speech starts quickly', () => {
    const reply =
      'That is a fairly long opening sentence that runs well past eighty characters in total length. Then more.';
    const [first, ...rest] = splitForSpeech(reply);
    assert.ok(first && first.length <= SPEECH_FIRST_CHUNK_MAX, `${first?.length}`);
    assert.ok(rest.length > 0);
  });

  it('defaults stay under the API cap', () => {
    assert.ok(SPEECH_CHUNK_MAX <= 300);
    assert.ok(SPEECH_FIRST_CHUNK_MAX <= SPEECH_CHUNK_MAX);
  });
});
