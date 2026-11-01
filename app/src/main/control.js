'use strict';

// What she can do on the PC when you ask: click a control by its name, type, press keys, move windows,
// scroll, and look at the screen. Windows only. Always on the window that was in front before her panel.

const { ipcMain, clipboard, desktopCapturer, screen } = require('electron');
const { execFile } = require('node:child_process');
const path = require('node:path');
const games = require('./games');
const minecraft = require('./minecraft');

const SCRIPT = path.join(__dirname, 'control.ps1');
const KEYS = { enter: '{ENTER}', esc: '{ESC}', escape: '{ESC}', tab: '{TAB}', space: ' ', up: '{UP}', down: '{DOWN}', left: '{LEFT}', right: '{RIGHT}', delete: '{DEL}', del: '{DEL}', backspace: '{BS}', home: '{HOME}', end: '{END}', pageup: '{PGUP}', pagedown: '{PGDN}' };
const MODS = { ctrl: '^', control: '^', alt: '%', shift: '+' };

// "ctrl+shift+t" -> SendKeys "^+t"; null when it isn't a combo we can press
function sendKeys(combo) {
  const parts = String(combo).toLowerCase().split('+').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  let prefix = '';
  for (const mod of parts.slice(0, -1)) {
    if (!MODS[mod]) return null; // the Windows key can't be sent this way
    prefix += MODS[mod];
  }
  const key = parts.at(-1);
  const body = KEYS[key] || (/^f([1-9]|1[0-2])$/.test(key) ? `{${key.toUpperCase()}}` : /^[a-z0-9]$/.test(key) ? key : null);
  return body ? prefix + body : null;
}

// every process of hers (her windows are never what you mean)
function ownPids() {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', '(Get-Process -Name Capri -ErrorAction SilentlyContinue).Id -join \',\''], { windowsHide: true }, (_e, out) => resolve(String(out).trim()));
  });
}

async function ps(action, arg = '') {
  const pids = await ownPids();
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-Action', action, '-Arg', arg, '-Pids', pids],
      { windowsHide: true, timeout: 20000 }, (err, out) => {
        try { resolve(JSON.parse(String(out).trim().split(/\r?\n/).at(-1))); } catch { resolve({ ok: false, error: err?.message || 'no answer' }); }
      });
  });
}

async function act({ action, arg }) {
  if (process.platform !== 'win32') return { ok: false, error: 'Windows only' };
  if (action === 'type') {
    let saved = '';
    try { saved = clipboard.readText(); } catch { /* not text */ }
    clipboard.writeText(String(arg).slice(0, 2000));
    const res = await ps('keys', '^v');
    setTimeout(() => { try { if (saved) clipboard.writeText(saved); } catch { /* leave it */ } }, 800);
    return res;
  }
  if (action === 'keys') {
    const keys = sendKeys(arg);
    return keys ? ps('keys', keys) : { ok: false, error: `can't press ${arg}` };
  }
  if (['click', 'focus', 'window', 'scroll'].includes(action)) return ps(action, String(arg || ''));
  // games (games.js): `arg` is { command, value }
  if (action === 'cyberpunk') return arg?.command === 'install' ? games.installCyberpunk() : games.cyberpunk(arg?.command, arg?.value);
  if (action === 'memory') return games.memAct(arg?.command, arg?.value, () => ps('pid'));
  if (action === 'minecraft') return minecraft.act(arg || {}); // minecraft.js: your own worlds, offline

  return { ok: false, error: 'unknown action' };
}

async function look() {
  const display = screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.min(1600, display.size.width), height: Math.min(1000, display.size.height) } });
  const source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
  if (!source) return { ok: false, error: 'no screen' };
  return { ok: true, data: `data:image/jpeg;base64,${source.thumbnail.toJPEG(82).toString('base64')}` };
}

function register() {
  ipcMain.handle('pc:act', (_e, request) => act(request || {}).catch((err) => ({ ok: false, error: err.message })));
  ipcMain.handle('pc:look', () => look().catch((err) => ({ ok: false, error: err.message })));
  ipcMain.handle('game:status', () => games.status().catch(() => ({})));
  ipcMain.handle('mc:running', () => minecraft.running().catch(() => ({ running: false })));
}

module.exports = { register };
