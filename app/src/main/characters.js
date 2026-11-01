'use strict';

// Characters of yours, next to her data on the drive: characters/<id>/character.json, its body
// picture (body.png, 240x420, made in the editor) and its faces (faces/<name>.png).
// Capri herself is built in and never written here.

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const FACE_NAMES = ['calm', 'aside', 'smug', 'wide', 'look', 'laugh', 'many', 'blush', 'tease', 'grin'];

const dir = () => path.join(app.getPath('userData'), 'characters');
const safeId = (id) => (/^[a-z0-9-]{1,40}$/.test(String(id || '')) ? id : null);

function read(id) {
  if (!safeId(id)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(dir(), id, 'character.json'), 'utf8'));
  } catch {
    return null;
  }
}

function list() {
  let ids = [];
  try {
    ids = fs.readdirSync(dir(), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch { /* none yet */ }
  return ids.map(read).filter(Boolean).sort((a, b) => (a.created || 0) - (b.created || 0));
}

// 'data:image/png;base64,...' -> a file
function writePicture(file, dataUrl) {
  const m = /^data:image\/(png|webp|jpeg);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new Error('not a picture');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(m[2], 'base64'));
}

// { id?, name, points, body?: dataUrl, faces?: { name: dataUrl | null } } -> the saved character
function save(input) {
  const id = safeId(input.id) || `c-${Date.now().toString(36)}`;
  const folder = path.join(dir(), id);
  const before = read(id) || { id, created: Date.now(), faces: {} };
  if (input.body) writePicture(path.join(folder, 'body.png'), input.body);
  if (!input.body && !fs.existsSync(path.join(folder, 'body.png'))) throw new Error('no body picture');
  const faces = { ...before.faces };
  for (const [name, data] of Object.entries(input.faces || {})) {
    if (!FACE_NAMES.includes(name)) continue;
    const file = path.join(folder, 'faces', `${name}.png`);
    if (data === null) {
      fs.rmSync(file, { force: true });
      delete faces[name];
    } else {
      writePicture(file, data);
      faces[name] = `faces/${name}.png`;
    }
  }
  const character = {
    ...before,
    id,
    name: String(input.name || 'Character').slice(0, 24),
    points: input.points || before.points || {},
    faces,
    updated: Date.now(),
  };
  fs.writeFileSync(path.join(folder, 'character.json'), JSON.stringify(character, null, 2));
  return character;
}

function remove(id) {
  if (!safeId(id)) return false;
  fs.rmSync(path.join(dir(), id), { recursive: true, force: true });
  return true;
}

module.exports = { dir, list, read, save, remove, FACE_NAMES };
