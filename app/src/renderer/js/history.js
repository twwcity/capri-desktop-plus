// Her chats, one per subject: the clock in her chat header lists them (main.js keeps them in
// memory.json). Open one to carry on, start a new one, archive one out of the way, or delete it.

const ICON = {
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  archive: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/></svg>',
  unarchive: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M12 18v-6M9.5 14.5 12 12l2.5 2.5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
};

const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export class History {
  constructor({ host, panel, chat }) {
    this.host = host;
    this.panel = panel;
    this.chat = chat;
    this.box = null;
    this.archived = false; // showing the archived ones
    this.button = panel.el.querySelector('.panel__history');
    this.button.addEventListener('click', () => (this.box ? this.close() : this.open()));
  }

  async open() {
    const list = await this.host.chatList().catch(() => []);
    if (this.box) this.box.remove();
    const box = document.createElement('div');
    box.className = 'history-menu';
    document.body.append(box);
    this.box = box;
    this.render(list);
    this.outside = (e) => { if (!box.contains(e.target) && !this.button.contains(e.target)) this.close(); };
    setTimeout(() => document.addEventListener('pointerdown', this.outside), 0);
  }

  close() {
    this.box?.remove();
    this.box = null;
    if (this.outside) document.removeEventListener('pointerdown', this.outside);
    this.outside = null;
  }

  // under the clock, kept on screen
  place() {
    const at = this.button.getBoundingClientRect();
    const { box } = this;
    const below = at.bottom + 8;
    box.style.left = `${Math.max(8, Math.min(at.left - 12, innerWidth - box.offsetWidth - 8))}px`;
    box.style.top = `${below + box.offsetHeight <= innerHeight - 8 ? below : Math.max(8, at.top - box.offsetHeight - 8)}px`;
  }

  render(list) {
    const el = (tag, className, html) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (html) node.innerHTML = html;
      return node;
    };
    const { box } = this;
    const head = el('div', 'history-menu__head');
    const tabs = el('div', 'history-menu__tabs');
    for (const [label, on] of [['Chats', false], ['Archived', true]]) {
      const tab = el('button', on === this.archived ? 'is-on' : '');
      tab.type = 'button';
      tab.textContent = `${label} ${list.filter((c) => c.archived === on).length || ''}`.trim();
      tab.addEventListener('click', () => { this.archived = on; this.render(list); });
      tabs.append(tab);
    }
    const fresh = el('button', 'history-menu__new', ICON.plus);
    fresh.type = 'button';
    fresh.append('New chat');
    fresh.addEventListener('click', () => this.start());
    head.append(tabs, fresh);

    const rows = el('div', 'history-menu__list');
    const shown = list.filter((c) => c.archived === this.archived);
    if (!shown.length) rows.append(el('p', 'history-menu__empty', this.archived ? 'Nothing archived.' : 'No chats yet.'));
    for (const c of shown) {
      const row = el('div', `history-menu__row${c.current ? ' is-current' : ''}`);
      const open = el('button', 'history-menu__open');
      open.type = 'button';
      const title = el('span', 'history-menu__title');
      title.textContent = c.title;
      const when = el('span', 'history-menu__when');
      when.textContent = ago(c.updated);
      open.append(title, when);
      open.addEventListener('click', () => this.load(c.id));
      const keep = el('button', 'history-menu__icon', c.archived ? ICON.unarchive : ICON.archive);
      keep.type = 'button';
      keep.title = c.archived ? 'Unarchive' : 'Archive';
      keep.addEventListener('click', async () => this.render(await this.host.chatArchive(c.id, !c.archived)));
      const del = el('button', 'history-menu__icon is-danger', ICON.trash);
      del.type = 'button';
      del.title = 'Delete';
      // two clicks: the first asks
      del.addEventListener('click', async () => {
        if (!del.classList.contains('is-sure')) {
          del.classList.add('is-sure');
          del.textContent = 'Delete?';
          return;
        }
        const res = await this.host.chatDelete(c.id);
        if (res.wasCurrent) this.chat.resume([]);
        this.render(res.list);
      });
      row.append(open, keep, del);
      rows.append(row);
    }
    box.replaceChildren(head, rows);
    this.place();
  }

  async load(id) {
    const history = await this.host.chatOpen(id);
    this.close();
    if (history) this.chat.resume(history);
  }

  async start() {
    await this.host.chatNew();
    this.close();
    this.chat.resume([]);
  }
}
