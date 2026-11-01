'use strict';

// Her code mode (chat.js): she writes and edits real files in a project folder, and a web game she
// makes opens in its own window to play right away. Every write stays inside that folder, and a file
// she changes or replaces is copied first to <folder>/.capri-backup/<time>/.

const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const WORKSPACE = path.join(path.dirname(process.execPath), '..', 'workspace');
const SKIP = /^(node_modules|\.git|\.capri-backup|dist|build|__pycache__|\.venv|venv)$/;
const TEXT = /\.(html?|css|js|mjs|cjs|ts|tsx|jsx|json|md|txt|py|lua|cs|c|cpp|h|hpp|java|go|rs|rb|php|sh|bat|cmd|ps1|ini|cfg|toml|ya?ml|xml|svg|sql|gd|glsl)$/i;
const MAX_FILES = 400;
const MAX_CONTEXT = 90 * 1024; // what she reads of the project per message

// a folder name from what you asked: "make a snake game" -> snake-game
const slug = (text) => (text.toLowerCase().match(/[a-z0-9]+/g) || []).slice(0, 4).join('-') || `project-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`; // Thai and such: by date

function inside(dir, rel) {
  const abs = path.resolve(dir, rel);
  const back = path.relative(dir, abs);
  if (!rel || back.startsWith('..') || path.isAbsolute(back)) throw new Error(`outside the project: ${rel}`);
  return abs;
}

function walk(dir) {
  const out = [];
  const go = (sub) => {
    if (out.length >= MAX_FILES) return;
    let entries = [];
    try { entries = fs.readdirSync(path.join(dir, sub), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (SKIP.test(e.name)) continue;
      const rel = sub ? `${sub}/${e.name}` : e.name;
      if (e.isDirectory()) go(rel);
      else if (out.length < MAX_FILES) out.push({ path: rel, size: fs.statSync(path.join(dir, rel)).size });
    }
  };
  go('');
  return out;
}

// the folder's files, and the text of as many as fit (the smallest first, so more of them do)
function context(dir) {
  const files = fs.existsSync(dir) ? walk(dir) : []; // a new project's folder comes with its first file
  let room = MAX_CONTEXT;
  const contents = [];
  for (const f of [...files].filter((f) => TEXT.test(f.path)).sort((a, b) => a.size - b.size)) {
    if (f.size > room) continue;
    contents.push({ path: f.path, text: fs.readFileSync(path.join(dir, f.path), 'utf8') });
    room -= f.size;
  }
  return { dir, files, contents };
}

// Where FIND is in the file: exactly, or else line by line with the spaces around each line ignored
// (a model copies indentation and line ends loosely). { start, end } or null.
function locate(text, find) {
  const at = text.indexOf(find);
  if (at >= 0) return { start: at, end: at + find.length };
  const want = find.replace(/\r/g, '').split('\n').map((l) => l.trim());
  while (want.length && !want[0]) want.shift();
  while (want.length && !want.at(-1)) want.pop();
  if (!want.length) return null;
  const lines = text.split('\n');
  const offsets = [];
  let pos = 0;
  for (const l of lines) { offsets.push(pos); pos += l.length + 1; }
  for (let i = 0; i + want.length <= lines.length; i++) {
    if (want.every((w, k) => lines[i + k].trim() === w)) {
      const last = i + want.length - 1;
      return { start: offsets[i], end: offsets[last] + lines[last].replace(/\r$/, '').length };
    }
  }
  return null;
}

// ops: [{ type: 'write', path, text } | { type: 'edit', path, find, replace } | { type: 'delete', path }]
function apply(dir, ops) {
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backup = (abs, rel) => {
    if (!fs.existsSync(abs)) return;
    const to = path.join(dir, '.capri-backup', stamp, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(abs, to);
  };
  const done = [];
  for (const op of ops) {
    try {
      const abs = inside(dir, op.path);
      const existed = fs.existsSync(abs);
      if (op.type === 'delete') {
        if (!existed) continue;
        backup(abs, op.path);
        fs.rmSync(abs);
        done.push({ path: op.path, abs, action: 'deleted' });
      } else if (op.type === 'edit') {
        if (!existed) throw new Error('no such file');
        const text = fs.readFileSync(abs, 'utf8');
        const spot = locate(text, op.find);
        if (!spot) throw new Error('the part to change was not found');
        backup(abs, op.path);
        fs.writeFileSync(abs, text.slice(0, spot.start) + op.replace + text.slice(spot.end));
        done.push({ path: op.path, abs, action: 'edited' });
      } else {
        backup(abs, op.path);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, op.text);
        done.push({ path: op.path, abs, action: existed ? 'rewritten' : 'new', size: Buffer.byteLength(op.text) });
      }
    } catch (err) {
      done.push({ path: op.path, action: 'failed', error: err.message });
    }
  }
  return { dir, backup: path.join(dir, '.capri-backup', stamp), files: done };
}

// --- floating windows over your games ---------------------------------------------------------------
// A page with <meta name="capri-overlay" content="width=360,height=220,corner=top-right"> opens
// frameless, see-through and on top of everything (a game in borderless or windowed mode; an
// exclusive-fullscreen game draws over it). Dragged anywhere to move. Ctrl+Shift+F9: clicks go
// through to the game (and back); Ctrl+Shift+F10: all of them close.

const overlays = new Set();
let through = false;

function overlaySpec(file) {
  const head = fs.readFileSync(file, 'utf8').slice(0, 6000);
  const meta = /<meta[^>]+name=["']capri-overlay["'][^>]*content=["']([^"']*)["']/i.exec(head)
    || /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']capri-overlay["']/i.exec(head);
  if (!meta) return null;
  const opt = Object.fromEntries(meta[1].split(',').map((kv) => kv.split('=').map((s) => s.trim())));
  return {
    width: Math.min(1200, Math.max(120, Number(opt.width) || 360)),
    height: Math.min(900, Math.max(60, Number(opt.height) || 220)),
    corner: opt.corner || 'top-right',
  };
}

function overlay(file, spec) {
  const { screen, globalShortcut } = require('electron');
  const area = screen.getPrimaryDisplay().workArea;
  const m = 16;
  const x = /left/.test(spec.corner) ? area.x + m : /center/.test(spec.corner) ? area.x + (area.width - spec.width) / 2 : area.x + area.width - spec.width - m;
  const y = /bottom/.test(spec.corner) ? area.y + area.height - spec.height - m : area.y + m;
  const win = new BrowserWindow({
    x: Math.round(x), y: Math.round(y), width: spec.width, height: spec.height,
    frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, resizable: true, fullscreenable: false,
    title: path.basename(path.dirname(file)),
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'overlay-preload.js') },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('did-finish-load', () => win.webContents.insertCSS(
    'html{-webkit-app-region:drag} button,input,select,textarea,a,label,[data-nodrag]{-webkit-app-region:no-drag}'));
  win.loadFile(file);
  if (through) win.setIgnoreMouseEvents(true, { forward: true });
  overlays.add(win);
  win.on('closed', () => overlays.delete(win));
  if (!globalShortcut.isRegistered('Control+Shift+F9')) {
    globalShortcut.register('Control+Shift+F9', () => {
      through = !through;
      for (const w of overlays) w.setIgnoreMouseEvents(through, { forward: true });
    });
    globalShortcut.register('Control+Shift+F10', () => { for (const w of [...overlays]) w.close(); });
  }
  return true;
}

// the PC's load, for overlays: CPU from two looks at its counters, the NVIDIA card from nvidia-smi
let cpuBefore = null;
let gpuSeen = { at: 0, value: null };
function cpuNow() {
  const os = require('node:os');
  const t = os.cpus().reduce((a, c) => {
    const all = Object.values(c.times).reduce((s, v) => s + v, 0);
    return { idle: a.idle + c.times.idle, all: a.all + all };
  }, { idle: 0, all: 0 });
  const was = cpuBefore || t;
  cpuBefore = t;
  const all = t.all - was.all;
  return all > 0 ? Math.round(100 * (1 - (t.idle - was.idle) / all)) : 0;
}
function gpuNow() {
  if (Date.now() - gpuSeen.at < 900) return Promise.resolve(gpuSeen.value);
  return new Promise((resolve) => {
    require('node:child_process').execFile('nvidia-smi', ['--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total,name', '--format=csv,noheader,nounits'],
      { timeout: 3000, windowsHide: true }, (err, out) => {
        const [gpu, temp, used, total, name] = err ? [] : out.split('\n')[0].split(',').map((s) => s.trim());
        gpuSeen = { at: Date.now(), value: err ? null : { gpu: Number(gpu), gpuTemp: Number(temp), vramUsedMB: Number(used), vramTotalMB: Number(total), gpuName: name } };
        resolve(gpuSeen.value);
      });
  });
}
async function stats() {
  const os = require('node:os');
  const total = os.totalmem();
  const used = total - os.freemem();
  const gpu = await gpuNow();
  return {
    cpu: cpuNow(),
    ram: Math.round((100 * used) / total),
    ramUsedGB: Math.round(used / 1e8) / 10,
    ramTotalGB: Math.round(total / 1e8) / 10,
    gpu: gpu?.gpu ?? null, gpuTemp: gpu?.gpuTemp ?? null, vramUsedMB: gpu?.vramUsedMB ?? null, vramTotalMB: gpu?.vramTotalMB ?? null, gpuName: gpu?.gpuName ?? null,
  };
}

// a web game, in a window of its own (no Node in it: it's only a page); an overlay page floats instead
function play(file) {
  const spec = overlaySpec(file);
  if (spec) return overlay(file, spec);
  const win = new BrowserWindow({
    width: 1000,
    height: 760,
    title: path.basename(path.dirname(file)),
    autoHideMenuBar: true,
    backgroundColor: '#111',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(file);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  return true;
}

function register({ config, updateConfig }) {
  const projectDir = () => config.load().codeDir || null;
  ipcMain.handle('code:info', () => ({ dir: projectDir(), workspace: WORKSPACE }));
  ipcMain.handle('code:context', (_e, { dir, ask }) => context(dir || projectDir() || path.join(WORKSPACE, slug(ask || ''))));
  ipcMain.handle('code:apply', (_e, { dir, ops }) => {
    const res = apply(dir, ops);
    updateConfig({ codeDir: dir }); // the next message carries on in the same project
    return res;
  });
  ipcMain.handle('code:pick', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], defaultPath: projectDir() || WORKSPACE });
    if (canceled || !filePaths[0]) return null;
    updateConfig({ codeDir: filePaths[0] });
    return filePaths[0];
  });
  ipcMain.handle('code:new', () => { updateConfig({ codeDir: null }); return null; });
  ipcMain.handle('code:play', (_e, file) => typeof file === 'string' && /\.html?$/i.test(file) && fs.existsSync(file) && play(file));
  ipcMain.handle('overlay:stats', () => stats());
  ipcMain.on('overlay:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
  ipcMain.on('overlay:through', (e, on) => BrowserWindow.fromWebContents(e.sender)?.setIgnoreMouseEvents(on, { forward: true }));
  ipcMain.on('code:reveal', (_e, file) => typeof file === 'string' && fs.existsSync(file) && shell.showItemInFolder(file));
  ipcMain.on('code:openDir', (_e, dir) => typeof dir === 'string' && fs.existsSync(dir) && shell.openPath(dir));
  app.on('ready', () => fs.mkdirSync(WORKSPACE, { recursive: true }));
}

module.exports = { register, WORKSPACE };
