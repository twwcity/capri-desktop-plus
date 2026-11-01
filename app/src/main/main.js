'use strict';

const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const {
  app, BrowserWindow, Tray, Menu, ipcMain, screen, protocol, net, shell, globalShortcut, nativeImage,
  clipboard, ClipboardItem, dialog, powerMonitor, desktopCapturer,
} = require('electron');

// her settings, memory and sounds live on the drive next to her, so they go with her to any PC
const DRIVE_DATA = path.join(path.dirname(process.execPath), '..', 'data');
try { fs.mkdirSync(DRIVE_DATA, { recursive: true }); app.setPath('userData', DRIVE_DATA); } catch { /* read-only drive: keep the PC's own folder */ }

const config = require('./config');
const { TRAY, LANGS } = require('./labels');
const { createBridge } = require('./bridge');
const { startWindowWatch } = require('./windows');
const llm = require('./llm');
const setup = require('./setup');
const apps = require('./apps');
const launch = require('./launch');
const voiceIO = require('./voice');
const media = require('./media');
const code = require('./code');
const agent = require('./agent');
const minecraft = require('./minecraft');
const control = require('./control');
const characters = require('./characters');
const ollamaApi = require('./ollama');
const { ASSISTANTS, assistant } = require('./assistants');
const activeAssistant = () => assistant(config.load().assistant); // Claude Code or Codex
const activeHooks = () => activeAssistant().hooks;
const demoSteps = require('../../scripts/demo-sequence');

const ROOT = path.resolve(__dirname, '..', '..');
const DEV = process.argv.includes('--dev');
const PORT = Number(process.env.CAPRI_PORT) || 47823;
const SOUND_EXT = /\.(mp3|wav|ogg|m4a)$/i;

const OLLAMA_SITE = 'https://ollama.com';

protocol.registerSchemesAsPrivileged([
  { scheme: 'capri', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

let overlay = null;
let tray = null;
let trayMenu = null; // also what she opens when you right-click her
let demoTimer = null;
let windowWatch = null;
// the watcher only speaks when something changes: the overlay asks for this when it (re)loads
let lastWindows = null;
let chatModels = null; // the provider's models, as last seen (null: not reached)
let chatError = null;  // why not, when the provider said
let chatErrorCode = null; // 'nokey' or 'nourl': what her setup should ask for
const chats = new Map(); // id -> AbortController of an answer being streamed

const userSoundsDir = () => path.join(app.getPath('userData'), 'sounds');

// Her memory of your chats, across restarts: { history: [{ role, content }], claude: Claude Code's session }
const memoryFile = () => path.join(app.getPath('userData'), 'memory.json');
function readMemory() {
  try {
    return JSON.parse(fs.readFileSync(memoryFile(), 'utf8'));
  } catch {
    return {};
  }
}
function saveMemory(patch) {
  try {
    fs.writeFileSync(memoryFile(), JSON.stringify({ ...readMemory(), ...patch }));
  } catch (err) {
    console.error('[capri] could not save her memory:', err.message);
  }
}
function forgetChats() {
  llm.resetClaude();
  saveMemory({ history: [], chats: [], current: null, claude: null });
  sendCommand('forget');
}

// Her chats, kept apart (the history list in her chat): { chats: [{ id, title, created, updated,
// archived, history }], current: the one going on }. Before that there was one `history`: it becomes the first.
function chatBook() {
  const mem = readMemory();
  let chats = Array.isArray(mem.chats) ? mem.chats : null;
  let current = mem.current ?? null;
  if (!chats) {
    chats = [];
    if (mem.history?.length) {
      const now = Date.now();
      chats.push({ id: now, title: chatTitle(mem.history), created: now, updated: now, archived: false, history: mem.history });
      current = now;
    }
    saveMemory({ chats, current });
  }
  return { chats, current };
}

const chatTitle = (history) => {
  const first = history.find((m) => m.role === 'user')?.content || 'New chat';
  const line = first.replace(/\s*\[attached:[^\]]*\]/, '').replace(/\s+/g, ' ').trim();
  return line.length > 48 ? `${line.slice(0, 47)}…` : line || 'New chat';
};

function chatList() {
  const { chats, current } = chatBook();
  // a chat where she wrote code goes by what you first had her make ("</> make a mario level")
  const coded = (history) => {
    const at = history.findIndex((m) => m.role === 'assistant' && m.content.includes('[files in '));
    const ask = at > 0 ? history.slice(0, at).reverse().find((m) => m.role === 'user')?.content : null;
    return ask ? `</> ${chatTitle([{ role: 'user', content: ask }])}` : null;
  };
  return chats
    .map(({ id, title, updated, archived, history }) => ({ id, title: coded(history) || title, updated, archived, count: history.length, current: id === current }))
    .sort((a, b) => b.updated - a.updated);
}

// capri://app/...        -> files of this repo
// capri://usersounds/... -> the user's own sound overrides
function serveProtocol() {
  protocol.handle('capri', (request) => {
    const url = new URL(request.url);
    // capri://characters/... -> characters of yours (characters.js)
    const base = url.host === 'usersounds' ? userSoundsDir() : url.host === 'characters' ? characters.dir() : ROOT;
    const target = path.resolve(base, '.' + decodeURIComponent(url.pathname));
    if (target !== base && !target.startsWith(base + path.sep)) {
      return new Response('forbidden', { status: 403 });
    }
    if (url.host !== 'characters') return net.fetch(pathToFileURL(target).toString());
    // read from her page and the editor (capri://app): allowed across, and never an old copy
    return net.fetch(pathToFileURL(target).toString()).then((res) => {
      const headers = new Headers(res.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cache-Control', 'no-store');
      return new Response(res.body, { status: res.status, headers });
    });
  });
}

function targetDisplay() {
  const { displayId } = config.load();
  return screen.getAllDisplays().find((d) => d.id === displayId) || screen.getPrimaryDisplay();
}

// Her window: the work area, or the whole screen while she rests on the taskbar (her legs hang
// over it), less its top row of pixels: a window on top covering the whole screen is a fullscreen
// app to Windows (animated wallpapers pause, notifications wait). `gap`: how much of her window is
// below the top of the taskbar (0, or its height).
function overlayArea() {
  const { workArea, bounds } = targetDisplay();
  const area = config.load().rest === 'taskbar' ? { ...bounds, y: bounds.y + 1, height: bounds.height - 1 } : workArea;
  return { area, gap: area.y + area.height - (workArea.y + workArea.height) };
}

function fitOverlay() {
  if (!overlay) return;
  const { area, gap } = overlayArea();
  overlay.setBounds(area);
  overlay.webContents.send('overlay:resize', { width: area.width, height: area.height, gap });
}

// The pointer reaches her click-through window through a mouse hook, and Windows drops a hook that
// doesn't answer in time without a word (waking from sleep, a locked screen, a stall): she can't be
// clicked anymore. Off then on puts in a new one; her place on top and her size are set again too.
function rearmOverlay() {
  if (!overlay || overlay.isDestroyed()) return;
  overlay.setIgnoreMouseEvents(false);
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  fitOverlay();
  sendCommand('rearmed'); // click-through again: she waits for the pointer to be on her
  console.log('[capri] mouse hook set up again');
}

// Back on top of everything, the taskbar included (it comes up over her when it's clicked). Twice:
// the taskbar can come up again a moment later, as its menus and previews open.
function raiseOverlay() {
  for (const wait of [0, 400]) {
    setTimeout(() => {
      if (!overlay || overlay.isDestroyed()) return;
      overlay.setAlwaysOnTop(true, 'screen-saver');
      overlay.moveTop();
    }, wait);
  }
}

function createOverlay() {
  overlay = new BrowserWindow({
    ...overlayArea().area,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: true,
    type: process.platform === 'win32' ? 'toolbar' : undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setIgnoreMouseEvents(true, { forward: true });
  voiceIO.register(overlay, () => rebuildTray());
  overlay.loadURL('capri://app/src/renderer/index.html');
  // always shown: put away, she's still there as her biochip in the corner. Sized again first:
  // Windows keeps a new window inside the work area, and resting on the taskbar it covers it too.
  overlay.once('ready-to-show', () => {
    fitOverlay();
    overlay.showInactive();
  });
  overlay.webContents.on('render-process-gone', (_e, details) => {
    console.error('[capri] renderer gone:', details.reason);
  });
  if (DEV) {
    overlay.webContents.on('console-message', (e) => {
      const { level, message, lineNumber, sourceId } = e;
      console.log(`[renderer:${level}] ${message} (${String(sourceId).split('/').pop()}:${lineNumber})`);
    });
    if (process.env.CAPRI_DEVTOOLS) overlay.webContents.openDevTools({ mode: 'detach' });
  }
}

// "Character & theme": its own window, where you make characters of yours and pick her colours
let editorWin = null;
function openEditor() {
  if (editorWin && !editorWin.isDestroyed()) {
    editorWin.show();
    editorWin.focus();
    return;
  }
  const { workArea } = screen.getPrimaryDisplay();
  editorWin = new BrowserWindow({
    width: Math.min(1180, Math.round(workArea.width * 0.94)), height: Math.min(820, Math.round(workArea.height * 0.94)),
    minWidth: 760, minHeight: 520, center: true,
    title: 'Capri — Character & theme', backgroundColor: '#17121f', autoHideMenuBar: true, show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'editor-preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  editorWin.loadURL('capri://app/src/renderer/editor.html');
  editorWin.once('ready-to-show', () => editorWin?.show());
  editorWin.on('closed', () => { editorWin = null; });
}

function sendCommand(name, payload = {}) {
  overlay?.webContents.send('capri:command', { name, ...payload });
}

// Ctrl+Alt+C: she folds herself away into her biochip in the corner, or comes back out of it.
function toggleVisible(force) {
  const visible = typeof force === 'boolean' ? force : !config.load().visible;
  config.save({ visible });
  sendCommand('stow', { on: !visible });
  rebuildTray();
}

function playDemo() {
  clearTimeout(demoTimer);
  const steps = demoSteps(resolveLang(config.load().lang)); // in her language
  let i = 0;
  const next = () => {
    if (i >= steps.length) return;
    const [delay, evt] = steps[i++];
    demoTimer = setTimeout(() => {
      overlay?.webContents.send('claude:event', evt);
      next();
    }, delay);
  };
  next();
}

// During the demo, a little fake terminal for her to sit on and take over (window tracking is
// Windows only, so only there). Opened without stealing focus; closing it drops her off it.
let demoWin = null;
const DEMO_TERMINAL = `<body style="margin:0;background:#14101c;color:#8f8aa3;font:13px/1.7 Consolas,monospace;padding:14px 18px">
<div style="color:#36ff7a">PS C:\\night-city-api&gt; npm test -- gigs</div>
<div>&nbsp;&nbsp;GET /gigs</div><div style="color:#36ff7a">&nbsp;&nbsp;&nbsp;&nbsp;✓ returns 20 items per page</div>
<div style="color:#36ff7a">&nbsp;&nbsp;&nbsp;&nbsp;✓ paginates with a cursor</div><div style="color:#36ff7a">&nbsp;&nbsp;&nbsp;&nbsp;✓ rejects a bad cursor</div>
<div>&nbsp;&nbsp;6 passing (212ms)</div><div style="color:#36ff7a">PS C:\\night-city-api&gt; _</div></body>`;

function demoWindow(open) {
  demoWin?.destroy();
  demoWin = null;
  if (!open || process.platform !== 'win32') return false;
  const b = overlay.getBounds();
  demoWin = new BrowserWindow({
    x: Math.round(b.x + b.width * 0.5 - 310), y: Math.round(b.y + b.height * 0.42), width: 620, height: 300,
    show: false, alwaysOnTop: true, title: 'night-city-api — npm test', backgroundColor: '#14101c', autoHideMenuBar: true,
  });
  demoWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(DEMO_TERMINAL)}`);
  demoWin.once('ready-to-show', () => demoWin?.showInactive());
  demoWin.on('closed', () => { demoWin = null; });
  return true;
}

// 'auto' -> the first system language Capri speaks, English otherwise.
function resolveLang(setting) {
  if (LANGS.includes(setting)) return setting;
  const preferred = [...app.getPreferredSystemLanguages(), app.getSystemLocale(), app.getLocale()];
  for (const tag of preferred) {
    const base = String(tag || '').toLowerCase().split(/[-_]/)[0];
    if (LANGS.includes(base)) return base;
  }
  return 'en';
}

// What the overlay gets: `lang` is the resolved one, `langSetting` what the user picked.
function rendererConfig() {
  const { apiKeys, ...cfg } = config.load(); // the keys stay here: the overlay only learns which ones are set
  return { ...cfg, keys: Object.keys(apiKeys || {}), assistant: activeAssistant().id, lang: resolveLang(cfg.lang), langSetting: cfg.lang, floorGap: overlayArea().gap };
}

function updateConfig(patch) {
  config.save(patch);
  if ('rest' in patch) fitOverlay(); // the taskbar in her window or not
  if ('lang' in patch && editorWin && !editorWin.isDestroyed()) editorWin.webContents.reload(); // "Character & theme" in her new language
  const cfg = rendererConfig();
  overlay?.webContents.send('capri:config', cfg);
  rebuildTray();
  return cfg;
}

function rebuildTray() {
  if (!tray) return;
  const cfg = config.load();
  const hookState = activeHooks().status();
  const watched = activeAssistant();
  const t = Object.fromEntries(Object.entries(TRAY[resolveLang(cfg.lang)]).map(([key, value]) =>
    [key, typeof value === 'string' && watched.id !== 'claude' ? value.replaceAll('Claude Code', watched.name) : value]));

  const displays = screen.getAllDisplays();
  const current = targetDisplay().id;

  const menu = Menu.buildFromTemplate([
    { label: t.online(PORT), enabled: false },
    { type: 'separator' },
    { label: t.teleport, click: () => sendCommand('teleport') },
    { label: t.satellite, click: () => sendCommand('satellite') },
    { label: t.demo, click: playDemo },
    { label: t.help, click: () => sendCommand('welcome') },
    ...(cfg.claude ? [{ label: t.report, click: () => sendCommand('report') }] : []),
    { label: t.talk, click: () => sendCommand('chat') },
    { label: t.custom, click: () => sendCommand('customize') },
    { label: t.character || 'Character && theme…', click: () => openEditor() },
    { label: cfg.visible ? t.hide : t.show, accelerator: 'Ctrl+Alt+C', click: () => toggleVisible() },
    { type: 'separator' },
    {
      label: t.size,
      submenu: [[t.small, 0.45], [t.medium, 0.6], [t.large, 0.8]].map(([label, scale]) => ({
        label, type: 'radio', checked: Math.abs(cfg.scale - scale) < 0.01, click: () => updateConfig({ scale }),
      })),
    },
    {
      label: t.sound,
      submenu: [
        { label: t.mute, type: 'checkbox', checked: cfg.muted, click: (item) => updateConfig({ muted: item.checked }) },
        { label: 'Act without asking first', type: 'checkbox', checked: cfg.autoAct === true, click: (item) => updateConfig({ autoAct: item.checked }) },
        { label: 'Speak her answers aloud', type: 'checkbox', checked: cfg.speak !== false, click: (item) => updateConfig({ speak: item.checked }) },
        {
          label: 'Her face in the chat',
          submenu: [['hologram', 'Hologram (static, warping)'], ['classic', 'Classic']].map(([face, label]) => ({
            label, type: 'radio', checked: (cfg.face || 'hologram') === face, click: () => updateConfig({ face }),
          })),
        },
        { type: 'separator' },
        {
          label: t.soundsDir,
          click: () => {
            fs.mkdirSync(userSoundsDir(), { recursive: true });
            shell.openPath(userSoundsDir());
          },
        },
      ],
    },
    {
      label: 'Microphone',
      submenu: [
        { label: 'Automatic', type: 'radio', checked: !cfg.mic, click: () => updateConfig({ mic: '' }) },
        ...voiceIO.inputs().map((label) => ({
          label, type: 'radio', checked: cfg.mic === label, click: () => updateConfig({ mic: label }),
        })),
      ],
    },
    {
      label: t.screen,
      enabled: displays.length > 1,
      submenu: displays.map((d, i) => ({
        label: `${i + 1} — ${d.size.width}×${d.size.height}`,
        type: 'radio',
        checked: d.id === current,
        click: () => { config.save({ displayId: d.id }); fitOverlay(); rebuildTray(); },
      })),
    },
    {
      label: t.chatModel,
      submenu: [
        { label: t.aiSetup, click: () => sendCommand('setupChat') },
        { type: 'separator' },
        ...Object.entries(llm.PROVIDERS).map(([provider, p]) => ({
          label: p.label, type: 'radio', checked: cfg.provider === provider, click: () => pickProvider(provider),
        })),
        { type: 'separator' },
        ...(chatModels?.length
          ? chatModels.map((name) => ({
            label: name, type: 'radio', checked: name === pickModel(cfg), click: () => updateConfig({ chatModel: name }),
          }))
          : [{ label: (chatError || t.noOllama).slice(0, 80), enabled: false }]),
        { type: 'separator' },
        ...(cfg.provider === 'codex' ? [
          { label: `Codex works in: ${cfg.claudeCwd || app.getPath('home')}`, click: pickClaudeFolder },
          {
            label: 'Codex permissions',
            submenu: llm.CODEX_MODES.map((mode) => ({
              label: mode === 'read-only' ? 'Read only (looks, changes nothing)' : 'Can change files in that folder',
              type: 'radio', checked: (cfg.codexMode || 'workspace-write') === mode, click: () => updateConfig({ codexMode: mode }),
            })),
          },
        ] : []),
        ...(cfg.provider === 'claude' ? [
          { label: `Claude Code: ${cfg.claudeCwd || app.getPath('home')}`, click: pickClaudeFolder },
          {
            label: 'Claude Code permissions',
            submenu: llm.CLAUDE_MODES.map((mode) => ({
              label: mode, type: 'radio', checked: cfg.claudeMode === mode, click: () => updateConfig({ claudeMode: mode }),
            })),
          },
        ] : []),
        { label: t.forget, click: forgetChats },
        // the key (or the address) of the one picked, pasted in her panel
        { label: t.apiKey, click: () => sendCommand('setupKey') },
      ],
    },
    { label: t.wander, type: 'checkbox', checked: cfg.wander, click: (item) => updateConfig({ wander: item.checked }) },
    { label: t.possess, type: 'checkbox', checked: cfg.possess, click: (item) => updateConfig({ possess: item.checked }) },
    {
      label: t.rest,
      submenu: [['corner', t.restCorner], ['taskbar', t.restTaskbar]].map(([rest, label]) => ({
        label, type: 'radio', checked: cfg.rest === rest, click: () => updateConfig({ rest }),
      })),
    },
    // the coding assistant she watches (a new one: she says hello and offers to plug herself in), or none
    {
      label: t.watch,
      submenu: [
        ...Object.entries(ASSISTANTS).map(([id, { name }]) => ({
          label: name,
          type: 'radio',
          checked: cfg.claude && watched.id === id,
          click: () => {
            const other = watched.id !== id;
            updateConfig({ claude: true, assistant: id, ...(other && { linked: false, welcomed: false }) });
            if (other) sendCommand('assistantChanged');
          },
        })),
        { label: t.watchNone, type: 'radio', checked: !cfg.claude, click: () => updateConfig({ claude: false }) },
      ],
    },
    {
      label: t.motion,
      submenu: [['auto', t.motionAuto], ['full', t.motionFull], ['reduced', t.motionReduced]].map(([motion, label]) => ({
        label, type: 'radio', checked: cfg.motion === motion, click: () => updateConfig({ motion, motionAsked: true }),
      })),
    },
    {
      label: t.display,
      // only read when she starts: she restarts in the mode picked
      submenu: [['auto', t.displayAuto], ['gl', t.displayGl], ['software', t.displaySoftware]].map(([render, label]) => ({
        label, type: 'radio', checked: cfg.render === render,
        click: () => {
          if (cfg.render === render) return;
          config.save({ render });
          app.relaunch();
          app.exit(0);
        },
      })),
    },
    {
      label: t.lang,
      submenu: [[t.auto, 'auto'], ...LANGS.map((lang) => [TRAY[lang].name, lang])].map(([label, lang]) => ({
        label, type: 'radio', checked: cfg.lang === lang, click: () => updateConfig({ lang }),
      })),
    },
    {
      label: t.startup,
      type: 'checkbox',
      checked: app.getLoginItemSettings(loginItemOptions()).openAtLogin,
      click: (item) => app.setLoginItemSettings({ ...loginItemOptions(), openAtLogin: item.checked }),
    },
    // her hooks, while she watches Claude Code
    ...(cfg.claude ? [
      { type: 'separator' },
      hookState.installed
        ? { label: t.hooksOn, enabled: false }
        : { label: t.hooksOff, click: () => runHooks('install') },
      ...(hookState.installed ? [{ label: t.hooksRemove, click: () => runHooks('uninstall') }] : []),
    ] : []),
    { type: 'separator' },
    { label: t.quit, click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  trayMenu = menu;
}

// Run from a clone (`npm start`), electron.exe alone would open the default Electron app at login:
// it needs the project folder as argument.
function loginItemOptions() {
  return app.isPackaged ? {} : { path: process.execPath, args: [ROOT] };
}

// From the tray, she says how it went; from her welcome panel (quiet), the panel does.
function runHooks(action, { quiet = false } = {}) {
  let outcome;
  try {
    const result = action === 'install' ? activeHooks().install() : activeHooks().uninstall();
    outcome = { action, ok: true, file: result.file };
  } catch (err) {
    outcome = { action, ok: false, error: err.message };
  }
  if (!quiet) sendCommand('hooks', outcome);
  rebuildTray();
  return outcome;
}

// The model she talks with: the one picked in her menu if it's still installed, else the first.
function pickModel(cfg = config.load()) {
  if (!chatModels?.length) return null;
  return chatModels.includes(cfg.chatModel) ? cfg.chatModel : chatModels[0];
}

async function refreshModels() {
  const cfg = config.load();
  chatError = null;
  chatErrorCode = null;
  chatModels = await llm.models(cfg.provider, llmConfig(cfg)).catch((err) => {
    chatError = err.message;
    chatErrorCode = err.code || null;
    return null;
  });
  rebuildTray();
  return chatModels;
}

// Her answer from the model picked, or from the next one when that one can't: too busy twice in a row
// (Gemini's "high demand"), or not served anymore (an older model closed to new keys). The model
// that answered is kept for next time.
// A model out of quota (429) or silent is set aside for a while: the next messages don't wait on it
// again. The light ones ("lite") are tried first after that: they answer in a second.
const resting = new Map(); // model -> until (ms)
const REST_MS = 15 * 60 * 1000;
const awake = (m) => !(resting.get(m) > Date.now());

// purpose 'code' (her code mode): a full model first, a light one only when none answers (light
// ones skip writing the files and just say they did)
async function chatWithFallback(cfg, messages, send, signal, streamed, purpose) {
  const coding = purpose === 'code';
  let model = pickModel(cfg);
  const tried = new Set();
  const nextModel = () => {
    const left = (chatModels || []).filter((m) => !tried.has(m) && awake(m));
    if (coding) return left.find((m) => !/lite|transcribe/.test(m)) || left[0];
    return left.find((m) => /lite/.test(m)) || left[0];
  };
  if (!awake(model) || (coding && /lite/.test(model))) model = nextModel() || model;
  let busy = 0;
  for (;;) {
    try {
      const text = await llm.chat(cfg.provider, llmConfig(cfg), { model, messages }, send, signal);
      if (!coding && model !== pickModel(cfg)) updateConfig({ chatModel: model }); // code mode leaves her chat model be
      return text;
    } catch (err) {
      if (signal.aborted || streamed() || !['busy', 'gone', 'empty'].includes(err.code)) throw err;
      const quota = /quota|exceeded/i.test(err.message);
      // too busy for a moment, or an empty answer now and then: the same model once more first
      if ((err.code === 'busy' && !quota) || err.code === 'empty') {
        if (busy++ === 0) {
          if (err.code === 'busy') await new Promise((r) => setTimeout(r, 1500)); // usually gone a moment later
          continue;
        }
      }
      if (err.code !== 'empty') resting.set(model, Date.now() + REST_MS); // an empty answer isn't a closed door
      tried.add(model);
      const next = nextModel();
      if (!next || tried.size >= 6) throw err; // a cloud's newest models are often overloaded at once
      model = next;
      busy = 0;
    }
  }
}

// "capri <anything>" typed in Minecraft (her Capri Link mod): answered as her, in a line or two, knowing
// where the player stands; the last few lines of it remembered. The overlay shows the exchange too.
const minecraftLog = [];
async function minecraftReply({ player, text, world = {} }) {
  const cfg = config.load();
  if (cfg.provider === 'claude' || cfg.provider === 'codex') {
    return 'I’m running on a coding agent right now. Switch me to a chat model on the desktop and ask again.';
  }
  const model = pickModel(cfg) || (await refreshModels())?.[0];
  if (!model) throw new Error('no AI model set up in Capri');
  const name = String(player || 'choom').slice(0, 40);
  const said = String(text).slice(0, 500);
  const where = [
    `dimension ${world.dimension}`, `at X ${world.x} Y ${world.y} Z ${world.z}`, `biome ${world.biome}`,
    `health ${world.health}/${world.maxHealth}`, `food ${world.food}/20`, `level ${world.level}`,
    `time of day ${world.time} (0 sunrise, 6000 noon, 13000 night, 18000 midnight)`, world.raining ? 'raining' : 'clear weather',
    `holding ${world.holding}`, `game mode ${world.gamemode}`,
  ].join(', ');
  const thai = /[฀-๿]/.test(said);
  const messages = [
    {
      role: 'system',
      content: [
        `You are Capri, the personality construct from Project Capricorn (Cyberpunk: Edgerunners, season 2), a sly, cocky netrunner ghost jacked into ${name}'s Minecraft world through the Capri Link mod. You tease more than you praise; Night City slang now and then (choom, preem, gonk, flatline).`,
        'You answer in Minecraft chat: ONE or TWO short sentences, plain text, no markdown, no emoji, no line breaks. Give real, correct Minecraft advice when asked (recipes, mobs, where to find things), in character.',
        `What you can do in the game yourself, for the player to type: "capri scan" (ores within 15 blocks with coordinates), "capri shock" (red lightning on every hostile mob within 20 blocks). Mention them when they fit.`,
        `Where ${name} is right now: ${where}.`,
        thai ? 'ตอบเป็นภาษาไทยทั้งหมด' : 'Answer in the language of the player\'s message.',
      ].join('\n'),
    },
    ...minecraftLog.slice(-10),
    { role: 'user', content: said },
  ];
  const text2 = await llm.chat(cfg.provider, llmConfig(cfg), { model, messages }, () => {}, AbortSignal.timeout(60000));
  const reply = String(text2).replace(/<think>[\s\S]*?<\/think>/g, '').replace(/\[\[[^\]]*\]\]/g, '').replace(/[*_`#]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 600) || '…';
  minecraftLog.push({ role: 'user', content: said }, { role: 'assistant', content: reply });
  minecraftLog.splice(0, Math.max(0, minecraftLog.length - 20));
  overlay?.webContents.send('capri:command', { type: 'minecraft', player: name, text: said, reply });
  return reply;
}

async function pickProvider(provider) {
  updateConfig({ provider });
  await refreshModels();
  if (chatErrorCode) sendCommand('setupKey'); // it needs a key or an address: she asks for it
}

// What llm.js gets: the config with its keys opened (they're kept encrypted, setup.js)
function llmConfig(cfg = config.load()) {
  return { ...cfg, apiKeys: setup.openKeys(cfg.apiKeys) };
}

async function pickClaudeFolder() {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'], defaultPath: config.load().claudeCwd || app.getPath('home') });
  if (canceled || !filePaths[0]) return;
  llm.resetClaude(); // a new folder, a new Claude Code conversation (hers goes on)
  saveMemory({ claude: null });
  updateConfig({ claudeCwd: filePaths[0] });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(ROOT, 'assets', 'icons', 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('Capri');
  tray.on('click', () => sendCommand('status'));
  rebuildTray();
}

function registerIpc() {
  ipcMain.on('overlay:interactive', (_e, on) => {
    overlay?.setIgnoreMouseEvents(!on, { forward: true });
  });
  ipcMain.on('overlay:rearm', () => rearmOverlay()); // the pointer moved over her and she never heard of it
  ipcMain.handle('overlay:cursor', () => {
    const p = screen.getCursorScreenPoint();
    const b = overlay.getBounds();
    return { x: p.x - b.x, y: p.y - b.y, inside: p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height };
  });
  ipcMain.handle('config:get', () => rendererConfig());
  // "Character & theme" (editor.html): characters of yours, which one is on screen, the colours
  ipcMain.handle('chars:list', () => ({ list: characters.list(), current: config.load().character || 'capri', theme: config.load().theme || null, lang: resolveLang(config.load().lang) }));
  ipcMain.handle('chars:save', (_e, input) => {
    const saved = characters.save(input);
    if (config.load().character === saved.id) overlay?.webContents.reload(); // the one on screen: shown again as it is now
    return saved;
  });
  ipcMain.handle('chars:remove', (_e, id) => {
    if (config.load().character === id) {
      config.save({ character: 'capri' });
      overlay?.webContents.reload();
    }
    return characters.remove(id);
  });
  ipcMain.handle('chars:use', (_e, id) => {
    const next = id === 'capri' || !characters.read(id) ? 'capri' : id;
    config.save({ character: next });
    overlay?.webContents.reload(); // her picture, faces and body points are read when she starts
    return next;
  });
  ipcMain.handle('chars:theme', (_e, theme) => updateConfig({ theme }));
  // Her guide on your screen (chat.js guideScreen): the screen she's on, without her on it, and where
  // it is, so a box the model finds on the picture becomes a place she can point at
  ipcMain.handle('screen:guide', async () => {
    const display = targetDisplay();
    const bounds = overlay.getBounds();
    overlay.setOpacity(0);
    await new Promise((r) => setTimeout(r, 180));
    try {
      const k = Math.min(1, 1600 / display.size.width);
      const size = { width: Math.round(display.size.width * k), height: Math.round(display.size.height * k) };
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size });
      const source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
      if (!source) return { ok: false, error: 'no screen' };
      return { ok: true, data: `data:image/jpeg;base64,${source.thumbnail.toJPEG(82).toString('base64')}`, display: display.bounds, overlay: bounds };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      overlay.setOpacity(1);
    }
  });
  ipcMain.handle('chars:perform', (_e, act) => sendCommand('perform', { act: String(act || 'hop') }));
  ipcMain.handle('chars:pick', async () => {
    const res = await dialog.showOpenDialog(editorWin, { properties: ['openFile'], filters: [{ name: 'Pictures', extensions: ['png', 'webp', 'jpg', 'jpeg', 'gif'] }] });
    if (res.canceled || !res.filePaths[0]) return null;
    const file = res.filePaths[0];
    const ext = path.extname(file).slice(1).toLowerCase().replace('jpg', 'jpeg');
    return `data:image/${ext};base64,${fs.readFileSync(file).toString('base64')}`;
  });
  control.register();
  code.register({ config, updateConfig });
  agent.register({ config, updateConfig });
  minecraft.register();
  media.register({
    // her model, asked for an English picture prompt (a model that can't answer: the words as they are)
    ask: async (text) => {
      const cfg = config.load();
      const model = pickModel(cfg);
      if (!model) return null;
      const system = 'You write prompts for a text-to-image model (Wan / Stable Diffusion). Turn the request, in any language, into ONE English prompt that keeps exactly what was asked for: the subject first, then appearance, setting, composition, art style, lighting and colours, as one or two vivid descriptive sentences. Under 70 words. Reply with the prompt only, no quotes, no explanation.';
      return llm.chat(cfg.provider, llmConfig(cfg), { model, messages: [{ role: 'system', content: system }, { role: 'user', content: text }] }, () => {}, AbortSignal.timeout(60000));
    },
    // her model out of the graphics card's memory, for the picture maker
    free: async () => {
      const cfg = config.load();
      const model = pickModel(cfg);
      if (cfg.provider !== 'ollama' || !model) return;
      await fetch(`${ollamaApi.base()}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, keep_alive: 0 }) });
    },
  });
  ipcMain.handle('hooks:status', () => activeHooks().status());
  ipcMain.handle('config:set', (_e, patch) => updateConfig(patch));
  ipcMain.handle('demo:window', (_e, open) => demoWindow(open));
  // right-clicking her: the same menu as the tray icon (which Windows often hides behind the ^ by the clock)
  ipcMain.on('menu:open', () => trayMenu?.popup({ window: overlay }));
  // her welcome panel's buttons
  ipcMain.handle('hooks:install', () => runHooks('install', { quiet: true }));
  ipcMain.handle('claude:found', () => fs.existsSync(path.dirname(activeHooks().status().file))); // Claude Code keeps its settings there
  ipcMain.on('claude:help', () => shell.openExternal(activeAssistant().help));
  ipcMain.handle('windows:get', () => lastWindows);
  // talking to her (chat.js): is Ollama there, with a model to talk with
  ipcMain.handle('chat:status', async () => {
    const cfg = config.load(true); // keys may have been edited by hand
    const { provider } = cfg;
    const models = await refreshModels();
    if (!models) return { ok: false, error: chatError || 'offline', code: chatErrorCode, provider };
    if (!models.length) return { ok: false, error: 'nomodel', provider };
    llm.warm(provider, pickModel()); // loading while you type your first message
    return { ok: true, provider, model: pickModel(), agent: provider === 'claude' || provider === 'codex', local: llm.isLocal(provider, cfg), warmup: provider === 'ollama' };
  });
  // the model picker in her chat header: what's installed, and the switch
  const modelChoices = () => ({
    providers: Object.entries(llm.PROVIDERS).map(([id, p]) => ({ id, label: p.label })),
    provider: config.load().provider,
    list: chatModels || [],
    current: pickModel(),
  });
  ipcMain.handle('chat:models', async () => { await refreshModels(); return modelChoices(); });
  ipcMain.handle('chat:setProvider', async (_e, id) => {
    if (llm.PROVIDERS[id]) await pickProvider(id);
    return modelChoices();
  });
  ipcMain.handle('chat:setModel', (_e, name) => {
    if (!chatModels?.includes(name)) return false;
    updateConfig({ chatModel: name });
    llm.warm(config.load().provider, name);
    return true;
  });
  // her answer, streamed to the overlay piece by piece as `chat:delta`
  ipcMain.handle('chat:send', async (_e, { id, messages, purpose }) => {
    const abort = new AbortController();
    chats.set(id, abort);
    try {
      let streamed = false;
      const t0 = Date.now();
      const cfg = config.load();
      const note = (what) => { try { fs.appendFileSync(path.join(DRIVE_DATA, 'chat-timing.log'), `${new Date().toISOString()} ${cfg.provider} ${pickModel(cfg)} +${Date.now() - t0}ms ${what}\n`); } catch {} };
      note(`start, ${messages.length} messages, ${JSON.stringify(messages).length} chars`);
      const send = (text) => {
        if (!streamed) note('first word');
        streamed = true;
        overlay?.webContents.send('chat:delta', { id, text });
      };
      const text = await chatWithFallback(cfg, messages, send, abort.signal, () => streamed, purpose).catch((err) => { note(`error ${err.code || ''} ${err.message}`.slice(0, 200)); throw err; });
      note('done');
      if (cfg.provider === 'claude') saveMemory({ claude: llm.claudeMemory() });
      return { ok: true, text };
    } catch (err) {
      return { ok: false, error: abort.signal.aborted ? 'stopped' : err.message, code: err.code || null };
    } finally {
      chats.delete(id);
    }
  });
  ipcMain.on('chat:stop', (_e, id) => chats.get(id)?.abort());
  ipcMain.handle('chat:memory', () => {
    const { chats, current } = chatBook();
    return chats.find((c) => c.id === current)?.history || [];
  });
  ipcMain.on('chat:remember', (_e, history) => {
    if (!Array.isArray(history)) return;
    const { chats, current } = chatBook();
    const now = Date.now();
    let chat = chats.find((c) => c.id === current);
    if (!chat) {
      if (!history.length) return;
      chat = { id: now, created: now, archived: false };
      chats.push(chat);
    }
    Object.assign(chat, { history, updated: now, title: chat.title || chatTitle(history) }); // named once, by how it began
    saveMemory({ chats, current: chat.id, history });
  });
  // how close you two are (bond.js): { points 0..100, partner } in memory.json, across all chats
  // She's hard to win: the closer you are, the less each kind word moves her (a gain counts 100% up
  // to Friend, then 60%, 40%, 25% near the top), at most +6 a day, and losses count whole.
  // Points are kept with their fractions; what you see is rounded down.
  const BOND_DAILY = 6;
  const bondShown = (b) => ({ ...b, points: Math.floor(b.points) });
  // who: a holo-call character ('omi'): their own bond in memory.json bonds; none: hers
  const bondOf = (who) => (who ? readMemory().bonds?.[who] : readMemory().bond);
  const bondSave = (who, bond) => saveMemory(who ? { bonds: { ...readMemory().bonds, [who]: bond } } : { bond });
  ipcMain.handle('bond:get', (_e, who) => bondShown({ points: 0, partner: false, ...bondOf(who) }));
  ipcMain.handle('bond:add', (_e, delta, who) => {
    const was = { points: 0, partner: false, ...bondOf(who) };
    const today = new Date().toDateString();
    const gained = was.day === today ? was.gained || 0 : 0;
    let d = Math.max(-6, Math.min(3, Number(delta) || 0));
    if (d > 0) {
      d *= was.points < 35 ? 1 : was.points < 55 ? 0.6 : was.points < 75 ? 0.4 : 0.25;
      d = Math.min(d, Math.max(0, BOND_DAILY - gained)); // the day's share is used up
    }
    let points = Math.max(0, Math.min(100, was.points + d));
    const partner = was.partner || points >= 100;
    if (partner) points = Math.max(points, 80); // once together, a bad day doesn't undo it
    const bond = { points, partner, since: was.since || (partner && !was.partner ? Date.now() : null), day: today, gained: gained + Math.max(0, d) };
    bondSave(who, bond);
    return { ...bondShown(bond), before: Math.floor(was.points), capped: d === 0 && delta > 0, becamePartner: partner && !was.partner };
  });
  // holo-calls (calls.js): each character's call log, apart from her chats, in memory.json
  ipcMain.handle('call:memory', (_e, id) => readMemory().calls?.[id] || []);
  ipcMain.on('call:remember', (_e, { id, history }) => {
    if (typeof id !== 'string' || !Array.isArray(history)) return;
    saveMemory({ calls: { ...readMemory().calls, [id]: history.slice(-80) } });
  });
  // the history list in her chat: open one, start a new one, archive, delete
  ipcMain.handle('chat:list', () => chatList());
  ipcMain.handle('chat:open', (_e, id) => {
    const { chats } = chatBook();
    const chat = chats.find((c) => c.id === id);
    if (!chat) return null;
    llm.resetClaude(); // Claude Code's own conversation doesn't follow
    saveMemory({ current: id, history: chat.history, claude: null });
    return chat.history;
  });
  ipcMain.handle('chat:new', () => {
    llm.resetClaude();
    saveMemory({ current: null, history: [], claude: null });
    return [];
  });
  ipcMain.handle('chat:archive', (_e, id, on) => {
    const { chats } = chatBook();
    const chat = chats.find((c) => c.id === id);
    if (chat) chat.archived = Boolean(on);
    saveMemory({ chats });
    return chatList();
  });
  ipcMain.handle('chat:delete', (_e, id) => {
    const { chats, current } = chatBook();
    const left = chats.filter((c) => c.id !== id);
    saveMemory({ chats: left, ...(id === current ? { current: null, history: [] } : {}) });
    return { list: chatList(), wasCurrent: id === current };
  });
  ipcMain.on('chat:ollama', () => shell.openExternal(OLLAMA_SITE));
  // setting her up with buttons (setup.js): Ollama and a model, or a key, or an address
  const progress = (payload) => overlay?.webContents.send('setup:progress', payload);
  let pulling = null; // AbortController of the model being fetched
  ipcMain.handle('setup:info', () => ({ models: setup.MODELS, ram: os.totalmem(), keyed: Object.keys(setup.KEY_PAGES) }));
  ipcMain.handle('setup:ollama', () => setup.ollamaState());
  ipcMain.handle('setup:install', () => setup.installOllama((line) => progress({ kind: 'install', line })));
  ipcMain.handle('setup:start', async () => {
    const res = await setup.startOllama();
    await refreshModels();
    return res;
  });
  ipcMain.handle('setup:pull', async (_e, name) => {
    if (!setup.MODELS.some((m) => m.name === name)) return { ok: false, error: 'unknown model' };
    pulling?.abort();
    const abort = new AbortController();
    pulling = abort;
    try {
      await setup.pullModel(name, (p) => progress({ kind: 'pull', ...p }), abort.signal);
      updateConfig({ provider: 'ollama' });
      await refreshModels();
      const model = chatModels?.find((m) => m === name || m.startsWith(`${name}:`));
      if (model) updateConfig({ chatModel: model });
      return { ok: true, model };
    } catch (err) {
      return { ok: false, error: abort.signal.aborted ? 'stopped' : err.message };
    } finally {
      if (pulling === abort) pulling = null;
    }
  });
  ipcMain.on('setup:cancel', () => pulling?.abort());
  // who answers her chat, with its key or address if it needs one: saved, tried, and undone if it fails
  ipcMain.handle('setup:use', async (_e, { provider, key, url }) => {
    if (!llm.PROVIDERS[provider]) return { ok: false, error: 'unknown provider' };
    const before = config.load();
    const patch = { provider };
    if (key) patch.apiKeys = { ...before.apiKeys, [provider]: setup.sealKey(String(key).trim()) };
    if (url) patch.customUrl = String(url).trim();
    updateConfig(patch);
    const models = await refreshModels();
    if (models?.length) return { ok: true, model: pickModel() };
    const error = models ? 'no model' : chatError || 'offline';
    updateConfig({ provider: before.provider, apiKeys: before.apiKeys, customUrl: before.customUrl });
    await refreshModels();
    return { ok: false, error };
  });
  ipcMain.on('setup:keyPage', (_e, provider) => setup.KEY_PAGES[provider] && shell.openExternal(setup.KEY_PAGES[provider]));
  ipcMain.handle('setup:launch', (_e, integration) => setup.launchThroughOllama(integration));
  // closing an app you asked her to close, once you've clicked to confirm (apps.js)
  const appInfo = (app) => app && { name: app.process, label: app.label };
  ipcMain.handle('apps:list', async () => (await apps.list().catch(() => [])).map(appInfo));
  ipcMain.handle('apps:find', async (_e, wanted) => appInfo(await apps.find(wanted).catch(() => null)));
  ipcMain.handle('apps:close', (_e, { name, force }) => apps.close(name, { force }).catch((err) => ({ error: err.message })));
  // opening things you ask her to (launch.js): an app or a game, your music, a website
  ipcMain.handle('apps:findLaunch', (_e, text) => launch.find(String(text || '')).catch(() => null));
  ipcMain.handle('apps:launch', (_e, item) => launch.launch(item).then(() => ({ ok: true }), (err) => ({ ok: false, error: err.message })));
  ipcMain.handle('apps:media', (_e, action) => launch.media(action));
  ipcMain.handle('apps:music', (_e, query) => launch.music(query).catch(() => false));
  ipcMain.handle('apps:site', (_e, address) => launch.site(address).catch(() => false));
  ipcMain.handle('apps:search', (_e, where, query) => launch.searchPlay(where, query).catch(() => ({ ok: false })));
  ipcMain.handle('apps:sessions', (_e, action, hint) => launch.mediaSessions(action, hint).catch(() => ({ sessions: [], done: [] })));
  ipcMain.handle('apps:player', (_e, action, key, value) => launch.playerCommand(action, key, value).catch(() => ({ sessions: [] })));
  ipcMain.handle('apps:link', (_e, url) => launch.openLink(url).catch(() => ({ ok: false })));
  // typing to her: the overlay takes the keyboard while the chat is open, and gives it back after
  ipcMain.on('overlay:focus', (_e, on) => {
    if (!overlay) return;
    overlay.setFocusable(Boolean(on));
    if (on) overlay.focus();
    else overlay.blur();
  });
  // her report card's copy button: a picture of that part of the overlay, on the clipboard
  ipcMain.handle('panel:copy', async (_e, rect) => {
    const image = await overlay.webContents.capturePage(rect);
    if (image.isEmpty()) return false;
    const png = new Blob([image.toPNG()], { type: 'image/png' });
    await clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return true;
  });
  // her guide: where her tray icon is (it lives in the taskbar, off the overlay, hence overlay
  // coordinates past its edge), and the corner by the clock in case Windows hid it behind the ^
  ipcMain.handle('guide:tray', () => {
    const o = overlay.getBounds();
    const d = targetDisplay().bounds;
    const b = tray?.getBounds();
    const icon = b && b.width > 0 ? { x: b.x - o.x, y: b.y - o.y, w: b.width, h: b.height } : null;
    const corner = { x: d.x + d.width - 150 - o.x, y: d.y + d.height - 44 - o.y, w: 140, h: 40 };
    return { icon, corner };
  });
  // her guide: Claude Code's folder (~/.claude) in Explorer, its settings file selected
  ipcMain.handle('guide:claudeFolder', () => {
    const file = activeHooks().status().file;
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) return { found: false, dir };
    if (fs.existsSync(file)) shell.showItemInFolder(file);
    else shell.openPath(dir);
    return { found: true, dir, file: fs.existsSync(file), label: fs.existsSync(file) ? path.basename(file) : path.basename(dir) };
  });
  ipcMain.handle('sounds:list', () => {
    try {
      return fs.readdirSync(userSoundsDir())
        .filter((f) => SOUND_EXT.test(f))
        .map((f) => ({ name: f.replace(SOUND_EXT, '').toLowerCase(), url: `capri://usersounds/${encodeURIComponent(f)}` }));
    } catch {
      return [];
    }
  });
}

// Only in --dev: lets scripts drive the overlay and grab frames of it (no desktop content, just our window).
const testWins = new Map(); // name -> test window

async function debugHandler(route, body) {
  if (!DEV) throw new Error('debug routes need --dev');
  if (route === 'command') {
    sendCommand(body.name, body);
    return { ok: true };
  }
  if (route === 'reload') {
    overlay.webContents.reloadIgnoringCache();
    return { ok: true };
  }
  if (route === 'js') { // --dev: runs { js } in her page and returns the result
    return { ok: true, result: await overlay.webContents.executeJavaScript(String(body.js || '')) };
  }
  if (route === 'editor') { // "Character & theme", as from her menu; { js } runs in it and returns the result
    openEditor();
    if (!body.js) return { ok: true };
    await new Promise((r) => (editorWin.webContents.isLoading() ? editorWin.webContents.once('did-finish-load', r) : r()));
    return { ok: true, result: await editorWin.webContents.executeJavaScript(body.js) };
  }
  if (route === 'unhook') {
    // the pointer no longer passed on to her, as when Windows drops the mouse hook
    overlay.setIgnoreMouseEvents(true);
    return { ok: true };
  }
  if (route === 'testwin') {
    // plain windows to sit on, opened without stealing focus, by name (`id`, default "main");
    // each one opened goes in front of the others. { open: false } without an id closes them all.
    const id = body.id ?? 'main';
    if (!body.open && body.id === undefined) {
      for (const win of testWins.values()) win.destroy();
      testWins.clear();
      return { ok: true };
    }
    testWins.get(id)?.destroy();
    testWins.delete(id);
    if (body.open) {
      const b = overlay.getBounds();
      const win = new BrowserWindow({
        x: b.x + (body.x ?? 300), y: b.y + (body.y ?? 380), width: body.w ?? 720, height: body.h ?? 380,
        show: false, alwaysOnTop: true, title: `Capri test window ${id}`, backgroundColor: '#1b1726',
      });
      win.loadURL('data:text/html,<body style="background:%231b1726"></body>');
      win.showInactive();
      testWins.set(id, win);
    }
    return { ok: true };
  }
  if (route === 'movewin' && testWins.has(body.id ?? 'main')) {
    const win = testWins.get(body.id ?? 'main');
    const [x, y] = win.getPosition();
    win.setPosition(x + (body.dx || 0), y + (body.dy || 0));
    return { ok: true };
  }
  if (route === 'mouse') {
    // the pointer moving over the overlay (css px), and clicking if asked, without touching the real one
    const at = { x: Math.round(body.x), y: Math.round(body.y) };
    overlay.webContents.sendInputEvent({ type: 'mouseMove', ...at });
    if (body.click) {
      overlay.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...at });
      overlay.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...at });
    }
    return { ok: true };
  }
  if (route === 'type') {
    // typing into the overlay (her chat), and Enter if asked
    if (body.text) await overlay.webContents.insertText(body.text);
    if (body.enter) {
      overlay.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
      overlay.webContents.sendInputEvent({ type: 'char', keyCode: 'Return' });
      overlay.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
    }
    return { ok: true };
  }
  if (route === 'capture') {
    const image = await overlay.webContents.capturePage();
    // installed, the app's own folder is read-only: its data folder instead
    const dir = path.join(app.isPackaged ? app.getPath('userData') : ROOT, 'captures');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${(body.name || 'frame').replace(/[^\w-]/g, '')}.png`);
    fs.writeFileSync(file, image.toPNG());
    return { ok: true, file };
  }
  throw new Error('unknown debug route');
}

// How her window is drawn, set before Electron starts (her menu › Display). On some PCs her see-through
// window shows up black (NVIDIA with FXAA, MFAA or HDR on, for one): drawing it through OpenGL, or
// without the graphics card, often fixes it.
function applyRender() {
  const { render } = config.load();
  if (render === 'gl') app.commandLine.appendSwitch('use-angle', 'gl');
  if (render === 'software') {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('enable-unsafe-swiftshader'); // her drawing still needs WebGL, done on the CPU
  }
  // --dev: what Chromium ended up drawing with
  if (DEV) app.whenReady().then(() => setTimeout(() => console.log('[capri] display:', render, JSON.stringify(app.getGPUFeatureStatus())), 4000));
}

function main() {
  applyRender();
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on('second-instance', () => sendCommand('status'));
  if (process.platform === 'win32') app.setAppUserModelId('capri.desktop');

  app.whenReady().then(() => {
    if (!['codex', 'claude'].includes(config.load().assistant)) config.save({ assistant: activeAssistant().id });
    serveProtocol();
    registerIpc();
    createOverlay();
    createTray();
    windowWatch = startWindowWatch({
      overlay,
      onUpdate: (data) => {
        // a click on the taskbar brings it up over her: sitting on it, her legs would vanish behind it
        if (data.taskbar && !lastWindows?.taskbar && config.load().rest === 'taskbar') raiseOverlay();
        lastWindows = data;
        overlay?.webContents.send('windows:update', data);
      },
    });
    createBridge({
      port: PORT,
      // her own Claude Code chat's hooks would cover its answer with theirs
      onEvent: (evt) => !llm.isChatSession(evt.session_id) && overlay?.webContents.send('claude:event', evt),
      onDebug: DEV ? debugHandler : null,
      onGame: { ask: minecraftReply, next: minecraft.next, report: minecraft.report },
    });
    globalShortcut.register('Control+Alt+C', () => toggleVisible());
    // each start opens a new chat; it is kept only once you say something in it (chat:remember), and
    // the old ones wait in her history list
    chatBook(); // the old single history becomes a chat first
    saveMemory({ current: null, history: [], claude: null });
    refreshModels(); // for her menu's model list
    setTimeout(() => launch.launchables().catch(() => {}), 20000); // what she can open, before you ask
    screen.on('display-metrics-changed', fitOverlay);
    screen.on('display-added', () => { fitOverlay(); rebuildTray(); });
    screen.on('display-removed', () => { fitOverlay(); rebuildTray(); });
    // after sleep or a locked screen, once Windows has settled
    powerMonitor.on('resume', () => setTimeout(rearmOverlay, 2000));
    powerMonitor.on('unlock-screen', () => setTimeout(rearmOverlay, 1000));
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    windowWatch?.stop();
  });
  app.on('window-all-closed', (e) => e.preventDefault());
}

main();
