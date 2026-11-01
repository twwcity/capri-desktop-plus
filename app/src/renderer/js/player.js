// The media bar in her chat: what's playing on the PC (Spotify, YouTube in a browser…), its time, and
// buttons to go back, rewind 10 s, play/pause, forward 10 s, skip; a loop (played again from the start
// when it ends) and a sleep timer (paused when it runs out). Main's playerCommand does the talking to
// Windows; this asks once a second while her chat is open.

const ICON = {
  prev: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7"/><path d="M4 4v4.7h4.7"/><text x="12" y="15.5" font-size="7" text-anchor="middle" fill="currentColor" stroke="none" font-family="monospace">10</text></svg>',
  play: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
  fwd: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6L20 8.7"/><path d="M20 4v4.7h-4.7"/><text x="12" y="15.5" font-size="7" text-anchor="middle" fill="currentColor" stroke="none" font-family="monospace">10</text></svg>',
  next: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>',
  loop: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
  timer: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>',
};
const reducedMotion = () => document.documentElement.dataset.motion === 'reduced';
const VOL = {
  voldown: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 12h4"/></svg>',
  volup: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 12h4M19 10v4"/></svg>',
};
// the bar's own state between runs: full, or small in her panel's corner
const saved = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* this run only */ } };
const TIMER_STEPS = [0, 15, 30, 45, 60, 90, 120]; // minutes, one click to the next
const clock = (s) => {
  s = Math.max(0, Math.round(s || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(s % 60).padStart(2, '0')}`;
};

export class Player {
  constructor({ host, panel, chat }) {
    this.host = host;
    this.panel = panel;
    this.chat = chat;
    this.now = null;        // the session shown
    this.loop = false;
    this.timerAt = 0;       // when the sleep timer pauses it (ms), 0: off
    this.timerStep = 0;
    this.busy = false;
    this.mode = saved('capri.player.mode', 'full'); // 'full' | 'mini' (a cover in her panel's corner)
    this.closedKey = null; // closed for this song or clip: back with the next one
    this.build();
    setInterval(() => this.tick(), 1000);
    setInterval(() => this.watch(), 120); // goes and comes back with her panel (picked up, put away)
  }

  get th() { return this.chat.brain?.lang === 'th'; }

  build() {
    const bar = document.createElement('div');
    bar.className = 'media-bar';
    bar.hidden = true;
    bar.innerHTML = `
      <div class="media-bar__cover"><img alt=""><span>♪</span></div>
      <div class="media-bar__main">
      <div class="media-bar__info"><span class="media-bar__note">♪</span><span class="media-bar__title"></span><span class="media-bar__app"></span><button type="button" class="media-bar__win" data-do="mini">–</button><button type="button" class="media-bar__win" data-do="close">✕</button></div>
      <div class="media-bar__time"><span class="media-bar__pos">0:00</span><div class="media-bar__track"><i></i></div><span class="media-bar__end">0:00</span></div>
      <div class="media-bar__buttons">
        <button type="button" data-do="previous">${ICON.prev}</button>
        <button type="button" data-do="back">${ICON.back}</button>
        <button type="button" data-do="toggle" class="is-main">${ICON.play}</button>
        <button type="button" data-do="fwd">${ICON.fwd}</button>
        <button type="button" data-do="next">${ICON.next}</button>
        <span class="media-bar__gap"></span>
        <button type="button" data-do="voldown">${VOL.voldown}</button>
        <button type="button" data-do="volup">${VOL.volup}</button>
        <button type="button" data-do="loop">${ICON.loop}</button>
        <button type="button" data-do="timer">${ICON.timer}<b class="media-bar__left"></b></button>
      </div>
      </div>`;
    bar.addEventListener('click', (e) => {
      e.stopPropagation(); // a click in her panel would close it
      const b = e.target.closest('[data-do]');
      if (b) this.press(b.dataset.do);
    });
    // a click on the track: there
    bar.querySelector('.media-bar__track').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.now?.seek || !this.now.end) return;
      const r = e.currentTarget.getBoundingClientRect();
      this.send('seek', ((e.clientX - r.left) / r.width) * this.now.end);
    });
    this.bar = bar;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'media-chip';
    chip.hidden = true;
    chip.innerHTML = '<img alt=""><span>♪</span>';
    chip.addEventListener('click', (e) => { e.stopPropagation(); this.setMode('full'); });
    this.chip = chip;
    document.body.append(chip);
    document.body.append(bar); // its own box, floating over her panel
    new ResizeObserver(() => this.place()).observe(this.panel.el);
  }

  async send(action, value = 0) {
    if (this.busy) return;
    this.busy = true;
    try {
      const res = await this.host.playerCommand(action, this.now?.key || '', value);
      this.show(res.sessions);
    } finally {
      this.busy = false;
    }
  }

  press(what) {
    const s = this.now;
    if (what === 'loop') {
      this.loop = !this.loop;
      this.paint();
      return;
    }
    if (what === 'timer') return this.timerMenu();
    if (what === 'mini') return this.setMode('mini');
    if (what === 'voldown' || what === 'volup') return this.host.media(what); // the PC's volume, a few steps
    if (what === 'close') {
      this.closeMenu();
      this.closedKey = s?.key || null;
      return this.show(this.sessions || []);
    }
    if (!s) return;
    if (what === 'back') return this.send('seek', Math.max(0, s.pos - 10));
    if (what === 'fwd') return this.send('seek', Math.min(s.end - 1, s.pos + 10));
    if (what === 'previous' && !s.prev) return this.send('seek', 0); // a single video: back to its start
    return this.send(what);
  }

  // once a second: the state, the loop, the timer
  async tick() {
    const open = this.panel.current?.chat && this.panel.visible;
    if (this.timerAt && Date.now() >= this.timerAt) {
      this.timerAt = 0;
      this.timerStep = 0;
      const res = await this.host.playerCommand('pause', this.now?.key || '');
      this.show(res.sessions);
      if (open) this.panel.stream(this.th ? 'หมดเวลาแล้ว หยุดเพลงให้แล้วนะ ฝันดี' : 'Timer’s up. Paused it. Sleep well, choom.', { done: true });
    }
    if (!open && !this.loop) { this.bar.hidden = true; this.chip.hidden = true; return; }
    if (this.busy) return;
    this.busy = true;
    try {
      const res = await this.host.playerCommand('state', this.now?.key || '');
      this.show(res.sessions);
      // the loop: at its end, from the start again
      const s = this.now;
      if (this.loop && s?.seek && s.end > 5 && (s.end - s.pos < 1.6 || (this.wasPlaying && s.status !== 'Playing' && s.end - s.pos < 4))) {
        await this.host.playerCommand('seek', s.key, 0);
        await this.host.playerCommand('play', s.key);
      }
      this.wasPlaying = s?.status === 'Playing';
    } finally {
      this.busy = false;
    }
  }

  setMode(mode) {
    this.mode = mode;
    save('capri.player.mode', mode);
    this.closeMenu();
    this.show(this.sessions || []);
  }

  // shown at all: her chat open, something playing, and not closed for this one
  get wanted() {
    return Boolean(this.panel.current?.chat && this.panel.visible && this.now && this.now.key !== this.closedKey);
  }

  show(sessions = []) {
    this.sessions = sessions;
    const playing = sessions.find((x) => x.status === 'Playing');
    const same = sessions.find((x) => x.key === this.now?.key);
    this.now = playing || same || sessions[0] || null;
    if (this.now && this.now.key !== this.coverKey) this.loadCover(this.now.key);
    if (!this.now) this.showCover(null);
    const was = this.bar.hidden;
    if (this.now && this.closedKey && this.now.key !== this.closedKey) this.closedKey = null; // a new one: back
    this.bar.hidden = !(this.wanted && this.mode === 'full');
    this.chip.hidden = !(this.wanted && this.mode === 'mini');
    this.chip.classList.toggle('is-playing', this.now?.status === 'Playing');
    this.chip.title = this.now ? `${this.now.title || ''}${this.now.artist ? ` — ${this.now.artist}` : ''}` : '';
    this.paint();
    if (was && !this.bar.hidden && !reducedMotion()) {
      this.bar.classList.remove('is-opening');
      void this.bar.offsetWidth; // restart it
      this.bar.classList.add('is-opening');
    }
    if (!this.bar.hidden || !this.chip.hidden) this.place();
  }

  async loadCover(key) {
    this.coverKey = key;
    this.showCover(null);
    const res = await this.host.playerCommand('thumb', key).catch(() => null);
    if (this.coverKey === key && res?.key === key) this.showCover(res.thumb);
  }

  showCover(src) {
    const img = this.bar.querySelector('.media-bar__cover img');
    const mini = this.chip.querySelector('img');
    if (src) { img.src = src; mini.src = src; } else { img.removeAttribute('src'); mini.removeAttribute('src'); }
    this.bar.classList.toggle('has-cover', Boolean(src));
    this.chip.classList.toggle('has-cover', Boolean(src));
  }

  // the sleep timer's popup, over its button: a few times, your own minutes, the end of this song, off
  timerMenu() {
    if (this.menu) return this.closeMenu();
    const th = this.th;
    const box = document.createElement('div');
    box.className = 'timer-menu';
    const left = this.timerAt ? clock((this.timerAt - Date.now()) / 1000) : '';
    box.innerHTML = `
      <div class="timer-menu__head"><b>⏲ ${th ? 'ตั้งเวลาหยุดเพลง' : 'SLEEP TIMER'}</b><span>${left ? (th ? `เหลือ ${left}` : `${left} left`) : (th ? 'ปิดอยู่' : 'off')}</span></div>
      <div class="timer-menu__grid">${TIMER_STEPS.filter(Boolean).map((m) => `<button type="button" data-min="${m}">${m >= 60 && m % 60 === 0 ? `${m / 60} ${th ? 'ชม.' : 'h'}` : m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} ${th ? 'ชม.' : 'h'}` : `${m} ${th ? 'นาที' : 'min'}`}</button>`).join('')}</div>
      <button type="button" class="timer-menu__song" data-min="song">${th ? '♪ หยุดเมื่อเพลงนี้จบ' : '♪ When this song ends'}</button>
      <form class="timer-menu__own"><input type="number" min="1" max="600" placeholder="${th ? 'กี่นาที…' : 'Minutes…'}"><button type="submit">${th ? 'ตั้ง' : 'Set'}</button></form>
      ${this.timerAt ? `<button type="button" class="timer-menu__off" data-min="0">${th ? 'ยกเลิกตั้งเวลา' : 'Turn timer off'}</button>` : ''}`;
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest('[data-min]');
      if (!b) return;
      const v = b.dataset.min;
      if (v === 'song') {
        const s = this.now;
        if (s?.end) this.timerAt = Date.now() + Math.max(1, s.end - s.pos - 0.8) * 1000; // just before it ends (no next one starts)
      } else this.setTimer(Number(v));
      this.paint();
      this.closeMenu();
    });
    box.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const n = Math.round(Number(box.querySelector('input').value));
      if (n > 0) this.setTimer(Math.min(600, n));
      this.closeMenu();
    });
    box.addEventListener('pointerdown', () => this.host.focusOverlay?.(true)); // the keyboard, for your minutes
    document.body.append(box);
    this.menu = box;
    const at = this.bar.querySelector('[data-do="timer"]').getBoundingClientRect();
    box.style.left = `${Math.max(8, Math.min(at.right - box.offsetWidth, innerWidth - box.offsetWidth - 8))}px`;
    const above = at.top - box.offsetHeight - 8;
    box.style.top = `${above >= 8 ? above : at.bottom + 8}px`;
    this.outside = (e) => { if (!box.contains(e.target) && !e.target.closest?.('[data-do="timer"]')) this.closeMenu(); };
    setTimeout(() => document.addEventListener('pointerdown', this.outside), 0);
  }

  closeMenu() {
    this.menu?.remove();
    this.menu = null;
    if (this.outside) document.removeEventListener('pointerdown', this.outside);
    this.outside = null;
  }

  // her panel gone (you picked her up, it closed): the bar folds away with it; back with it after
  watch() {
    const open = Boolean(this.panel.current?.chat && this.panel.visible);
    if (!open) this.chip.hidden = true;
    if (open && this.mode === 'mini' && this.chip.hidden && this.wanted) this.show(this.sessions || []);
    if (!open && !this.bar.hidden && !this.closing) {
      this.closing = true;
      this.closeMenu();
      this.bar.classList.remove('is-opening');
      this.bar.classList.add('is-closing');
      setTimeout(() => {
        this.closing = false;
        this.bar.classList.remove('is-closing');
        if (!(this.panel.current?.chat && this.panel.visible)) this.bar.hidden = true;
      }, reducedMotion() ? 0 : 160);
    } else if (open && this.mode === 'full' && this.bar.hidden && this.wanted && !this.closing) {
      this.show(this.sessions || []);
    }
  }

  // just above her panel, as wide as it; below it when there is no room above. It follows her panel
  // every frame, easing toward where it should be (so it glides along when she moves).
  place() {
    if (this.bar.hidden && this.chip.hidden) return;
    // her panel already gone (it hides a moment before the bar finishes folding): stay where it was,
    // or the empty rectangle at 0,0 pulls the bar into the top-left corner on its way out
    if (this.closing || this.panel.el.hidden) return;
    const r = this.panel.el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    if (!this.chip.hidden) {
      this.target = { x: Math.max(4, r.left + 2), y: Math.max(4, r.top - 46) };
      if (!this.at) this.at = { ...this.target };
      if (!this.following) { this.following = true; requestAnimationFrame(() => this.follow()); }
      return;
    }
    const w = Math.max(260, r.width - 20);
    if (this.width !== w) { this.width = w; this.bar.style.width = `${w}px`; }
    const h = this.bar.offsetHeight;
    this.target = {
      x: Math.max(8, Math.min(r.left + 10, innerWidth - w - 8)),
      y: r.top - h - 6 >= 8 ? r.top - h - 6 : Math.min(r.bottom + 6, innerHeight - h - 8),
    };
    if (!this.at) this.at = { ...this.target }; // just shown: right there (the open animation does the rest)
    if (!this.following) {
      this.following = true;
      requestAnimationFrame(() => this.follow());
    }
  }

  follow() {
    if (this.bar.hidden && this.chip.hidden) { this.following = false; this.at = null; return; }
    this.place(); // where her panel is now
    const t = this.target;
    if (!t) { requestAnimationFrame(() => this.follow()); return; }
    const k = reducedMotion() ? 1 : 0.22; // a fraction of the way each frame: quick, but never a jump
    this.at.x += (t.x - this.at.x) * k;
    this.at.y += (t.y - this.at.y) * k;
    if (Math.abs(t.x - this.at.x) < 0.3) this.at.x = t.x;
    if (Math.abs(t.y - this.at.y) < 0.3) this.at.y = t.y;
    (this.chip.hidden ? this.bar : this.chip).style.transform = `translate3d(${this.at.x}px, ${this.at.y}px, 0)`;
    requestAnimationFrame(() => this.follow());
  }

  paint() {
    const s = this.now;
    const q = (sel) => this.bar.querySelector(sel);
    if (s) {
      q('.media-bar__title').textContent = `${s.title || '?'}${s.artist ? ` — ${s.artist}` : ''}`;
      q('.media-bar__title').title = q('.media-bar__title').textContent;
      q('.media-bar__app').textContent = s.app;
      q('.media-bar__pos').textContent = clock(s.pos);
      q('.media-bar__end').textContent = s.end ? clock(s.end) : '--:--';
      q('.media-bar__track i').style.width = `${s.end ? Math.min(100, (100 * s.pos) / s.end) : 0}%`;
      q('[data-do="toggle"]').innerHTML = s.status === 'Playing' ? ICON.pause : ICON.play;
      q('[data-do="next"]').disabled = !s.next;
      q('[data-do="back"]').disabled = !s.seek;
      q('[data-do="fwd"]').disabled = !s.seek;
      this.bar.classList.toggle('is-playing', s.status === 'Playing');
    }
    const th = this.th;
    const tip = {
      previous: th ? 'ก่อนหน้า / กลับไปต้นเพลง' : 'Previous / back to start', back: th ? 'ถอย 10 วิ' : 'Back 10 s',
      toggle: th ? 'เล่น / หยุด' : 'Play / pause', fwd: th ? 'ไปข้างหน้า 10 วิ' : 'Forward 10 s', next: th ? 'ถัดไป' : 'Next',
      loop: th ? `เล่นวนซ้ำ: ${this.loop ? 'เปิด' : 'ปิด'}` : `Loop: ${this.loop ? 'on' : 'off'}`,
      timer: th ? 'ตั้งเวลาหยุดเพลง' : 'Sleep timer',
      voldown: th ? 'เสียงเบาลง' : 'Volume down', volup: th ? 'เสียงดังขึ้น' : 'Volume up',
      mini: th ? 'ย่อไว้ที่มุม' : 'Minimize to the corner', close: th ? 'ปิด (กลับมาเมื่อเปลี่ยนเพลง)' : 'Close (back with the next song)',
    };
    for (const [k, v] of Object.entries(tip)) this.bar.querySelector(`[data-do="${k}"]`).title = v;
    this.bar.querySelector('[data-do="loop"]').classList.toggle('is-on', this.loop);
    this.bar.querySelector('[data-do="timer"]').classList.toggle('is-on', Boolean(this.timerAt));
    this.bar.querySelector('.media-bar__left').textContent = this.timerAt ? clock((this.timerAt - Date.now()) / 1000) : '';
  }

  // asked in words: "ตั้งเวลาปิดเพลง 30 นาที", "เล่นวนไปเรื่อยๆ"
  setTimer(min) {
    this.timerAt = min ? Date.now() + min * 60000 : 0;
    this.timerStep = 0;
    this.paint();
  }

  setLoop(on) {
    this.loop = on;
    this.paint();
  }
}
