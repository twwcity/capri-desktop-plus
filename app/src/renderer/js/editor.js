// "Character & theme" (editor.html, opened from her menu).
// Capri stays the original. A character of yours is a full-body picture fitted into her 240x420
// frame, with the body points her animation bends around (sprite.js), and faces for her panel.
// The preview runs the same renderer as on the desktop, so what moves here moves there.

import { SpriteRenderer, SPRITE, CAPRI_RIG, useRig } from './sprite.js';

const ed = window.editor;
const W = SPRITE.width, H = SPRITE.height;
const $ = (id) => document.getElementById(id);

// Its words, in her language (her menu's Language); English for the ones without their own.
const STRINGS = {
  en: {
    title: 'Character & theme', tabCharacter: 'Character', tabTheme: 'Theme', characters: 'Characters',
    newCharacter: '+ New character', capriTitle: 'Capri (original)',
    capriKept: 'The original is never changed: her picture, her moves and her animations all stay as they are.',
    capriHow: 'For another character, press "+ New character" on the left and add your picture.',
    useCapri: 'Use Capri', name: 'Name', namePlaceholder: 'Character name', pickBody: 'Choose full-body picture…',
    removeBg: 'Remove background', bgStrength: 'Background removal strength',
    bodyHint: 'Best: a full-body picture, standing, facing forward, arms a little away from the body, on a transparent background (PNG).',
    bodyPoints: 'Body points', pointsHint: 'Pick a point in the list, then click on the picture, or drag a dot on the picture to move it.',
    armWidth: 'Arm thickness', guess: 'Place points automatically again', preview: 'Animation preview', loop: 'Loop through the moves',
    faces: 'Faces (in her message box)', facesHint: 'Optional: a missing face is replaced by another one you added.',
    save: 'Save', saveUse: 'Save and use', delete: 'Delete', tryOn: 'Try on the desktop:',
    presets: 'Ready-made themes', ownColors: 'Your own colours', resetColors: 'Back to the original colours',
    themeHint: 'Colours change on screen right away: the message box, the character’s outline and its afterimages.',
    inUse: 'in use', newName: 'New character', pickFirst: 'Click here or press "Choose full-body picture…"',
    add: 'Add', change: 'Change', remove: 'Remove',
    sNoPicture: 'No picture chosen yet', sPlaced: 'Points placed automatically: move them to fit the character',
    sNeedPicture: 'Add a picture of the character first', sSaved: 'Saved', sUsing: 'Now on screen: {name}',
    sCantSave: 'Could not save: {error}', sCantOpen: 'Could not open the character: {error}', sBackToCapri: 'Capri is back',
    sDeleted: 'Deleted', sAskDelete: 'Delete "{name}"? This can’t be undone.', sPickAgain: 'Choose the picture again to remove its background',
    sTheme: 'Theme changed', character: 'Character',
    points: {
      head: 'Head (where her name tag points)', mane: 'Middle of the hair (it flares from here)', face: 'Middle of the face (stays still)',
      neck: 'Neck (the head turns around it)', shoulderL: 'Left shoulder (in the picture)', handL: 'Left hand',
      shoulderR: 'Right shoulder (in the picture)', handR: 'Right hand', hip: 'Hip (folds here when sitting)',
      kneeL: 'Left knee', kneeR: 'Right knee', feet: 'Feet (where it stands)',
    },
    short: { head: 'head', mane: 'hair', face: 'face', neck: 'neck', shoulderL: 'L sh.', handL: 'L hand', shoulderR: 'R sh.', handR: 'R hand', hip: 'hip', kneeL: 'L knee', kneeR: 'R knee', feet: 'feet' },
    faceNames: { grin: 'Grin (main)', calm: 'Calm', look: 'Looking at you', smug: 'Smug', laugh: 'Laughing', wide: 'Surprised', aside: 'Looking away', many: 'Staring', blush: 'Blushing', tease: 'Teasing' },
    moves: { idle: 'Idle', wave: 'Wave', raise: 'Arms up', reach: 'Reach', tilt: 'Head tilt', mane: 'Hair flare', sit: 'Sit & swing', split: 'Split', glitch: 'Glitch', warp: 'Warp' },
    tries: { hop: 'Hop', spin: 'Spin', curious: 'Curious', victory: 'Victory', flinch: 'Flinch', split: 'Split', alarm: 'Alarm', talk: 'Talk', teleport: 'Teleport' },
    presetNames: { capri: 'Capri (original)', ocean: 'Ocean', sakura: 'Sakura', gold: 'Gold', matrix: 'Matrix', blood: 'Blood', mono: 'Mono' },
    colorNames: { violet: 'Outline / main buttons', red: 'Alerts / errors', green: 'Done / highlights', ink: 'Message box background', paper: 'Text' },
  },
  th: {
    title: 'ตัวละครและธีม', tabCharacter: 'ตัวละคร', tabTheme: 'ธีม', characters: 'ตัวละคร',
    newCharacter: '+ สร้างตัวละครใหม่', capriTitle: 'Capri (ต้นฉบับ)',
    capriKept: 'ตัวต้นฉบับจะไม่ถูกแก้ไข ทั้งรูป ท่าทาง และแอนิเมชันอยู่ครบเหมือนเดิม',
    capriHow: 'อยากได้ตัวละครอื่น กด "+ สร้างตัวละครใหม่" ทางซ้าย แล้วใส่รูปของคุณ',
    useCapri: 'ใช้ Capri', name: 'ชื่อ', namePlaceholder: 'ชื่อตัวละคร', pickBody: 'เลือกรูปตัวเต็ม…',
    removeBg: 'ลบพื้นหลัง', bgStrength: 'ความแรงในการลบพื้นหลัง',
    bodyHint: 'ใช้รูปตัวละครยืนเต็มตัว หันหน้าตรง แขนกางออกจากตัวเล็กน้อย พื้นหลังโปร่งใส (PNG) จะได้ผลดีที่สุด',
    bodyPoints: 'จุดบนตัว', pointsHint: 'เลือกจุดจากรายการ แล้วคลิกบนรูป หรือลากจุดสีบนรูปเพื่อย้าย',
    armWidth: 'ความหนาแขน', guess: 'วางจุดอัตโนมัติใหม่', preview: 'ดูตัวอย่างการขยับ', loop: 'เล่นท่าวนอัตโนมัติ',
    faces: 'หน้า (ในกล่องข้อความ)', facesHint: 'ไม่ใส่ก็ได้ ถ้าไม่มี จะใช้หน้าอื่นที่มีแทน',
    save: 'บันทึก', saveUse: 'บันทึกและใช้ตัวนี้', delete: 'ลบ', tryOn: 'ลองบนหน้าจอ:',
    presets: 'ธีมสำเร็จรูป', ownColors: 'ปรับสีเอง', resetColors: 'กลับเป็นสีต้นฉบับ',
    themeHint: 'สีจะเปลี่ยนบนหน้าจอทันที ทั้งกล่องข้อความ เส้นขอบตัวละคร และเงาตอนแยกร่าง',
    inUse: 'ใช้อยู่', newName: 'ตัวละครใหม่', pickFirst: 'คลิกตรงนี้ หรือกด "เลือกรูปตัวเต็ม…"',
    add: 'ใส่รูป', change: 'เปลี่ยน', remove: 'ลบ',
    sNoPicture: 'ยังไม่ได้เลือกรูป', sPlaced: 'วางจุดให้อัตโนมัติแล้ว ลองขยับจุดให้ตรงกับตัวละคร',
    sNeedPicture: 'ใส่รูปตัวละครก่อน', sSaved: 'บันทึกแล้ว', sUsing: 'ใช้ {name} บนหน้าจอแล้ว',
    sCantSave: 'บันทึกไม่ได้: {error}', sCantOpen: 'เปิดตัวละครไม่ได้: {error}', sBackToCapri: 'กลับมาใช้ Capri แล้ว',
    sDeleted: 'ลบแล้ว', sAskDelete: 'ลบ "{name}" ใช่ไหม? ลบแล้วกู้คืนไม่ได้', sPickAgain: 'เลือกรูปใหม่อีกครั้งเพื่อลบพื้นหลัง',
    sTheme: 'เปลี่ยนธีมแล้ว', character: 'ตัวละคร',
    points: {
      head: 'หัว (จุดที่ป้ายชื่อชี้)', mane: 'กลางผม (ผมฟูออกจากตรงนี้)', face: 'กลางหน้า (ส่วนที่ไม่ฟู)',
      neck: 'คอ (หัวหมุนรอบจุดนี้)', shoulderL: 'ไหล่ซ้าย (ในรูป)', handL: 'มือซ้าย',
      shoulderR: 'ไหล่ขวา (ในรูป)', handR: 'มือขวา', hip: 'สะโพก (ตอนนั่ง พับตรงนี้)',
      kneeL: 'เข่าซ้าย', kneeR: 'เข่าขวา', feet: 'เท้า (จุดที่ยืน)',
    },
    short: { head: 'หัว', mane: 'ผม', face: 'หน้า', neck: 'คอ', shoulderL: 'ไหล่ซ้าย', handL: 'มือซ้าย', shoulderR: 'ไหล่ขวา', handR: 'มือขวา', hip: 'สะโพก', kneeL: 'เข่าซ้าย', kneeR: 'เข่าขวา', feet: 'เท้า' },
    faceNames: { grin: 'ยิ้ม (หลัก)', calm: 'นิ่ง', look: 'มองคุณ', smug: 'ยิ้มเยาะ', laugh: 'หัวเราะ', wide: 'ตกใจ', aside: 'หันไปทางอื่น', many: 'จ้องเขม็ง', blush: 'เขิน', tease: 'แซว' },
    moves: { idle: 'ยืนเฉย', wave: 'โบกมือ', raise: 'ชูแขน', reach: 'ยื่นแขน', tilt: 'เอียงหัว', mane: 'ผมฟู', sit: 'นั่งแกว่งขา', split: 'แยกร่าง', glitch: 'กลิตช์', warp: 'วาร์ป' },
    tries: { hop: 'กระโดด', spin: 'หมุน', curious: 'สงสัย', victory: 'ฉลอง', flinch: 'สะดุ้ง', split: 'แยกร่าง', alarm: 'ตกใจ', talk: 'พูด', teleport: 'วาร์ป' },
    presetNames: { capri: 'Capri (ต้นฉบับ)', ocean: 'มหาสมุทร', sakura: 'ซากุระ', gold: 'ทองคำ', matrix: 'เมทริกซ์', blood: 'เลือด', mono: 'ขาวดำ' },
    colorNames: { violet: 'เส้นขอบ / ปุ่มหลัก', red: 'แจ้งเตือน / ผิดพลาด', green: 'สำเร็จ / ไฮไลต์', ink: 'พื้นกล่องข้อความ', paper: 'ตัวหนังสือ' },
  },
};
let T = STRINGS.en;
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');

// every [data-t] text and [data-t-ph] placeholder of the page, in her language
function translatePage(lang) {
  T = STRINGS[lang] || STRINGS.en;
  document.documentElement.lang = STRINGS[lang] ? lang : 'en';
  document.title = `Capri — ${T.title}`;
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = T[el.dataset.t] ?? '';
  for (const el of document.querySelectorAll('[data-t-ph]')) el.placeholder = T[el.dataset.tPh] ?? '';
}

// the points you place, in the order you're asked for them
const POINTS = [
  { key: 'head', color: '#ffd23f' }, { key: 'mane', color: '#ff7ad9' }, { key: 'face', color: '#ffffff' },
  { key: 'neck', color: '#3ff2ff' }, { key: 'shoulderL', color: '#36ff7a' }, { key: 'handL', color: '#36ff7a' },
  { key: 'shoulderR', color: '#ff2f5b' }, { key: 'handR', color: '#ff2f5b' }, { key: 'hip', color: '#b98cff' },
  { key: 'kneeL', color: '#ffa94d' }, { key: 'kneeR', color: '#ffa94d' }, { key: 'feet', color: '#9ad0ff' },
];

const FACES = ['grin', 'calm', 'look', 'smug', 'laugh', 'wide', 'aside', 'many', 'blush', 'tease'];

// moves for the preview: each sets her animation values over time (t in seconds)
const MOVES = [
  ['idle', (t, p) => { p.hair = Math.sin(t * 1.6) * 3; p.head = Math.sin(t * 0.9) * 0.04; }],
  ['wave', (t, p) => { p.armR = 2.0 + Math.sin(t * 9) * 0.35; p.head = 0.08; }],
  ['raise', (t, p) => { const k = Math.min(1, (t % 2) * 3); p.armL = p.armR = 2.3 * k; p.mane = 0.8 * k; }],
  ['reach', (t, p) => { p.armL = 0.5; p.longL = 1 + 0.5 * Math.abs(Math.sin(t * 2)); }],
  ['tilt', (t, p) => { p.head = Math.sin(t * 2.4) * 0.28; p.hair = Math.sin(t * 2.4) * 6; }],
  ['mane', (t, p) => { p.mane = Math.max(0, Math.sin(t * 3)) * 1.4; p.hair = Math.sin(t * 5) * 4; }],
  ['sit', (t, p) => { p.sit = 1; p.kickL = Math.sin(t * 3) * 0.4; p.kickR = Math.sin(t * 3 + 1.4) * 0.4; }],
  ['split', (t, p) => { const k = Math.abs(Math.sin(t * 2)); p.echo = [14 * k, -3 * k]; p.split = 3 * k; }],
  ['glitch', (t, p) => { p.glitch = Math.sin(t * 7) > 0.3 ? 0.8 : 0; p.glitchSeed = Math.floor(t * 12); p.split = 2; }],
  ['warp', (t, p) => { const k = (t % 1.6) / 1.6; p.collapse = k < 0.5 ? k * 2 : 2 - k * 2; }],
];

const TRY = ['hop', 'spin', 'curious', 'victory', 'flinch', 'split', 'alarm', 'talk', 'teleport'];

// her colours: Capri's own, then some others (red: errors and alerts, green: done, violet: outline)
const CAPRI_COLORS = { red: '#ff2f5b', green: '#36ff7a', violet: '#7a3dff', ink: '#17121f', paper: '#f6eef3' };
const PRESETS = [
  ['capri', null],
  ['ocean', { red: '#ff5c8a', green: '#3ff2ff', violet: '#2f7bff', ink: '#0c1824', paper: '#e9f6ff' }],
  ['sakura', { red: '#ff4f9a', green: '#ffc2e2', violet: '#c04dff', ink: '#24121e', paper: '#fff0f6' }],
  ['gold', { red: '#ff7a1a', green: '#ffd23f', violet: '#e0a020', ink: '#1a140a', paper: '#fff6e0' }],
  ['matrix', { red: '#ff3b3b', green: '#39ff14', violet: '#0f9d58', ink: '#06120a', paper: '#d9ffe0' }],
  ['blood', { red: '#ff1a1a', green: '#ff6a00', violet: '#8a0f2a', ink: '#140808', paper: '#ffecec' }],
  ['mono', { red: '#ffffff', green: '#bdbdbd', violet: '#6b6b6b', ink: '#111111', paper: '#f2f2f2' }],
];
const COLOR_NAMES = ['violet', 'red', 'green', 'ink', 'paper'];

let state = { list: [], current: 'capri', theme: null };
let selected = 'capri'; // 'capri', or a character id, or 'new'
let draft = null;       // the character being edited
let activePoint = 'head';
let source = null;      // the picture you picked, before it's fitted (for "remove background")
let renderer = null;

// ---------- small helpers ----------

function status(text, error = false) {
  const el = $('status');
  el.textContent = text;
  el.classList.toggle('is-error', error);
  clearTimeout(status.timer);
  status.timer = setTimeout(() => { el.textContent = ''; }, 4000);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('cannot read the picture'));
    img.src = src;
  });
}

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});

function pickFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/webp,image/jpeg,image/gif';
    input.onchange = () => resolve(input.files[0] ? fileToDataUrl(input.files[0]) : null);
    input.click();
  });
}

// a picture, fetched across (capri://characters) as a blob so canvases may read it
async function loadAcross(url) {
  const blob = await (await fetch(url, { cache: 'no-store' })).blob();
  return loadImage(URL.createObjectURL(blob));
}

// ---------- the body picture ----------

// Remove the background: every pixel close to the corners' colour goes see-through (soft at the edge).
function keyOut(img, tolerance) {
  const s = Math.min(1, 1200 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, c.width, c.height);
  const im = g.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  const at = (x, y) => (y * c.width + x) * 4;
  const corners = [at(0, 0), at(c.width - 1, 0), at(0, c.height - 1), at(c.width - 1, c.height - 1)];
  const bg = [0, 1, 2].map((k) => corners.reduce((sum, i) => sum + d[i + k], 0) / 4);
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);
    if (dist < tolerance) d[i + 3] = 0;
    else if (dist < tolerance * 1.6) d[i + 3] = Math.min(d[i + 3], Math.round(255 * (dist - tolerance) / (tolerance * 0.6)));
  }
  g.putImageData(im, 0, 0);
  return c;
}

// the opaque part of a canvas: { x0, y0, x1, y1 } or null
function bounds(canvas) {
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const d = g.getImageData(0, 0, canvas.width, canvas.height).data;
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (d[(y * canvas.width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

// The picture fitted into her frame: cropped to the figure, as big as fits, feet at the bottom, centred.
function fitBody(img) {
  const src = $('keyout').checked ? keyOut(img, Number($('tolerance').value)) : (() => {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c;
  })();
  const b = bounds(src) || { x0: 0, y0: 0, x1: src.width - 1, y1: src.height - 1 };
  const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
  const s = Math.min((W - 12) / bw, (H - 10) / bh);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const g = out.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, b.x0, b.y0, bw, bh, (W - bw * s) / 2, H - 4 - bh * s, bw * s, bh * s);
  return out;
}

// A first guess of every point, from the figure's size (a standing figure, arms a little out).
function guessPoints(canvas) {
  const b = bounds(canvas) || { x0: 20, y0: 5, x1: 220, y1: 416 };
  const h = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2;
  const y = (f) => Math.round(b.y0 + h * f);
  const x = (dx) => Math.round(Math.min(W - 4, Math.max(4, cx + h * dx)));
  return {
    head: [x(0), y(0.12)], mane: [x(0), y(0.08)], face: [x(0), y(0.12)], neck: [x(0), y(0.2)],
    shoulderL: [x(-0.07), y(0.23)], handL: [Math.max(b.x0 + 6, x(-0.2)), y(0.46)],
    shoulderR: [x(0.07), y(0.23)], handR: [Math.min(b.x1 - 6, x(0.2)), y(0.46)],
    hip: [x(0), y(0.52)], kneeL: [x(-0.045), y(0.74)], kneeR: [x(0.045), y(0.74)], feet: [x(0), b.y1],
  };
}

// The points as the renderer takes them (sprite.js useRig), plus the ones you placed.
function rigOf(d) {
  const p = d.pts;
  const top = (bounds(d.body) || { y0: 5 }).y0;
  return {
    head: p.head, neck: p.neck, mane: p.mane, face: p.face,
    shoulderL: p.shoulderL, shoulderR: p.shoulderR, handL: p.handL, handR: p.handR, feet: p.feet,
    hip: p.hip[1], knee: Math.round((p.kneeL[1] + p.kneeR[1]) / 2), kneeLX: p.kneeL[0], kneeRX: p.kneeR[0],
    top, armW: d.armW, pts: p,
  };
}

// ---------- drawing the editor ----------

function drawBody() {
  const g = $('body').getContext('2d');
  g.clearRect(0, 0, W, H);
  if (draft?.body) g.drawImage(draft.body, 0, 0);
}

function drawMarks() {
  const svg = $('marks');
  if (!draft) return svg.replaceChildren();
  const p = draft.pts;
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const kids = [];
  // the arms as the renderer cuts them out, and the bones between the points
  for (const [a, b, color] of [['shoulderL', 'handL', '#36ff7a'], ['shoulderR', 'handR', '#ff2f5b']]) {
    kids.push(el('line', { x1: p[a][0], y1: p[a][1], x2: p[b][0], y2: p[b][1], stroke: color, 'stroke-opacity': 0.22, 'stroke-width': draft.armW * 2, 'stroke-linecap': 'round' }));
  }
  for (const [a, b] of [['neck', 'shoulderL'], ['neck', 'shoulderR'], ['neck', 'hip'], ['hip', 'kneeL'], ['hip', 'kneeR'], ['kneeL', 'feet'], ['kneeR', 'feet'], ['shoulderL', 'handL'], ['shoulderR', 'handR'], ['neck', 'head']]) {
    kids.push(el('line', { x1: p[a][0], y1: p[a][1], x2: p[b][0], y2: p[b][1], stroke: '#fff', 'stroke-opacity': 0.5, 'stroke-width': 0.8, 'stroke-dasharray': '2 2' }));
  }
  for (const pt of POINTS) {
    const [x, y] = p[pt.key];
    const g = el('g', { class: `mark${pt.key === activePoint ? ' is-on' : ''}`, 'data-key': pt.key });
    g.append(el('circle', { cx: x, cy: y, r: pt.key === activePoint ? 4.5 : 3.5, fill: pt.color, stroke: '#000', 'stroke-width': 0.8 }));
    const label = el('text', { x: x + 6, y: y + 2.5 });
    label.textContent = T.short[pt.key];
    g.append(label);
    kids.push(g);
  }
  svg.replaceChildren(...kids);
}

function drawPointList() {
  const list = $('points');
  list.replaceChildren(...POINTS.map((pt) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = pt.key === activePoint ? 'is-on' : '';
    const [x, y] = draft.pts[pt.key];
    b.innerHTML = `<span class="dot"></span><span></span><span class="xy">${x}, ${y}</span>`;
    b.querySelector('.dot').style.background = pt.color;
    b.children[1].textContent = T.points[pt.key];
    b.onclick = () => { activePoint = pt.key; refresh(); };
    li.append(b);
    return li;
  }));
}

function drawFaces() {
  const list = $('faces');
  list.replaceChildren(...FACES.map((name) => {
    const li = document.createElement('li');
    const src = draft.faces[name];
    li.innerHTML = `${src ? '<img alt="">' : '<div class="empty">+</div>'}<span></span><div class="row"></div>`;
    if (src) li.querySelector('img').src = src;
    li.querySelector('span').textContent = T.faceNames[name];
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn is-small';
    add.textContent = src ? T.change : T.add;
    add.onclick = async () => {
      const data = await pickFile();
      if (!data) return;
      const small = await shrink(data, 320);
      draft.faces[name] = small;
      draft.faceChanges[name] = small;
      drawFaces();
    };
    li.querySelector('.row').append(add);
    if (src) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn is-small is-danger';
      del.textContent = T.remove;
      del.onclick = () => {
        delete draft.faces[name];
        draft.faceChanges[name] = null;
        drawFaces();
      };
      li.querySelector('.row').append(del);
    }
    return li;
  }));
}

// a face picture, at most `max` px on its long side, as PNG
async function shrink(dataUrl, max) {
  const img = await loadImage(dataUrl);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

function drawRoster() {
  const items = [{ id: 'capri', name: T.capriTitle, thumb: '../../assets/capri/capri-full.png' },
    ...state.list.map((c) => ({ id: c.id, name: c.name, thumb: `capri://characters/${c.id}/body.png?v=${c.updated || 0}` }))];
  if (selected === 'new') items.push({ id: 'new', name: draft?.name || T.newName, thumb: null });
  $('roster').replaceChildren(...items.map((c) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = c.id === selected ? 'is-on' : '';
    b.innerHTML = `${c.thumb ? '<img alt="">' : ''}<span></span>${c.id === state.current ? '<span class="tag"></span>' : ''}`;
    if (c.id === state.current) b.querySelector('.tag').textContent = T.inUse;
    if (c.thumb) b.querySelector('img').src = c.thumb;
    b.querySelector('span').textContent = c.name;
    b.onclick = () => select(c.id);
    li.append(b);
    return li;
  }));
}

function refresh() {
  drawRoster();
  const own = selected !== 'capri';
  $('original').hidden = own;
  $('work').hidden = !own;
  if (!own || !draft) return;
  $('name').value = draft.name;
  $('armw').value = draft.armW;
  $('armw-val').textContent = `${draft.armW}px`;
  $('delete').hidden = selected === 'new';
  $('stage-empty').hidden = Boolean(draft.body);
  drawBody();
  drawFaces();
  if (!draft.pts) {
    $('marks').replaceChildren();
    $('points').replaceChildren();
    return;
  }
  drawMarks();
  drawPointList();
  updatePreview();
}

// ---------- the live preview (the desktop's own renderer) ----------

const REST = {
  seed: 0, boil: 0.9, hair: 0, head: 0, mane: 0, armL: 0, armR: 0, longL: 1, longR: 1, sit: 0, kickL: 0, kickR: 0,
  smear: [0, 0], echo: [0, 0], glitch: 0, glitchSeed: 0, split: 0, collapse: 0, dissolve: 0, sparkle: 0, grade: 0,
  sil: [0, 0, 0], silAmount: 0, misreg: [-2.6, 2.2], alpha: 1,
};
let move = MOVES[0];
let moveStart = performance.now();
let lastSeed = 0;

function updatePreview() {
  if (!draft?.body) return;
  useRig(rigOf(draft));
  if (!renderer || renderer.image !== draft.body) {
    renderer = new SpriteRenderer($('preview'), draft.body);
    renderer.resize(0.62);
  } else {
    renderer.setRig();
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!renderer || selected === 'capri') return;
  let t = (now - moveStart) / 1000;
  if ($('loop').checked && t > 3) {
    move = MOVES[(MOVES.indexOf(move) + 1) % MOVES.length];
    moveStart = now;
    t = 0;
    markMove();
  }
  const p = structuredClone(REST);
  if (now - lastSeed > 1000 / 12) lastSeed = now; // a new drawing on twos, like on the desktop
  p.seed = Math.floor(lastSeed / 83) % 100;
  move[1](t, p);
  renderer.draw(p);
}

function markMove() {
  for (const b of $('moves').children) b.classList.toggle('is-primary', b.dataset.move === move[0]);
}

// ---------- characters ----------

function blankDraft() {
  return { id: null, name: T.newName, body: null, bodyChanged: false, pts: null, armW: 14, faces: {}, faceChanges: {} };
}

async function select(id) {
  selected = id;
  if (id === 'capri') {
    draft = null;
    return refresh();
  }
  if (id === 'new') {
    draft = blankDraft();
    refresh();
    return choosePicture();
  }
  const c = state.list.find((x) => x.id === id);
  if (!c) return;
  try {
    const base = `capri://characters/${c.id}/`;
    const img = await loadAcross(`${base}body.png?v=${c.updated || 0}`);
    const body = document.createElement('canvas');
    body.width = W;
    body.height = H;
    body.getContext('2d').drawImage(img, 0, 0);
    const faces = Object.fromEntries(Object.entries(c.faces || {}).map(([name, file]) => [name, `${base}${file}?v=${c.updated || 0}`]));
    draft = {
      id: c.id, name: c.name, body, bodyChanged: false,
      pts: c.points?.pts || guessPoints(body), armW: c.points?.armW || 14, faces, faceChanges: {},
    };
    source = null;
    refresh();
  } catch (err) {
    status(fill(T.sCantOpen, { error: err.message }), true);
  }
}

async function choosePicture() {
  const data = await pickFile();
  if (!data) {
    if (!draft.body) status(T.sNoPicture);
    return;
  }
  source = await loadImage(data);
  applyPicture(true);
}

function applyPicture(guess) {
  if (!source) return;
  draft.body = fitBody(source);
  draft.bodyChanged = true;
  if (guess || !draft.pts) draft.pts = guessPoints(draft.body);
  refresh();
  status(T.sPlaced);
}

async function save(andUse) {
  if (!draft?.body) return status(T.sNeedPicture, true);
  draft.name = $('name').value.trim() || T.character;
  try {
    const saved = await ed.save({
      id: draft.id,
      name: draft.name,
      points: rigOf(draft),
      body: draft.bodyChanged ? draft.body.toDataURL('image/png') : null,
      faces: draft.faceChanges,
    });
    draft.id = saved.id;
    draft.bodyChanged = false;
    draft.faceChanges = {};
    selected = saved.id;
    if (andUse) await ed.use(saved.id);
    await reload();
    status(andUse ? fill(T.sUsing, { name: saved.name }) : T.sSaved);
  } catch (err) {
    status(fill(T.sCantSave, { error: err.message }), true);
  }
}

async function reload() {
  state = await ed.list();
  drawRoster();
}

// ---------- placing points on the picture ----------

function spritePoint(e) {
  const r = $('stage').getBoundingClientRect();
  return [
    Math.round(Math.min(W - 1, Math.max(0, ((e.clientX - r.left) / r.width) * W))),
    Math.round(Math.min(H - 1, Math.max(0, ((e.clientY - r.top) / r.height) * H))),
  ];
}

let dragging = null;
let placed = false; // put down by a click on the picture (not a dot moved): on to the next point after
$('stage').addEventListener('pointerdown', (e) => {
  if (draft && !draft.body) return choosePicture(); // nothing on it yet: clicking it picks the picture
  if (!draft?.pts) return;
  const mark = e.target.closest?.('.mark');
  placed = !mark;
  if (mark) {
    activePoint = mark.dataset.key;
  } else {
    draft.pts[activePoint] = spritePoint(e);
  }
  dragging = activePoint;
  $('stage').setPointerCapture(e.pointerId);
  refresh();
});
$('stage').addEventListener('pointermove', (e) => {
  if (!dragging) return;
  draft.pts[dragging] = spritePoint(e);
  drawMarks();
  drawPointList();
  updatePreview();
});
$('stage').addEventListener('pointerup', () => {
  if (!dragging) return;
  // placed by a click: on to the next point
  const i = POINTS.findIndex((p) => p.key === dragging);
  dragging = null;
  if (placed && i >= 0 && i < POINTS.length - 1) activePoint = POINTS[i + 1].key;
  refresh();
});

// ---------- theme ----------

function currentColors() {
  return { ...CAPRI_COLORS, ...(state.theme?.colors || {}) };
}

function drawTheme() {
  const preset = state.theme?.preset || 'capri';
  $('presets').replaceChildren(...PRESETS.map(([id, colors]) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = id === preset ? 'is-on' : '';
    b.innerHTML = '<span></span><div class="swatches"></div>';
    b.querySelector('span').textContent = T.presetNames[id];
    for (const name of ['violet', 'red', 'green', 'ink', 'paper']) {
      const i = document.createElement('i');
      i.style.background = (colors || CAPRI_COLORS)[name];
      b.querySelector('.swatches').append(i);
    }
    b.onclick = () => setTheme(colors ? { preset: id, colors } : null);
    li.append(b);
    return li;
  }));
  const colors = currentColors();
  $('colors').replaceChildren(...COLOR_NAMES.map((name) => {
    const l = document.createElement('label');
    l.innerHTML = '<input type="color"><span></span>';
    const input = l.querySelector('input');
    input.value = colors[name];
    l.querySelector('span').textContent = T.colorNames[name];
    input.oninput = () => setTheme({ preset: 'custom', colors: { ...currentColors(), [name]: input.value } }, true);
    return l;
  }));
  applyOwnTheme();
}

// the editor wears the same colours
function applyOwnTheme() {
  const colors = currentColors();
  for (const [name, value] of Object.entries(colors)) document.documentElement.style.setProperty(`--${name}`, value);
}

let themeTimer = 0;
function setTheme(theme, live = false) {
  state.theme = theme;
  if (live) {
    applyOwnTheme();
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => ed.theme(theme), 120); // a colour being dragged: not every step
    return;
  }
  ed.theme(theme);
  drawTheme();
  status(T.sTheme);
}
$('theme-reset').onclick = () => setTheme(null);

// ---------- wiring ----------

for (const tab of document.querySelectorAll('.tab')) {
  tab.onclick = () => {
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('is-on', t === tab);
    $('page-character').hidden = tab.dataset.tab !== 'character';
    $('page-theme').hidden = tab.dataset.tab !== 'theme';
  };
}

$('new').onclick = () => select('new');
$('pick').onclick = () => choosePicture();
$('keyout').onchange = () => {
  $('keyout-row').hidden = !$('keyout').checked;
  if (source) applyPicture(false);
  else if (draft?.body) status(T.sPickAgain);
};
$('tolerance').onchange = () => source && applyPicture(false);
$('armw').oninput = () => {
  draft.armW = Number($('armw').value);
  $('armw-val').textContent = `${draft.armW}px`;
  drawMarks();
  updatePreview();
};
$('guess').onclick = () => {
  if (!draft?.body) return;
  draft.pts = guessPoints(draft.body);
  refresh();
};
$('name').oninput = () => { draft.name = $('name').value; };
$('save').onclick = () => save(false);
$('use').onclick = () => save(true);
$('use-capri').onclick = async () => {
  await ed.use('capri');
  await reload();
  status(T.sBackToCapri);
};
$('delete').onclick = async () => {
  if (!draft?.id || !confirm(fill(T.sAskDelete, { name: draft.name }))) return;
  await ed.remove(draft.id);
  await reload();
  select('capri');
  status(T.sDeleted);
};

// the buttons made from lists, in her language
function buildButtons() {
$('moves').replaceChildren(...MOVES.map((m) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn is-small';
  b.dataset.move = m[0];
  b.textContent = T.moves[m[0]];
  b.onclick = () => {
    move = m;
    moveStart = performance.now();
    $('loop').checked = false;
    markMove();
  };
  return b;
}));
markMove();

$('try').replaceChildren(...TRY.map((act) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn is-small';
  b.textContent = T.tries[act];
  b.onclick = () => ed.perform(act);
  return b;
}));
}

(async () => {
  await reload();
  translatePage(state.lang);
  buildButtons();
  drawTheme();
  await select(state.current && state.current !== 'capri' && state.list.some((c) => c.id === state.current) ? state.current : 'capri');
  requestAnimationFrame(frame);
})();

// for a look from devtools
window.capriEditor = {
  SPRITE, CAPRI_RIG, get draft() { return draft; },
  // --dev: a new character from a picture, without the file dialog
  async newFrom(dataUrl, name) {
    selected = 'new';
    draft = blankDraft();
    draft.name = name || draft.name;
    source = await loadImage(dataUrl);
    applyPicture(true);
  },
  save,
  setMove(id) { move = MOVES.find((m) => m[0] === id) || move; moveStart = performance.now(); $('loop').checked = false; markMove(); },
};
