'use strict';

// Capri's voice, run by voice.js with the node.exe next to it (Electron can't take sherpa-onnx's audio).
// One JSON request per line on stdin: {id, text, voice?}. One answer per line on stdout: {id, file, rate} or {id, error}.
// Each language has its voice; each model is loaded once, on first use:
//   English and the rest: Kokoro (Bella)      Chinese: Kokoro (Xiaobei)      Japanese: Kokoro (Alpha), via ja.js
//   Thai: MMS                                 Korean: KSS, via ko.js

const sherpa = require('sherpa-onnx-node');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');

const KOKORO = path.join(__dirname, 'kokoro-multi-lang-v1_0');
const THAI = path.join(__dirname, 'vits-mms-tha');
// a Thai man's voice (VIZINTZOR/MMS-TTS-THAI-MALEV2, converted the same way): D's
const THAI_M = path.join(__dirname, 'vits-mms-tha-male');
// a Thai woman's voice (VIZINTZOR/MMS-TTS-THAI-FEMALEV2, converted to ONNX): Omi's, far less robotic
const THAI_F = path.join(__dirname, 'vits-mms-tha-female');
const KOREAN = path.join(__dirname, 'vits-mimic3-ko_KO-kss_low');

const MODELS = {
  kokoro: () => ({ kokoro: { model: path.join(KOKORO, 'model.onnx'), voices: path.join(KOKORO, 'voices.bin'), tokens: path.join(KOKORO, 'tokens.txt'), lexicon: `${path.join(KOKORO, 'lexicon-us-en.txt')},${path.join(KOKORO, 'lexicon-zh.txt')}`, dictDir: path.join(KOKORO, 'dict') } }),
  thai: () => ({ vits: { model: path.join(THAI, 'model.onnx'), tokens: path.join(THAI, 'tokens.txt') } }),
  thaiM: () => ({ vits: { model: path.join(THAI_M, 'model.onnx'), tokens: path.join(THAI_M, 'tokens.txt') } }),
  thaiF: () => ({ vits: { model: path.join(THAI_F, 'model.onnx'), tokens: path.join(THAI_F, 'tokens.txt') } }),
  korean: () => ({ vits: { model: path.join(KOREAN, 'ko_KO-kss_low.onnx'), tokens: path.join(KOREAN, 'tokens.txt') } }),
};
const engines = {};
function engine(name) {
  if (!engines[name]) engines[name] = new sherpa.OfflineTts({ model: { ...MODELS[name](), numThreads: 4 }, maxNumSentences: 1 });
  return engines[name];
}

let ja = null;
let ko = null;

// which voice, by the script most of the text is in
function language(text) {
  const letters = text.replace(/[\s\p{P}\p{N}]/gu, '').length || 1;
  const share = (re) => (text.match(re) || []).length / letters;
  if (share(/[฀-๿]/g) > 0.3) return 'th';
  if (share(/[가-힯]/g) > 0.3) return 'ko';
  if (share(/[぀-ヿ]/g) > 0.05) return 'ja';
  if (share(/[一-鿿]/g) > 0.3) return 'zh';
  return 'en';
}

// Each voice, per language: the Kokoro speaker (sid), how fast it's said (speed) and how fast the overlay
// plays it back (rate: above 1 also raises it). The low Thai voice is said slowly and played back faster.
// capri: Bella, bright and quick. omi (her holo-calls): River, calmer and lower; not her actress's voice.
const VOICES = {
  capri: { en: { sid: 2, speed: 0.95, rate: 1.15 }, th: { speed: 0.69, rate: 1.6 }, ja: { sid: 37, speed: 0.95, rate: 1.08 }, zh: { sid: 45, speed: 0.95, rate: 1.1 }, ko: { speed: 0.95, rate: 1.12 } },
  king: { en: { sid: 16, speed: 0.95, rate: 0.9 }, th: { model: 'thaiM', speed: 0.92, rate: 0.88 }, ja: { sid: 41, speed: 0.95, rate: 0.9 }, zh: { sid: 49, speed: 0.95, rate: 0.9 }, ko: { speed: 0.95, rate: 0.85 } },
  talia: { en: { sid: 10, speed: 1.05, rate: 1.05 }, th: { model: 'thaiF', speed: 1.05, rate: 1.1 }, ja: { sid: 39, speed: 1.05, rate: 1.05 }, zh: { sid: 47, speed: 1.05, rate: 1.05 }, ko: { speed: 1.05, rate: 1.1 } },
  roman: { en: { sid: 18, speed: 1.05, rate: 1.12 }, th: { model: 'thaiF', speed: 1.08, rate: 1.18 }, ja: { sid: 41, speed: 1.05, rate: 1.15 }, zh: { sid: 50, speed: 1.05, rate: 1.15 }, ko: { speed: 1.05, rate: 1.2 } },
  jessie: { en: { sid: 6, speed: 0.98, rate: 1.02 }, th: { model: 'thaiF', speed: 0.96, rate: 1.04 }, ja: { sid: 40, speed: 0.98, rate: 1.02 }, zh: { sid: 48, speed: 0.98, rate: 1.02 }, ko: { speed: 0.98, rate: 1.05 } },
  avida: { en: { sid: 3, speed: 0.92, rate: 0.95 }, th: { model: 'thaiF', speed: 0.9, rate: 0.93 }, ja: { sid: 37, speed: 0.92, rate: 0.95 }, zh: { sid: 46, speed: 0.92, rate: 0.95 }, ko: { speed: 0.92, rate: 0.95 } },
  yupi: { en: { sid: 4, speed: 1.08, rate: 1.1 }, th: { model: 'thaiF', speed: 1.08, rate: 1.14 }, ja: { sid: 38, speed: 1.08, rate: 1.1 }, zh: { sid: 47, speed: 1.08, rate: 1.1 }, ko: { speed: 1.08, rate: 1.12 } },
  kyoko: { en: { sid: 1, speed: 1.12, rate: 1.14 }, th: { model: 'thaiF', speed: 1.1, rate: 1.2 }, ja: { sid: 39, speed: 1.12, rate: 1.14 }, zh: { sid: 48, speed: 1.12, rate: 1.14 }, ko: { speed: 1.12, rate: 1.16 } },
  d: { en: { sid: 17, speed: 1.0, rate: 0.97 }, th: { model: 'thaiM', speed: 1.0, rate: 0.97 }, ja: { sid: 41, speed: 1.0, rate: 1.0 }, zh: { sid: 50, speed: 1.0, rate: 1.0 }, ko: { speed: 1.0, rate: 0.9 } },
  omi: { en: { sid: 8, speed: 1.0, rate: 1.0 }, th: { model: 'thaiF', speed: 1.0, rate: 1.0 }, ja: { sid: 38, speed: 1.0, rate: 1.0 }, zh: { sid: 46, speed: 1.0, rate: 1.0 }, ko: { speed: 1.0, rate: 1.02 } },
};

// names the voices don't know, said the way they sound (Kokoro skips them; the Thai voice has no Latin)
const SAY = { en: [[/\bOmi\b/g, 'Oh-mee'], [/\bCapri\b/g, 'Kah-pree'], [/\bD\b/g, 'Dee'], [/\bKingsley\b/g, 'Kings-lee'], [/\bTalia\b/g, 'Tah-lia'], [/\bCarax\b/g, 'Kah-rax'], [/\bAvida\b/g, 'Ah-vee-da'], [/\bYupi\b/g, 'Yoo-pee'], [/\bKyoko\b/g, 'Kyo-ko']], th: [[/\bOmi\b/gi, 'โอมิ'], [/\bCapri\b/gi, 'คาปรี'], [/\bD\b/g, 'ดี'], [/\bDavid\b/gi, 'เดวิด']] };

async function speak(said, who = 'capri') {
  const lang = language(said);
  const text = (SAY[lang] || SAY.en).reduce((t, [re, to]) => t.replace(re, to), said);
  let v = (VOICES[who] || VOICES.capri)[lang];
  // a character's own Thai voice not on this PC (not shared in the release: see THIRD-PARTY.md): the
  // MMS voice, raised the way Capri's is for the women, as it is for the men
  if (lang === 'th' && v.model && !fs.existsSync(v.model === 'thaiM' ? THAI_M : THAI_F)) {
    v = v.model === 'thaiF' ? { speed: VOICES.capri.th.speed + 0.04, rate: VOICES.capri.th.rate - 0.12 } : { speed: v.speed, rate: v.rate };
  }
  let audio;
  if (lang === 'th') {
    audio = engine(v.model ? v.model : 'thai').generate({ text, sid: 0, speed: v.speed });
  } else if (lang === 'ko') {
    ko = ko || require('./ko');
    audio = engine('korean').generate({ text: '', sid: 0, speed: v.speed, generationConfig: new sherpa.GenerationConfig({ sid: 0, speed: v.speed, phonemeCodepoints: ko.phonemes(text) }) });
  } else if (lang === 'ja') {
    ja = ja || require('./ja');
    const phonemeCodepoints = await ja.phonemes(text);
    audio = engine('kokoro').generate({ text: '', sid: v.sid, speed: v.speed, generationConfig: new sherpa.GenerationConfig({ sid: v.sid, speed: v.speed, phonemeCodepoints }) });
  } else {
    audio = engine('kokoro').generate({ text, sid: v.sid, speed: v.speed });
  }
  const rate = v.rate;
  const file = path.join(os.tmpdir(), `capri-voice-${process.pid}-${Date.now()}.wav`);
  sherpa.writeWave(file, { samples: audio.samples, sampleRate: audio.sampleRate });
  return { file, rate };
}

// one at a time, in order
let queue = Promise.resolve();
const lines = readline.createInterface({ input: process.stdin });
lines.on('line', (line) => {
  queue = queue.then(async () => {
    let id = null;
    try {
      const req = JSON.parse(line);
      id = req.id;
      process.stdout.write(`${JSON.stringify({ id, ...(await speak(String(req.text), req.voice)) })}\n`);
    } catch (err) {
      process.stdout.write(`${JSON.stringify({ id, error: err.message })}\n`);
    }
  });
});
lines.on('close', () => queue.then(() => process.exit(0)));
process.stdout.write(`${JSON.stringify({ ready: true })}\n`);
setTimeout(() => engine('kokoro'), 50); // her usual voice, loaded before she first needs it
