'use strict';

// Who she talks with: Ollama, any OpenAI-compatible server (local, cloud, or a keyless gateway),
// or Claude Code itself (headless `claude -p`, so your messages become its prompts).
// Keys come from config.json's `apiKeys` ({ openai: "sk-..." }) or the provider's env variable.

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const ollama = require('./ollama');

const PROVIDERS = {
  ollama: { label: 'Ollama (local)', kind: 'ollama', local: true },
  lmstudio: { label: 'LM Studio (local)', url: 'http://127.0.0.1:1234/v1', local: true },
  llamacpp: { label: 'llama.cpp / vLLM (local :8080)', url: 'http://127.0.0.1:8080/v1', local: true },
  pollinations: {
    label: 'Pollinations (no key)', url: 'https://text.pollinations.ai/openai', modelsUrl: 'https://text.pollinations.ai/models',
  },
  openrouter: { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', env: 'OPENROUTER_API_KEY' },
  openai: { label: 'OpenAI', url: 'https://api.openai.com/v1', env: 'OPENAI_API_KEY' },
  groq: { label: 'Groq', url: 'https://api.groq.com/openai/v1', env: 'GROQ_API_KEY' },
  gemini: { label: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai', env: 'GEMINI_API_KEY' },
  deepseek: { label: 'DeepSeek', url: 'https://api.deepseek.com/v1', env: 'DEEPSEEK_API_KEY' },
  mistral: { label: 'Mistral', url: 'https://api.mistral.ai/v1', env: 'MISTRAL_API_KEY' },
  custom: { label: 'Custom (customUrl in config)' },
  claude: { label: 'Claude Code (sends to the terminal agent)', kind: 'claude' },
  codex: { label: 'Codex (works on your files)', kind: 'codex' },
};

// no bypassPermissions: a chat bubble on the desktop shouldn't run anything without asking
const CLAUDE_MODES = ['default', 'acceptEdits'];

function endpoint(id, cfg) {
  const p = PROVIDERS[id];
  const url = (id === 'custom' ? cfg.customUrl : p.url) || '';
  const key = cfg.apiKeys?.[id] || (p.env && process.env[p.env]) || '';
  return { ...p, url: url.replace(/\/+$/, ''), key };
}

const headers = (key) => ({ 'content-type': 'application/json', ...(key && { authorization: `Bearer ${key}` }) });

// Why a server said no, in a sentence (Gemini sends its error inside an array), with a code when it's
// worth another try: 'busy' (too many people on it right now), 'gone' (that model isn't served anymore).
async function failure(res) {
  const body = await res.text().catch(() => '');
  let message = body.slice(0, 200) || `answered ${res.status}`;
  try {
    const parsed = JSON.parse(body);
    const err = (Array.isArray(parsed) ? parsed[0] : parsed)?.error;
    if (err) message = typeof err === 'string' ? err : err.message || message;
  } catch {
    // not JSON: the start of the body says it
  }
  const code = res.status === 429 || res.status === 503 || /overloaded|high demand|unavailable/i.test(message) ? 'busy'
    : res.status === 404 ? 'gone' : null;
  return Object.assign(new Error(message), { status: res.status, code });
}

// Gemini lists every model it has (embeddings, speech, images…): only the ones to chat with, a current
// stable Flash first (older ones get closed to new keys, previews come and go).
function geminiModels(names) {
  const version = (n) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] || 0);
  const rank = (n) => (/preview|exp/.test(n) ? 4 : 0) + (/flash-lite/.test(n) ? 1 : /flash/.test(n) ? 0 : 2);
  return names
    .filter((n) => /gemini/.test(n) && !/embed|tts|image|audio|live|veo|imagen|computer-use|robotics|aqa/.test(n))
    .filter((n) => version(n) >= 3) // 2.x answers 404 "no longer available to new users"
    .sort((a, b) => rank(a) - rank(b) || version(b) - version(a));
}

// The provider's models by name; null when it can't be reached (Ollama only), throws with why otherwise.
async function models(id, cfg) {
  const p = endpoint(id, cfg);
  if (p.kind === 'ollama') return ollama.models().catch(() => null);
  if (p.kind === 'claude') return claudeVersion().then(() => ['Claude Code']);
  if (p.kind === 'codex') return codexVersion().then(() => codexModels());
  // what's missing has a code, so her setup knows what to ask for (setup.js)
  if (!p.url) throw Object.assign(new Error('no address set for this server'), { code: 'nourl' });
  if (p.env && !p.key) throw Object.assign(new Error(`no API key (or ${p.env})`), { code: 'nokey' });
  const res = await fetch(p.modelsUrl || `${p.url}/models`, { headers: headers(p.key), signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw await failure(res);
  const body = await res.json();
  const list = Array.isArray(body) ? body : body.data || body.models || [];
  const names = list.map((m) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
  return id === 'gemini' ? geminiModels(names) : names;
}

function warm(id, model) {
  if (PROVIDERS[id].kind === 'ollama') ollama.warm(model);
}

// OpenAI-style streaming (server-sent events): onDelta(piece) as it comes, resolves with all of it.
async function openaiChat(p, { model, messages }, onDelta, signal) {
  // a server that never answers (a busy cloud model can hang without a word): given up on after
  // FIRST_WORD_MS, as 'gone', so main.js tries another of its models
  const quiet = new AbortController();
  const timer = setTimeout(() => quiet.abort(), p.local ? 360000 : FIRST_WORD_MS);
  const both = AbortSignal.any([signal, quiet.signal].filter(Boolean));
  try {
    return await openaiStream(p, { model, messages }, (piece) => { clearTimeout(timer); onDelta(piece); }, both);
  } catch (err) {
    if (!quiet.signal.aborted || signal?.aborted) throw err;
    const gone = new Error(`${model} didn't answer in ${FIRST_WORD_MS / 1000}s`);
    gone.code = 'gone';
    throw gone;
  } finally {
    clearTimeout(timer);
  }
}

const FIRST_WORD_MS = 15000;

// pictures come Ollama's way ({ content, images: [base64] }): OpenAI-style servers want them as parts
const toOpenai = (m) => (m.images?.length
  ? { role: m.role, content: [{ type: 'text', text: m.content }, ...m.images.map((b64) => ({ type: 'image_url', image_url: { url: `data:image/${b64.startsWith('iVBOR') ? 'png' : 'jpeg'};base64,${b64}` } }))] }
  : m);

async function openaiStream(p, { model, messages: given }, onDelta, signal) {
  const messages = given.map(toOpenai);
  const res = await fetch(`${p.url}/chat/completions`, {
    method: 'POST',
    headers: headers(p.key),
    // Gemini 3 thinks for a long while before the first word unless told not to
    body: JSON.stringify({ model, messages, stream: true, ...(/googleapis\.com/.test(p.url) ? { reasoning_effort: 'low' } : {}) }),
    signal,
  });
  if (!res.ok) throw await failure(res);
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let why = null; // how it ended (stop, length, content_filter…)
  // an answer with no words in it (Gemini now and then sends just an end): an error main.js retries
  const done = () => {
    if (text.trim()) return text;
    const empty = new Error(`${model} sent an empty answer${why ? ` (${why})` : ''}`);
    empty.code = 'empty';
    throw empty;
  };
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return done();
      const msg = JSON.parse(data);
      if (msg.error) throw new Error(msg.error.message || msg.error);
      why = msg.choices?.[0]?.finish_reason || why;
      const piece = msg.choices?.[0]?.delta?.content || ''; // reasoning comes apart, and is left out
      if (piece) {
        text += piece;
        onDelta(piece);
      }
    }
  }
  return done();
}

// --- Claude Code ---------------------------------------------------------------------------------
// The prompt goes in on stdin, never on the command line: the shell (needed for an npm claude.cmd)
// only ever sees fixed arguments.

const quote = (s) => (process.platform === 'win32' ? `"${s}"` : s); // cmd joins the arguments
// its session id, picked here so her hooks can tell its events from your other sessions' (main.js)
let claudeSession = null;
let claudeStarted = false; // each message after the first continues the same conversation

function claudeVersion() {
  return new Promise((resolve, reject) => {
    execFile('claude', ['--version'], { shell: process.platform === 'win32', timeout: 10000 }, (err, out) => (
      err ? reject(new Error('Claude Code not found (is `claude` on your PATH?)')) : resolve(out.trim())));
  });
}

function claudeChat(cfg, text, persona, onDelta, signal) {
  // her persona, from a file: too long and too full of quotes and newlines for cmd's command line
  const personaFile = path.join(os.tmpdir(), 'capri-persona.txt');
  fs.writeFileSync(personaFile, persona);
  const args = ['-p', '--output-format', 'stream-json', '--verbose',
    '--permission-mode', CLAUDE_MODES.includes(cfg.claudeMode) ? cfg.claudeMode : 'default',
    '--append-system-prompt-file', quote(personaFile)];
  if (!claudeSession) claudeSession = randomUUID();
  args.push(claudeStarted ? '--resume' : '--session-id', claudeSession);
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, {
      cwd: cfg.claudeCwd || os.homedir(),
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    const kill = () => (process.platform === 'win32'
      ? execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], () => {})
      : child.kill());
    signal.addEventListener('abort', kill, { once: true });
    let buffer = '';
    let all = '';
    let result = null;
    let errors = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        claudeStarted = true;
        if (msg.type === 'assistant') {
          for (const block of msg.message?.content || []) {
            if (block.type !== 'text' || !block.text) continue;
            const piece = (all ? '\n' : '') + block.text;
            all += piece;
            onDelta(piece);
          }
        } else if (msg.type === 'result') {
          result = msg;
        }
      }
    });
    child.stderr.on('data', (chunk) => { errors += chunk; });
    child.stdin.end(text);
    child.on('error', reject);
    child.on('close', () => {
      if (signal.aborted) return reject(new Error('stopped'));
      if (result?.is_error) return reject(new Error(result.result || 'Claude Code failed'));
      if (!result) return reject(new Error(errors.trim().slice(0, 300) || 'Claude Code gave no answer'));
      resolve(result.result || all);
    });
  });
}

// --- Codex ---------------------------------------------------------------------------------------
// The same idea with OpenAI's Codex CLI: `codex exec` in her work folder, the prompt on stdin, its
// events as JSON lines. Its thread goes on from one message to the next (`exec resume`). It has no
// system prompt of its own: her persona rides with the first message of a thread.

let codexThread = null;
const CODEX_MODES = ['workspace-write', 'read-only'];
const CODEX_FALLBACK = 'gpt-5.6-luna';

function codexModels() {
  try {
    const cache = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.codex', 'models_cache.json'), 'utf8'));
    const list = (cache.models || cache.data || []).map((m) => m.slug || m.id || m.model).filter((m) => m && !/review|reserve/.test(m));
    return list.length ? [...new Set([CODEX_FALLBACK, ...list])] : [CODEX_FALLBACK];
  } catch {
    return [CODEX_FALLBACK];
  }
}

function codexVersion() {
  return new Promise((resolve, reject) => {
    execFile('codex', ['--version'], { shell: process.platform === 'win32', timeout: 10000 }, (err, out) => (
      err ? reject(new Error('Codex not found (is `codex` on your PATH?)')) : resolve(out.trim())));
  });
}

function codexChat(cfg, model, text, persona, onDelta, signal) {
  const sandbox = CODEX_MODES.includes(cfg.codexMode) ? cfg.codexMode : 'workspace-write';
  const args = ['exec', '--json', '--skip-git-repo-check', '-s', sandbox, '-m', model || CODEX_FALLBACK, '-c', 'model_reasoning_effort=low'];
  args.push(...(codexThread ? ['resume', codexThread, '-'] : ['-']));
  const prompt = codexThread ? text : `${persona}\n\n---\n\n${text}`;
  return new Promise((resolve, reject) => {
    const child = spawn('codex', args, { cwd: cfg.claudeCwd || os.homedir(), shell: process.platform === 'win32', windowsHide: true });
    const kill = () => (process.platform === 'win32'
      ? execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], () => {})
      : child.kill());
    signal.addEventListener('abort', kill, { once: true });
    let buffer = '';
    let all = '';
    let failed = null;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.type === 'thread.started') codexThread = msg.thread_id;
        else if (msg.type === 'item.completed' && msg.item?.type === 'agent_message' && msg.item.text) {
          const piece = (all ? '\n' : '') + msg.item.text;
          all += piece;
          onDelta(piece);
        } else if (msg.type === 'turn.failed' || msg.type === 'error') {
          const raw = msg.error?.message || msg.message || 'Codex failed';
          try { failed = JSON.parse(raw).error?.message || raw; } catch { failed = raw; }
        }
      }
    });
    child.stdin.end(prompt);
    child.on('error', reject);
    child.on('close', () => {
      if (signal.aborted) return reject(new Error('stopped'));
      if (!all && failed) return reject(new Error(failed));
      if (!all) return reject(new Error('Codex gave no answer'));
      resolve(all);
    });
  });
}

function resetClaude() {
  claudeSession = null;
  claudeStarted = false;
  codexThread = null; // a new folder or a forgotten chat: Codex starts over too
}

// Claude Code's conversation, to save and pick up again after a restart.
const claudeMemory = () => ({ session: claudeSession, started: claudeStarted });
function restoreClaude(saved) {
  claudeSession = saved?.session || null;
  claudeStarted = Boolean(claudeSession && saved.started);
}

const isChatSession = (id) => Boolean(id) && id === claudeSession;

async function chat(id, cfg, { model, messages }, onDelta, signal) {
  const p = endpoint(id, cfg);
  if (p.kind === 'ollama') return ollama.chat({ model, messages }, onDelta, signal);
  // Claude Code keeps its own memory of the conversation: only her persona and your last message go
  if (p.kind === 'claude') return claudeChat(cfg, messages.at(-1).content, messages[0].content, onDelta, signal);
  if (p.kind === 'codex') return codexChat(cfg, model, messages.at(-1).content, messages[0].content, onDelta, signal);
  return openaiChat(p, { model, messages }, onDelta, signal);
}

// Whether her answers stay on this PC: a server on this machine.
function isLocal(id, cfg) {
  if (id === 'ollama') return /^(https?:\/\/)?(127\.0\.0\.1|localhost|0\.0\.0\.0|\[?::1\]?)(:|\/|$)/.test(process.env.OLLAMA_HOST || '127.0.0.1');
  if (id === 'custom') return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(cfg.customUrl || '');
  return Boolean(PROVIDERS[id].local);
}

module.exports = { isLocal, PROVIDERS, CLAUDE_MODES, CODEX_MODES, models, warm, chat, resetClaude, isChatSession, claudeMemory, restoreClaude };
