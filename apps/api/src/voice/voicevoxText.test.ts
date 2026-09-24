import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { integerToWords, toVoicevoxText } from './voicevoxText.js';

describe('integerToWords', () => {
  it('reads the numbers a market reply actually contains', () => {
    assert.equal(integerToWords(0), 'zero');
    assert.equal(integerToWords(15), 'fifteen');
    assert.equal(integerToWords(40), 'forty');
    assert.equal(integerToWords(175), 'one hundred seventy five');
    assert.equal(integerToWords(2026), 'two thousand twenty six');
    assert.equal(integerToWords(1_250_000), 'one million two hundred fifty thousand');
  });
});

describe('toVoicevoxText', () => {
  it('turns prices and percentages into English words, not Japanese numerals', () => {
    assert.equal(
      toVoicevoxText('NVDA is at $175.15, down 0.61% today.'),
      'NVDA is at ワン hundred seventy five point ワン five dollars, down zero point six ワン percent today.',
    );
  });

  it('reads signed moves', () => {
    assert.equal(toVoicevoxText('+2.5% then -1%'), 'plus two point five percent then minus ワン percent');
  });

  it('says "dollar" for exactly one', () => {
    assert.equal(toVoicevoxText('$1'), 'ワン dollar');
  });

  it('treats $RCHAN as a name', () => {
    assert.equal(toVoicevoxText('$RCHAN is live'), 'RCHAN is live');
  });

  it('expands contractions instead of letting them be spelled', () => {
    assert.equal(
      toVoicevoxText("I don't have it. It's late, can't say, you're right, Apple's report"),
      'I do not have イット. イット is late, cannot say, you are right, Apples report',
    );
  });

  it('respells the words the engine reads as letters, but keeps acronyms and tickers spelled', () => {
    assert.equal(toVoicevoxText('We told me no. US and IT stocks, not AAPL'), 'ウィー told ミー ノー. US and IT ストックス, not AAPL');
  });

  it('reads ordinals', () => {
    assert.equal(toVoicevoxText('the 1st and 22nd'), 'the first and twenty second');
  });

  it('leaves Indonesian and ordinary words alone', () => {
    assert.equal(toVoicevoxText('Harga saham naik & volume tinggi'), 'Harga saham naik and volume tinggi');
  });
});
