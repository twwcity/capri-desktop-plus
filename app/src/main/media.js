'use strict';

// Files she can be given (pictures, text) and pictures she can make (stable-diffusion.cpp, offline).

const { app, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.env.CAPRI_IMAGEGEN_DIR || path.join(path.dirname(process.execPath), '..', 'imagegen');
const OUT = path.join(ROOT, 'images');
const MODEL = path.join(ROOT, 'sd_turbo.safetensors');
// Wan 2.2 (TI2V 5B): slower but far better pictures; used whenever its three files are there
const WAN_DIR = path.join(ROOT, 'wan');
const WAN = {
  model: path.join(WAN_DIR, 'Wan2.2-TI2V-5B-Q5_K_M.gguf'),
  t5: path.join(WAN_DIR, 'umt5-xxl-encoder-Q5_K_M.gguf'),
  vae: path.join(WAN_DIR, 'wan2.2_vae.safetensors'),
};
const NEGATIVE = 'blurry, low quality, worst quality, jpeg artifacts, deformed, bad anatomy, extra fingers, watermark, text, signature';
const IMAGE = /\.(png|jpe?g|webp|gif|bmp)$/i;
const TEXT = /\.(txt|md|json|csv|log|js|mjs|ts|py|html|css|xml|ya?ml|ini|cfg|toml|java|c|cpp|h|cs|go|rs|sh|bat|ps1|sql)$/i;
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' };

function sdExe() {
  for (const dir of [ROOT, path.join(ROOT, 'bin')]) {
    for (const name of ['sd-cli.exe', 'sd.exe']) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) return file;
    }
  }
  return null;
}

const hasWan = () => Object.values(WAN).every((f) => fs.existsSync(f));
const available = () => Boolean(sdExe() && (hasWan() || fs.existsSync(MODEL)));

// "แนวตั้ง" / "portrait" / "wallpaper" pick the shape; square otherwise
function size(text) {
  if (/แนวตั้ง|portrait|vertical|phone|มือถือ|tall/i.test(text)) return ['480', '832'];
  if (/แนวนอน|landscape|wide|wallpaper|วอลเปเปอร์|banner|horizontal/i.test(text)) return ['832', '480'];
  return ['640', '640'];
}

function wanArgs(prompt, text, file) {
  const [w, h] = size(text);
  return ['--diffusion-model', WAN.model, '--t5xxl', WAN.t5, '--vae', WAN.vae, '-p', prompt, '-n', NEGATIVE,
    '--cfg-scale', '5.0', '--sampling-method', 'euler', '--steps', '20', '--flow-shift', '3.0',
    '-W', w, '-H', h, '--flash-attn', 'on', '--offload-to-cpu', '--vae-tiling', '--seed', '-1', '-o', file];
}

const turboArgs = (prompt, file) => ['-m', MODEL, '-p', prompt, '--steps', '4', '--cfg-scale', '1.0', '-W', '512', '-H', '512', '--sampling-method', 'euler', '--seed', '-1', '-o', file];

async function pick() {
  const res = await dialog.showOpenDialog({
    title: 'Give Capri a file',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Pictures and text', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'txt', 'md', 'json', 'csv', 'log', 'js', 'ts', 'py', 'html', 'css', 'xml', 'yml', 'yaml', 'ini', 'cfg', 'toml', 'sql'] }, { name: 'All files', extensions: ['*'] }],
  });
  if (res.canceled) return [];
  const files = [];
  for (const file of res.filePaths.slice(0, 6)) {
    const name = path.basename(file);
    const size = fs.statSync(file).size;
    if (IMAGE.test(name) && size <= 20 * 1024 * 1024) {
      const ext = path.extname(name).slice(1).toLowerCase();
      files.push({ name, kind: 'image', data: `data:${MIME[ext]};base64,${fs.readFileSync(file).toString('base64')}` });
    } else if (TEXT.test(name) && size <= 2 * 1024 * 1024) {
      files.push({ name, kind: 'text', data: fs.readFileSync(file, 'utf8').slice(0, 16000) });
    }
  }
  return files;
}

function run(file, args, onLine) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd: path.dirname(file), windowsHide: true });
    let tail = '';
    const read = (d) => { tail = (tail + d).slice(-2000); onLine?.(String(d)); };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`image maker exited ${code}: ${tail.split('\n').slice(-4).join(' ').trim()}`))));
  });
}

let busy = false;

// `ask(prompt)` turns what you said into an English picture prompt (her model); `free()` unloads her
// model first, so the graphics card has room.
async function generate(text, { ask, free }) {
  if (!available()) return { ok: false, error: 'The picture maker is not installed' };
  if (busy) return { ok: false, error: 'busy' };
  busy = true;
  try {
    let prompt = String(text).trim().slice(0, 400);
    try {
      const better = await ask(prompt);
      if (better) prompt = better.replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 300);
    } catch { /* the words as they are */ }
    await free().catch(() => {});
    fs.mkdirSync(OUT, { recursive: true });
    const file = path.join(OUT, `capri-${Date.now()}.png`);
    let wan = hasWan();
    try {
      await run(sdExe(), wan ? wanArgs(prompt, text, file) : turboArgs(prompt, file));
    } catch (err) {
      if (!wan || !fs.existsSync(MODEL)) throw err;
      wan = false; // Wan didn't fit this PC: the quick model instead
      await run(sdExe(), turboArgs(prompt, file));
    }
    const data = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
    return { ok: true, file, data, prompt };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    busy = false;
  }
}

function register(deps) {
  ipcMain.handle('media:info', () => ({ draw: available() }));
  ipcMain.handle('media:pick', () => pick().catch(() => []));
  ipcMain.handle('media:generate', (_e, text) => generate(text, deps));
  ipcMain.on('media:show', (_e, file) => {
    if (typeof file === 'string' && file.startsWith(OUT)) shell.showItemInFolder(file);
  });
  // a picture she drew, saved where you choose (Downloads by default)
  ipcMain.handle('media:save', async (_e, file) => {
    if (typeof file !== 'string' || !file.startsWith(OUT) || !fs.existsSync(file)) return false;
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('downloads'), path.basename(file)),
      filters: [{ name: 'PNG', extensions: ['png'] }],
    });
    if (canceled || !filePath) return false;
    fs.copyFileSync(file, filePath);
    shell.showItemInFolder(filePath);
    return true;
  });
  ipcMain.on('media:open', (_e, file) => {
    if (typeof file === 'string' && file.startsWith(OUT)) shell.openPath(file);
  });
}

module.exports = { register };
