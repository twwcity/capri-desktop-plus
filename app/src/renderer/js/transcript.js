// Her chat log: tap her face in her chat and the whole conversation opens beside it, with the code
// she wrote in code mode (each file, or each change as - old / + new lines), and the project's
// folder and game a click away.

import { paint, showBig } from './panel.js';
import { codeOps } from './chat.js';

const MARK = { new: '+', rewritten: '~', edited: '~', deleted: '−', failed: '!' };
const MAX_LINES = 400; // of one file shown; the rest is in the folder

export class Transcript {
  constructor({ host, panel, chat }) {
    this.host = host;
    this.panel = panel;
    this.chat = chat;
    this.box = null;
    this.face = panel.el.querySelector('.panel__face');
    this.face.title = 'Chat log';
    // and a button under her face that says so
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'panel__log';
    this.button.title = 'Chat log';
    this.button.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg><span>LOG</span>';
    this.face.after(this.button);
    for (const el of [this.face, this.button]) {
      el.addEventListener('click', (e) => {
        if (!this.panel.el.classList.contains('is-chat')) return;
        e.stopPropagation(); // a click on the panel itself would close it
        if (this.box) this.close(); else this.open();
      });
    }
  }

  open() {
    const box = document.createElement('div');
    box.className = 'transcript';
    const head = document.createElement('div');
    head.className = 'transcript__head';
    head.innerHTML = '<b>CHAT LOG</b><span class="transcript__sub"></span>';
    head.querySelector('.transcript__sub').textContent = `// ${(this.chat.history || []).length} msgs`;
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '✕';
    x.addEventListener('click', () => this.close());
    head.append(x);
    const list = document.createElement('div');
    list.className = 'transcript__list';
    const history = this.chat.history || [];
    if (!history.length) list.append(this.note('Nothing said yet in this chat.'));
    for (const m of history) list.append(m.role === 'user' ? this.you(m) : this.her(m));
    box.append(head, list);
    document.body.append(box);
    this.box = box;
    this.place();
    list.scrollTop = list.scrollHeight;
    this.outside = (e) => { if (!box.contains(e.target) && !this.face.contains(e.target) && !this.button.contains(e.target)) this.close(); };
    setTimeout(() => document.addEventListener('pointerdown', this.outside), 0);
  }

  close() {
    this.box?.remove();
    this.box = null;
    if (this.outside) document.removeEventListener('pointerdown', this.outside);
    this.outside = null;
  }

  // beside her panel, on whichever side has room, kept on screen
  place() {
    const r = this.panel.el.getBoundingClientRect();
    const { box } = this;
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const left = r.left - w - 12 >= 8 ? r.left - w - 12 : Math.min(r.right + 12, innerWidth - w - 8);
    box.style.left = `${Math.max(8, left)}px`;
    box.style.top = `${Math.max(8, Math.min(r.bottom - h, innerHeight - h - 8))}px`;
  }

  note(text) {
    const p = document.createElement('p');
    p.className = 'transcript__note';
    p.textContent = text;
    return p;
  }

  you(m) {
    const row = document.createElement('div');
    row.className = 'transcript__msg is-you';
    row.textContent = m.content.replace(/\n\n\(The project already exists[\s\S]*$/, '').replace(/\s*\[attached:[^\]]*\]/, '');
    if (m.pics?.length) {
      const strip = document.createElement('div');
      strip.className = 'transcript__pics';
      for (const src of m.pics) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.addEventListener('click', (e) => { e.stopPropagation(); showBig(src); });
        strip.append(img);
      }
      row.append(strip);
    }
    return row;
  }

  her(m) {
    const row = document.createElement('div');
    row.className = 'transcript__msg is-her';
    const words = document.createElement('div');
    words.textContent = m.content.replace(/\s*\[(files in|she drew)[^\]]*\]/g, '').trim() || '…';
    row.append(words);
    const files = /\[files in ([^:\]]+(?::\\[^:\]]*)?): ([^\]]*)\]/.exec(m.content);
    if (m.code || files) row.append(this.codeCard(m.code, files));
    return row;
  }

  // what a code turn did: the folder, then each file (open it to see the code)
  codeCard(code, files) {
    const card = document.createElement('div');
    card.className = 'transcript__code';
    const dir = code?.dir || files?.[1];
    const top = document.createElement('div');
    top.className = 'transcript__dir';
    top.textContent = `📁 ${dir}`;
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Open folder';
    open.addEventListener('click', () => this.host.codeOpenDir(dir));
    top.append(open);
    // the game to play: a page she wrote, or one named in an older log line ("index.html rewritten")
    const listed = (files?.[2] || '').split(', ').map((s) => ({ path: s.split(' ')[0], action: s.split(' ')[1] }));
    const page = [...(code?.files || []), ...listed].find((f) => /\.html?$/i.test(f.path) && f.action !== 'deleted' && f.action !== 'failed');
    if (page) {
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'is-play';
      play.textContent = '▶ Play';
      play.addEventListener('click', () => this.host.codePlay(`${dir}\\${page.path.replace(/\//g, '\\')}`));
      top.append(play);
    }
    card.append(top);
    if (!code?.raw) { // from before the log kept code: only what changed
      card.append(this.note(files?.[2] || ''));
      return card;
    }
    const ops = codeOps(code.raw);
    for (const op of ops) {
      const done = code.files.find((f) => f.path === op.path);
      const item = document.createElement('details');
      const sum = document.createElement('summary');
      const what = op.type === 'edit' ? 'edit' : op.type === 'delete' ? 'deleted' : (done?.action || 'file');
      sum.textContent = `${MARK[done?.action] || '•'} ${op.path} · ${what}${done?.error ? ` (${done.error})` : ''}`;
      item.append(sum);
      if (op.type !== 'delete') {
        const pre = document.createElement('pre');
        const lines = op.type === 'edit'
          ? [...op.find.split('\n').map((l) => ['del', l]), ...op.replace.split('\n').map((l) => ['add', l])]
          : op.text.split('\n').map((l) => ['', l]);
        pre.innerHTML = lines.slice(0, MAX_LINES)
          .map(([kind, l]) => `<span class="row ${kind}">${kind === 'del' ? '- ' : kind === 'add' ? '+ ' : ''}${paint(l)}</span>`)
          .join('\n') + (lines.length > MAX_LINES ? `\n<span class="c">… ${lines.length - MAX_LINES} more lines in the file</span>` : '');
        item.append(pre);
      }
      card.append(item);
    }
    return card;
  }
}
