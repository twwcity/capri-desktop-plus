'use strict';

// Her Minecraft mod, Capri Link (its source: games/minecraft/capri-mod on the drive), carried inside her
// (resources/minecraft/capri-link.jar) and put into its game folder whenever it's newer. While a world
// is open the mod asks her each second for orders: what you tell her on the desktop ("หาแร่เพชร",
// "ฟ้าผ่าม็อบ") is queued here, runs in the game, and what the mod said there comes back.

const { ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DRIVE = path.join(path.dirname(process.execPath), '..');
const JAR = path.join(__dirname, '..', '..', 'minecraft', 'capri-link.jar');
const GAME = path.join(DRIVE, 'games', 'minecraft', 'capri-1.21.1');
const MODS = path.join(GAME, 'mods');

const queue = [];
const waiting = new Map(); // id -> resolve(report)
let seen = 0;              // when the mod last asked (ms)
let player = '';
let nextId = 1;

// the jar she carries, into the game's mods when it differs (size or time)
function install() {
  try {
    if (!fs.existsSync(JAR) || !fs.existsSync(GAME)) return false;
    fs.mkdirSync(MODS, { recursive: true });
    const to = path.join(MODS, 'capri-link-1.0.0.jar');
    const a = fs.statSync(JAR);
    const b = fs.existsSync(to) ? fs.statSync(to) : null;
    if (b && b.size === a.size && b.mtimeMs >= a.mtimeMs) return true;
    fs.copyFileSync(JAR, to);
    return true;
  } catch (err) {
    console.error('[capri] minecraft mod install:', err.message); // in use by a running game: next start
    return false;
  }
}

const online = () => Date.now() - seen < 4000;

// what the mod gets when it asks
function next(who) {
  seen = Date.now();
  if (who) player = who;
  return queue.splice(0, queue.length);
}

function report({ id, report: text }) {
  const done = waiting.get(String(id));
  if (done) {
    waiting.delete(String(id));
    done(String(text || ''));
  }
}

// an order for the game: scan (arg: ore words) | shock (arg: "" hostiles, "all", a mob) | say (arg: words)
function order(cmd, arg = '') {
  if (!online()) return Promise.resolve({ ok: false, error: 'Minecraft is not open (with the Capri Link profile)' });
  const id = String(nextId++);
  queue.push({ id, cmd, arg: String(arg).slice(0, 300) });
  return new Promise((resolve) => {
    const timer = setTimeout(() => { waiting.delete(id); resolve({ ok: false, error: 'the game did not answer' }); }, 15000);
    waiting.set(id, (text) => { clearTimeout(timer); resolve({ ok: true, report: text }); });
  });
}

function register() {
  install();
  ipcMain.handle('minecraft:status', () => ({ online: online(), player, installed: fs.existsSync(path.join(MODS, 'capri-link-1.0.0.jar')) }));
  ipcMain.handle('minecraft:order', (_e, cmd, arg) => (['scan', 'shock', 'say'].includes(cmd) ? order(cmd, arg) : { ok: false, error: 'unknown order' }));
}

module.exports = { register, next, report, online, install };
