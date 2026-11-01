'use strict';

// Offline voice: Whisper (speech to text) and Piper (text to speech), kept in <drive>\capri\voice
// next to the app. Nothing here touches the network.

const { ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = process.env.CAPRI_VOICE_DIR || path.join(path.dirname(process.execPath), '..', 'voice');
const WHISPER = path.join(ROOT, 'whisper', 'Release', 'whisper-cli.exe');
// small, tried against large-v3-turbo on Thai with English in it: small kept both (English in English
// letters) in 4 s; turbo dropped the English and took 13-24 s from the drive
const WHISPER_MODEL = ['ggml-small.bin', 'ggml-medium.bin', 'ggml-large-v3-turbo-q5_0.bin']
  .map((f) => path.join(ROOT, 'whisper', f)).find((f) => fs.existsSync(f)) || path.join(ROOT, 'whisper', 'ggml-small.bin');
const WHISPER_VAD = path.join(ROOT, 'whisper', 'ggml-silero-v5.1.2.bin'); // only the speech goes in
// a first line in the language spoken: Whisper keeps to it, and writes it the way it should look
// Thai and English mixed, the way people talk ("เปิด YouTube ให้หน่อย", "open Chrome please"): English
// words stay in English letters, Thai in Thai
const MIXED = 'สวัสดี Capri วันนี้ช่วยเปิด YouTube กับ Spotify หน่อย แล้วก็ make a game ให้ด้วยนะ. Hey Capri, open Chrome please.';
const HINT = { th: MIXED, en: MIXED, ja: 'こんにちは、Capri。', ko: '안녕, Capri.', zh: '你好，Capri。' };
const PIPER = path.join(ROOT, 'piper', 'piper.exe');
const PIPER_VOICE = path.join(ROOT, 'piper-voice', 'jenny.onnx');

// Kokoro (English and most languages, a girl's voice) and MMS (Thai), through sherpa-onnx in its own
// node.exe (tts-server.js): Electron won't take the audio sherpa-onnx hands back
const SHERPA = path.join(ROOT, 'sherpa');
const SHERPA_NODE = path.join(SHERPA, 'node.exe');
const SHERPA_SERVER = path.join(SHERPA, 'tts-server.js');
const haveSherpa = () => fs.existsSync(SHERPA_NODE) && fs.existsSync(SHERPA_SERVER);

const have = () => ({
  stt: fs.existsSync(WHISPER) && fs.existsSync(WHISPER_MODEL),
  tts: haveSherpa() || (fs.existsSync(PIPER) && fs.existsSync(PIPER_VOICE)),
});

let server = null; // { child, waiting: Map(id -> {resolve, reject}) }
let nextId = 1;
function sherpaServer() {
  if (server) return server;
  const child = spawn(SHERPA_NODE, [SHERPA_SERVER], { cwd: SHERPA, windowsHide: true });
  const waiting = new Map();
  let buffer = '';
  child.stdout.on('data', (d) => {
    buffer += d;
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const job = waiting.get(msg.id);
      if (!job) continue;
      waiting.delete(msg.id);
      if (msg.error) job.reject(new Error(msg.error)); else job.resolve(msg);
    }
  });
  child.stderr.on('data', () => {});
  const fail = () => {
    for (const job of waiting.values()) job.reject(new Error('voice server stopped'));
    if (server?.child === child) server = null;
  };
  child.on('error', fail);
  child.on('exit', fail);
  server = { child, waiting };
  return server;
}

function speakSherpa(text, voice) {
  const { child, waiting } = sherpaServer();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error('voice took too long')); }, 60000);
    waiting.set(id, {
      resolve: (msg) => { clearTimeout(timer); resolve(msg); },
      reject: (err) => { clearTimeout(timer); reject(err); },
    });
    child.stdin.write(`${JSON.stringify({ id, text, voice })}\n`);
  }).then(({ file, rate }) => {
    try { return { wav: fs.readFileSync(file), rate }; } finally { fs.rm(file, { force: true }, () => {}); }
  });
}

function run(file, args, { input, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, windowsHide: true });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', () => {});
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${path.basename(file)} exited ${code}`))));
    if (input !== undefined) child.stdin.end(input);
  });
}

const tmp = (ext) => path.join(os.tmpdir(), `capri-voice-${process.pid}-${Date.now()}${ext}`);

// Thai or English, said as Thai: with the mixed first line, Whisper writes the Thai in Thai and keeps
// the English in English letters (tried: "…ช่วยเปิดเพลงให้หน่อยนะ. Hey Capri, open YouTube…");
// left to detect, it picks one language for the whole clip and drops the other.
async function listen(wav, lang) {
  const file = tmp('.wav');
  fs.writeFileSync(file, Buffer.from(wav));
  const spoken = lang === 'th' || lang === 'en' ? 'th' : 'auto';
  try {
    const out = await run(WHISPER, [
      '-m', WHISPER_MODEL, '-f', file, '-l', spoken, '-nt', '-np', '-t', String(Math.max(4, Math.min(12, os.cpus().length - 2))),
      ...(fs.existsSync(WHISPER_VAD) ? ['--vad', '-vm', WHISPER_VAD] : []),
      ...(HINT[lang] ? ['--prompt', HINT[lang]] : []),
    ], { cwd: path.dirname(WHISPER) });
    return out.replace(/\[[A-Z_ ]+\]|\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
  } finally {
    fs.rm(file, { force: true }, () => {});
  }
}

// voice: whose ('capri', or a character on a holo-call: 'omi')
async function speak(text, voice = 'capri') {
  if (haveSherpa()) {
    try { return await speakSherpa(text, voice); } catch (err) { console.error('[capri] kokoro', err.message); }
  }
  return { wav: await speakPiper(text), rate: 1.32 };
}

async function speakPiper(text) {
  const file = tmp('.wav');
  try {
    await run(PIPER, ['-m', PIPER_VOICE, '--length_scale', '1.25', '--noise_scale', '0.667', '--noise_w', '0.9', '--sentence_silence', '0.15', '--output_file', file], { input: `${text}\n`, cwd: path.dirname(PIPER) });
    return fs.readFileSync(file);
  } finally {
    fs.rm(file, { force: true }, () => {});
  }
}

let handlers = false;
let devices = [];
const inputs = () => devices;

function register(win, onDevices = () => {}) {
  // the overlay may use the microphone (and nothing else it asks for)
  win.webContents.session.setPermissionRequestHandler((_wc, permission, done) => done(permission === 'media'));
  win.webContents.session.setPermissionCheckHandler((_wc, permission) => permission === 'media');
  if (handlers) return; // the overlay is rebuilt now and then: the handlers stay
  handlers = true;
  if (haveSherpa()) setTimeout(() => { try { sherpaServer(); } catch { /* on first use, then */ } }, 8000);
  ipcMain.handle('voice:info', () => have());
  ipcMain.on('voice:devices', (_e, labels) => {
    const next = (Array.isArray(labels) ? labels : []).map(String).slice(0, 20);
    if (next.join('|') === devices.join('|')) return;
    devices = next;
    onDevices();
  });
  ipcMain.handle('voice:listen', (_e, wav, lang) => listen(wav, lang).catch((err) => { console.error('[capri] listen', err.message); return ''; }));
  ipcMain.handle('voice:speak', (_e, text, voice) => speak(String(text).slice(0, 600), typeof voice === 'string' ? voice : 'capri').catch((err) => { console.error('[capri] speak', err.message); return null; }));
}

module.exports = { register, inputs };
