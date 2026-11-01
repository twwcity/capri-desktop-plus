'use strict';

// Korean for the KSS voice: Hangul syllables -> the IPA symbols it was trained on (its tokens.txt), with
// the sound changes that matter most (linking, lenis consonants voiced between vowels, final neutralising).

const ONSET = ['k', 'k', 'n', 't', 't', 'ɾ', 'm', 'p', 'p', 's', 's', '', 'tɕ', 'tɕ', 'tɕh', 'kh', 'th', 'ph', 'h'];
const VOWEL = ['a', 'ɛ', 'ja', 'jɛ', 'ʌ', 'e', 'jʌ', 'je', 'o', 'wa', 'wɛ', 'we', 'jo', 'u', 'wʌ', 'we', 'wi', 'ju', 'ɯ', 'ɯi', 'i'];
// each final (batchim): how it sounds at the end, and what it becomes before a vowel
const CODA = [
  null, ['k', 'k'], ['k', 'k'], ['k', 'ks'], ['n', 'n'], ['n', 'ntɕ'], ['n', 'n'], ['t', 't'], ['l', 'ɾ'],
  ['k', 'lk'], ['m', 'lm'], ['l', 'lp'], ['l', 'ls'], ['l', 'lth'], ['p', 'lph'], ['l', 'ɾ'], ['m', 'm'],
  ['p', 'p'], ['p', 'ps'], ['t', 's'], ['t', 's'], ['ŋ', 'ŋ'], ['t', 'tɕ'], ['t', 'tɕh'], ['k', 'kh'],
  ['t', 'th'], ['p', 'ph'], ['t', ''],
];
const VOICED = { k: 'ɡ', t: 'd', p: 'b', tɕ: 'dʑ' };
const PUNCT = { ',': ',', '.': '.', '?': '.', '!': '.', '…': '.', '，': ',', '。': '.', '？': '.', '！': '.' }; // the voice knows no ? or !

function syllables(text) {
  return [...text].map((ch) => {
    const code = ch.codePointAt(0) - 0xac00;
    if (code < 0 || code > 11171) return { other: ch };
    return { on: Math.floor(code / 588), v: Math.floor((code % 588) / 28), co: code % 28 };
  });
}

function hangulToIpa(text) {
  const syl = syllables(text);
  let out = '';
  for (let i = 0; i < syl.length; i++) {
    const s = syl[i];
    if (s.other !== undefined) {
      out += PUNCT[s.other] || (/\s/.test(s.other) ? ' ' : /[a-z]/i.test(s.other) ? s.other.toLowerCase() : '');
      continue;
    }
    const prev = syl[i - 1];
    const next = syl[i + 1];
    // the onset: a silent ㅇ takes the previous final (linking); lenis voiced after a vowel or a voiced final
    let onset = ONSET[s.on];
    if (s.on === 11 && prev?.co && prev.other === undefined) onset = '';
    const afterVoiced = prev && prev.other === undefined && (!prev.co || [4, 8, 16, 21].includes(prev.co));
    if (afterVoiced && VOICED[onset]) onset = VOICED[onset];
    if (s.on === 5 && prev?.co === 8) onset = 'l'; // ㄹㄹ
    out += onset + VOWEL[s.v];
    if (s.co) {
      const linked = next && next.other === undefined && next.on === 11;
      let coda = linked ? CODA[s.co][1] : CODA[s.co][0];
      if (linked && VOICED[coda]) coda = VOICED[coda];
      // nasalising before ㄴ/ㅁ: 합니다 -> hamnida
      if (!linked && next && next.other === undefined && [2, 6].includes(next.on)) coda = { k: 'ŋ', t: 'n', p: 'm' }[coda] || coda;
      out += coda;
    }
  }
  return out;
}

// sentences of codepoints, for GenerationConfig.phonemeCodepoints
function phonemes(text) {
  return hangulToIpa(text).split(/(?<=[.?!])/).map((s) => s.trim()).filter((s) => /[^\s.,?!]/.test(s)).map((s) => [...s].map((c) => c.codePointAt(0)));
}

module.exports = { phonemes, hangulToIpa };
