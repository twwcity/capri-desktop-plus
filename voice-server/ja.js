'use strict';

// Japanese for Kokoro: kuromoji reads the kanji (katakana readings), and the kana become the IPA
// symbols Kokoro was trained on. Sentences of codepoints, for GenerationConfig.phonemeCodepoints.

const kuromoji = require('kuromoji');
const path = require('node:path');

const ROW = { // consonant of each kana row, before a / i / u / e / o
  ア: ['', '', '', '', ''], カ: ['k', 'k', 'k', 'k', 'k'], ガ: ['ɡ', 'ɡ', 'ɡ', 'ɡ', 'ɡ'],
  サ: ['s', 'ɕ', 's', 's', 's'], ザ: ['z', 'ʥ', 'z', 'z', 'z'], タ: ['t', 'ʨ', 'ʦ', 't', 't'],
  ダ: ['d', 'ʥ', 'z', 'd', 'd'], ナ: ['n', 'ɲ', 'n', 'n', 'n'], ハ: ['h', 'ç', 'ɸ', 'h', 'h'],
  バ: ['b', 'b', 'b', 'b', 'b'], パ: ['p', 'p', 'p', 'p', 'p'], マ: ['m', 'm', 'm', 'm', 'm'],
  ラ: ['ɾ', 'ɾ', 'ɾ', 'ɾ', 'ɾ'],
};
const ROWS = {
  ア: 'アイウエオ', カ: 'カキクケコ', ガ: 'ガギグゲゴ', サ: 'サシスセソ', ザ: 'ザジズゼゾ', タ: 'タチツテト',
  ダ: 'ダヂヅデド', ナ: 'ナニヌネノ', ハ: 'ハヒフヘホ', バ: 'バビブベボ', パ: 'パピプペポ', マ: 'マミムメモ',
  ラ: 'ラリルレロ',
};
const VOWELS = ['a', 'i', 'ɯ', 'e', 'o'];
const KANA = {};
for (const [row, letters] of Object.entries(ROWS)) {
  [...letters].forEach((k, i) => { KANA[k] = { c: ROW[row][i], v: VOWELS[i] }; });
}
Object.assign(KANA, {
  ヤ: { c: 'j', v: 'a' }, ユ: { c: 'j', v: 'ɯ' }, ヨ: { c: 'j', v: 'o' },
  ワ: { c: 'w', v: 'a' }, ヲ: { c: '', v: 'o' }, ヴ: { c: 'v', v: 'ɯ' },
  ァ: { c: '', v: 'a' }, ィ: { c: '', v: 'i' }, ゥ: { c: '', v: 'ɯ' }, ェ: { c: '', v: 'e' }, ォ: { c: '', v: 'o' },
  ャ: { c: 'j', v: 'a' }, ュ: { c: 'j', v: 'ɯ' }, ョ: { c: 'j', v: 'o' },
});
const SMALL_Y = { ャ: 'a', ュ: 'ɯ', ョ: 'o' };
const SMALL_V = { ァ: 'a', ィ: 'i', ゥ: 'ɯ', ェ: 'e', ォ: 'o' };
const PALATAL = new Set(['ɕ', 'ʥ', 'ʨ', 'ɲ', 'ç']); // シャ is ɕa, not ɕja
const PUNCT = { '、': ',', '，': ',', '。': '.', '．': '.', '？': '?', '！': '!', '?': '?', '!': '!', ',': ',', '.': '.', '…': '…' };

const toKatakana = (s) => s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

function kanaToIpa(kana) {
  let out = '';
  const chars = [...toKatakana(kana)];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];
    if (ch === 'ン') { out += 'ɴ'; continue; }
    if (ch === 'ッ') { out += 'ʔ'; continue; }
    if (ch === 'ー') { out += 'ː'; continue; }
    if (PUNCT[ch]) { out += PUNCT[ch]; continue; }
    const k = KANA[ch];
    if (!k) { if (/[a-z]/i.test(ch)) out += ch.toLowerCase(); else if (/\s/.test(ch)) out += ' '; continue; }
    if (next && SMALL_Y[next] && k.v === 'i' && k.c) { // キャ, シュ, チョ...
      out += PALATAL.has(k.c) ? k.c : `${k.c}j`;
      out += SMALL_Y[next];
      i++;
    } else if (next && SMALL_V[next] && 'ウフツテデトドヴ'.includes(ch)) { // ファ, ティ, ウィ, ツァ...
      out += ch === 'ウ' ? 'w' : ch === 'テ' ? 't' : ch === 'デ' ? 'd' : ch === 'ト' ? 't' : ch === 'ド' ? 'd' : k.c;
      out += SMALL_V[next];
      i++;
    } else if (next && SMALL_V[next] && k.v === 'i' && k.c) { // シェ, チェ, ジェ
      out += k.c + SMALL_V[next];
      i++;
    } else {
      out += k.c + k.v;
    }
  }
  return out;
}

let tokenizer = null;
const ready = new Promise((resolve, reject) => {
  kuromoji.builder({ dicPath: path.join(path.dirname(require.resolve('kuromoji')), '..', 'dict') }).build((err, t) => {
    if (err) reject(err); else { tokenizer = t; resolve(); }
  });
});

// "元気？何か面白いことあった？" -> [[...codepoints of "ɡeɴki?"], [...]]
async function phonemes(text) {
  await ready;
  const ipa = tokenizer.tokenize(text).map((t) => kanaToIpa(t.pronunciation && t.pronunciation !== '*' ? t.pronunciation : t.surface_form)).join('');
  return ipa.split(/(?<=[.?!…])/).map((s) => s.trim()).filter((s) => /[^\s.,?!…]/.test(s)).map((s) => [...s].map((c) => c.codePointAt(0)));
}

module.exports = { phonemes, kanaToIpa };
