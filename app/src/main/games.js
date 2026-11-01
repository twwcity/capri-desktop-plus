'use strict';

// Cheats in offline games, when you ask. Two ways:
//  - Cyberpunk 2077: through CapriLink, a Cyber Engine Tweaks mod (<drive>\capri\games\cyberpunk): money, items,
//    health, ammo, god mode, level, time...
//  - any other offline game: capri-mem.exe finds a number in the game's memory and changes it (scan, next, set).
//    It refuses games with an anti-cheat or that are known to be online.

const { spawn, execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(path.dirname(process.execPath), '..', 'games');
const MEM = path.join(ROOT, 'capri-mem.exe');
const MOD_SRC = path.join(ROOT, 'cyberpunk', 'CapriLink');
const CET_SRC = path.join(ROOT, 'dl', 'cet', 'bin');

// --- Cyberpunk 2077 ---

// Steam libraries, then the usual GOG and Epic places
function cyberpunkDir() {
  const libraries = [];
  for (const steam of ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam']) {
    try {
      const vdf = fs.readFileSync(path.join(steam, 'steamapps', 'libraryfolders.vdf'), 'utf8');
      for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) libraries.push(path.join(m[1].replace(/\\\\/g, '\\'), 'steamapps', 'common'));
    } catch { /* no Steam there */ }
  }
  const tries = [
    ...libraries.map((l) => path.join(l, 'Cyberpunk 2077')),
    'C:\\GOG Games\\Cyberpunk 2077', 'C:\\Program Files (x86)\\GOG Galaxy\\Games\\Cyberpunk 2077', 'C:\\Program Files\\Epic Games\\Cyberpunk2077',
  ];
  return tries.find((d) => fs.existsSync(path.join(d, 'bin', 'x64', 'Cyberpunk2077.exe'))) || null;
}

const modDir = (game) => path.join(game, 'bin', 'x64', 'plugins', 'cyber_engine_tweaks', 'mods', 'CapriLink');

function running(image) {
  return new Promise((resolve) => {
    execFile('tasklist', ['/fi', `imagename eq ${image}`, '/nh'], { windowsHide: true }, (_e, out) => resolve(String(out).toLowerCase().includes(image.toLowerCase())));
  });
}

// Cyber Engine Tweaks, when the drive doesn't carry it (a fresh install from the release): its latest
// release from its own GitHub, unzipped into games/dl/cet (so CET_SRC is its bin folder)
async function fetchCet() {
  const res = await fetch('https://api.github.com/repos/maximegmd/CyberEngineTweaks/releases/latest', {
    headers: { 'User-Agent': 'capri-desktop', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const release = await res.json();
  const asset = (release.assets || []).find((a) => /^cet_.*\.zip$/i.test(a.name));
  if (!asset) throw new Error('no CET zip in its latest release');
  const dl = path.join(ROOT, 'dl');
  fs.mkdirSync(dl, { recursive: true });
  const zip = path.join(dl, asset.name);
  const data = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(180000) });
  if (!data.ok) throw new Error(`download answered ${data.status}`);
  fs.writeFileSync(zip, Buffer.from(await data.arrayBuffer()));
  const dest = path.join(dl, 'cet');
  fs.rmSync(dest, { recursive: true, force: true });
  await new Promise((resolve, reject) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`],
  { windowsHide: true, timeout: 120000 }, (err) => (err ? reject(err) : resolve())));
  if (!fs.existsSync(path.join(CET_SRC, 'x64', 'version.dll'))) throw new Error('the CET zip had an unexpected layout');
  return { ok: true, version: release.tag_name };
}

// CET and CapriLink into the game (with the game closed)
async function installCyberpunk() {
  const game = cyberpunkDir();
  if (!game) return { ok: false, error: 'Cyberpunk 2077 is not installed on this PC' };
  if (await running('Cyberpunk2077.exe')) return { ok: false, error: 'close Cyberpunk first, then ask me again' };
  if (!fs.existsSync(path.join(game, 'bin', 'x64', 'plugins', 'cyber_engine_tweaks.asi'))) {
    if (!fs.existsSync(CET_SRC)) {
      const got = await fetchCet().catch((err) => ({ error: err.message }));
      if (got.error) return { ok: false, error: `couldn't download Cyber Engine Tweaks: ${got.error}` };
    }
    fs.cpSync(CET_SRC, path.join(game, 'bin'), { recursive: true });
  }
  fs.mkdirSync(modDir(game), { recursive: true });
  fs.copyFileSync(path.join(MOD_SRC, 'init.lua'), path.join(modDir(game), 'init.lua'));
  return { ok: true, message: 'Cyber Engine Tweaks and CapriLink are in. Start the game: the first time, CET asks you to pick a key for its console.' };
}

let nextId = Date.now();
async function cyberpunk(command, arg = '') {
  const game = cyberpunkDir();
  if (!game) return { ok: false, error: 'Cyberpunk 2077 is not installed on this PC' };
  const dir = modDir(game);
  if (!fs.existsSync(path.join(dir, 'init.lua'))) return { ok: false, error: 'CapriLink is not installed yet: say "install the Cyberpunk mod"' };
  if (!(await running('Cyberpunk2077.exe'))) return { ok: false, error: 'Cyberpunk is not running' };
  const id = ++nextId;
  fs.writeFileSync(path.join(dir, 'inbox.txt'), `${id}|${command}|${String(arg).replace(/[|\r\n]/g, ' ')}|end\n`);
  const outbox = path.join(dir, 'outbox.txt');
  for (let waited = 0; waited < 8000; waited += 250) {
    await new Promise((r) => setTimeout(r, 250));
    let line = '';
    try { line = fs.readFileSync(outbox, 'utf8').trim(); } catch { continue; }
    const [got, status, ...rest] = line.split('|');
    if (Number(got) === id) return status === 'ok' ? { ok: true, message: rest.join('|') } : { ok: false, error: rest.join('|') };
  }
  return { ok: false, error: 'the game did not answer: is a save loaded, and is CapriLink on in CET?' };
}

// --- any offline game: capri-mem.exe ---

let mem = null; // { child, queue }
function memory() {
  if (mem) return mem;
  const child = spawn(MEM, [], { windowsHide: true });
  const waiting = [];
  let buffer = '';
  child.stdout.on('data', (d) => {
    buffer += d;
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      const job = waiting.shift();
      if (!job) continue;
      try { job(JSON.parse(line)); } catch { job({ ok: false, error: line }); }
    }
  });
  const stop = () => { while (waiting.length) waiting.shift()({ ok: false, error: 'the value finder stopped' }); mem = null; };
  child.on('exit', stop);
  child.on('error', stop);
  mem = { child, ask: (line) => new Promise((resolve) => { waiting.push(resolve); child.stdin.write(`${line}\n`); }) };
  return mem;
}

let attached = null; // pid
// `target()` gives { pid, title } of the window in front (control.js)
async function memAct(op, value, target) {
  if (!fs.existsSync(MEM)) return { ok: false, error: 'the value finder is missing' };
  const m = memory();
  if (op === 'scan') {
    const front = await target();
    if (!front?.pid) return { ok: false, error: 'no game window in front' };
    const res = await m.ask(`attach ${front.pid}`);
    if (!res.ok) return res;
    attached = front.pid;
    const kind = /[.,]/.test(value) ? 'float' : 'int';
    const found = await m.ask(`scan ${kind} ${String(value).replace(',', '.')}`);
    return found.ok ? { ...found, message: `${front.title}: ${found.message}` } : found;
  }
  if (!attached) return { ok: false, error: 'find a value first ("find 500")' };
  if (op === 'next') return m.ask(`next ${String(value).replace(',', '.')}`);
  if (op === 'set') return m.ask(`set ${String(value).replace(',', '.')}`);
  if (op === 'reset') { attached = null; return m.ask('reset'); }
  return { ok: false, error: 'unknown' };
}

// what she can cheat in right now
async function status() {
  const game = cyberpunkDir();
  const installed = Boolean(game && fs.existsSync(path.join(modDir(game), 'init.lua')));
  return { cyberpunk: installed && (await running('Cyberpunk2077.exe')), cyberpunkInstalled: installed, scanning: Boolean(attached) };
}

module.exports = { cyberpunk, installCyberpunk, memAct, cyberpunkDir, status };
