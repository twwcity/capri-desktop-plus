// Her voice, both ways, offline (main/voice.js): the mic button in her chat panel (Whisper writes down
// what you say, then it is sent like typed text) and her answers read aloud (Piper).

const RATE = 16000;
const SILENCE_MS = 1800;   // quiet this long after you spoke: you're done (Thai has long pauses)
const MAX_MS = 30000;
const LEVEL = 0.006;       // RMS above this counts as speech, at least; above the room's own noise too
const CALIBRATE_MS = 350;  // the room, listened to first

// what goes to Whisper: the silence before and after cut off (a little kept), the voice brought up to a
// steady level (a quiet mic is the first reason it hears wrong)
function tidy(samples) {
  const win = 320; // 20 ms
  const rms = (i) => { let n = 0; for (let k = i; k < i + win && k < samples.length; k++) n += samples[k] * samples[k]; return Math.sqrt(n / win); };
  let floor = Infinity;
  for (let i = 0; i < Math.min(samples.length, RATE / 2); i += win) floor = Math.min(floor, rms(i));
  const gate = Math.max(LEVEL, floor * 3);
  let a = 0;
  let b = samples.length;
  while (a < b && rms(a) < gate) a += win;
  while (b > a && rms(Math.max(0, b - win)) < gate) b -= win;
  const pad = RATE * 0.25;
  const out = samples.slice(Math.max(0, a - pad), Math.min(samples.length, b + pad));
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? Math.min(8, 0.9 / peak) : 1;
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  return out;
}

const wav = (samples) => {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return buf;
};

// what is worth saying aloud: no tags, markup or code, and only text the English voice can read
const speakable = (text) => {
  const t = String(text).replace(/\[\[[^\]]*\]\]/g, ' ').replace(/```[\s\S]*?```/g, ' ').replace(/[*_`#>~]/g, '')
    .replace(/https?:\/\/\S+/g, ' ').replace(/[^\p{L}\p{M}\p{N}\p{P}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const letters = t.match(/\p{L}/gu) || [];
  const latin = letters.filter((c) => /[A-Za-zÀ-ſ]/.test(c)).length;
  // the scripts she has a voice for: Latin, Thai, Japanese, Chinese, Korean
  const voiced = letters.filter((c) => /[฀-๿぀-ヿ一-鿿가-힯]/.test(c)).length;
  return letters.length && (latin + voiced) / letters.length > 0.8 ? t : '';
};

export class Talk {
  constructor({ host, panel, voice, config }) {
    this.host = host;
    this.panel = panel;
    this.voice = voice;
    this.config = config; // () => current config
    this.rec = null;
    this.playing = null;
    host.voiceInfo().then((info) => {
      this.info = info;
      panel.chatMic.hidden = !info.stt;
      if (info.stt) this.listDevices();
    }).catch(() => {});
    navigator.mediaDevices.addEventListener?.('devicechange', () => this.listDevices());
    panel.chatMic.addEventListener('click', () => (this.rec ? this.stop() : this.start()));
    // her chat's line: what you said goes in it and is sent
    this.chatTarget = {
      mic: panel.chatMic,
      input: panel.chatInput,
      submit: (text) => { panel.chatInput.value = text; panel.chatForm.requestSubmit(); },
    };
  }

  // 8-bit blips: up when she starts listening, down when she stops
  blip(up) {
    try {
      const ctx = this.voice.ensure();
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime + 0.01;
      const notes = up ? [660, 990] : [990, 520];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(f, t + i * 0.075);
        g.gain.setValueAtTime(0.0001, t + i * 0.075);
        g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.075 + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.075 + 0.07);
        o.connect(g).connect(this.voice.master);
        o.start(t + i * 0.075);
        o.stop(t + i * 0.075 + 0.08);
      });
    } catch { /* no sound: still listens */ }
  }

  // target: where what you say goes ({ mic, input, submit(text) }), her chat by default
  async start(target = this.chatTarget) {
    this.stopSpeaking();
    this.blip(true);
    await new Promise((r) => setTimeout(r, 170)); // the blip, not in the recording
    let stream;
    try {
      stream = await this.openMic();
    } catch (err) {
      target.input.placeholder = 'No microphone access';
      return;
    }
    const ctx = new AudioContext({ sampleRate: RATE });
    const node = ctx.createScriptProcessor(4096, 1, 1);
    const chunks = [];
    const rec = { stream, ctx, node, chunks, heard: false, quietSince: 0, startedAt: performance.now(), placeholder: target.input.placeholder, noise: [], level: LEVEL, target };
    node.onaudioprocess = (e) => {
      const data = new Float32Array(e.inputBuffer.getChannelData(0));
      chunks.push(data);
      let sum = 0;
      for (const s of data) sum += s * s;
      const level = Math.sqrt(sum / data.length);
      const now = performance.now();
      if (now - rec.startedAt < CALIBRATE_MS) { // the room first: speech is well above it
        rec.noise.push(level);
        rec.level = Math.max(LEVEL, Math.min(0.05, Math.min(...rec.noise) * 3.5));
        return;
      }
      const loud = level > rec.level;
      if (loud) { rec.heard = true; rec.quietSince = now; }
      else if (!rec.quietSince) rec.quietSince = now;
      if ((rec.heard && now - rec.quietSince > SILENCE_MS) || now - rec.startedAt > MAX_MS) this.stop();
    };
    const source = ctx.createMediaStreamSource(stream);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node);
    node.connect(mute).connect(ctx.destination);
    this.rec = rec;
    target.mic.classList.add('is-listening');
    target.input.placeholder = 'Listening…';
  }

  // her menu's microphone list: the names only show once the microphone was opened, so it is, for a moment
  async listDevices() {
    try {
      let all = await navigator.mediaDevices.enumerateDevices();
      if (all.some((d) => d.kind === 'audioinput' && !d.label)) {
        (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop());
        all = await navigator.mediaDevices.enumerateDevices();
      }
      this.host.voiceDevices(all.filter((d) => d.kind === 'audioinput' && !/^(default|communications)/i.test(d.label) && !/cable|virtual|stereo mix/i.test(d.label)).map((d) => d.label));
    } catch { /* no microphone */ }
  }

  // The default microphone is sometimes a dead one (a USB mic nobody uses, a virtual cable) and gives pure
  // silence: if so, the input that actually has a signal is used instead.
  async openMic() {
    const audio = (deviceId) => ({ audio: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    const chosen = devices.find((d) => d.label && d.label === this.config().mic);
    if (chosen) return navigator.mediaDevices.getUserMedia(audio(chosen.deviceId)); // the one picked in her menu
    const probe = async (deviceId) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(audio(deviceId));
        const ctx = new AudioContext({ sampleRate: RATE });
        const node = ctx.createScriptProcessor(2048, 1, 1);
        let peak = 0;
        node.onaudioprocess = (e) => { for (const v of e.inputBuffer.getChannelData(0)) peak = Math.max(peak, Math.abs(v)); };
        const mute = ctx.createGain();
        mute.gain.value = 0;
        ctx.createMediaStreamSource(stream).connect(node);
        node.connect(mute).connect(ctx.destination);
        await new Promise((r) => setTimeout(r, 600));
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
        return { deviceId, peak };
      } catch {
        return { deviceId, peak: 0 };
      }
    };
    const results = await Promise.all(devices.filter((d) => !/cable|virtual|stereo mix/i.test(d.label)).map((d) => probe(d.deviceId)));
    const def = results.find((r) => r.deviceId === 'default');
    const live = def && def.peak > 1e-4 ? def : results.sort((a, b) => b.peak - a.peak)[0];
    return navigator.mediaDevices.getUserMedia(audio(live && live.peak > 1e-4 ? live.deviceId : null));
  }
  async stop() {
    const rec = this.rec;
    if (!rec) return;
    this.rec = null;
    rec.node.disconnect();
    rec.stream.getTracks().forEach((t) => t.stop());
    rec.ctx.close();
    this.blip(false);
    const { mic: chatMic, input: chatInput } = rec.target;
    chatMic.classList.remove('is-listening');
    if (!rec.heard) {
      chatInput.placeholder = 'I did not hear anything…';
      setTimeout(() => { chatInput.placeholder = rec.placeholder; }, 2500);
      return;
    }
    chatInput.placeholder = 'Thinking about what you said…';
    const total = rec.chunks.reduce((n, c) => n + c.length, 0);
    const samples = new Float32Array(total);
    let at = 0;
    for (const c of rec.chunks) { samples.set(c, at); at += c.length; }
    const text = await this.host.voiceListen(wav(tidy(samples)), this.config().lang);
    chatInput.placeholder = rec.placeholder;
    if (!text) return;
    rec.target.submit(text);
  }

  // Someone on a holo-call (Omi): the same voice model as hers, but heard down a line: one clean voice
  // (no double, no dropouts), squeezed into a phone's band with a bit of presence and warmth, over a
  // faint hiss of static. Hers sounds like a construct; theirs like a call.
  sayOnLine(ctx, buffer, rate) {
    const t0 = ctx.currentTime + 0.05;
    const length = buffer.duration / rate;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 320;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3600;
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 1700;
    presence.Q.value = 0.9;
    presence.gain.value = 5;
    const warm = ctx.createWaveShaper(); // a soft tape-like saturation
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
    }
    warm.curve = curve;
    const out = ctx.createGain();
    out.gain.value = 1.25;
    hp.connect(lp).connect(presence).connect(warm).connect(out).connect(this.voice.master);
    const dry = ctx.createBufferSource();
    dry.buffer = buffer;
    dry.playbackRate.value = rate;
    dry.connect(hp);
    // the line's hiss, a little longer than the voice
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * (length + 0.4)), ctx.sampleRate);
    const data = nb.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = nb;
    const hiss = ctx.createBiquadFilter();
    hiss.type = 'bandpass';
    hiss.frequency.value = 2500;
    hiss.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.value = 0.018;
    noise.connect(hiss).connect(ng).connect(this.voice.master);
    dry.start(t0);
    noise.start(t0 - 0.15);
    const parts = [dry, noise];
    const me = { stop: () => parts.forEach((p) => { try { p.stop(); } catch { /* over */ } }) };
    dry.onended = () => { try { noise.stop(); } catch { /* over */ } if (this.playing === me) this.playing = null; };
    this.playing = me;
  }

  stopSpeaking() {
    try { this.playing?.stop(); } catch { /* already over */ }
    this.playing = null;
  }

  // her answer, aloud: the voice plus a thin detuned ghost of it, so she sounds like a construct
  // voice: whose ('capri', or a character on a holo-call)
  async say(text, voice = 'capri') {
    if (!this.info?.tts || this.config().speak === false || this.voice.muted) return;
    const line = speakable(text);
    if (!line) return;
    const spoken = await this.host.voiceSpeak(line, voice);
    const hers = voice === 'capri';
    if (!spoken?.wav) return;
    const bytes = spoken.wav;
    const rate = spoken.rate || 1.32; // her pitch: each voice is played back at its own speed
    const ctx = this.voice.ensure();
    if (ctx.state === 'suspended') ctx.resume();
    const buffer = await ctx.decodeAudioData(bytes.buffer ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes);
    this.stopSpeaking();
    if (!hers) return this.sayOnLine(ctx, buffer, rate);
    // her voice and a detuned double a breath behind it (a mind of many), with digital glitches: brief
    // random dropouts, and a little grit
    const out = ctx.createGain();
    out.gain.value = 1.1;
    const gate = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 200;
    const air = ctx.createBiquadFilter();
    air.type = 'highshelf';
    air.frequency.value = 4000;
    air.gain.value = 6;
    const grit = ctx.createWaveShaper();
    const curve = new Float32Array(512);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = (Math.round(x * 40) / 40) * 0.2 + x * 0.8; // slightly quantised, still clean
    }
    grit.curve = curve;
    out.connect(gate).connect(hp).connect(air).connect(grit).connect(this.voice.master);
    const t0 = ctx.currentTime + 0.05;
    const dry = ctx.createBufferSource();
    dry.buffer = buffer;
    dry.playbackRate.value = rate;
    dry.connect(out);
    const ghost = ctx.createBufferSource();
    ghost.buffer = buffer;
    ghost.playbackRate.value = rate * 1.06;
    const gg = ctx.createGain();
    gg.gain.value = 0.35;
    ghost.connect(gg).connect(out);
    // glitches: now and then a 25-60 ms dropout or a stutter
    const length = buffer.duration / rate;
    for (let at = 0.4 + Math.random() * 0.4; at < length - 0.2; at += 0.7 + Math.random() * 1.1) {
      const dur = 0.025 + Math.random() * 0.035;
      gate.gain.setValueAtTime(1, t0 + at - 0.001);
      gate.gain.setValueAtTime(Math.random() < 0.5 ? 0 : 0.25, t0 + at);
      gate.gain.setValueAtTime(1, t0 + at + dur);
    }
    dry.start(t0);
    ghost.start(t0 + 0.022);
    // her clip plays in her picture while she speaks
    if (hers) this.panel?.setLive('speak', true);
    const parts = [dry, ghost];
    const me = { stop: () => { parts.forEach((p) => p.stop()); this.panel?.setLive('speak', false); } };
    dry.onended = () => { if (this.playing === me) { this.playing = null; this.panel?.setLive('speak', false); } };
    this.playing = me;
  }
}
