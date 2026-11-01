// The transmission panel next to Capri, and the one-line ticker she wears while Claude works.

import { clamp, ease, reducedMotion } from './util.js';

const NOISE = '▚▞▙▟░▒#%&/\\<>01XZ';

// Her faces, frames of her from the show (tools/build-cutins.py). A message can ask for one;
// otherwise it goes with what kind of message it is.
const FACE_DIR = '../../assets/capri/';
// her clips in her picture (setLive): her dance, and her close-up talking to you
const LIVE_CLIPS = ['face-live.webm', 'face-live2.webm'];
export const FACES = {
  calm: 'face-calm.png',   // watching, mouth shut
  aside: 'face-aside.png', // turned away: a sigh, thinking
  smug: 'face-smug.png',   // the fang grin, head cocked
  wide: 'face-wide.png',   // eyes gone round: surprised
  look: 'face-look.png',   // looking right at you
  laugh: 'face-laugh.png', // mouth wide open
  many: 'face-many.png',   // all her eyes on you
  blush: 'face-blush.png', // flustered, a peace sign: you got to her (bond.js)
  tease: 'face-tease.png', // the sharp-toothed grin, side-eye: teasing you, a joke on you
  grin: 'capri-face.png',
};
const KIND_FACE = { alert: 'many', done: 'look', error: 'laugh', work: 'calm', idle: 'calm', report: 'smug', chat: 'look' };
const PRIORITY = { info: 1, idle: 1, work: 2, done: 3, error: 3, report: 3, chat: 3, alert: 4 };
const DECODE_STEP_MS = 28;
const COUNT_MS = 700; // her report's numbers counting up

// one line of code, escaped and coloured by kind (her code mode's live view)
const PAINT = /(\/\/.*$|#\s.*$|<!--.*?-->|\/\*.*?\*\/)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b\d+(?:\.\d+)?\b)|(\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|from|async|await|try|catch|finally|throw|this|true|false|null|undefined|typeof|of|in|def|self|None|True|False|elif|local|end|then)\b)|(<\/?[a-zA-Z][\w-]*|\/?>(?!=))/gm;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function paint(line) {
  let out = '';
  let last = 0;
  for (const m of line.matchAll(PAINT)) {
    out += esc(line.slice(last, m.index));
    const kind = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : m[4] ? 'k' : 't';
    out += `<span class="${kind}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(line.slice(last));
}

// a picture you sent, big over everything until you click
export function showBig(src) {
  const box = document.createElement('div');
  box.className = 'pic-big';
  box.innerHTML = '<img alt="">';
  box.querySelector('img').src = src;
  box.addEventListener('click', (e) => { e.stopPropagation(); box.remove(); });
  document.body.append(box);
}

export class Panel {
  constructor({ panel, ticker, labels }) {
    this.el = panel;
    this.tickerEl = ticker;
    this.labels = labels;
    this.line = panel.querySelector('.panel__line');
    this.stopStream(); // her chat answer, decoding in (stream)
    this.streamTo = [];
    this.portrait = panel.querySelector('.panel__face img');
    this.quote = panel.querySelector('.panel__quote');
    this.progress = panel.querySelector('.panel__progress');
    this.bar = panel.querySelector('.panel__bar');
    this.reply = panel.querySelector('.panel__reply');
    this.report = panel.querySelector('.panel__report');
    this.actions = panel.querySelector('.panel__actions');
    this.onAction = null; // (id) => void, a button of the message was clicked
    this.onDismiss = null; // (message) => void, a message left: closed, timed out or replaced
    this.summary = panel.querySelector('.panel__summary');
    this.log = panel.querySelector('.panel__log');
    this.tag = panel.querySelector('.panel__tag');
    this.state = panel.querySelector('.panel__state');
    this.tickerVerb = ticker.querySelector('.ticker__verb');
    this.tickerTarget = ticker.querySelector('.ticker__target');
    this.current = null;
    this.hideTimer = null;
    this.decodeTimer = null;
    this.anchor = { x: 0, y: 0, side: 1 };
    this.view = { w: innerWidth, h: innerHeight };
    this.onChar = null;    // (mood) => void, for the voice blips
    this.onTalk = null;    // (talking: boolean) => void
    this.suspended = false;
    this.tickerAction = null;
    this.tickerShownAt = 0;
    this.tickerTimer = null;
    this.missed = null; // a Claude message that came while you were chatting with her, shown after

    // talking to her (chat.js): a line to type in, under her answer
    this.chatForm = panel.querySelector('.panel__chat');
    this.chatInput = panel.querySelector('.panel__input');
    this.chatSend = panel.querySelector('.panel__send');
    this.chatMic = panel.querySelector('.panel__mic');
    this.chatAttach = panel.querySelector('.panel__attach');
    this.files = panel.querySelector('.panel__files');
    this.preview = panel.querySelector('.panel__preview');
    this.chatClose = panel.querySelector('.panel__close');
    this.note = panel.querySelector('.panel__note');
    this.chatForm.addEventListener('click', (e) => e.stopPropagation());
    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.chatInput.value.trim();
      if ((!text && !this.attach?.count) || this.chatInput.disabled) return;
      this.chatInput.value = '';
      this.current?.onSend?.(text);
    });
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
    this.chatClose.addEventListener('click', () => this.hide());

    this.el.addEventListener('click', () => {
      if (this.current?.chat) this.chatInput.focus(); // a chat stays until you close it
      else this.hide();
    });
    this.portrait.addEventListener('animationend', (e) => {
      if (e.animationName === 'face-swap') this.portrait.classList.remove('is-swapping');
    });
  }

  get visible() {
    return !this.el.hidden && !this.suspended && !this.leaving;
  }

  // Message: { kind, line, tag, quote, reply, summary, log: [{verb, target, error}], actions, guide,
  //            hold (ms | null for sticky) }
  // reply: Claude's whole answer, in a block that scrolls
  // actions: buttons, [{ id, label, primary }]; clicking one calls the message's onAction(id),
  //          or the panel's
  // guide: the quote is an explanation, shown whole
  // badge: the word in the corner, instead of the one for its kind
  // face: her expression (a key of FACES), instead of the one for its kind
  // report: her report card, { date, hero: { value, label }, stats: [{ value, label, hot }],
  //         longest: { label, project, time }, foot }
  // chat: a line to type to her, { placeholder, send, close, noteTag, note, secret }; onSend(text)
  //       gets what you typed (secret: hidden as you type, a key)
  // progress: a bar under the line, 0..1 (a download)
  // onLeave: () => void, when this message goes (closed, timed out or replaced)
  say(msg) {
    const cur = this.current;
    // her chat stays open while she watches: what Claude Code is up to goes in a strip over it
    // (a permission prompt still comes first: it needs you)
    if (cur?.chat && this.visible && !msg.chat && !msg.guide && PRIORITY[msg.kind] < 4) {
      this.watchStrip(msg);
      return true;
    }
    if (!msg.chat) this.watchStrip(null);
    // don't step on something more important that just appeared (one step of her guide follows another)
    const steps = cur?.guide && msg.guide;
    if (cur && this.visible && !steps && cur.kind !== msg.kind && PRIORITY[cur.kind] > PRIORITY[msg.kind] && performance.now() - cur.at < 2600) {
      return false;
    }
    // nor on something you may be reading: an answer, her report (progress lines don't knock it off)
    if (cur?.reply && this.visible && PRIORITY[msg.kind] < 2) return false;
    if (cur?.report && this.visible && PRIORITY[msg.kind] < 3) return false;
    // nor on a chat with her: only a permission prompt breaks in; Claude finishing waits until after
    // (even while she teleports and the panel is put aside for a moment). Her setup's panels with a
    // line to type in (a key) aren't a chat: its next step follows them.
    if (cur?.chat && !cur.guide && !this.el.hidden && !this.leaving && PRIORITY[msg.kind] < 4) {
      if (PRIORITY[msg.kind] >= 3) this.missed = { ...msg, missedAt: performance.now() };
      return false;
    }
    if (cur && this.visible) this.onDismiss?.(cur);
    cur?.onLeave?.();
    this.current = { ...msg, at: performance.now() };
    clearTimeout(this.hideTimer);

    this.el.dataset.kind = msg.kind;
    this.setFace(msg.face || KIND_FACE[msg.kind] || 'grin');
    this.tag.textContent = msg.tag || '';
    this.renderTagMenu(msg.tagMenu);
    this.setPics(msg.pics || []); // the chat's pictures stay with the chat
    this.setCodeLive(null);
    this.state.textContent = msg.badge || this.labels.state[msg.kind] || '';
    this.quote.textContent = msg.quote || '';
    this.quote.hidden = !msg.quote;
    this.setProgress(msg.progress);
    this.reply.textContent = msg.reply || '';
    this.reply.hidden = !msg.reply;
    this.reply.scrollTop = 0;
    this.el.classList.toggle('has-reply', Boolean(msg.reply));
    this.el.classList.toggle('has-report', Boolean(msg.report));
    this.el.classList.toggle('is-guide', Boolean(msg.guide));
    this.renderReport(msg.report);
    this.renderActions(msg.actions, msg.onAction);
    this.renderChat(msg.chat);
    this.summary.textContent = msg.summary || '';
    this.summary.hidden = !msg.summary;
    this.renderLog(msg.log || []);

    this.tickerEl.hidden = true;
    this.leaving = false;
    this.el.hidden = false;
    this.el.classList.remove('is-leaving');
    this.replayEnter();
    this.place();
    this.decode(msg.line || '', msg.kind);

    if (msg.hold) this.hideTimer = setTimeout(() => this.hide(), msg.hold);
    return true;
  }

  // The tag in her header as a picker: { load, onProvider, onPick }. Click it and the providers and
  // the models open under the header (like her tray menu); picking changes the tag in place.
  renderTagMenu(menu) {
    this.tagList?.remove();
    this.tagList = null;
    this.tag.classList.toggle('is-pick', Boolean(menu));
    this.tag.onclick = null;
    if (!menu) return;
    const short = (name) => name.replace(/:latest$/, '').replace(/^models\//, '');
    const close = () => { this.tagList?.remove(); this.tagList = null; };
    const fill = (box, { providers = [], provider, list = [], current }) => {
      const row = (label, on, click) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.classList.toggle('is-on', on);
        b.onclick = click;
        return b;
      };
      const rule = document.createElement('hr');
      box.replaceChildren(
        ...providers.map((p) => row(p.label, p.id === provider, async () => {
          box.classList.add('is-busy');
          const next = await menu.onProvider(p.id).catch(() => null);
          box.classList.remove('is-busy');
          if (!next || !this.tagList) return;
          if (next.current) this.tag.textContent = short(next.current);
          fill(box, next);
        })),
        rule,
        ...list.map((name) => row(name, name === current, () => {
          this.tag.textContent = short(name);
          close();
          menu.onPick(name);
        })),
      );
    };
    this.tag.onclick = async () => {
      if (this.tagList) return close();
      const data = await menu.load().catch(() => null);
      if (!data || this.current?.tagMenu !== menu || this.tagList) return;
      const box = document.createElement('div');
      box.className = 'panel__models';
      fill(box, data);
      this.tagList = box;
      this.tag.parentElement.after(box);
    };
  }

  // Code being written, shown as it comes (her code mode): the last lines of the file, coloured a
  // little (comments, strings, numbers, keywords); null hides it.
  setCodeLive(code, name = '') {
    let box = this.el.querySelector('.panel__codelive');
    if (code == null) return box?.remove();
    if (!box) {
      box = document.createElement('div');
      box.className = 'panel__codelive';
      box.innerHTML = '<div class="panel__codelive-name"></div><pre></pre>';
      this.line.after(box);
    }
    box.querySelector('.panel__codelive-name').textContent = name;
    const lines = code.split('\n');
    const from = Math.max(0, lines.length - 40);
    const pre = box.querySelector('pre');
    pre.innerHTML = lines.slice(from).map((l, i) => `<span class="ln">${from + i + 1}</span>${paint(l)}`).join('\n');
    pre.scrollTop = pre.scrollHeight;
    this.place();
  }

  // The strip over her chat with what she is watching ("RUNNING · PC · Claude has been working…");
  // null takes it away. Done and error lines fade after a while, work lines stay until the next.
  watchStrip(msg) {
    clearTimeout(this.watchTimer);
    let strip = this.el.querySelector('.panel__watch');
    if (!msg) return strip?.remove();
    if (!strip) {
      strip = document.createElement('div');
      strip.className = 'panel__watch';
      strip.innerHTML = '<b></b><span class="w-tag"></span><span class="w-line"></span>';
      this.el.querySelector('.panel__body').prepend(strip);
    }
    strip.dataset.kind = msg.kind;
    strip.querySelector('b').textContent = msg.badge || this.labels.state[msg.kind] || msg.kind;
    strip.querySelector('.w-tag').textContent = msg.tag || '';
    strip.querySelector('.w-line').textContent = msg.line || msg.summary || '';
    strip.title = [msg.line, msg.summary, msg.quote].filter(Boolean).join('\n');
    this.place();
    if (msg.kind !== 'work') this.watchTimer = setTimeout(() => { strip.remove(); this.place(); }, Math.max(msg.hold || 0, 12000));
  }

  // Code mode's project in her header ("</> snake-game"); null takes it away.
  setCodeTag(name) {
    let chip = this.el.querySelector('.panel__code');
    if (!name) return chip?.remove();
    if (!chip) {
      chip = document.createElement('span');
      chip.className = 'panel__code';
      this.tag.after(chip);
    }
    chip.textContent = '</> ' + name;
  }

  // The pictures you sent with your message, as thumbnails under it; a click shows one big.
  setPics(pics = []) {
    let strip = this.el.querySelector('.panel__pics');
    if (!pics.length) { strip?.remove(); return; }
    if (!strip) {
      strip = document.createElement('div');
      strip.className = 'panel__pics';
      this.quote.after(strip);
    }
    strip.replaceChildren(...pics.map((src) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.addEventListener('click', (e) => { e.stopPropagation(); showBig(src); });
      return img;
    }));
    this.place();
  }

  // The bar under her line (a download), 0..1; nothing hides it.
  setProgress(k) {
    this.progress.hidden = typeof k !== 'number';
    if (!this.progress.hidden) this.bar.style.transform = `scaleX(${clamp(k, 0, 1).toFixed(3)})`;
  }

  // The quote under her line, changed in place (how far a download is), without a new message.
  setQuote(text) {
    if (!this.current) return;
    this.current.quote = text;
    this.quote.textContent = text || '';
    this.quote.hidden = !text;
    this.place();
  }

  // Change her expression; the swap glitches across a couple of drawings.
  // Her moving picture (a clip of her, looping) in place of her face while she thinks or speaks:
  // setLive('think' | 'speak', on). Her blushing face wins over it.
  setLive(reason, on) {
    this.live ??= new Set();
    if (on) this.live.add(reason); else this.live.delete(reason);
    this.refreshLive();
  }

  refreshLive() {
    const show = !this.character && Boolean(this.live?.size) && !this.portrait.getAttribute('src').endsWith(FACES.blush) && !reducedMotion.matches;
    if (show && !this.liveVideo) {
      const v = document.createElement('video');
      v.className = 'panel__live';
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      this.portrait.after(v);
      this.liveVideo = v;
    }
    const v = this.liveVideo;
    if (!v) return;
    // which clip, each time it comes on: thinking, her dance; speaking, one of her clips at random
    if (show && !v.classList.contains('is-on')) {
      const clip = this.live.has('speak') ? LIVE_CLIPS[Math.floor(Math.random() * LIVE_CLIPS.length)] : LIVE_CLIPS[0];
      if (!v.src.endsWith(clip)) v.src = FACE_DIR + clip;
      v.currentTime = 0;
    }
    v.classList.toggle('is-on', show);
    if (show) v.play().catch(() => {}); else v.pause();
  }

  // A character of yours in place of Capri: its name on the panel, its faces (a missing one: its
  // grin, look or any other, else its body picture), and no clips of Capri.
  setCharacter({ name, faces, body }) {
    this.character = { faces, fallback: faces.grin || faces.look || faces.calm || Object.values(faces)[0] || body };
    const who = this.el.querySelector('.panel__who');
    if (who) who.textContent = name;
    this.portrait.setAttribute('src', this.character.fallback);
  }

  setFace(name) {
    const src = this.character
      ? this.character.faces[name] || this.character.fallback
      : FACE_DIR + (FACES[name] || FACES.grin);
    if (this.portrait.getAttribute('src') === src) return;
    this.portrait.setAttribute('src', src);
    this.refreshLive();
    if (reducedMotion.matches) return;
    this.portrait.classList.remove('is-swapping');
    void this.portrait.offsetWidth; // restart the animation
    this.portrait.classList.add('is-swapping');
  }

  // Her report card: today's big number, three smaller ones, the longest mission, a footer.
  // The numbers count up on twos, like her animation.
  renderReport(report) {
    clearInterval(this.countTimer);
    this.report.hidden = !report;
    if (!report) {
      this.report.replaceChildren();
      return;
    }
    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const number = (className, value) => {
      const node = el('b', className, '0');
      node.dataset.value = value;
      return node;
    };
    const head = el('header', 'report__head');
    head.append(el('span', 'report__title', this.labels.report.title), el('span', 'report__date', report.date));
    const hero = el('div', 'report__hero');
    hero.append(number('report__big', report.hero.value), el('span', 'report__label', report.hero.label));
    const grid = el('dl', 'report__grid');
    for (const stat of report.stats) {
      const cell = el('div', stat.hot ? 'report__cell is-hot' : 'report__cell');
      const value = el('dd');
      value.append(number('report__num', stat.value));
      cell.append(el('dt', 'report__label', stat.label), value);
      grid.append(cell);
    }
    const parts = [head, hero, grid];
    if (report.longest) {
      const longest = el('p', 'report__longest');
      longest.append(el('span', 'report__chip', report.longest.label), el('span', 'report__project', report.longest.project), el('b', 'report__time', report.longest.time));
      parts.push(longest);
    }
    const foot = el('footer', 'report__foot');
    foot.append(el('span', '', report.foot), el('span', 'report__sign', 'CAPRI // PROJECT CAPRICORN'));
    parts.push(foot);
    this.report.replaceChildren(...parts);

    const numbers = [...this.report.querySelectorAll('[data-value]')];
    const show = (node, k) => {
      node.textContent = Math.round(Number(node.dataset.value) * k).toLocaleString(document.documentElement.lang);
    };
    if (reducedMotion.matches) {
      numbers.forEach((node) => show(node, 1));
      return;
    }
    const t0 = performance.now();
    const step = () => {
      let counting = false;
      numbers.forEach((node, i) => {
        const k = clamp((performance.now() - t0 - 180 - i * 70) / COUNT_MS, 0, 1);
        show(node, ease.out(k));
        if (k < 1) counting = true;
      });
      if (!counting) clearInterval(this.countTimer);
    };
    step();
    this.countTimer = setInterval(step, 1000 / 12);
  }

  renderActions(actions = [], onAction = null) {
    this.actions.replaceChildren(...actions.map(({ id, label, primary }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = primary ? 'panel__action is-primary' : 'panel__action';
      button.dataset.id = id;
      button.textContent = label;
      button.addEventListener('click', (e) => {
        e.stopPropagation(); // a click on the panel itself closes it
        if (onAction) onAction(id);
        else this.onAction?.(id);
      });
      return button;
    }));
    this.actions.hidden = !actions.length;
  }

  // New buttons on the message on screen (in a chat: the app she offers to close), or none.
  setActions(actions, onAction) {
    if (!this.current) return;
    this.current.actions = actions;
    this.renderActions(actions, onAction);
    this.place();
  }

  renderChat(chat) {
    this.el.classList.toggle('is-chat', Boolean(chat));
    this.line.classList.remove('is-streaming');
    this.chatForm.hidden = !chat;
    this.note.hidden = !chat?.note;
    if (!chat) return;
    this.chatInput.type = chat.secret ? 'password' : 'text';
    this.chatInput.placeholder = chat.placeholder;
    this.chatInput.setAttribute('aria-label', chat.placeholder);
    this.chatInput.disabled = false;
    this.chatSend.disabled = false;
    this.chatSend.textContent = chat.send;
    this.chatClose.setAttribute('aria-label', chat.close);
    if (chat.note) {
      const tag = document.createElement('b');
      tag.textContent = chat.noteTag || '';
      this.note.replaceChildren(...(chat.noteTag ? [tag, ' '] : []), chat.note);
    }
    requestAnimationFrame(() => this.chatInput.focus());
  }

  // A chat turn: what you said goes up top, her answer starts coming in under it (stream), without
  // announcing the panel all over again.
  chatTurn({ quote, face, pics = [] }) {
    if (!this.current?.chat) return;
    clearInterval(this.decodeTimer);
    this.stopStream();
    this.setFace(face);
    this.quote.textContent = quote;
    this.quote.hidden = !quote;
    this.setPics(pics);
    this.line.textContent = '';
    this.line.classList.add('is-streaming');
    this.place();
  }

  // Her answer so far (done: all of it). It decodes in through noise like her other lines, catching
  // up faster the further behind it is (Claude Code's answer comes in one piece), and glitches once done.
  stream(text, { done = false } = {}) {
    if (!this.current?.chat) return;
    this.streamTo = [...text];
    this.streamDone = done;
    // an answer rewritten rather than added to (a reasoning block cut out, an error): from where they part
    let same = 0;
    const max = Math.min(this.streamShown, this.streamTo.length);
    while (same < max && this.streamTo[same] === this.streamAt[same]) same++;
    this.streamShown = same;
    if (reducedMotion.matches) {
      this.streamShown = this.streamTo.length;
      return this.streamStep();
    }
    this.streamTimer ??= setInterval(() => this.streamStep(), DECODE_STEP_MS);
  }

  streamStep() {
    const chars = this.streamTo;
    const behind = chars.length - this.streamShown;
    this.streamShown += Math.min(behind, Math.max(2, Math.ceil(behind / 14)));
    this.streamAt = chars.slice(0, this.streamShown);
    const caughtUp = this.streamShown >= chars.length;
    if (caughtUp && this.streamDone) {
      this.stopStream();
      this.line.textContent = chars.join('');
      this.line.classList.remove('is-streaming');
      this.glitchLine();
    } else {
      // noise where the next characters land; still waiting for more, a little static at the end
      let tail = '';
      for (let i = 0; i < (caughtUp ? 2 : Math.min(6, behind)); i++) {
        tail += chars[this.streamShown + i] === ' ' ? ' ' : NOISE[Math.floor(Math.random() * NOISE.length)];
      }
      this.line.textContent = this.streamAt.join('') + tail;
      this.line.classList.add('is-streaming');
    }
    this.line.scrollTop = this.line.scrollHeight;
    this.place();
  }

  stopStream() {
    clearInterval(this.streamTimer);
    this.streamTimer = null;
    this.streamShown = 0;
    this.streamAt = [];
  }

  // a jolt through her finished answer: split colours, slices knocked sideways
  glitchLine() {
    if (reducedMotion.matches) return;
    this.line.classList.remove('is-glitching');
    void this.line.offsetWidth; // restart the CSS animation
    this.line.classList.add('is-glitching');
  }

  // While she answers you can't send another.
  setChatBusy(busy) {
    this.setLive('think', busy); // her clip while the answer is on its way
    this.chatInput.disabled = busy;
    this.chatSend.disabled = busy;
    if (!busy && this.current?.chat) this.chatInput.focus();
  }

  // A button of the message on screen says something else now ("Copied").
  relabel(id, label) {
    const button = this.actions.querySelector(`[data-id="${id}"]`);
    if (button) button.textContent = label;
  }

  // A picture of the panel as it is (her report card), handed to `copy` as a rect of the overlay:
  // on a dark plate of its own, without its buttons, so it reads anywhere it's pasted.
  async snapshot(copy) {
    this.el.classList.add('is-capturing');
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    await frame();
    const r = this.el.getBoundingClientRect();
    const pad = 18;
    const rect = {
      x: Math.max(0, Math.floor(r.left - pad)),
      y: Math.max(0, Math.floor(r.top - pad)),
      width: Math.ceil(r.width + pad * 2 + 6), // + her violet shadow
      height: Math.ceil(r.height + pad * 2 + 6),
    };
    const plate = document.createElement('div');
    plate.className = 'snap-plate';
    Object.assign(plate.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    document.body.append(plate);
    await frame();
    await frame();
    try {
      return await copy(rect);
    } finally {
      plate.remove();
      this.el.classList.remove('is-capturing');
    }
  }

  // Refresh the log of the message on screen without re-announcing it.
  updateLog(log) {
    if (this.current && this.visible) this.renderLog(log);
  }

  renderLog(entries) {
    this.log.replaceChildren(...entries.slice(-4).map((e) => {
      const li = document.createElement('li');
      if (e.error) li.className = 'is-error';
      const verb = document.createElement('span');
      verb.className = 'panel__verb';
      verb.textContent = e.verb;
      const target = document.createElement('span');
      target.className = 'panel__target';
      target.textContent = e.target || '';
      li.append(verb, target);
      return li;
    }));
    this.log.hidden = entries.length === 0;
  }

  hide() {
    clearTimeout(this.hideTimer);
    clearInterval(this.decodeTimer);
    this.stopStream();
    this.onTalk?.(false);
    this.attach?.clear();
    if (this.el.hidden || this.leaving) return;
    const gone = this.current;
    this.current = null;
    this.leaving = true;
    if (gone) {
      this.onDismiss?.(gone);
      gone.onLeave?.();
    }
    // what Claude said while you were talking with her, now that you're done
    const missed = gone?.chat && this.missed;
    this.missed = null;
    if (missed && performance.now() - missed.missedAt < 120000) setTimeout(() => this.say(missed), 400);
    if (reducedMotion.matches) {
      this.el.hidden = true;
    } else {
      this.el.classList.add('is-leaving');
      setTimeout(() => {
        if (this.leaving) this.el.hidden = true;
      }, 150);
    }
    // back to the ticker if Claude is still busy
    if (this.tickerAction) this.setTicker(this.tickerAction);
  }

  // Only drop a sticky alert (permission prompt) once it has been dealt with.
  clearKind(kind) {
    if (this.current?.kind === kind) this.hide();
  }

  suspend() {
    this.suspended = true;
    this.el.style.visibility = 'hidden';
    this.tickerEl.style.visibility = 'hidden';
  }

  resume() {
    this.suspended = false;
    this.el.style.visibility = '';
    this.tickerEl.style.visibility = '';
    this.place();
    if (!this.el.hidden) this.replayEnter();
  }

  replayEnter() {
    this.el.classList.remove('is-entering');
    void this.el.offsetWidth; // restart the CSS animation
    this.el.classList.add('is-entering');
  }

  decode(text, kind) {
    clearInterval(this.decodeTimer);
    if (reducedMotion.matches || !text) {
      this.line.textContent = text;
      return;
    }
    const chars = [...text];
    let done = 0;
    this.onTalk?.(true);
    const step = () => {
      done = Math.min(chars.length, done + 2);
      const head = chars.slice(0, done).join('');
      let tail = '';
      for (let i = done; i < Math.min(chars.length, done + 6); i++) {
        tail += chars[i] === ' ' ? ' ' : NOISE[Math.floor(Math.random() * NOISE.length)];
      }
      this.line.textContent = head + tail;
      if (chars[done - 1] && chars[done - 1] !== ' ') this.onChar?.(kind);
      if (done >= chars.length) {
        clearInterval(this.decodeTimer);
        this.line.textContent = text;
        this.onTalk?.(false);
      }
    };
    step();
    this.decodeTimer = setInterval(step, DECODE_STEP_MS);
  }

  // Ticker: "▸ Modifie  main.js" floating over her head while Claude works.
  // Throttled so a burst of tool calls reads as a flicker of activity, not noise.
  setTicker(action) {
    this.tickerAction = action;
    clearTimeout(this.tickerTimer);
    if (!action || this.visible) {
      this.tickerEl.hidden = true;
      return;
    }
    const wait = Math.max(0, 380 - (performance.now() - this.tickerShownAt));
    this.tickerTimer = setTimeout(() => {
      // Claude thinking: the seconds counting up don't flash each time, only the first one does
      const counting = action.thinking && this.tickerEl.dataset.thinking === 'true' && !this.tickerEl.hidden;
      this.tickerShownAt = performance.now();
      this.tickerVerb.textContent = action.verb;
      this.tickerTarget.textContent = action.target || '';
      this.tickerEl.dataset.error = action.error ? 'true' : 'false';
      this.tickerEl.dataset.thinking = action.thinking ? 'true' : 'false';
      this.tickerEl.hidden = false;
      if (!counting) {
        this.tickerEl.classList.remove('is-flash');
        void this.tickerEl.offsetWidth;
        this.tickerEl.classList.add('is-flash');
      }
      this.place();
    }, wait);
  }

  setAnchor(anchor, view) {
    this.anchor = anchor;
    this.view = view;
    this.place();
  }

  // Sit on the tips of her mane, leaning toward the middle of the screen; tail points at her.
  place() {
    const { x, y, top: crown = y - 80, lean = 0 } = this.anchor;
    const { w } = this.view;
    const margin = 14;
    // lean: the side she wants it on (away from what she's pointing at), else toward the middle
    const towardLeft = lean ? lean < 0 : x > w / 2;

    if (!this.el.hidden) {
      const pw = this.el.offsetWidth;
      const ph = this.el.offsetHeight;
      let left = towardLeft ? x - pw + 46 : x - 46;
      left = clamp(left, margin, w - pw - margin);
      let top = crown - ph + 14;
      let below = false;
      if (top < margin) {
        top = y + 40;
        below = true;
      }
      if (this.view.h) top = clamp(top, margin, this.view.h - ph - margin); // a tall one (an answer) stays on screen
      this.el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
      this.el.style.setProperty('--tail-x', `${clamp(x - left, 24, pw - 24)}px`);
      this.el.dataset.below = below ? 'true' : 'false';
    }

    if (!this.tickerEl.hidden) {
      const tw = this.tickerEl.offsetWidth;
      const left = clamp(x - tw / 2, margin, w - tw - margin);
      const top = Math.max(margin, crown - this.tickerEl.offsetHeight - 10);
      this.tickerEl.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    }
  }

  rect() {
    if (this.el.hidden || this.suspended) return null;
    return this.el.getBoundingClientRect();
  }
}
