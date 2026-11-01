'use strict';

// Reading Minecraft worlds straight from their files, read-only: Java Edition (every version, the old
// numeric-ID chunks, 1.13+ palettes, 1.18+ worlds and the 26.x "dimensions/" layout) and Bedrock
// (LevelDB). What she needs from them: where you are, where diamonds are, what's in the chests nearby.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const DIAMOND = /^minecraft:(deepslate_)?diamond_ore$/;
const AIR = /^minecraft:(cave_|void_)?air$/;
const CONTAINERS = /chest|barrel|shulker|hopper|dispenser|dropper/i;

// ---------- NBT ----------
// Compounds become objects, lists arrays, longs BigInt, byte arrays Buffers, long arrays { longs: Buffer }.
// Each compound remembers its tags' types (TYPES), and each list its element type, so items can be written
// back as commands exactly (snbt below).

const TYPES = Symbol('nbt types');

function readNbt(buf, little = false, offset = 0) {
  let o = offset;
  const u8 = () => buf[o++];
  const i16 = () => { const v = little ? buf.readInt16LE(o) : buf.readInt16BE(o); o += 2; return v; };
  const u16 = () => { const v = little ? buf.readUInt16LE(o) : buf.readUInt16BE(o); o += 2; return v; };
  const i32 = () => { const v = little ? buf.readInt32LE(o) : buf.readInt32BE(o); o += 4; return v; };
  const i64 = () => { const v = little ? buf.readBigInt64LE(o) : buf.readBigInt64BE(o); o += 8; return v; };
  const f32 = () => { const v = little ? buf.readFloatLE(o) : buf.readFloatBE(o); o += 4; return v; };
  const f64 = () => { const v = little ? buf.readDoubleLE(o) : buf.readDoubleBE(o); o += 8; return v; };
  const str = () => { const n = u16(); const s = buf.toString('utf8', o, o + n); o += n; return s; };
  const payload = (type) => {
    switch (type) {
      case 1: { const v = buf.readInt8(o); o += 1; return v; }
      case 2: return i16();
      case 3: return i32();
      case 4: return i64();
      case 5: return f32();
      case 6: return f64();
      case 7: { const n = i32(); const v = buf.subarray(o, o + n); o += n; return v; }
      case 8: return str();
      case 9: {
        const t = u8();
        const n = i32();
        const list = [];
        list.type = t;
        for (let i = 0; i < n; i++) list.push(payload(t));
        return list;
      }
      case 10: {
        const obj = {};
        const types = {};
        for (;;) {
          const t = u8();
          if (t === 0 || t === undefined) break;
          const name = str();
          types[name] = t;
          obj[name] = payload(t);
        }
        Object.defineProperty(obj, TYPES, { value: types });
        return obj;
      }
      case 11: { const n = i32(); const v = []; for (let i = 0; i < n; i++) v.push(i32()); v.type = 3; v.array = 'I'; return v; }
      case 12: { const n = i32(); const v = { longs: buf.subarray(o, o + n * 8), little }; o += n * 8; return v; }
      default: throw new Error(`bad NBT tag ${type}`);
    }
  };
  const type = u8();
  if (type !== 10) throw new Error('not an NBT compound');
  str();
  const value = payload(10);
  return { value, end: o };
}

// every root compound in a row (Bedrock block entities are several, back to back)
function readNbtAll(buf, little) {
  const out = [];
  let o = 0;
  while (o < buf.length) {
    const { value, end } = readNbt(buf, little, o);
    out.push(value);
    o = end;
  }
  return out;
}

// NBT as Java's command syntax (SNBT), from the types it was read with
function snbt(value, type) {
  const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const key = (k) => (/^[A-Za-z0-9_.+-]+$/.test(k) ? k : q(k));
  switch (type) {
    case 1: return `${value}b`;
    case 2: return `${value}s`;
    case 3: return `${value}`;
    case 4: return `${value}L`;
    case 5: return `${value}f`;
    case 6: return `${value}d`;
    case 7: return `[B;${[...value].map((b) => `${(b << 24) >> 24}B`).join(',')}]`;
    case 8: return q(value);
    case 9: return `[${value.map((v) => snbt(v, value.type)).join(',')}]`;
    case 10: {
      const types = value[TYPES] || {};
      return `{${Object.keys(value).map((k) => `${key(k)}:${snbt(value[k], types[k])}`).join(',')}}`;
    }
    case 11: return `[I;${value.join(',')}]`;
    case 12: {
      const n = value.longs.length / 8;
      const parts = [];
      for (let i = 0; i < n; i++) parts.push(`${value.little ? value.longs.readBigInt64LE(i * 8) : value.longs.readBigInt64BE(i * 8)}L`);
      return `[L;${parts.join(',')}]`;
    }
    default: return '""';
  }
}

const readGzipNbt = (file) => {
  const raw = fs.readFileSync(file);
  return readNbt(raw[0] === 0x1f && raw[1] === 0x8b ? zlib.gunzipSync(raw) : raw).value;
};

// ---------- Java Edition ----------

const DIMS = {
  overworld: { old: '', name: 'overworld' },
  the_nether: { old: 'DIM-1', name: 'the_nether' },
  the_end: { old: 'DIM1', name: 'the_end' },
};
function dimName(d) {
  if (d === -1 || /nether/.test(String(d))) return 'the_nether';
  if (d === 1 || /the_end/.test(String(d))) return 'the_end';
  return 'overworld';
}

function regionDir(world, dim) {
  const modern = path.join(world, 'dimensions', 'minecraft', DIMS[dim].name, 'region'); // 26.x and later
  if (fs.existsSync(modern)) return modern;
  return path.join(world, DIMS[dim].old, 'region');
}

function javaLevel(world) {
  try {
    return readGzipNbt(path.join(world, 'level.dat')).Data || {};
  } catch {
    return {};
  }
}

// You in a Java world: { x, y, z, dim, file }, from level.dat (single player), else the newest player file
function javaPlayer(world) {
  const level = javaLevel(world);
  if (level.Player?.Pos) return { ...posOf(level.Player), file: 'level.dat' };
  for (const dir of ['players/data', 'playerdata']) {
    const full = path.join(world, dir);
    let files = [];
    try { files = fs.readdirSync(full).filter((f) => f.endsWith('.dat')); } catch { continue; }
    files.sort((a, b) => fs.statSync(path.join(full, b)).mtimeMs - fs.statSync(path.join(full, a)).mtimeMs);
    for (const f of files) {
      try {
        const p = readGzipNbt(path.join(full, f));
        if (p.Pos) return { ...posOf(p), file: `${dir}/${f}` };
      } catch { /* the next one */ }
    }
  }
  return null;
}
const posOf = (p) => ({ x: Number(p.Pos[0]), y: Number(p.Pos[1]), z: Number(p.Pos[2]), dim: dimName(p.Dimension ?? p.dimension) });

// one chunk's NBT from its region file, or null
function readJavaChunk(dir, cx, cz, cache) {
  const rx = cx >> 5, rz = cz >> 5;
  const file = path.join(dir, `r.${rx}.${rz}.mca`);
  let region = cache.get(file);
  if (region === undefined) {
    try { region = fs.readFileSync(file); } catch { region = null; }
    cache.set(file, region);
  }
  if (!region || region.length < 8192) return null;
  const i = ((cx & 31) + (cz & 31) * 32) * 4;
  const offset = ((region[i] << 16) | (region[i + 1] << 8) | region[i + 2]) * 4096;
  if (!offset || offset + 5 > region.length) return null;
  const length = region.readUInt32BE(offset);
  const kind = region[offset + 4];
  let data = region.subarray(offset + 5, offset + 4 + length);
  if (kind & 128) { // too big for the region: in its own file
    try { data = fs.readFileSync(path.join(dir, `c.${cx}.${cz}.mcc`)); } catch { return null; }
  }
  try {
    const k = kind & 127;
    if (k === 1) data = zlib.gunzipSync(data);
    else if (k === 2) data = zlib.inflateSync(data);
    else if (k !== 3) return null; // LZ4 (an option of 1.20.5+): not read
    return readNbt(data).value;
  } catch {
    return null;
  }
}

// A chunk's sections as { y, palette: [name], index(i) } (i = (y*16 + z)*16 + x), and its block entities
function javaSections(chunk) {
  const level = chunk.Level || chunk;
  const dataVersion = chunk.DataVersion ?? level.DataVersion ?? 0;
  const out = [];
  for (const sec of level.sections || level.Sections || []) {
    const y = sec.Y;
    const states = sec.block_states || (sec.Palette ? { palette: sec.Palette, data: sec.BlockStates } : null);
    if (states?.palette) {
      // { Name } up to 26.2; 26.3 writes { "": name } for a plain block and { id, properties } for the rest
      const palette = states.palette.map((p) => (typeof p === 'string' ? p : p.Name ?? p.id ?? p[''] ?? ''));
      if (palette.length === 1 || !states.data) {
        out.push({ y, palette, index: () => 0 });
        continue;
      }
      const bits = Math.max(4, Math.ceil(Math.log2(palette.length)));
      const longs = states.data.longs;
      const spanning = !sec.block_states && dataVersion < 2529; // before 20w17a, entries cross longs
      const perLong = Math.floor(64 / bits);
      const mask = (1n << BigInt(bits)) - 1n;
      const get = (n) => longs.readBigUInt64BE(n * 8);
      out.push({
        y, palette,
        index: spanning
          ? (i) => {
            const bit = i * bits, at = Math.floor(bit / 64), shift = BigInt(bit % 64);
            let v = get(at) >> shift;
            if (Number(shift) + bits > 64 && (at + 1) * 8 < longs.length) v |= get(at + 1) << (64n - shift);
            return Number(v & mask);
          }
          : (i) => {
            const at = Math.floor(i / perLong);
            if (at * 8 >= longs.length) return 0;
            return Number((get(at) >> BigInt((i % perLong) * bits)) & mask);
          },
      });
    } else if (sec.Blocks) {
      // before 1.13: numeric IDs, 56 is diamond ore. Indexed (y*16 + z)*16 + x too.
      const blocks = sec.Blocks;
      out.push({ y, palette: null, legacy: blocks, index: (i) => blocks[i] });
    }
  }
  return { sections: out, entities: level.block_entities || level.TileEntities || [], dataVersion };
}

const legacyName = (id) => (id === 56 ? 'minecraft:diamond_ore' : id === 0 ? 'minecraft:air' : 'minecraft:stone');

// ---------- Bedrock (LevelDB) ----------

function varint(buf, o) {
  let v = 0, shift = 0, b;
  do {
    b = buf[o++];
    v += (b & 0x7f) * 2 ** shift;
    shift += 7;
  } while (b & 0x80);
  return [v, o];
}

function inflateBlock(raw, type) {
  if (type === 0) return raw;
  if (type === 2) return zlib.inflateSync(raw);
  if (type === 4) return zlib.inflateRawSync(raw);
  if (type === 1) return snappy(raw);
  throw new Error(`unknown block compression ${type}`);
}

// snappy, for worlds written by tools that use it
function snappy(src) {
  let [len, o] = varint(src, 0);
  const out = Buffer.alloc(len);
  let w = 0;
  while (o < src.length) {
    const tag = src[o++];
    const kind = tag & 3;
    if (kind === 0) {
      let n = tag >> 2;
      if (n >= 60) { const bytes = n - 59; n = src.readUIntLE(o, bytes); o += bytes; }
      n += 1;
      src.copy(out, w, o, o + n);
      w += n;
      o += n;
      continue;
    }
    let n, off;
    if (kind === 1) { n = ((tag >> 2) & 7) + 4; off = ((tag >> 5) << 8) | src[o++]; }
    else if (kind === 2) { n = (tag >> 2) + 1; off = src.readUInt16LE(o); o += 2; }
    else { n = (tag >> 2) + 1; off = src.readUInt32LE(o); o += 4; }
    for (let i = 0; i < n; i++, w++) out[w] = out[w - off];
  }
  return out;
}

// the entries of one block: [{ key: Buffer (internal), value: Buffer }]
function blockEntries(block) {
  const restarts = block.readUInt32LE(block.length - 4);
  const end = block.length - 4 - restarts * 4;
  const out = [];
  let o = 0;
  let last = Buffer.alloc(0);
  while (o < end) {
    let shared, nonShared, vlen;
    [shared, o] = varint(block, o);
    [nonShared, o] = varint(block, o);
    [vlen, o] = varint(block, o);
    const key = Buffer.concat([last.subarray(0, shared), block.subarray(o, o + nonShared)]);
    o += nonShared;
    out.push({ key, value: block.subarray(o, o + vlen) });
    o += vlen;
    last = key;
  }
  return out;
}

class Table {
  constructor(file) {
    this.buf = fs.readFileSync(file);
    // LevelDB's magic number: Marketplace worlds are encrypted, and theirs is garbage
    if (this.buf.length < 48 || this.buf.subarray(this.buf.length - 8).toString('hex') !== '57fb808b247547db') {
      throw Object.assign(new Error('encrypted'), { encrypted: true });
    }
    const footer = this.buf.subarray(this.buf.length - 48);
    let [, o] = varint(footer, 0); // metaindex offset
    [, o] = varint(footer, o);     // and size
    let ioff, isize;
    [ioff, o] = varint(footer, o);
    [isize] = varint(footer, o);
    this.index = blockEntries(this.read(ioff, isize)).map(({ key, value }) => {
      const [off, p] = varint(value, 0);
      const [size] = varint(value, p);
      return { user: key.subarray(0, key.length - 8), off, size };
    });
    this.cache = new Map();
  }

  read(off, size) {
    return inflateBlock(this.buf.subarray(off, off + size), this.buf[off + size]);
  }

  // the newest { seq, type, value } for that key in this table, or null
  get(user) {
    let lo = 0, hi = this.index.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (Buffer.compare(this.index[mid].user, user) < 0) lo = mid + 1; else hi = mid;
    }
    let best = null;
    for (let b = lo; b < this.index.length && b <= lo + 1; b++) {
      const h = this.index[b];
      let entries = this.cache.get(b);
      if (!entries) {
        try { entries = blockEntries(this.read(h.off, h.size)); } catch { entries = []; }
        if (this.cache.size > 64) this.cache.clear();
        this.cache.set(b, entries);
      }
      for (const e of entries) {
        if (e.key.length - 8 !== user.length || Buffer.compare(e.key.subarray(0, user.length), user) !== 0) continue;
        const trailer = e.key.readBigUInt64LE(e.key.length - 8);
        const seq = trailer >> 8n;
        if (!best || seq > best.seq) best = { seq, type: Number(trailer & 0xffn), value: e.value };
      }
      if (Buffer.compare(h.user, user) > 0) break;
    }
    return best;
  }
}

// the write-ahead log: what was written since the last table, newest wins
function readLog(file) {
  const buf = fs.readFileSync(file);
  const map = new Map();
  let record = [];
  for (let block = 0; block < buf.length; block += 32768) {
    let o = block;
    const end = Math.min(block + 32768, buf.length);
    while (o + 7 <= end) {
      const len = buf.readUInt16LE(o + 4);
      const type = buf[o + 6];
      if (type === 0 && len === 0) break;
      const data = buf.subarray(o + 7, o + 7 + len);
      o += 7 + len;
      if (type === 1) record = [data];
      else if (type === 2) record = [data];
      else if (type === 3) { record.push(data); continue; }
      else if (type === 4) record.push(data);
      if (type === 1 || type === 4) {
        const batch = Buffer.concat(record);
        record = [];
        if (batch.length < 12) continue;
        let seq = batch.readBigUInt64LE(0);
        const count = batch.readUInt32LE(8);
        let p = 12;
        for (let i = 0; i < count && p < batch.length; i++, seq++) {
          const kind = batch[p++];
          let klen;
          [klen, p] = varint(batch, p);
          const key = batch.subarray(p, p + klen);
          p += klen;
          let value = null;
          if (kind === 1) {
            let vlen;
            [vlen, p] = varint(batch, p);
            value = batch.subarray(p, p + vlen);
            p += vlen;
          }
          const k = key.toString('latin1');
          const had = map.get(k);
          if (!had || seq > had.seq) map.set(k, { seq, type: kind, value });
        }
      }
    }
  }
  return map;
}

class BedrockDb {
  constructor(dir) {
    this.tables = [];
    this.logs = [];
    let encrypted = 0, total = 0;
    for (const f of fs.readdirSync(dir)) {
      try {
        if (f.endsWith('.ldb') || f.endsWith('.sst')) {
          total++;
          this.tables.push(new Table(path.join(dir, f)));
        } else if (f.endsWith('.log') && /^\d+\.log$/.test(f)) this.logs.push(readLog(path.join(dir, f)));
      } catch (err) {
        if (err.encrypted) encrypted++; // else a file being written: skipped
      }
    }
    // encrypted worlds (Marketplace): only what's still in the log can be read, if anything
    this.partial = encrypted > 0;
    if (total && encrypted === total && !this.logs.some((l) => l.size)) {
      throw Object.assign(new Error('This world is encrypted (a Marketplace world): its files can’t be read.'), { encrypted: true });
    }
  }

  get(key) {
    let best = null;
    for (const log of this.logs) {
      const e = log.get(key.toString('latin1'));
      if (e && (!best || e.seq > best.seq)) best = e;
    }
    for (const t of this.tables) {
      const e = t.get(key);
      if (e && (!best || e.seq > best.seq)) best = e;
    }
    return best && best.type === 1 ? best.value : null;
  }
}

const BEDROCK_DIM = { overworld: 0, the_nether: 1, the_end: 2 };
function chunkKey(cx, cz, dim, tag, sub) {
  const b = Buffer.alloc((dim ? 12 : 8) + 1 + (sub === undefined ? 0 : 1));
  b.writeInt32LE(cx, 0);
  b.writeInt32LE(cz, 4);
  let o = 8;
  if (dim) { b.writeInt32LE(dim, 8); o = 12; }
  b[o++] = tag;
  if (sub !== undefined) b.writeInt8(sub, o);
  return b;
}

// one Bedrock sub-chunk: { palette: [name], index(i) } with i = (x*16 + z)*16 + y, or null
function bedrockSub(buf) {
  if (!buf || !buf.length) return null;
  const version = buf[0];
  if (version !== 8 && version !== 9) return null; // very old worlds: not read
  let o = version === 9 ? 3 : 2;
  const header = buf[o++];
  const bits = header >> 1;
  let words = null, perWord = 0;
  if (bits) {
    perWord = Math.floor(32 / bits);
    const count = Math.ceil(4096 / perWord);
    words = buf.subarray(o, o + count * 4);
    o += count * 4;
  }
  const size = buf.readInt32LE(o);
  o += 4;
  const palette = [];
  for (let i = 0; i < size; i++) {
    const { value, end } = readNbt(buf, true, o);
    palette.push(value.name);
    o = end;
  }
  const mask = (1 << bits) - 1;
  return {
    palette,
    index: bits ? (i) => (words.readUInt32LE(Math.floor(i / perWord) * 4) >>> ((i % perWord) * bits)) & mask : () => 0,
  };
}

// ---------- one world, either edition ----------

class World {
  constructor({ edition, dir, version }) {
    this.edition = edition;
    this.dir = dir;
    this.version = version;
    this.regionCache = new Map();
    if (edition === 'bedrock') this.db = new BedrockDb(path.join(dir, 'db'));
  }

  info() {
    if (this.edition === 'java') {
      const level = javaLevel(this.dir);
      return { name: level.LevelName || path.basename(this.dir), cheats: level.allowCommands ? true : level.allowCommands === 0 ? false : null, dataVersion: level.DataVersion ?? null };
    }
    let name = path.basename(this.dir);
    try { name = fs.readFileSync(path.join(this.dir, 'levelname.txt'), 'utf8').trim(); } catch { /* the folder name */ }
    let cheats = null;
    try { cheats = Boolean(readNbt(fs.readFileSync(path.join(this.dir, 'level.dat')).subarray(8), true).value.commandsEnabled); } catch { /* unknown */ }
    return { name, cheats, dataVersion: null, partial: this.db.partial };
  }

  player() {
    if (this.edition === 'java') return javaPlayer(this.dir);
    const raw = this.db.get(Buffer.from('~local_player'));
    if (!raw) return null;
    const p = readNbt(raw, true).value;
    const dim = p.DimensionId === 1 ? 'the_nether' : p.DimensionId === 2 ? 'the_end' : 'overworld';
    return { x: p.Pos[0], y: p.Pos[1] - 1.62, z: p.Pos[2], dim }; // Bedrock keeps the eyes' height
  }

  // { sections: [{ y, palette, index, order }], entities } of one chunk, or null
  chunk(cx, cz, dim) {
    if (this.edition === 'java') {
      const nbt = readJavaChunk(regionDir(this.dir, dim), cx, cz, this.regionCache);
      if (!nbt) return null;
      const c = javaSections(nbt);
      for (const s of c.sections) s.order = 'yzx';
      return c;
    }
    const d = BEDROCK_DIM[dim];
    const sections = [];
    for (let sy = -4; sy < 20; sy++) {
      const sub = bedrockSub(this.db.get(chunkKey(cx, cz, d, 0x2f, sy)));
      if (sub) sections.push({ y: sy, order: 'xzy', ...sub });
    }
    let entities = [];
    const raw = this.db.get(chunkKey(cx, cz, d, 0x31));
    if (raw) { try { entities = readNbtAll(raw, true); } catch { /* broken */ } }
    return sections.length || entities.length ? { sections, entities } : null;
  }
}

const at = (s, lx, ly, lz) => (s.order === 'xzy' ? (lx * 16 + lz) * 16 + ly : (ly * 16 + lz) * 16 + lx);
const nameAt = (s, i) => (s.palette ? s.palette[s.index(i)] : legacyName(s.index(i)));

// Every diamond ore within `radius` chunks of you, grouped into veins, nearest first:
// [{ x, y, z, count, distance, stand: { x, y, z } | null }] (stand: an open spot right next to it)
function findDiamonds(world, me, radius = 8, from = 0) {
  const ores = [];
  const chunks = new Map();
  let saved = 0;
  const pcx = Math.floor(me.x) >> 4, pcz = Math.floor(me.z) >> 4;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (from && Math.max(Math.abs(dx), Math.abs(dz)) < from) continue; // the ring already searched
      const c = world.chunk(pcx + dx, pcz + dz, me.dim);
      if (!c) continue;
      saved++;
      chunks.set(`${pcx + dx},${pcz + dz}`, c);
      for (const s of c.sections) {
        const hit = s.palette ? s.palette.some((n) => DIAMOND.test(n)) : s.legacy?.includes(56);
        if (!hit) continue;
        for (let i = 0; i < 4096; i++) {
          if (!DIAMOND.test(nameAt(s, i))) continue;
          const [lx, ly, lz] = s.order === 'xzy' ? [i >> 8, i & 15, (i >> 4) & 15] : [i & 15, i >> 8, (i >> 4) & 15];
          ores.push({ x: (pcx + dx) * 16 + lx, y: s.y * 16 + ly, z: (pcz + dz) * 16 + lz });
        }
      }
    }
  }
  const blockAt = (x, y, z) => {
    const c = chunks.get(`${x >> 4},${z >> 4}`);
    const s = c?.sections.find((q) => q.y === y >> 4);
    return s ? nameAt(s, at(s, x & 15, y & 15, z & 15)) : null;
  };
  // veins: ores touching each other
  const seen = new Set();
  const key = (o) => `${o.x},${o.y},${o.z}`;
  const byKey = new Map(ores.map((o) => [key(o), o]));
  const veins = [];
  for (const o of ores) {
    if (seen.has(key(o))) continue;
    const vein = [];
    const stack = [o];
    seen.add(key(o));
    while (stack.length) {
      const c = stack.pop();
      vein.push(c);
      for (const [a, b, d] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const n = byKey.get(`${c.x + a},${c.y + b},${c.z + d}`);
        if (n && !seen.has(key(n))) { seen.add(key(n)); stack.push(n); }
      }
    }
    const first = vein[0];
    // somewhere to stand by it: open air for the feet and the head, next to one of its blocks
    let stand = null;
    for (const v of vein) {
      for (const [a, d] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const fx = v.x + a, fz = v.z + d;
        for (const fy of [v.y, v.y - 1]) {
          if (AIR.test(blockAt(fx, fy, fz) || '') && AIR.test(blockAt(fx, fy + 1, fz) || '')) { stand = { x: fx, y: fy, z: fz }; break; }
        }
        if (stand) break;
      }
      if (stand) break;
    }
    veins.push({ ...first, count: vein.length, distance: Math.round(Math.hypot(first.x - me.x, first.y - me.y, first.z - me.z)), stand });
  }
  veins.sort((a, b) => a.distance - b.distance);
  veins.saved = saved; // how many chunks were on disk to look in
  return veins;
}

// The nearest saved chunk with that biome in it (1.18+ Java, which keeps biome names): { x, z, distance } or null
function findBiomeSaved(world, me, biome, radius = 32) {
  const want = biome.includes(':') ? biome : `minecraft:${biome}`;
  const pcx = Math.floor(me.x) >> 4, pcz = Math.floor(me.z) >> 4;
  let best = null;
  for (let r = 0; r <= radius && !best; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const c = world.edition === 'java' ? readJavaChunk(regionDir(world.dir, me.dim), pcx + dx, pcz + dz, world.regionCache) : null;
        const level = c && (c.Level || c);
        const has = (level?.sections || []).some((s) => Array.isArray(s.biomes?.palette) && s.biomes.palette.includes(want));
        if (!has) continue;
        const x = (pcx + dx) * 16 + 8, z = (pcz + dz) * 16 + 8;
        const d = Math.round(Math.hypot(x - me.x, z - me.z));
        if (!best || d < best.distance) best = { x, z, distance: d };
      }
    }
  }
  return best;
}

// The containers within `radius` chunks of you with something in them, nearest first:
// [{ id, x, y, z, distance, items: [{ slot, id, count, data, nbt, types }] }]
function findChests(world, me, radius = 4) {
  const out = [];
  const pcx = Math.floor(me.x) >> 4, pcz = Math.floor(me.z) >> 4;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const c = world.chunk(pcx + dx, pcz + dz, me.dim);
      for (const e of c?.entities || []) {
        const id = String(e.id || e.Id || '');
        if (!CONTAINERS.test(id)) continue;
        // a structure's chest nobody opened yet: no items, only the loot table they'll come from
        const loot = typeof e.LootTable === 'string' && e.LootTable ? e.LootTable : null;
        if (loot && !(e.Items?.length)) {
          out.push({ id, x: e.x, y: e.y, z: e.z, distance: Math.round(Math.hypot(e.x - me.x, e.y - me.y, e.z - me.z)), items: [], loot });
          continue;
        }
        if (!Array.isArray(e.Items) || !e.Items.length) continue;
        const items = e.Items.map((it) => ({
          slot: it.Slot ?? 0,
          id: String(it.id || it.Name || ''),
          count: Number(it.count ?? it.Count ?? 1),
          damage: Number(it.Damage ?? 0),
          nbt: it,
        })).filter((it) => it.id && !/air$/.test(it.id) && it.count > 0);
        if (!items.length) continue;
        out.push({ id, x: e.x, y: e.y, z: e.z, distance: Math.round(Math.hypot(e.x - me.x, e.y - me.y, e.z - me.z)), items });
      }
    }
  }
  return out.sort((a, b) => a.distance - b.distance);
}

module.exports = { World, findDiamonds, findChests, findBiomeSaved, snbt, TYPES, readNbt, readGzipNbt };
