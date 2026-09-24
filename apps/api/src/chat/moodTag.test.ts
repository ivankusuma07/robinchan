import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractMoodTag } from './moodTag.js';

describe('extractMoodTag', () => {
  it('strips a trailing tag and reports the mood', () => {
    const { visible, mood } = extractMoodTag('NVDA is up 3% today.\n[[mood:happy]]');
    assert.equal(visible, 'NVDA is up 3% today.');
    assert.equal(mood, 'happy');
  });

  it('is case-insensitive on the mood name', () => {
    const { mood } = extractMoodTag('Careful, that one moves fast.\n[[mood:ALERT]]');
    assert.equal(mood, 'alert');
  });

  it('tolerates trailing whitespace after the tag', () => {
    const { visible, mood } = extractMoodTag('Sure thing.\n[[mood:relaxed]]  \n ');
    assert.equal(visible, 'Sure thing.');
    assert.equal(mood, 'relaxed');
  });

  it('leaves text untouched when there is no tag', () => {
    const { visible, mood } = extractMoodTag('Cut off mid-sent');
    assert.equal(visible, 'Cut off mid-sent');
    assert.equal(mood, null);
  });

  it('rejects a mood outside the known set', () => {
    const { visible, mood } = extractMoodTag('Whatever.\n[[mood:excited]]');
    assert.equal(visible, 'Whatever.\n[[mood:excited]]');
    assert.equal(mood, null);
  });

  it('only strips the tag if it is at the very end', () => {
    const { visible, mood } = extractMoodTag('[[mood:happy]] is not a real tag here, ok?');
    assert.equal(visible, '[[mood:happy]] is not a real tag here, ok?');
    assert.equal(mood, null);
  });
});
