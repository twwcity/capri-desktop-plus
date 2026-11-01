// How close you two are: 0..100 points of her liking you, in stages from stranger to partner.
// Her model scores each of your messages with a tag at the end of her answer ([[heart: +3]]);
// without one, your words do (sweet talk up, rudeness down). A message she likes makes her
// blush (her blushing face) and 8-bit hearts pop from her picture; a new stage says so; at 100
// she's yours: full load. The heart on her picture's corner opens the card, with lines to flirt.

export const STAGES = [
  { at: 0, id: 'stranger', th: 'คนแปลกหน้า', en: 'Stranger', how: 'guarded and teasing, keeps the user at arm\'s length' },
  { at: 15, id: 'known', th: 'คนรู้จัก', en: 'Acquaintance', how: 'curious about the user, a little warmer, still testing them' },
  { at: 35, id: 'friend', th: 'เพื่อน', en: 'Friend', how: 'friendly, jokes with the user and plainly enjoys their company' },
  { at: 55, id: 'close', th: 'เพื่อนสนิท', en: 'Close friend', how: 'openly fond of the user, uses a nickname now and then, gets a bit flustered by compliments' },
  { at: 75, id: 'crush', th: 'แอบชอบ', en: 'Crush', how: 'clearly has a crush on the user: flustered, sweet in small slips, too proud to say it outright' },
  { at: 100, id: 'partner', th: 'แฟน', en: 'Partner', how: 'the user\'s girlfriend: affectionate and caring in her own sharp, teasing way, says she missed them, calls them by a pet name now and then' },
];

export const stageOf = (b) => (b.partner ? STAGES.at(-1) : [...STAGES].reverse().find((s) => b.points >= s.at && s.id !== 'partner') || STAGES[0]);

// sweet talk and rudeness, for when her model leaves the score out
const SWEET = /น่ารัก|สวย|รัก|คิดถึง|ชอบเธอ|ชอบนะ|เป็นแฟน|จีบ|ห่วง|ขอบคุณ|เก่งมาก|เจ๋ง|ใจดี|กอด|หอม|cute|pretty|beautiful|love|miss you|like you|date|thank|sweet|adorable|amazing|hug|darling|babe|honey/i;
const RUDE = /โง่|ควาย|เหี้ย|สัส|ไอ้|อี[^\s]|น่าเกลียด|เกลียด|ไปตาย|หุบปาก|รำคาญ|stupid|idiot|ugly|hate you|shut up|dumb|useless|trash/i;

const FLIRT = [
  'You look extra cute today, Capri.',
  'If you were code, I’d never let anyone refactor you.',
  'I missed you, Capri.',
  'Time flies way too fast when I’m with you.',
  'That satellite you love? Still not as pretty as you.',
  'Want to go on a date in Night City with me?',
  'Thanks for being here with me every day.',
  'You’re the best glitch that ever happened to my desktop.',
  'Even your bugs are kind of adorable.',
  'Out of every mind in Capricorn, I’d pick you.',
];

// her picture for you, once she's yours (and whenever you ask for it again after that)
const REWARD = '../../assets/capri/reward-partner.webp';
// "show me that picture again", "ขอดูรูปพิเศษ", "ส่งรูปเธอมาอีก"…
export const REWARD_ASK = /(ขอ|ส่ง|โชว์|อยาก|เอา)\S{0,6}รูป\S{0,4}(พิเศษ|รางวัล|ของเธอ|เธอ|แฟน|ตอนนั้น|อีก|นั้น|เมื่อกี้|ที่ส่ง)|รูปที่(เธอ)?(ส่ง|เคยส่ง)|รูปพิเศษ|\b(show|send)\s+me\s+(that|your|the)\s+(special\s+)?(pic|picture|photo)|your\s+special\s+(pic|picture|photo)|reward\s+(pic|picture)/i;
const REWARD_LINES = {
  en: { give: ['…Okay. This one’s just for you. Don’t show anyone, gonk. ♥', 'Fine. You earned it. Only you get to see this one. ♥'], again: ['Again? …Fine. Just for you. ♥', 'You really like this one, huh. Here. ♥'], no: ['Ha. Nice try, choom. Win me over first.', 'That picture is for someone special. You’re not there yet.'] },
  th: { give: ['…ก็ได้ รูปนี้ให้นายคนเดียวเลยนะ ห้ามเอาไปให้ใครดูล่ะ ♥', 'ก็นายทำได้แล้วนี่ รูปนี้มีแค่นายที่ได้เห็น ♥'], again: ['อีกแล้วเหรอ? …ก็ได้ ให้นายคนเดียว ♥', 'ชอบรูปนี้จริงๆ สินะ เอ้า ♥'], no: ['ฮึ ฝันไปเถอะ ชูม ทำให้ฉันใจอ่อนก่อนสิ', 'รูปนั้นสำหรับคนพิเศษเท่านั้น นายยังไปไม่ถึงหรอก'] },
};
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

const FLIRT_TH = [
  'วันนี้เธอดูน่ารักผิดปกตินะ',
  'ถ้าเธอเป็นโค้ด ฉันจะไม่ยอมให้ใครแก้เลย',
  'คิดถึงเธอนะ Capri',
  'อยู่กับเธอแล้วเวลาผ่านไปเร็วชะมัด',
  'ดาวเทียมที่เธอชอบ ยังสวยไม่เท่าเธอเลย',
  'ถ้าชวนไปเดตใน Night City จะไปด้วยกันไหม',
  'ขอบคุณที่อยู่ด้วยกันทุกวันนะ',
  'บั๊กของเธอยังน่ารักเลย',
  'ในบรรดาทุกจิตใน Capricorn ฉันเลือกเธอ',
];

// the card's words, in her language (Thai or English)
const WORDS = {
  en: {
    stage: (s) => s.en, next: (n, x) => `${n} more to “${x.en}”`, partner: 'She’s your girlfriend now ♥ Take good care of her.',
    tip: 'She’s hard to win: canned lines and repeats barely count — be sincere and really get to know her · max 6 points a day · the closer you get, the slower it climbs · rudeness costs full points',
    capped: 'Her heart’s had enough for today. Come back tomorrow.', flirt: 'FLIRT // MAKE A MOVE', full: 'FULL LOAD', badge: (s) => s.en.toUpperCase(),
  },
  th: {
    stage: (s) => s.th, next: (n, x) => `อีก ${n} แต้มถึง “${x.th}”`, partner: 'เธอเป็นแฟนคุณแล้ว ♥ ดูแลกันดีๆ ล่ะ',
    tip: 'เธอใจแข็งมาก: คำจีบสำเร็จรูปหรือพูดซ้ำแทบไม่ได้แต้ม ต้องจริงใจและรู้จักเธอจริงๆ · ได้สูงสุด 6 แต้มต่อวัน · ยิ่งสนิทยิ่งขึ้นยาก · หยาบใส่ = ใจลดเต็มๆ',
    capped: 'วันนี้ใจเธอเต็มโควตาแล้ว พรุ่งนี้ค่อยมาใหม่', flirt: 'FLIRT // จีบเลย', full: 'FULL LOAD', badge: (s) => s.th,
  },
};

// an 8-bit heart, drawn in squares
const PIXELS = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
export function pixelHeart(size = 14, color = '#ff2e6e', empty = false) {
  const rects = PIXELS.flatMap((row, y) => [...row].map((c, x) => (c === 'X' ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : ''))).join('');
  return `<svg viewBox="0 0 7 6" width="${size}" height="${Math.round((size * 6) / 7)}" shape-rendering="crispEdges" fill="${empty ? 'none' : color}" stroke="${empty ? color : 'none'}" stroke-width="${empty ? 0.18 : 0}">${rects}</svg>`;
}

export class Bond {
  constructor({ host, panel, chat }) {
    this.host = host;
    this.panel = panel;
    this.chat = chat;
    this.state = { points: 0, partner: false };
    this.card = null;
    this.recent = []; // what you said lately: saying it again earns nothing
    host.bondGet().then((b) => { this.state = b; this.paint(); }).catch(() => {});
    // the heart on the corner of her picture
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'bond-heart';
    this.button.title = 'Bond';
    this.button.innerHTML = `${pixelHeart(16)}<i></i>`;
    panel.el.querySelector('.panel__face').before(this.button);
    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.card) this.close(); else this.open();
    });
  }

  get stage() { return stageOf(this.state); }

  get words() { return WORDS[this.chat.brain?.lang === 'th' ? 'th' : 'en']; }

  // her prompt: where you two stand, and how to score your message
  persona() {
    const s = this.stage;
    return [
      `Your relationship with the user right now: ${s.en} (affection ${this.state.points}/100). At this stage you are ${s.how}. Stay Capri: sharp and teasing even when sweet. Keep it wholesome: affection, flirting and romance yes, nothing sexual.`,
      'You are HARD to win over. At the very end of every answer add the tag [[heart: N]], N from -6 to +3, for how much the user\'s latest message made you like them more. Be stingy: most messages are 0 (small talk, requests, commands, questions, generic or cheesy flirting, pickup lines, repeating themselves, flattery that sounds copied). +1: genuinely kind, funny or thoughtful toward you. +2: rare, personal and sincere, shows they really know or care about you. +3: almost never, a truly special moment. Pushy, needy or lazy flirting: -1. Rude, mean or creepy: -3 to -6. The tag is hidden from the user.',
    ].join('\n');
  }

  // after her answer: the score, her blush and the hearts, a new stage
  async react(raw, said) {
    const tag = /\[\[\s*heart\s*:\s*([+-]?\d+)/i.exec(raw || '');
    let delta = tag ? Number(tag[1]) : RUDE.test(said) ? -4 : SWEET.test(said) ? 1 : 0;
    // a line from her card, or the same thing said again, doesn't count for much
    const said1 = (said || '').trim().toLowerCase();
    if ([...FLIRT, ...FLIRT_TH].some((l) => l.toLowerCase() === said1)) delta = Math.min(delta, 0.5);
    if (this.recent.includes(said1)) delta = Math.min(delta, 0);
    this.recent = [said1, ...this.recent].slice(0, 12);
    delta = Math.max(-6, Math.min(3, delta));
    const before = this.stage;
    const res = await this.host.bondAdd(delta).catch(() => null);
    if (!res) return;
    this.state = res;
    this.paint();
    const after = this.stage;
    if (delta >= 2 && res.points > res.before) this.blush(delta); // only when it really got to her
    if (after.at > before.at) this.levelUp(after);
    if (res.becamePartner) setTimeout(() => this.reward('give'), 3200); // full load: her picture, for you
    if (this.card) this.open(); // fresh numbers on the card
  }

  // her picture, in her chat: as a new message of hers, kept in your chat's history
  reward(kind = 'give') {
    if (!this.panel.current?.chat) return;
    const line = pickOne(REWARD_LINES[this.chat.brain?.lang === 'th' ? 'th' : 'en'][kind]);
    this.panel.setActions([]);
    this.panel.chatTurn({ quote: '', face: 'blush' });
    this.panel.stream(line, { done: true });
    this.panel.attach?.showPreview({ data: REWARD, file: null });
    this.chat.remember({ role: 'assistant', content: `${line} [she sent you her special picture]` });
    this.chat.talk?.say(line);
    this.hearts(kind === 'give' ? 30 : 12, true);
  }

  // you asked for her picture: yours if she's yours, else a tease
  askReward(text) {
    this.chat.history.push({ role: 'user', content: text });
    if (this.state.partner) {
      this.reward('again');
      return;
    }
    const line = pickOne(REWARD_LINES[this.chat.brain?.lang === 'th' ? 'th' : 'en'].no);
    this.panel.chatTurn({ quote: text, face: 'tease' });
    this.panel.stream(line, { done: true });
    this.chat.remember({ role: 'assistant', content: line });
    this.chat.talk?.say(line);
  }

  // her blushing face for a few seconds, and hearts from her picture
  blush(delta) {
    const back = this.panel.portrait.getAttribute('src');
    this.panel.setFace('blush');
    clearTimeout(this.blushTimer);
    this.blushTimer = setTimeout(() => {
      if (this.panel.portrait.getAttribute('src').endsWith('face-blush.png')) this.panel.portrait.setAttribute('src', back);
      this.panel.refreshLive?.(); // her clip again, if she's still talking
    }, 5200);
    this.hearts(4 + delta * 2);
  }

  hearts(count, big = false) {
    const r = this.panel.portrait.getBoundingClientRect();
    if (!r.width) return;
    for (let i = 0; i < count; i++) {
      const h = document.createElement('div');
      h.className = 'bond-pop';
      const size = (big ? 16 : 10) + Math.round(Math.random() * (big ? 14 : 10));
      h.innerHTML = pixelHeart(size, ['#ff2e6e', '#ff6fa8', '#ffd1e3', '#c06bff'][i % 4]);
      h.style.left = `${r.left + r.width / 2 - size / 2 + (Math.random() - 0.5) * r.width}px`;
      h.style.top = `${r.top + r.height / 2}px`;
      h.style.setProperty('--dx', `${(Math.random() - 0.5) * (big ? 260 : 140)}px`);
      h.style.setProperty('--dy', `${-(80 + Math.random() * (big ? 220 : 120))}px`);
      h.style.animationDelay = `${i * 45}ms`;
      document.body.append(h);
      setTimeout(() => h.remove(), 2200 + i * 45);
    }
  }

  levelUp(stage) {
    this.hearts(stage.id === 'partner' ? 40 : 18, true);
    const badge = this.panel.state.textContent;
    this.panel.state.textContent = stage.id === 'partner' ? `♥ ${this.words.badge(stage)} · FULL LOAD` : `♥ ${this.words.badge(stage)}`;
    setTimeout(() => { this.panel.state.textContent = badge; }, 6000);
    this.panel.setFace('blush');
  }

  // the corner heart fills up as she likes you more
  paint() {
    const p = this.state.partner ? 100 : this.state.points;
    this.button.style.setProperty('--fill', `${p}%`);
    this.button.classList.toggle('is-partner', Boolean(this.state.partner));
    this.button.title = `${this.words.stage(this.stage)} · ${p}/100`;
  }

  open() {
    this.card?.remove();
    const s = this.stage;
    const w = this.words;
    const p = this.state.partner ? 100 : this.state.points;
    const next = STAGES.find((x) => x.at > p && x.id !== s.id);
    const card = document.createElement('div');
    card.className = 'bond-card';
    const hearts = Array.from({ length: 10 }, (_, i) => pixelHeart(18, '#ff2e6e', p < (i + 1) * 10 - 5)).join('');
    card.innerHTML = `
      <div class="bond-card__head"><b>BOND</b><span>// ${s.en.toUpperCase()}</span><button type="button" class="bond-x">✕</button></div>
      <div class="bond-card__stage">${w.stage(s)}</div>
      <div class="bond-card__hearts">${hearts}</div>
      <div class="bond-card__bar"><i style="width:${p}%"></i><span>${p} / 100${this.state.partner ? ` · ${w.full}` : ''}</span></div>
      <div class="bond-card__next">${this.state.partner ? w.partner : next ? w.next(next.at - p, next) : ''}</div>
      <ol class="bond-card__steps">${STAGES.map((x) => `<li class="${p >= x.at || (x.id === 'partner' && this.state.partner) ? 'is-on' : ''}${x.id === s.id ? ' is-now' : ''}">${w.stage(x)}</li>`).join('')}</ol>
      <div class="bond-card__tip">${w.tip}${this.state.capped ? `<br><b>${w.capped}</b>` : ''}</div>
      <div class="bond-card__flirt-title">${w.flirt}</div>
      <div class="bond-card__flirt"></div>`;
    const lines = [...(this.chat.brain?.lang === 'th' ? FLIRT_TH : FLIRT)].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const line of lines) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = line;
      b.addEventListener('click', () => {
        this.close();
        if (this.panel.current?.chat) this.chat.send(line);
        else this.chat.start().then(() => this.chat.send(line));
      });
      card.querySelector('.bond-card__flirt').append(b);
    }
    card.querySelector('.bond-x').addEventListener('click', () => this.close());
    document.body.append(card);
    this.card = card;
    const at = this.button.getBoundingClientRect();
    card.style.left = `${Math.max(8, Math.min(at.left, innerWidth - card.offsetWidth - 8))}px`;
    const above = at.top - card.offsetHeight - 8;
    card.style.top = `${above >= 8 ? above : Math.min(at.bottom + 8, innerHeight - card.offsetHeight - 8)}px`;
    this.outside = (e) => { if (!card.contains(e.target) && !this.button.contains(e.target)) this.close(); };
    setTimeout(() => document.addEventListener('pointerdown', this.outside), 0);
  }

  close() {
    this.card?.remove();
    this.card = null;
    if (this.outside) document.removeEventListener('pointerdown', this.outside);
    this.outside = null;
  }
}
