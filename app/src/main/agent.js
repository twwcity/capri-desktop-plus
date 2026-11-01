'use strict';

// Her PC agent mode (chat.js pcAgent): whatever model she talks with asks for one step at a time, and
// this does it, only inside the folders you allowed (config.agentRoots, Desktop/Documents/Downloads…
// by default). Deleting goes to the Recycle Bin. What can't be undone (deleting, moving, overwriting,
// running a command) is confirmed by you in her panel first: this only refuses to overwrite unasked.

const { app, dialog, ipcMain, shell } = require('electron');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const MAX_READ = 60 * 1024;
const MAX_LIST = 200;

function defaultRoots() {
  const home = app.getPath('home');
  return ['desktop', 'documents', 'downloads', 'pictures', 'music', 'videos'].map((n) => {
    try { return app.getPath(n); } catch { return null; }
  }).filter(Boolean).concat(path.join(path.dirname(process.execPath), '..', 'workspace'), path.join(home, 'OneDrive', 'Desktop'))
    .map((p) => path.resolve(p)).filter((p) => fs.existsSync(p));
}

const roots = (config) => {
  const cfg = config.load();
  return [...new Set([...(Array.isArray(cfg.agentRoots) && cfg.agentRoots.length ? cfg.agentRoots : defaultRoots())].map((p) => path.resolve(p)))];
};

// a path inside one of the allowed folders, or an error saying which are
function inside(config, p) {
  if (typeof p !== 'string' || !p.trim()) throw new Error('no path');
  const abs = path.resolve(p.trim().replace(/^~(?=[\\/]|$)/, app.getPath('home')));
  const ok = roots(config).some((r) => abs === r || abs.toLowerCase().startsWith(`${r.toLowerCase()}${path.sep}`));
  if (!ok) throw new Error(`outside the allowed folders: ${abs}`);
  return abs;
}

const size = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

function list(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const lines = entries.slice(0, MAX_LIST).map((e) => {
    if (e.isDirectory()) return `[dir]  ${e.name}`;
    let st = null;
    try { st = fs.statSync(path.join(dir, e.name)); } catch { /* gone */ }
    return `[file] ${e.name}${st ? `  (${size(st.size)}, ${st.mtime.toISOString().slice(0, 10)})` : ''}`;
  });
  return `${dir}\n${lines.join('\n') || '(empty)'}${entries.length > MAX_LIST ? `\n… ${entries.length - MAX_LIST} more` : ''}`;
}

// names matching a pattern (* and ?), under a folder, a few levels down
function find(dir, pattern) {
  const re = new RegExp(`^${String(pattern || '*').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
  const out = [];
  const go = (d, depth) => {
    if (out.length >= MAX_LIST || depth > 5) return;
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (/^(node_modules|\.git|\$RECYCLE\.BIN)$/i.test(e.name)) continue;
      const p = path.join(d, e.name);
      if (re.test(e.name)) out.push(`${e.isDirectory() ? '[dir]  ' : '[file] '}${p}`);
      if (e.isDirectory()) go(p, depth + 1);
    }
  };
  go(dir, 0);
  return out.join('\n') || '(nothing found)';
}

function run(command, cwd) {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `[Console]::OutputEncoding=[Text.Encoding]::UTF8; ${command}`],
      { cwd, timeout: 60000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, out, errOut) => {
        const text = `${out || ''}${errOut ? `\n[stderr]\n${errOut}` : ''}`.trim().slice(0, 8000);
        resolve(`${err ? `exit ${err.code ?? 'error'}${err.killed ? ' (timed out after 60 s)' : ''}\n` : ''}${text || '(no output)'}`);
      });
  });
}

// one step: { op, path, to, text, pattern, command, force } -> { ok, result } | { ok: false, error } | { confirm }
async function step(config, a) {
  const op = String(a?.op || '');
  switch (op) {
    case 'roots':
      return { ok: true, result: roots(config).join('\n') };
    case 'list':
      return { ok: true, result: list(inside(config, a.path)) };
    case 'find':
      return { ok: true, result: find(inside(config, a.path), a.pattern) };
    case 'read': {
      const p = inside(config, a.path);
      const buf = fs.readFileSync(p);
      if (buf.subarray(0, 4000).includes(0)) return { ok: true, result: `(binary file, ${size(buf.length)})` };
      return { ok: true, result: buf.toString('utf8').slice(0, MAX_READ) + (buf.length > MAX_READ ? '\n… (cut)' : '') };
    }
    case 'write': {
      const p = inside(config, a.path);
      if (fs.existsSync(p) && !a.force) return { confirm: 'overwrite' };
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, String(a.text ?? ''));
      return { ok: true, result: `wrote ${p}` };
    }
    case 'mkdir': {
      const p = inside(config, a.path);
      fs.mkdirSync(p, { recursive: true });
      return { ok: true, result: `folder ${p}` };
    }
    case 'move':
    case 'copy': {
      const from = inside(config, a.path);
      let to = inside(config, a.to);
      if (fs.existsSync(to) && fs.statSync(to).isDirectory()) to = path.join(to, path.basename(from)); // into a folder
      if (fs.existsSync(to) && !a.force) return { confirm: 'overwrite' };
      fs.mkdirSync(path.dirname(to), { recursive: true });
      if (op === 'copy') fs.cpSync(from, to, { recursive: true });
      else {
        try { fs.renameSync(from, to); } catch { fs.cpSync(from, to, { recursive: true }); fs.rmSync(from, { recursive: true }); } // across drives
      }
      return { ok: true, result: `${op === 'copy' ? 'copied' : 'moved'} ${from} -> ${to}` };
    }
    case 'delete': {
      const p = inside(config, a.path);
      if (!fs.existsSync(p)) return { ok: false, error: 'no such file' };
      await shell.trashItem(p); // the Recycle Bin: you can get it back
      return { ok: true, result: `moved to the Recycle Bin: ${p}` };
    }
    case 'open': {
      const p = inside(config, a.path);
      const err = await shell.openPath(p);
      return err ? { ok: false, error: err } : { ok: true, result: `opened ${p}` };
    }
    case 'run': {
      const cwd = inside(config, a.path || roots(config)[0]);
      return { ok: true, result: await run(String(a.command || ''), cwd) };
    }
    default:
      return { ok: false, error: `unknown op "${op}"` };
  }
}

function register({ config, updateConfig }) {
  ipcMain.handle('agent:step', async (_e, a) => {
    try { return await step(config, a); } catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('agent:roots', () => roots(config));
  ipcMain.handle('agent:addRoot', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (canceled || !filePaths[0]) return roots(config);
    updateConfig({ agentRoots: [...new Set([...roots(config), path.resolve(filePaths[0])])] });
    return roots(config);
  });
}

module.exports = { register };
