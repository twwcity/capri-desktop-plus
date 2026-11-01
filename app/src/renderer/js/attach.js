// What you hand her in her chat (pictures, text files), shown as small chips above the line you type,
// and the pictures she draws back (preview under her answer).

// white line icons of the + menu
const ICONS = {
  "clip": "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9\"/></svg>",
  "spark": "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\"/><circle cx=\"8.5\" cy=\"8.5\" r=\"1.6\"/><path d=\"M21 15l-5-5L5 21\"/><path d=\"M18 2.5v3M16.5 4h3\"/></svg>",
  "code": "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16\"/></svg>",
  "folder": "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linejoin=\"round\"><path d=\"M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z\"/></svg>",
  "newdir": "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM12 10.5v5M9.5 13h5\"/></svg>",
  "agent": "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"7\" width=\"16\" height=\"12\" rx=\"2\"/><path d=\"M12 3v4M9 12h.01M15 12h.01M9 16h6\"/></svg>",
  "hack": "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 5h16v11H4zM9 20h6M12 16v4\"/><path d=\"M7.5 9l2 1.5-2 1.5M11.5 12.5h4\"/></svg>",
  "cancel": "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9 9l6 6M15 9l-6 6\"/></svg>"
};

const MAX_SIDE = 1024; // pictures are shrunk before the model sees them: faster, and plenty to see

const shrink = (dataUrl) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    resolve(canvas.toDataURL('image/jpeg', 0.88));
  };
  img.onerror = () => resolve(null);
  img.src = dataUrl;
});

export class Attach {
  constructor({ host, panel }) {
    this.host = host;
    this.panel = panel;
    this.items = []; // { name, kind: 'image' | 'text', data, thumb }
    this.shown = null;
    panel.attach = this;
    this.canDraw = false;
    host.mediaInfo().then((info) => { this.canDraw = info.draw; }).catch(() => {});
    this.drawMode = false; // the next message is a picture to draw, chosen in the + menu
    this.menu = null;
    panel.chatAttach.addEventListener('click', () => this.toggleMenu());
    panel.chatInput.addEventListener('paste', (e) => this.paste(e));
    panel.preview.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'show' && this.shown) host.mediaShow(this.shown);
      else if (act === 'open' || e.target.tagName === 'IMG') { if (this.shown) host.mediaOpen(this.shown); }
    });
  }

  // the small menu that floats over the + button: add a file, or draw a picture
  toggleMenu() {
    if (this.menu) return this.closeMenu();
    const box = document.createElement('div');
    box.className = 'attach-menu';
    const item = (icon, label, run, enabled = true) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.disabled = !enabled;
      b.innerHTML = ICONS[icon];
      b.append(label);
      b.addEventListener('click', () => { this.closeMenu(); run(); });
      return b;
    };
    box.append(
      item('clip', 'Add files or photos', () => this.pick()),
      this.drawMode
        ? item('cancel', 'Cancel image', () => this.setDraw(false))
        : item('spark', 'Create image', () => this.setDraw(true), this.canDraw),
      this.agentMode
        ? item('cancel', 'Stop PC agent', () => this.setAgent(false))
        : item('agent', 'PC agent (manage files)', () => this.setAgent(true)),
      ...(this.agentMode ? [item('folder', 'Allow another folder…', async () => { await this.host.agentAddRoot(); this.setAgent(true); })] : []),
      this.codeMode
        ? item('cancel', 'Stop code mode', () => this.setCode(false))
        : item('code', 'Code mode', () => this.setCode(true)),
      this.hackMode
        ? item('cancel', 'Stop hack mode', () => this.setHack(false))
        : item('hack', 'Hack mode (games)', () => this.setHack(true)),
      ...(this.codeMode ? [
        item('folder', 'Open a project folder…', async () => { if (await this.host.codePick()) this.setCode(true); }),
        item('newdir', 'New project', async () => { await this.host.codeNew(); this.setCode(true); }),
      ] : []),
    );
    // on the page, not in her panel: the panel's cut corners would clip it
    document.body.append(box);
    const at = this.panel.chatAttach.getBoundingClientRect();
    const above = at.top - box.offsetHeight - 8;
    box.style.left = `${Math.max(8, Math.min(at.left, innerWidth - box.offsetWidth - 8))}px`;
    box.style.top = `${above >= 8 ? above : at.bottom + 8}px`;
    this.menu = box;
    // a click anywhere else closes it
    this.outside = (e) => { if (!box.contains(e.target) && !this.panel.chatAttach.contains(e.target)) this.closeMenu(); };
    setTimeout(() => document.addEventListener('pointerdown', this.outside), 0);
  }

  closeMenu() {
    this.menu?.remove();
    this.menu = null;
    if (this.outside) document.removeEventListener('pointerdown', this.outside);
    this.outside = null;
  }

  // draw mode: what you type next is the picture (nothing else draws)
  // code mode: what you type goes to her as a coder, writing real files (chat.js code()); it stays on
  // until stopped. The tag over the line says which project.
  // PC agent mode: what you type is a task on your files (chat.js pcAgent); it stays on until stopped
  // hack mode: what you type is a cheat for the game you're playing (chat.js hack): her AI reads it,
  // typos and all, and does it in the game. Your ordinary chat stays out of it. On until stopped.
  setHack(on) {
    if (on && this.codeMode) this.setCode(false);
    if (on && this.agentMode) this.setAgent(false);
    if (on && this.drawMode) this.setDraw(false);
    this.hackMode = on;
    this.panel.chatAttach.classList.toggle('is-hack', on);
    if (!this.placeholder) this.placeholder = this.panel.chatInput.placeholder;
    this.panel.chatInput.placeholder = on ? 'Hack: เสกเพชร 64, พาไปหมู่บ้าน, find diamonds…' : this.placeholder;
    this.panel.setCodeTag?.(on ? 'HACK MODE' : null);
    this.panel.chatInput.focus();
  }

  setAgent(on) {
    if (on && this.hackMode) this.setHack(false);
    this.agentMode = on;
    if (on && this.codeMode) this.setCode(false);
    if (on && this.drawMode) this.setDraw(false);
    this.panel.chatAttach.classList.toggle('is-agent', on);
    if (!this.placeholder) this.placeholder = this.panel.chatInput.placeholder;
    this.panel.chatInput.placeholder = on ? 'Agent: organize Downloads, move my photos…' : this.placeholder;
    this.panel.setCodeTag?.(on ? 'PC AGENT' : null);
    this.panel.chatInput.focus();
  }

  async setCode(on) {
    if (on && this.agentMode) this.setAgent(false);
    if (on && this.hackMode) this.setHack(false);
    this.codeMode = on;
    if (on && this.drawMode) this.setDraw(false);
    this.panel.chatAttach.classList.toggle('is-code', on);
    if (!this.placeholder) this.placeholder = this.panel.chatInput.placeholder;
    this.panel.chatInput.placeholder = on ? 'Code: make a game, change a file…' : this.placeholder;
    const info = on ? await this.host.codeInfo().catch(() => ({})) : {};
    this.panel.setCodeTag?.(on ? (info.dir ? info.dir.split(/[\\/]/).pop() : 'new project') : null);
    this.panel.chatInput.focus();
  }

  setDraw(on) {
    if (on && this.codeMode) this.setCode(false);
    if (on && this.hackMode) this.setHack(false);
    this.drawMode = on;
    this.panel.chatAttach.classList.toggle('is-draw', on);
    if (!this.placeholder) this.placeholder = this.panel.chatInput.placeholder;
    this.panel.chatInput.placeholder = on ? 'Describe the image…' : this.placeholder;
    this.panel.chatInput.focus();
  }

  // a picture or a text file pasted (a screenshot, a file copied in Explorer, an image copied from a page)
  async paste(event) {
    const files = [...(event.clipboardData?.files || [])].filter((f) => /^image\//.test(f.type) || /^text\//.test(f.type) || /\.(txt|md|json|csv|log|js|ts|py|html|css|xml|ya?ml)$/i.test(f.name));
    if (!files.length) return; // plain text: the line takes it as usual
    event.preventDefault();
    const read = (file, as) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      if (as === 'text') reader.readAsText(file); else reader.readAsDataURL(file);
    });
    for (const file of files) {
      if (this.items.length >= 6) break;
      if (/^image\//.test(file.type)) {
        const data = await shrink(await read(file, 'url'));
        if (data) this.items.push({ name: file.name && file.name !== 'image.png' ? file.name : 'pasted picture', kind: 'image', data, thumb: data });
      } else if (file.size <= 2 * 1024 * 1024) {
        const text = await read(file, 'text');
        if (text) this.items.push({ name: file.name, kind: 'text', data: text.slice(0, 16000) });
      }
    }
    this.render();
  }

  get count() {

    return this.items.length;
  }

  async pick() {
    const files = await this.host.mediaPick();
    for (const f of files) {
      if (this.items.length >= 6) break;
      if (f.kind === 'image') {
        const data = await shrink(f.data);
        if (data) this.items.push({ name: f.name, kind: 'image', data, thumb: data });
      } else {
        this.items.push({ name: f.name, kind: 'text', data: f.data });
      }
    }
    this.render();
    this.panel.chatInput.focus();
  }

  // what is attached, taken for the message being sent
  take() {
    const items = this.items;
    this.items = [];
    this.render();
    return items;
  }

  clear() {
    this.items = [];
    this.closeMenu();
    if (this.drawMode) this.setDraw(false);
    if (this.codeMode) this.setCode(false);
    if (this.agentMode) this.setAgent(false);
    if (this.hackMode) this.setHack(false);
    this.render();
    this.hidePreview();
  }

  render() {
    const { files } = this.panel;
    files.hidden = this.items.length === 0;
    files.replaceChildren(...this.items.map((item, i) => {
      const chip = document.createElement('span');
      chip.className = 'file-chip';
      if (item.thumb) {
        const img = document.createElement('img');
        img.src = item.thumb;
        img.alt = '';
        chip.append(img);
      }
      const label = document.createElement('span');
      label.textContent = item.name;
      const x = document.createElement('button');
      x.type = 'button';
      x.textContent = '✕';
      x.setAttribute('aria-label', `Remove ${item.name}`);
      x.addEventListener('click', () => { this.items.splice(i, 1); this.render(); });
      chip.append(label, x);
      return chip;
    }));
    this.panel.place?.();
  }

  showPreview({ data, file }) {
    this.shown = file;
    this.panel.preview.querySelector('img').src = data;
    this.panel.preview.querySelector('figcaption').hidden = !file;
    this.panel.preview.hidden = false;
    this.panel.place?.();
  }

  hidePreview() {
    this.panel.preview.hidden = true;
  }
}
