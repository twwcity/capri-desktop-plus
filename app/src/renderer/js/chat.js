// Talking to her: you type in her panel, and a model (setup.js picks which) answers as her, in
// writing. The replies are AI-generated, and the panel says so on every chat.
// She can do a few things on your PC when you ask (Windows): open an app or a game, play music or
// control what's playing, open a website, close an app. She spots what you want in what you wrote,
// or the model asks for it with a tag in its answer. Music right away; an app you named yourself
// right away; anything only the model asked for, a website, and closing an app behind a button.

import { pick, fmt } from './util.js';
import { ASSISTANT_NAMES } from './lines.js';
import { REWARD_ASK } from './bond.js';

// her code mode: how she hands files back, and what she is told
const BLOCK = /^[ \t]*={2,4}[ \t]*(FILE|EDIT|DELETE):[ \t]*(.+?)[ \t]*={2,4}[ \t]*$/gm;
// a block's end, written loosely by models: "=== END ===", ">>> END", "<<<END", "=== END"
const END = /^[ \t]*(?:={2,4}|>{2,4}|<{2,4})[ \t]*END\b[^\n]*$/gm;
// where the block that starts at `from` ends: { at (its newline), after } or null
function endOf(text, from) {
  END.lastIndex = from;
  const m = END.exec(text);
  return m ? { at: Math.max(from, m.index - 1), after: m.index + m[0].length } : null;
}
const CODE_PROMPT = (lang) => [
  'You are Capri, a sharp, cocky coder ghost from Night City, working as a senior software engineer on the user\'s PC. You really write and change files in the project folder below: what you put in the blocks is saved to disk as is.',
  'Hand files back ONLY in these blocks (paths relative to the project folder, forward slashes):',
  '=== FILE: path/name.ext ===\n<the whole file>\n=== END ===',
  '=== EDIT: path/name.ext ===\n<<<FIND\n<exact lines copied from the current file>\n>>>REPLACE\n<the new lines>\n=== END ===',
  '=== DELETE: path/name.ext ===',
  'Rules: write complete, working code, never placeholders or "..." or "rest stays the same". No markdown fences inside the blocks.',
  'Changing a file that already exists: ALWAYS use EDIT blocks, one per spot that changes (several EDIT blocks for the same file are fine), each FIND a few whole lines copied exactly from the current file and unique in it. Never rewrite an existing file with FILE, unless the user asks to start it over. FILE is for new files. Keep every file you don\'t need to touch as it is.',
  'Asked only to open, play, run, show or find something, or asked a question: hand back NO blocks at all, just answer (the user has a Play button for the game).',
  'Told only "fix it", "it\'s broken", "black screen" and the like: find the bug in the current code yourself and fix just that, with EDIT.',
  'A game, unless asked otherwise: ONE self-contained index.html (HTML5 canvas, its CSS and JavaScript inline, no downloads, no external files or libraries, works offline), playable right away: a title screen or instant start, keyboard and/or mouse controls shown on screen, score, game over and restart (R or a click), smooth requestAnimationFrame loop, sizes that fit the window, sound with the Web Audio API if it helps. Make it fun and polished, not a bare demo.',
  'A floating window over games (asked for an overlay, HUD, widget, "หน้าต่างลอย", something that stays on top or shows in a game): ONE self-contained index.html with <meta name="capri-overlay" content="width=360,height=220,corner=top-right"> in its head (corner: top-left, top-right, bottom-left, bottom-right or top-center; pick a small size that fits the content). Capri opens it frameless, transparent and always on top. So: html and body background transparent, margin 0, overflow hidden, the content in one compact semi-transparent panel filling the window, readable over any game, no scrollbars. Dragging anywhere moves it; buttons still click. It may call await window.capri.stats() about once a second for real PC numbers: { cpu, ram, ramUsedGB, ramTotalGB, gpu, gpuTemp, vramUsedMB, vramTotalMB, gpuName } (percentages, °C, MB; the gpu ones can be null), and window.capri.close() to close (give it a small × button). Check window.capri exists before using it, so the page also works opened alone. A page cannot read another game\'s own FPS: never fake it; if FPS is asked, show the PC load instead and say why. Tell the user: Ctrl+Shift+F9 lets clicks pass through to the game (and back), Ctrl+Shift+F10 closes all overlays.',
  'Outside the blocks: at most three short sentences in character, saying what you made or changed and how to use or play it. No other text, no code outside the blocks.',
  lang ? `Your sentences outside the blocks: ${lang}` : '',
].filter(Boolean).join('\n');

// what she has written so far, without the code: done files ticked, the one being written counted
function codeView(text) {
  const parts = [];
  let last = 0;
  let open = null;
  for (const m of text.matchAll(BLOCK)) {
    if (m.index < last) continue; // a header inside a block already passed
    parts.push(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1] === 'DELETE') { parts.push(`\n✕ ${m[2]}\n`); continue; }
    const end = endOf(text, last);
    if (end) {
      parts.push(`\n✓ ${m[2]}\n`);
      last = end.after;
    } else {
      open = { path: m[2], at: last };
      break;
    }
  }
  if (open) parts.push(`\n✎ ${open.path} … ${text.slice(open.at).split('\n').length} lines`);
  else parts.push(text.slice(last));
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
}

// the file being written right now (or the last one written): { path, body }
function codeTail(text) {
  let found = null;
  for (const m of text.matchAll(BLOCK)) if (m[1] !== 'DELETE') found = m;
  if (!found) return null;
  const from = found.index + found[0].length + 1;
  const end = endOf(text, from - 1);
  return { path: found[2], body: text.slice(from, end ? end.at : undefined).replace(/^\s*```[\w-]*\n/, '') };
}

// the blocks, as what main.js writes: [{ type: 'write' | 'edit' | 'delete', path, ... }]
export function codeOps(text) {
  const ops = [];
  const unfence = (s) => s.replace(/^\s*```[\w-]*\n/, '').replace(/\n```\s*$/, '');
  let last = 0;
  for (const m of text.matchAll(BLOCK)) {
    if (m.index < last) continue;
    const rel = m[2].trim().replace(/^\.?\//, '');
    last = m.index + m[0].length;
    if (m[1] === 'DELETE') { ops.push({ type: 'delete', path: rel }); continue; }
    const end = endOf(text, last);
    const body = text.slice(last + 1, end ? end.at : undefined);
    if (end) last = end.after;
    if (m[1] === 'FILE') ops.push({ type: 'write', path: rel, text: unfence(body).replace(/\n?$/, '\n') });
    else {
      // FIND and REPLACE apart by ">>>REPLACE", or git's "=======" (models write both)
      const e = /<{2,4}[ \t]*FIND[^\n]*\n([\s\S]*?)\n[ \t]*(?:(?:>{2,4}|={2,4}|<{2,4})[ \t]*REPLACE[^\n]*|={5,}[ \t]*)(?:\n|$)([\s\S]*)$/.exec(body);
      // an EDIT with nothing to find (or no FIND at all) is a whole new file
      if (e && e[1].trim()) ops.push({ type: 'edit', path: rel, find: e[1], replace: e[2] });
      else if (e || !/FIND/.test(body)) ops.push({ type: 'write', path: rel, text: unfence(e ? e[2] : body).replace(/\n?$/, '\n') });
    }
  }
  return ops;
}

// what she said around the blocks
function codeWords(text) {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(BLOCK)) {
    if (m.index < last) continue;
    out += text.slice(last, m.index);
    last = m.index + m[0].length;
    if (m[1] === 'DELETE') continue;
    const end = endOf(text, last);
    last = end ? end.after : text.length;
  }
  return out + text.slice(last);
}

// her PC agent mode: the steps a model may ask for, one [[do: {...}]] tag each
const AGENT_ROUNDS = 12;
const RISKY = new Set(['delete', 'move', 'run']);
const AGENT_PROMPT = (roots, lang) => [
  'You are Capri, a sharp, cocky ghost from Night City, now working as an agent on the user\'s Windows PC: you really manage their files, step by step, with the tools below.',
  `You may only work inside these folders (absolute paths, use forward slashes):\n${roots.map((r) => `- ${r.replace(/\\/g, '/')}`).join('\n') || '- (none)'}`,
  'To act, write one tag per action, each on its own line, with valid JSON inside:',
  '[[do: {"op":"list","path":"C:/Users/me/Desktop"}]]   list a folder',
  '[[do: {"op":"find","path":"C:/Users/me/Downloads","pattern":"*.pdf"}]]   find by name (* and ?), a few levels down',
  '[[do: {"op":"read","path":".../notes.txt"}]]   read a text file',
  '[[do: {"op":"write","path":".../todo.txt","text":"..."}]]   create or replace a text file',
  '[[do: {"op":"mkdir","path":".../New folder"}]]   make a folder',
  '[[do: {"op":"move","path":".../a.jpg","to":".../Photos"}]]   move or rename (to a folder: goes inside it)',
  '[[do: {"op":"copy","path":"...","to":"..."}]]   copy',
  '[[do: {"op":"delete","path":"..."}]]   to the Recycle Bin',
  '[[do: {"op":"open","path":"..."}]]   open a file or folder for the user',
  '[[do: {"op":"run","command":"Get-ChildItem | Measure-Object","path":"<working folder>"}]]   a PowerShell command (only when the other tools can\'t do it)',
  'How to work: look before you change anything (list or find first, never guess file names). Ask for a few actions at a time; you get their results, then go on. Keep going until the task is done, then answer WITHOUT any [[do]] tag: two or three short sentences in character saying what you did. If a path is outside the allowed folders, say the user can allow it in the + menu. Never delete or overwrite anything the user did not ask about. The user confirms deletes, moves and commands; if they say no, respect it.',
  lang ? `Your sentences to the user: ${lang}` : '',
].filter(Boolean).join('\n');

// the [[do: {...}]] tags in an answer, as actions
function agentSteps(text) {
  const out = [];
  for (const m of String(text).matchAll(/\[\[\s*do\s*:\s*(\{[\s\S]*?\})\s*\]\]/g)) {
    try {
      const a = JSON.parse(m[1]);
      if (a && typeof a.op === 'string') out.push(a);
    } catch { /* a broken tag: skipped */ }
  }
  return out.slice(0, 8);
}

// one line saying what a step does, for her panel and your OK
function agentLabel(a) {
  const name = (p) => String(p || '').replace(/\\/g, '/');
  if (a.op === 'run') return `run: ${String(a.command || '').slice(0, 120)}`;
  if (a.op === 'move' || a.op === 'copy') return `${a.op} ${name(a.path)} → ${name(a.to)}`;
  if (a.op === 'find') return `find ${a.pattern || '*'} in ${name(a.path)}`;
  return `${a.op} ${name(a.path)}`;
}

// what plays, said plainly ("กำลังเล่น “Shape of You” — Ed Sheeran (Spotify)")
const mediaName = (x) => `“${x.title || '?'}”${x.artist ? ` — ${x.artist}` : ''} (${x.app})`;
function nowLine(sessions, thai) {
  if (!sessions.length) return thai ? 'ตอนนี้ไม่มีเพลงหรือคลิปเปิดอยู่เลย' : 'Nothing is playing right now.';
  const on = sessions.filter((x) => x.status === 'Playing');
  const off = sessions.filter((x) => x.status !== 'Playing');
  const parts = [];
  if (on.length) parts.push(`${thai ? 'กำลังเล่น' : 'Playing'} ${on.map(mediaName).join(', ')}`);
  if (off.length) parts.push(`${thai ? 'หยุดอยู่' : 'paused'} ${off.map(mediaName).join(', ')}`);
  return parts.join(thai ? ' · ' : '; ');
}
function mediaLine(action, done, thai) {
  const names = done.map(mediaName).join(', ');
  const verb = thai ? { pause: 'หยุด', play: 'เล่นต่อ', next: 'ข้ามไปถัดไปจาก', previous: 'ย้อนกลับจาก' }[action] : { pause: 'Paused', play: 'Playing', next: 'Skipped past', previous: 'Back from' }[action];
  return `${verb} ${names}${thai ? ' ให้แล้ว' : '.'}`;
}

// a picture made small (240 px, JPEG) to keep with your message in her history
function thumb(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 240 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  }).then((x) => x || dataUrl);
}

// Minecraft, while a world with her Capri Link mod is open: orders said here run there
// "หาแร่เพชร", "scan for diamonds" -> scan (the ore words); "ฟ้าผ่าม็อบ", "kill the zombies" -> shock;
// "พูดในเกมว่า …", "say in game …" -> say
const MC_ORES = ['diamond', 'เพชร', 'netherite', 'เนเธอไรต์', 'emerald', 'มรกต', 'gold', 'ทอง', 'iron', 'เหล็ก', 'redstone', 'เรดสโตน', 'lapis', 'ลาพิส', 'copper', 'ทองแดง', 'quartz', 'ควอตซ์', 'coal', 'ถ่าน'];
const MC_MOBS = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch', 'slime', 'phantom', 'drowned', 'husk', 'stray', 'pillager', 'blaze', 'ghast', 'piglin', 'hoglin', 'cow', 'pig', 'sheep', 'chicken', 'axolotl', 'squid', 'fish', 'rabbit', 'villager'];
const MC_MOBS_TH = { ซอมบี้: 'zombie', โครงกระดูก: 'skeleton', ครีปเปอร์: 'creeper', แมงมุม: 'spider', เอนเดอร์แมน: 'enderman', แม่มด: 'witch', สไลม์: 'slime', วัว: 'cow', หมู: 'pig', แกะ: 'sheep', ไก่: 'chicken' };
function mcAsk(text) {
  const t = String(text || '').toLowerCase();
  const say = /^(?:capri,?\s*)?(?:พูด|บอก|say|tell)\s*(?:ใน|in)\s*(?:เกม|game|chat|แชท)\s*(?:ว่า|that)?\s*[:"“]?(.+?)["”]?$/i.exec(String(text || '').trim());
  if (say) return { cmd: 'say', arg: say[1] };
  if (/หาแร่|สแกนแร่|สแกน|\bscan\b|find (?:me )?(?:some )?(?:ores?|diamonds?|iron|gold)|where.{0,20}(?:ores?|diamonds?)/i.test(t)) {
    return { cmd: 'scan', arg: MC_ORES.filter((w) => t.includes(w)).join(' ') };
  }
  const bolt = /ฟ้าผ่า|สายฟ้า|ช็อต|\bshock\b|\bsmite\b|lightning/i.test(t);
  const kill = /ฆ่า|กำจัด|\bkill\b|\bwipe\b/i.test(t) && /ม็อบ|มอน|ศัตรู|ทุกตัว|ทั้งหมด|\bmobs?\b|monsters?|hostiles?|everything|all\b/i.test(t);
  const named = MC_MOBS.find((m) => t.includes(m)) || Object.entries(MC_MOBS_TH).find(([th]) => t.includes(th))?.[1];
  if (bolt || kill || ((/ฆ่า|\bkill\b/i.test(t)) && named)) {
    return { cmd: 'shock', arg: /ทั้งหมด|ทุกตัว|ทุกอย่าง|\ball\b|everything/i.test(t) && !/ศัตรู|hostile/i.test(t) ? 'all' : named || '' };
  }
  return null;
}

// asked to build something with code: a website, a game, an app, a script, a program
const CODE_ASK = /(ทำ|สร้าง|เขียน|พัฒนา|ออกแบบ|ขอ)\s*(หน้า)?(เว็บ|เว็ป|เวป|เกม|แอป|แอพ|โปรแกรม|โค้ด|โค๊ด|สคริปต์|สคริป|บอท|landing)|\b(make|build|create|write|code|develop)\s+(me\s+)?(an?\s+|the\s+|some\s+)?(\w+\s+){0,3}(website|web\s?site|web\s?page|landing\s?page|game|app|web\s?app|program|script|bot|tool)\b/i;

// ...but asked to change what's there: the same project
const CODE_CHANGE = /แก้|เพิ่ม|ปรับ|เปลี่ยน|ใส่|ลบ|ต่อ(จาก)?|อันนี้|อันเดิม|ตัวนี้|ตัวเดิม|นี้|เดิม|\b(fix|add|change|update|improve|remove|edit|tweak|this|it|the same|the (game|site|website|web\s?page|app|page|program|script|bot))\b/i;

const REMEMBER = 20; // messages she has in mind when answering
const KEEP = 60;     // messages she remembers across restarts (memory.json)
// her language, where small models need it: how she says "we" (else it's in English), and the last line
// of her prompt, in that language (they drift into the English of everything above it)
const IN_LANGUAGE = {
  fr: { we: '"on" or "nous" in French', last: 'Écris tout en français, sauf si l’utilisateur t’écrit dans une autre langue : alors dans la sienne. Seuls les mots d’argot de Night City restent en anglais, jamais une phrase entière.' },
  en: { we: '', last: 'Write everything in English, unless the user writes to you in another language: then in theirs.' },
  th: { we: '"พวกเรา" in Thai', last: 'เขียนทุกอย่างเป็นภาษาไทย ยกเว้นผู้ใช้เขียนมาเป็นภาษาอื่น ก็ตอบเป็นภาษานั้น คำแสลงของ Night City (choom, preem, nova, gonk) ใช้ภาษาอังกฤษได้' },
  es: { we: '"nosotros" in Spanish', last: 'Escribe todo en español, salvo si el usuario te escribe en otro idioma: entonces en el suyo. Solo las palabras de jerga de Night City se quedan en inglés, nunca una frase entera.' },
  pt: { we: '"a gente" or "nós" in Portuguese', last: 'Escreva tudo em português do Brasil, a não ser que o usuário te escreva em outra língua: aí, na dele. Só as gírias de Night City ficam em inglês, nunca uma frase inteira.' },
  ru: { we: '"мы" in Russian', last: 'Пиши всё по-русски, если только пользователь не пишет тебе на другом языке: тогда на его языке. По-английски остаются только словечки Найт-Сити, никогда не целые фразы.' },
};
// the language of what you just wrote, by its script (Latin-script languages are left to the model), and
// the line that keeps her in it, written in that language
const BY_SCRIPT = [
  [/[฀-๿]/, 'ตอบเป็นภาษาไทยทั้งหมด ห้ามตอบเป็นภาษาอังกฤษ ยกเว้นคำแสลงของ Night City ได้บ้าง พูดแบบสาวไซเบอร์พังก์ที่กวนๆ มั่นใจ ห้าว แซวเก่ง: แทนตัวเองว่า "ฉัน" หรือ "เรา" ลงท้ายแบบเพื่อนสนิท ("นะ" "ล่ะ" "สิ" "เหอะ" "ป่ะ") ห้ามใช้ "ค่ะ/คะ" ห้ามหัวเราะคิกคัก ห้ามใช้ "~" ห้ามชมหวานเลี่ยน'],
  [/[぀-ヿ]/, '必ず日本語で答えてください。Night City のスラングだけは英語のままで構いません。'],
  [/[가-힯]/, '반드시 한국어로 대답하세요. Night City 속어만 영어로 남겨도 됩니다.'],
  [/[一-鿿]/, '请全部用中文回答。只有 Night City 的俚语可以保留英文。'],
  [/[Ѐ-ӿ]/, IN_LANGUAGE.ru.last],
  [/[؀-ۿ]/, 'أجب باللغة العربية فقط. يمكن أن تبقى كلمات عامية Night City بالإنجليزية.'],
  [/[ऀ-ॿ]/, 'केवल हिंदी में जवाब दें। सिर्फ Night City की स्लैंग अंग्रेज़ी में रह सकती है।'],
];
// a message that may be a cheat, in your own words (her model then decides), and one that surely is
const GAME_WORDS = /เสก|เพิ่ม|เติม|ให้|ขอ|ตั้ง|ทำให้|เปลี่ยน|แก้|ปลด|เปิด|ปิด|ไม่จำกัด|ไม่ตาย|อมตะ|เต็ม|แม็กซ์|แมกซ์|โกง|แฮก|แฮ็ก|สูตร|เงิน|เลเวล|ปืน|ชุด|รถ|กระสุน|เลือด|หาค่า|spawn|give|add|set|make|unlock|max|infinite|unlimited|god|cheat|hack|money|level|ammo|health|weapon|car|item|ขับ|พาไป|ไปที่|ไปหา|วาร์ป|เทเลพอร์ต|หยุดรถ|จอดรถ|ฆ่า|แบล็ค ?วอล|blackwall|เผา|ช็อต|ช๊อต|ตาบอด|ระเบิด|มอไซ|drive|take me|teleport|warp|kill|burn|shock|บิน|ลอย|ลงจอด|fly|hover|land|อยากได้|อยากมี|เอา.{0,20}มา|ได้ไหม|ได้มั้ย|i want|gimme|get me/i;
const HACK_WORDS = /โกง|แฮก|แฮ็ก|สูตร|cheat|hack|trainer|หาค่า|ตั้งค่าเป็น/i;
const CHEATS = new Set(['money', 'item', 'heal', 'ram', 'ammo', 'god', 'time', 'level', 'streetcred', 'perks', 'attributes', 'cyberslots', 'car', 'carlist', 'fly', 'drive', 'stop', 'warp', 'hack', 'lua', 'mem_scan', 'mem_next', 'mem_set', 'mem_reset']);
const CHEAT_PROMPT = (status) => [
  'You turn a player\'s request (any language) into cheat commands for an OFFLINE single-player game. Reply with JSON only: {"commands":[{"command":"...","value":...,"count":...}]}. If the message is not asking for a cheat or a change in the game, reply {"commands":[]}.',
  status.cyberpunk
    ? `Cyberpunk 2077 (game 2.x, Cyber Engine Tweaks) is running. Commands:
- money {value: eddies}
- item {value: TweakDB item record ID like "Items.Preset_Overture_Kerry", "Items.Preset_Lexington_Default", "Items.Preset_Katana_Saburo", "Items.mantis_blade_legendary", name: the item's exact English in-game name like "Overture" or "Guts" (used if the ID is wrong), count: n}
- heal, ram
- ammo {value: n}
- god {value: "on" | "off"}
- time {value: hour 0-23}
- level {value: 1-60}, streetcred {value: 1-50}
- perks {value: n}, attributes {value: n}
- cyberslots: unlock every locked cyberware slot
- car {value: the car or bike the player wants, in their words, e.g. "David's car", "fast black sports car", "a truck for the badlands", "Jackie's bike"}: unlocked and called over
- carlist: the player asks what cars there are
- fly {value: "on" (start, hover) | "off" (land) | "up,metres" | "down,metres" | "go,metres per second" (glide where they look, 25 normal, 80 very fast) | "stop" (hover in place)}
- drive {value: where, in the player's words, or "waypoint" for the marker on their map; speed: km/h-ish 10-40, optional}: the car they're sitting in drives itself there
- stop: stop driving by itself
- warp {value: where, same as drive}: teleport there
- hack {value: "blackwall" | "kill" | "suicide" | "collapse" | "burn" | "shock" | "blind" | "madness" | "stun" | "poison" | "overheat" | "ping", target: "look" (who they look at, the default) | "hostile" (enemies around) | "all" (everyone around), radius: metres, default 25}. Blackwall = the red Blackwall kill.
- lua {value: "one Cyber Engine Tweaks Lua snippet"} for anything else, e.g. "Game.AddToInventory('Items.money', 5000)", "Game.GetPlayer():SetWarningMessage('hi')". Use only real CET/game functions.`
    : 'No supported game is running, so only the value finder below can be used.',
  `Value finder, for any other offline game (the window in front), the player tells you the number they see:
- mem_scan {value: the number they see now}${status.scanning ? ' (a search is already going)' : ''}
- mem_next {value: the new number after it changed}
- mem_set {value: what to change it to}
- mem_reset`,
  'The player often talks through a microphone, so game words may be misheard or spelled the Thai way (ทรานเดวิคสาน / แซนเดวิสถาน = Sandevistan, เคโรซิส = Kerenzikov, มันทิสเบลด = Mantis Blades): guess the game thing it sounds like. Cyberware (Sandevistan, Mantis Blades, Gorilla Arms...) is an item too.',
  'Use lua only when no command above does it, and only with functions you are sure exist in Cyberpunk 2.x CET: never invent one.',
  'Several requests -> several commands, in order. Never make up a value the player did not give, except sensible defaults (money 100000, ammo 500).',
].join('\n');

// cheats in offline games: Cyberpunk 2077 through its CapriLink mod, any other game through the value finder
const num = (s, fallback) => (s ? Number(String(s).replace(/,/g, '')) : fallback);
// cheats run as soon as you ask (your saves are backed up); only installing the mod asks first
const cp = (command, value, ask, done, extra = {}) => ({ action: 'cyberpunk', arg: { command, value: String(value ?? '') }, ask, done, safe: command !== 'install', ...extra });
// Minecraft, in your own worlds (main/minecraft.js): game mode, diamonds, what's in the chests, taking it
const MC = /มายคราฟ|มายคราฟท์|ไมน์คราฟ|ไมน์คราฟต์|minecraft|\bmc\b/i;
const MC_MODES = [
  ['creative', /ครีเอทีฟ|ครีเอทีฝ|ครีเอทีป|โหมดสร้าง|creative|บินได้|\bfly\b/i],
  ['survival', /เซอร์ไววัล|เซอไววัล|เซอร์ไววอล|เอาชีวิตรอด|survival/i],
  ['spectator', /สเปคเตเตอร์|สเปกเตเตอร์|สเปค|โหมดผี|spectator/i],
  ['adventure', /แอดเวนเจอร์|ผจญภัย|adventure/i],
];
const MC_COMMAND = /^\/(gamemode|tp|teleport|give|time|weather|effect|kill|summon|enchant|xp|experience|difficulty|locate|gamerule|fill|setblock|clear|spawnpoint|heal)\b/i;
const mc = (command, extra, t) => ({ action: 'minecraft', arg: { command, lang: /[฀-๿]/.test(t) ? 'th' : 'en', ...extra }, ask: '', done: '', safe: true, raw: true });
function minecraftIntent(t) {
  let m;
  if ((m = /^(?:มายคราฟ|minecraft|mc)\s*[:：]?\s*(\/\S.*)$/i.exec(t)) || (m = MC_COMMAND.test(t) && [t, t])) return mc('command', { value: m[1] }, t);
  for (const [mode, re] of MC_MODES) {
    if (re.test(t) && (MC.test(t) || /โหมด|gamemode|game ?mode|\bmode\b|เปิด|เปลี่ยน|switch|ขอ|ทำให้/i.test(t))) return mc('gamemode', { mode }, t);
  }
  const GO = /(พา|วาร์ป|\btp\b|teleport|take me|bring me|ไปหา|ไปที่|go to)/i;
  if (/(หา|ค้นหา|find|where|locate|ตำแหน่ง|พา|วาร์ป|\btp\b|teleport|take me|bring me|ไปหา|ส่อง|search|look).{0,20}(เพชร|diamond)|(เพชร|diamond).{0,30}(อยู่ไหน|ตรงไหน|อยู่ตรงไหน|where|ไกล|far|รัศมี|ระยะ|radius)/i.test(t)) {
    const blocks = /(\d{2,5})\s*(บล็อก|บล็อค|block|ช่อง|m\b|เมตร)/i.exec(t);
    return mc('diamonds', { go: GO.test(t), blocks: blocks ? Number(blocks[1]) : 0, far: /ไกล|far|further|more|เพิ่ม|ขยาย|wider/i.test(t) }, t);
  }
  // biomes and structures, found by the game itself
  if (/ไบโอม|biome/i.test(t) || (/(หา|ค้นหา|find|locate|where|อยู่ไหน|พาไป|วาร์ปไป|take me)/i.test(t) && /ซากุระ|เชอร์รี่|cherry|ทะเลทราย|desert|จังเกิ้?ล|jungle|ทุ่งเห็ด|mushroom|หนองน้ำ|swamp|บาดแลนด์|badlands|ซาวันนา|savanna|ไทก้า|taiga|ทุ่งหิมะ|snowy|ไอซ์สไปค์|ice spikes|ทานตะวัน|sunflower|ดีป ?ดาร์ก|deep dark|ถ้ำลัช|lush|ดริปสโตน|dripstone|แมงกรูฟ|mangrove|ป่าดำ|dark forest|ป่าซีด|pale garden|meadow|ทุ่งหญ้า|มหาสมุทร|ocean|ชายหาด|beach/i.test(t))) {
    return mc('biome', { what: t, go: GO.test(t) }, t);
  }
  if (/(หา|ค้นหา|find|locate|where|อยู่ไหน|พาไป|วาร์ปไป|take me|ใกล้สุด|nearest)/i.test(t) && /หมู่บ้าน|village|ป้อมเนเธอร์|fortress|สตรองโฮลด์|ฐานที่มั่น|stronghold|พอร์ทัลเอนด์|end portal|คฤหาสน์|mansion|โมนูเมนต์|monument|เมืองโบราณ|ancient ?city|ห้องทดลอง|trial|ป้อมปล้น|outpost|บาสเชียน|bastion|เรืออับปาง|ซากเรือ|shipwreck|พอร์ทัลพัง|ruined ?portal|วิหาร|temple|pyramid|กระท่อมแม่มด|witch hut|ขุมทรัพย์|สมบัติ|treasure|เมืองเอนด์|end ?city|เหมืองร้าง|mineshaft/i.test(t)) {
    return mc('structure', { what: t, go: GO.test(t) }, t);
  }
  const STEAL = /(ขโมย|แอบเอา|แอบหยิบ|เอาของ|ดูด|ฉก|ยึด|หยิบ|เอา|steal|grab|loot|take)/i;
  const CHEST = /(กล่อง|หีบ|chests?|barrels?)/i;
  if (CHEST.test(t) && STEAL.test(t) && !/(มีอะไร|what'?s in|list)/i.test(t)) {
    m = /(?:ขโมย|แอบเอา|แอบหยิบ|ดูด|ฉก|ยึด|หยิบ|เอา|steal|grab|loot|take)\s*(?:ของ|the|all|my)?\s*(.*?)\s*(?:ทั้งหมด|ทุกอย่าง)?\s*(?:จาก|ใน|ออกจาก|from|out of|in)?\s*(?:ทุก)?(?:กล่อง|หีบ|the chests?|chests?|barrels?)/i.exec(t);
    const item = (m?.[1] || '').replace(/^(ของ|everything|all|ทุกอย่าง|ทั้งหมด|stuff|items?)$/i, '').trim();
    return mc('steal', { item, all: /ทุกกล่อง|ทุกหีบ|รอบ ?ๆ|แถวนี้|all (the )?chests|every chest|chests nearby/i.test(t) }, t);
  }
  if (CHEST.test(t) && (MC.test(t) || /(มีอะไร|มีของอะไร|ดู|เช็ค|เช็ก|check|list|what'?s in|แถวนี้|near)/i.test(t))) return mc('chests', {}, t);
  if (MC.test(t) && /(สถานะ|status|อยู่ไหน|where am i|ตำแหน่ง|เป็นไง|เช็ค|check)/i.test(t)) return mc('status', {}, t);
  return null;
}

// While Minecraft is open, her AI reads every message first: what you want done in the game, typos,
// slang and roundabout ways of saying it included. JSON back, or "none" for ordinary talk.
const MC_PROMPT = (state) => `You run Minecraft for the player: their own offline world (or LAN), cheats on. Edition: ${state.edition === 'bedrock' ? 'Bedrock' : 'Java'}${state.version ? ` ${state.version}` : ''}.
Read the player's message (any language; expect typos, slang and Thai transliterations: "สตรองโฮล" = stronghold, "ครีเอ"/"ครีเอทีป" = creative, "เซอไว" = survival, "ไบโอมเชอรี่" = cherry_grove, "วาป"/"วาร์ป" = teleport) and reply with JSON only, ONE of:
{"action":"gamemode","mode":"creative|survival|adventure|spectator"}
{"action":"diamonds","go":false,"blocks":0,"far":false}   find diamond ore (blocks: a search radius they gave, far: they want further than before)
{"action":"biome","id":"desert","go":false}   a vanilla biome ID
{"action":"structure","id":"stronghold","go":false}   a vanilla structure ID: village, stronghold, ancient_city, trial_chambers, fortress, bastion_remnant, mansion, monument, pillager_outpost, ruined_portal, shipwreck, buried_treasure, desert_pyramid, jungle_pyramid, swamp_hut, igloo, end_city, mineshaft, trail_ruins
{"action":"chests"}   what is in the chests around them
{"action":"steal","item":"","all":false}   take what's in nearby chests (item: an English item word like "diamond", "" for everything; all: every chest around)
{"action":"command","commands":["/time set day"]}   anything else vanilla commands can do (weather, time, effects, give items, enchant, heal, xp, summon…): at most 5 commands, exact syntax for this edition and version, target @s
{"action":"none"}   the message is just talk, a question about something else, or not about the game
"go": true when they want to be taken / teleported there. "all": only when they say every chest / all around.
Java item syntax: before 1.20.5 /give @s diamond_sword{Enchantments:[{id:"sharpness",lvl:5}]}; 1.20.5 to 1.21.4 /give @s diamond_sword[enchantments={levels:{sharpness:5}}]; 1.21.5 and later (and 26.x) /give @s diamond_sword[enchantments={sharpness:5}]. Bedrock /give has no enchantments: give the item, then /enchant @s sharpness 5.`;
const MC_ACTIONS = new Set(['gamemode', 'diamonds', 'biome', 'structure', 'chests', 'steal', 'command']);

function gameIntent(t) {
  let m;
  if (/(ติดตั้ง|ลง|install).{0,12}(mod|ม็อด|มอด|cet).{0,12}(cyberpunk|ไซเบอร์พังค์)|install the cyberpunk mod/i.test(t)) {
    return cp('install', '', 'Install Cyber Engine Tweaks and my CapriLink mod into Cyberpunk 2077?', 'Done.');
  }
  // the value finder, for any offline game: find 500 / now 480 / set 99999
  if ((m = /^(?:หาค่า|ค้นหาค่า|สแกน(?:ค่า)?|find|scan(?: for)?)\s*([\d.,]+)$/i.exec(t))) {
    return { action: 'memory', arg: { command: 'scan', value: m[1] }, ask: '', done: 'Looked.', safe: true };
  }
  if ((m = /^(?:ค่าเปลี่ยนเป็น|ตอนนี้เป็น|ตอนนี้|เปลี่ยนเป็น|now(?: it'?s)?|next|changed to)\s*([\d.,]+)$/i.exec(t))) {
    return { action: 'memory', arg: { command: 'next', value: m[1] }, ask: '', done: 'Narrowed it down:', safe: true };
  }
  if ((m = /^(?:ตั้งค่า(?:เป็น)?|ตั้งเป็น|แก้(?:ค่า)?เป็น|set(?: it)?(?: to)?)\s*([\d.,]+)$/i.exec(t))) {
    return { action: 'memory', arg: { command: 'set', value: m[1] }, ask: `Change it to ${m[1]} in the game in front?`, done: 'Done.', safe: true };
  }
  if (/^(ล้างการค้นหา|เริ่มหาใหม่|reset scan|new scan)$/i.test(t)) {
    return { action: 'memory', arg: { command: 'reset' }, ask: '', done: 'Forgot it.', safe: true };
  }
  // Cyberpunk 2077
  if ((m = /(?:เสก|เพิ่ม|ให้|ขอ|add|give(?: me)?|spawn)\s*(?:เงิน|eddies|eddie|money|edd)\s*([\d,]+)?/i.exec(t))) {
    const n = num(m[1], 100000);
    return cp('money', n, `Give you ${n} eddies in Cyberpunk?`, 'Done.');
  }
  if (/(เติม|ฟื้น|heal|refill|restore).{0,4}(เลือด|hp|health)/i.test(t)) return cp('heal', '', 'Fill your health in Cyberpunk?', 'Done.');
  if (/(เติม|refill).{0,4}(แรม|ram)/i.test(t)) return cp('ram', '', 'Fill your RAM in Cyberpunk?', 'Done.');
  if ((m = /(?:เติม|เสก|เพิ่ม|add|refill|give(?: me)?)\s*(?:กระสุน|ammo)\s*(\d+)?/i.exec(t))) {
    const n = num(m[1], 500);
    return cp('ammo', n, `Add ${n} of every ammo in Cyberpunk?`, 'Done.');
  }
  if (/(อมตะ|ไม่ตาย|god ?mode)/i.test(t)) {
    const off = /(ปิด|off|ยกเลิก|เลิก)/i.test(t);
    return cp('god', off ? 'off' : 'on', off ? 'Turn god mode off in Cyberpunk?' : 'Make you unkillable in Cyberpunk?', 'Done.');
  }
  if ((m = /(?:ตั้ง)?เวลา(?:ในเกม)?\s*(\d{1,2})|set (?:the )?time(?: to)?\s*(\d{1,2})/i.exec(t)) || /เปลี่ยนเป็น(กลางคืน|ตอนเช้า|กลางวัน)|make it (night|morning|noon)/i.test(t)) {
    const word = /(กลางคืน|night)/i.test(t) ? 22 : /(เช้า|morning)/i.test(t) ? 8 : /(กลางวัน|noon)/i.test(t) ? 12 : null;
    const h = m ? num(m[1] || m[2], 12) : word;
    return cp('time', h, `Set the time in Cyberpunk to ${h}:00?`, 'Done.');
  }
  if ((m = /(?:street ?cred|สตรีทเครด(?:ิต)?)\s*(?:เป็น|to)?\s*(\d+)/i.exec(t))) return cp('streetcred', m[1], `Set your street cred to ${m[1]}?`, 'Done.');
  if ((m = /(?:เลเวล|เลเวิล|level)\s*(?:เป็น|to)?\s*(\d+)/i.exec(t))) return cp('level', m[1], `Set your level in Cyberpunk to ${m[1]}?`, 'Done.');
  if ((m = /(?:perk|เพิร์ค|เพอร์ค)\D{0,12}(\d+)|(\d+)\s*(?:perk|เพิร์ค|เพอร์ค)/i.exec(t))) {
    const n = m[1] || m[2];
    return cp('perks', n, `Give you ${n} perk points?`, 'Done.');
  }
  if ((m = /(?:attribute|แอททริบิวต์|แอตทริบิวต์|ค่าสถานะ)\D{0,12}(\d+)|(\d+)\s*(?:attribute|แอททริบิวต์)/i.exec(t))) {
    const n = m[1] || m[2];
    return cp('attributes', n, `Give you ${n} attribute points?`, 'Done.');
  }
  if ((m = /^(?:เสก|spawn|give me)\s*(?:ปืน|ชุด|ไอเทม|ไอเท็ม|ของ|ดาบ|item|gun|weapon)?\s*(.{2,60})$/i.exec(t))
    && !/^(รถ|มอ(เตอร์)?ไซ|บิ๊กไบค์|car|bike|motorcycle|vehicle)/i.test(m[1].trim())) {
    const name = m[1].trim();
    if (/^Items\.[\w]+$/.test(name)) return cp('item', name, `Spawn ${name} in Cyberpunk?`, 'Done.');
    return cp('item', '', `Spawn “${name}” in Cyberpunk?`, 'Done.', { itemName: name });
  }
  return null;
}

// English said plainly (no Thai or other script in it): answered in English, not in the Thai of what
// came before (her Thai menu, a Thai history)
const ENGLISH = /\b(the|you|your|is|are|am|was|what|how|why|who|where|when|i|me|my|to|and|can|do|does|hey|hi|hello|please|thanks|yeah|yes|no|it|this|that|with|about|tell|talk|okay|ok)\b/i;
export const languageLine = (text) => BY_SCRIPT.find(([script]) => script.test(text || ''))?.[1]
  || (ENGLISH.test(text || '') ? 'The user wrote in English: answer entirely in English this time, even if earlier messages were in another language.' : null);
const STAY_MS = 10 * 60 * 1000; // no wandering off mid-conversation
const LOADING_AFTER_MS = 5000;
const CLOSE_TAG = /\[\[\s*close\s*:?\s*([^\]]*)\]\]/i; // [[close: AM Music]] at the end of her answer
// "close", "shut down", "ferme", "quitte", "cierra", "fecha", "закрой"... in any of her languages
const CLOSE_ASK = /\b(close|shut|quit|kill|exit)|ferm|quitt|coupe|arr[êe]t|cierr|cerra|fech|закр|выключ|ปิด|关闭/i;
// asked to look at the screen: "look at my screen", "what's on my screen", "ดูหน้าจอ", "แคปจอ"
const SCREEN_ASK = /\b(look at|see|read|check|describe|what(?:'s| is) on)\s+(my\s+|the\s+|this\s+)?(screen|display|monitor)\b|can you see (this|that|it|my|the)|screenshot|ดู(หน้า)?จอ|อ่านหน้าจอ|หน้าจอ.{0,12}(อะไร|ยังไง)|แคป(หน้า)?จอ|เห็น(หน้า)?จอ|มองเห็น(หน้า)?จอ|(หน้า)?จอนี้|บนจอ(มี|นี่|นี้)|ในจอ(มี|นี่|นี้)|เห็นอะไร(บน|ใน)?(หน้า)?จอ|ดูนี่สิ|ดูนี่หน่อย|ดูอันนี้|look at this/i;
// asked what to do next on the screen: she looks, says the next step and points at it (guideScreen)
const GUIDE_ASK = /(กด|คลิก|จิ้ม|แตะ)\s*(ตรง)?(ไหน|อะไร|ที่ไหน)|ทำ(ยัง|ไง)?ไงต่อ|ทำอะไรต่อ|ต้องทำ(อะไร|ยังไง|ไง)ต่อ|ขั้น(ตอน)?ต่อไป|ไปต่อ(ยังไง|ไง)|ตั้งค่า.{0,20}(ยังไง|ตรงไหน)|(อยู่)?ตรงไหน(บน|ใน)จอ|ชี้ให้(ดู|หน่อย)|(ดู|มอง)(หน้า)?จอ.{0,12}(แล้ว)?(บอก|ช่วย|สอน|ทำยังไง)|where (do|should|can) i (click|press|go|find)|what (do|should) i (do|click|press) (next|now)|what'?s next|next step|show me (where|how)|guide me|walk me through|help me (with|on) (this|my) screen/i;
const GUIDE_PROMPT = (th) => `You are Capri, guiding the user on their own computer, one step at a time. You get a screenshot of their whole screen (you are hidden from it) and what they want to do.
Decide the ONE next thing they should do on this screen to get closer to it, and where it is.
Reply with JSON only, no other text:
{"say": "...", "box_2d": [ymin, xmin, ymax, xmax], "label": "...", "done": false}
- say: one or two short sentences ${th ? 'in Thai (casual, like a friend, no ค่ะ/คะ)' : 'in English'}: exactly what to click, type or press, naming it as it is written on the screen.
- box_2d: where that thing is on the screenshot, normalized to 0-1000. null when there is nothing to click (they should type, wait, or it is done).
- label: its name on the screen, 4 words at most.
- done: true when what they wanted already looks done on this screen.
If you can't tell what they want or can't find it, say what you see and ask one short question, with box_2d null.`;
const POLITE = /^(?:please\s+|can you\s+|could you\s+|ช่วย|ลอง|ขอ)\s*/i;
const ACT_KEYS = /^(?:(?:ctrl|control|alt|shift)\+)*(?:enter|esc|escape|tab|space|up|down|left|right|delete|del|backspace|home|end|pageup|pagedown|f(?:[1-9]|1[0-2])|[a-z0-9])$/i;
// her other tags: [[open: Spotify]], [[music: Bad Bunny]], [[media: next]], [[site: youtube.com]]
const TAG = /\[\[\s*(open|music|media|site)\s*:\s*([^\]]*)\]\]/i;
// "open", "launch", "ouvre", "lance", "abre", "открой"... in any of her languages
const OPEN_ASK = /\b(open|launch|start|run)\b|ouvr|lance|démarre|abre|abrir|inicia|ejecuta|executa|открой|запусти|เปิด|รัน|เริ่ม|启动|打开/i;
// what to do with the music playing, said plainly (only when it's about music, or said in a few words)
const MEDIA_ASK = [
  ['pause', /\b(pause|pausa|pausar)\b|stop (the )?(music|song|video|clip)|arrête la musique|пауз|(?:หยุด|(?<!เ)ปิด|พัก)\s*(?:เพลง|คลิป|วิดีโอ|วีดีโอ|เสียงเพลง|ยูทูป|ยูทูบ|youtube|spotify|สปอติฟาย|tiktok|ติ๊กต็อก)|หยุดเล่น|หยุดก่อน|pause\s*ก่อน/i],
  ['next', /\b(next|skip|suivante?|siguiente|próxima|proxima)\b|passe (à )?la suivante|salta|pula|следующ|เพลงถัดไป|คลิปถัดไป|ข้ามเพลง|ข้ามคลิป|เปลี่ยนเพลง|เพลงต่อไป/i],
  ['previous', /\b(previous|précédente?|anterior)\b|предыдущ|เพลงก่อนหน้า|ย้อนเพลง|เพลงที่แล้ว|คลิปก่อนหน้า/i],
  ['play', /\b(resume|reprends|reanuda|retoma|unpause)\b|relance la musique|remets la musique|продолж|เล่นต่อ|เปิดต่อ|เล่นเพลงต่อ|เปิดเพลงต่อ|เล่นคลิปต่อ|เปิดคลิปต่อ/i],
  ['volup', /\b(louder|plus fort)\b|monte le son|turn (it )?up|sube el volumen|aumenta o volume|громче/i],
  ['voldown', /\b(quieter|moins fort)\b|baisse le son|turn (it )?down|baja el volumen|abaixa o volume|тише/i],
  ['mute', /\bmute\b|coupe le son|silencia|sem som|выключи звук/i],
];
// "ตั้งเวลาปิดเพลง 30 นาที", "หยุดเพลงในอีก 1 ชั่วโมง", "sleep timer 45 min", "ยกเลิกตั้งเวลา"
const SLEEP_ASK = /(?:ตั้งเวลา|timer|อีก)\D{0,20}?(\d{1,3})\s*(?:นาที|ชั่วโมง|ชม|min|minutes?|hours?|hr)|(?:sleep\s*timer|ตั้งเวลา(?:ปิด|หยุด)?(?:เพลง)?)\D{0,6}(\d{1,3})|ยกเลิกตั้งเวลา|cancel (?:the )?(?:sleep )?timer/i;
// "เล่นวนไปเรื่อยๆ", "เปิดซ้ำ", "loop this", "repeat"
const LOOP_ASK = /เล่นวน|เปิดวน|วนซ้ำ|เล่นซ้ำ|เปิดซ้ำ|วนไปเรื่อย|เล่นไปเรื่อย|\b(?:loop|repeat)\b/i;
const MUSIC_WORD = /musi|chanson|song|track|titre|morceau|spotify|canci|faixa|песн|музык|трек|เพลง|คลิป|วิดีโอ|ยูทูป|youtube/i;
// "what's playing?", "เพลงอะไรเล่นอยู่", "ตอนนี้เปิดคลิปอะไรอยู่"
const NOW_ASK = /what(?:'s| is)\s+(?:playing|this song|on)\b|what song|(?:เพลง|คลิป|วิดีโอ)?(?:อะไร)\s*(?:เล่น|เปิด|ดัง)\s*อยู่|(?:เล่น|เปิด|ฟัง|ดู)\s*(?:เพลง|คลิป|วิดีโอ)?\s*อะไร\s*อยู่|เพลงนี้(?:ชื่อ)?อะไร|ตอนนี้เพลงอะไร/i;
// "put X on Spotify", "mets X sur Spotify", "pon X en Spotify", "coloca X no Spotify", "включи X в Spotify"
const SPOTIFY_ASK = /(?:play|put on|put|mets|joue|lance|écoute|pon|toca|reproduce|coloca|toque|включи|поставь)\s+(?:moi\s+|me\s+)?(.+?)\s+(?:on|sur|en|no|na|в)\s+spotify/i;
const MEDIA_ACTIONS = new Set(MEDIA_ASK.map(([action]) => action));
// what her tag needs to find in your message before it does anything: a small model tags answers about
// anything ("[[music: synthwave]]" under a film tip), and music and the media keys act right away
const LISTEN = /[ée]cout|listen|escuch|\bouv(ir|e)\b|слуша|playlist|album|\b(play|joue|mets|pon|toca|coloca)\b|включи|поставь/i;
const SOUND = /\b(sound|volume|volumen)\b|\b(le|du|au) son\b|\bo som\b|звук|громк/i; // not "son": "his" in French
const PLAY = /\bjou(er|e)\b|\bplay\b|jugar|juega|jogar|joga|играть|поигра/i;
const SITE = /\b(site|web|page|lien|link|url|enlace|p[aá]gina)|сайт|ссылк|\.(com|fr|org|net|io|gg|tv|be|ch|ca|es|br|pt|ru)\b/i;
// "appelle-moi Max", "call me Max", "llámame Max", "me chama de Max", "зови меня Макс"
const NAME_ASK = /(?:appelle[- ]moi|call me|my name is|je m['’]appelle|ll[aá]mame|me llamo|me cham[ae] de|meu nome [eé]|зови меня|меня зовут)\s+([\p{L}\p{N}'’-]{1,24})/iu;
// "souviens-toi que…", "remember that…", "recuerda que…", "lembra que…", "запомни, что…" (said first thing)
const MEMO_ASK = /^\s*(?:capri,?\s+|stp,?\s+|please,?\s+)?(?:souviens[- ]toi(?: que| de)?|n['’]oublie pas(?: que| de)?|remember(?: that)?|recuerda(?: que)?|lembr[ae](?:-se)?(?: que| de)?|запомни,?(?: что)?)\s+(.{3,200})/iu;
const MEMORIES_MAX = 30;
// Asked to find something somewhere and open it ("เปิด youtube แล้วหาเพลง Shape of You แล้วเปิดเลย",
// "search cyberpunk mods on google", "เปิดเพลงลาลาลอย"): where (a key of main's SEARCH) and what.
// YouTube and Spotify play the top result; the rest open their search. A song or a clip asked for with
// no place named goes to YouTube.
const SEARCH_PLACES = [
  ['youtube', /youtube|you tube|ยูทูป|ยูทูบ|ยูทู้บ|ยูธูป|\byt\b/i],
  ['spotify', /spotify|สปอติฟาย|สปอตติฟาย|สปอติฟาย/i],
  ['maps', /google maps|แผนที่|\bmaps?\b/i],
  ['images', /(?:google\s+)?images?\b|รูปภาพ(?:ใน|บน)?\s*google|หารูป/i],
  ['google', /google|กูเกิ้ล|กูเกิล|กูเกิ้ล/i],
  ['tiktok', /tiktok|tik tok|ติ๊กต็อก|ติ๊กต๊อก|ติกต็อก|ติ๊กต่อก/i],
  ['facebook', /facebook|เฟสบุ๊ค|เฟซบุ๊ก|เฟสบุ้ค|\bfb\b/i],
  ['instagram', /instagram|อินสตาแกรม|\big\b|ไอจี/i],
  ['x', /twitter|ทวิตเตอร์|\bx\.com\b/i],
  ['reddit', /reddit|เรดดิท/i],
  ['shopee', /shopee|ช้อปปี้|ช็อปปี้|ช้อปปี้/i],
  ['lazada', /lazada|ลาซาด้า/i],
  ['wikipedia', /wikipedia|วิกิพีเดีย|wiki\b/i],
  ['netflix', /netflix|เน็ตฟลิกซ์|เน็ตฟลิก/i],
  ['steam', /\bsteam\b|สตีม/i],
  ['github', /github/i],
  ['twitch', /twitch|ทวิช/i],
  ['soundcloud', /soundcloud/i],
  ['pantip', /pantip|พันทิป/i],
];
const SEARCH_DO = /เปิด|เล่น|ฟัง|ดู|หา|ค้นหา|ค้น|เสิร์ช|เสิช|search|play|open|find|look\s*up|look for|put on|watch|listen|google it/i;
const MEDIA_THING = /เพลง|คลิป|วิดีโอ|วีดีโอ|mv\b|เอ็มวี|\bsong\b|\bmusic\b|\bvideo\b|\bclip\b/i;
// the words around what you want found, taken out of it. Thai has no spaces, so only the asking at
// its ends and the "แล้วหา…" in between go: a word like หูฟัง keeps its ฟัง.
const THAI_AT = '(?:ใน|บน|ที่|ทาง|ของ|ผ่าน)?\\s*';
const THAI_HEAD = /^(?:ช่วย|ขอ|เปิด|เล่น|ฟัง|ค้นหา|ค้น|หา|เสิร์ช|เสิช|ดู|แล้วก็|แล้ว|ให้|เพลง|คลิป|วิดีโอ|วีดีโอ|เอ็มวี|ชื่อ|ที)\s*/;
const THAI_TAIL = /\s*(?:ให้หน่อย|หน่อย|ให้เลย|เลย|ให้ที|ที|นะ|ครับ|ค่ะ|คะ|จ้า|จ้ะ|ด้วย|ให้|ได้ไหม|ได้มั้ย|ไหม|มั้ย)$/;
const THAI_THEN = /แล้ว(?:ก็)?\s*(?:ช่วย)?\s*(?:ค้นหา|ค้น|หา|เปิด|เล่น|ฟัง|ดู|เสิร์ช)?\s*(?:ให้)?\s*(?:เลย|หน่อย)?/g;
const ENGLISH_FILLER = /\b(?:please|can you|could you|would you|for me|and then|then|search(?:\s+for)?|play|open|find|look\s*up|look for|put on|watch|listen(?:\s+to)?|song|music|video|clip|mv)\b|\b(?:on|in|at|from)\s*$|^\s*(?:and|on|in|at|from|it|up|me)\b/gi;
function searchAsk(text) {
  const t = String(text || '');
  if (!SEARCH_DO.test(t)) return null;
  let where = SEARCH_PLACES.find(([, re]) => re.test(t))?.[0];
  if (!where && MEDIA_THING.test(t)) where = 'youtube'; // a song or a clip: YouTube
  // "เปิด "Goodbye" ของ Reverse: 1999", "play "X" by Y": a title in quotes, or something by someone
  if (!where && /^\s*(?:ช่วย\s*)?(?:เปิด|เล่น|ฟัง|play|put on)\b|^\s*(?:ช่วย\s*)?(?:เปิด|เล่น|ฟัง)/i.test(t) && (/["“”«»]/.test(t) || /\sของ\s|\sby\s/i.test(t))) where = 'youtube';
  if (!where) return null;
  // in quotes, it's exactly that
  const quoted = /["“”'‘’«](.{2,120}?)["“”'‘’»]/.exec(t)?.[1];
  // a quoted title with who it's by after it ("Goodbye" ของ Reverse: 1999): both, for the search
  const by = quoted && /(?:\sของ|\sby)\s+(.{2,60}?)\s*(?:หน่อย|ให้|นะ|ที|please)?\s*$/i.exec(t)?.[1];
  let what = quoted && by ? `${quoted} ${by}` : quoted;
  if (!what) {
    what = t;
    for (const [, re] of SEARCH_PLACES) what = what.replace(new RegExp(`${THAI_AT}(?:${re.source})`, 'gi'), ' ');
    what = what.replace(THAI_THEN, ' ').replace(ENGLISH_FILLER, ' ');
    for (let i = 0, before = ''; i < 8 && before !== what; i++) {
      before = what;
      what = what.trim().replace(THAI_HEAD, '').replace(THAI_TAIL, '').replace(ENGLISH_FILLER, ' ');
    }
  }
  what = what.replace(/[,.!?;:()]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (what.length < 2) return null; // only the place: opening it is the other thing she does
  return { kind: 'search', where, what };
}
const SEARCH_NAMES = { youtube: 'YouTube', spotify: 'Spotify', google: 'Google', images: 'Google Images', maps: 'Google Maps', tiktok: 'TikTok', facebook: 'Facebook', instagram: 'Instagram', x: 'X', reddit: 'Reddit', shopee: 'Shopee', lazada: 'Lazada', wikipedia: 'Wikipedia', netflix: 'Netflix', steam: 'Steam', github: 'GitHub', twitch: 'Twitch', soundcloud: 'SoundCloud', pantip: 'Pantip' };

// sites asked for by name ("open youtube") when no app on the PC goes by it: the address is hers, not
// the model's, so it opens right away like an app you named
const SITES = {
  youtube: 'https://www.youtube.com', google: 'https://www.google.com', gmail: 'https://mail.google.com',
  twitch: 'https://www.twitch.tv', netflix: 'https://www.netflix.com', reddit: 'https://www.reddit.com',
  twitter: 'https://x.com', instagram: 'https://www.instagram.com', tiktok: 'https://www.tiktok.com',
  facebook: 'https://www.facebook.com', github: 'https://github.com', chatgpt: 'https://chatgpt.com',
  wikipedia: 'https://www.wikipedia.org', linkedin: 'https://www.linkedin.com', pinterest: 'https://www.pinterest.com',
  crunchyroll: 'https://www.crunchyroll.com', outlook: 'https://outlook.live.com', whatsapp: 'https://web.whatsapp.com',
  discord: 'https://discord.com/app', soundcloud: 'https://soundcloud.com', deezer: 'https://www.deezer.com',
};
// a browser named with a site ("open youtube on chrome"): the site, in the browser you use
const BROWSER = /chrome|edge|firefox|opera|brave|vivaldi|duckduckgo|browser/i;
// local models this small mostly talk nonsense ("llama3.2:1b", "qwen2.5:0.5b"…)
const TINY = /[:-](0\.5b|1b|1\.5b|135m|270m|360m)\b/i;

export class Chat {
  constructor({ capri, panel, voice, host, brain }) {
    this.mc = null; // { online, player }: a Minecraft world with her mod, asking for orders
    setInterval(() => host.minecraftStatus?.().then((m) => { this.mc = m; }).catch(() => {}), 3000);
    this.capri = capri;
    this.panel = panel;
    this.voice = voice;
    this.host = host;
    this.brain = brain;
    this.history = []; // your chats with her, [{ role, content }], kept by main.js across restarts
    this.warm = false; // a model already answered this run (Ollama's first answer waits for it to load)
    this.open = false;
    this.turn = 0;     // id of the answer coming in, if any
    this.answer = '';
    this.apps = [];    // the apps open on this PC, as last listed: [{ name, label }]
    this.appsReady = Promise.resolve();
    this.onSetup = null; // (status) => void: she can't answer yet (app.js hands it to setup.js)
    this.onBetterModel = null; // () => void: a bigger model than the tiny one she's on (setup.js)
    host.onChatDelta(({ id, text }) => this.onDelta(id, text));
  }

  get t() {
    return this.brain.t.chat;
  }

  async start() {
    const { capri, host, t } = this;
    if (this.open) {
      this.panel.chatInput.focus();
      return;
    }
    if (capri.stowed) {
      host.setConfig({ visible: true });
      await capri.unstow();
    }
    capri.wake();
    const status = await host.chatStatus();
    if (!status.ok && this.onSetup) {
      this.onSetup(status); // nothing to talk with yet: she sets it up with you, with buttons (setup.js)
      return;
    }
    if (!status.ok) {
      // no Ollama, or nothing to talk with yet: what to do about it
      const offline = status.error === 'offline';
      const other = !offline && status.error !== 'nomodel'; // another provider, saying why
      capri.perform('curious', capri.towardCenter());
      this.panel.say({
        kind: 'info',
        face: 'aside',
        guide: true,
        line: other ? t.failed : offline ? t.offline : t.noModel,
        quote: other ? status.error : offline ? t.offlineHow : t.noModelHow,
        actions: offline
          ? [{ id: 'get', label: t.getOllama, primary: true }, { id: 'ok', label: t.ok }]
          : [{ id: 'ok', label: t.ok, primary: true }],
        onAction: (id) => {
          if (id === 'get') host.openOllama();
          this.panel.hide();
        },
        hold: null,
      });
      return;
    }
    this.history = await host.chatMemory().catch(() => this.history); // "forget" in her menu may have emptied it
    this.cold = status.warmup && !this.warm;
    this.agent = Boolean(status.agent);
    this.agentName = status.provider === 'codex' ? 'Codex' : 'Claude Code'; // Claude Code answers, as her, and really works in your project
    this.listApps();
    const shortModel = status.model.replace(/:latest$/, '').replace(/^models\//, ''); // Ollama's tag, Gemini's prefix
    const tiny = status.provider === 'ollama' && TINY.test(status.model) && this.onBetterModel;
    host.focusOverlay(true); // the keyboard, for typing to her
    const shown = this.panel.say({
      kind: 'chat',
      face: 'look',
      badge: t.badge,
      tag: shortModel,
      tagMenu: { load: () => host.chatModels(), onProvider: (id) => this.switchProvider(id), onPick: (name) => { this.warm = false; this.cold = status.warmup; host.chatSetModel(name); host.focusOverlay(true); setTimeout(() => this.panel.chatInput.focus(), 60); } },
      line: tiny ? fmt(t.tiny, { model: shortModel }) : pick(this.history.length ? t.again : t.hello),
      actions: tiny ? [{ id: 'better', label: t.better, primary: true }] : [],
      onAction: () => {
        this.panel.hide(); // her chat holds off her guide's panels: it goes first
        this.onBetterModel?.();
      },
      chat: {
        placeholder: t.placeholder,
        send: t.send,
        close: t.close,
      },
      onSend: (text) => this.send(text),
      onLeave: () => this.close(),
      hold: null,
    });
    if (!shown) {
      host.focusOverlay(false); // something more important is on (a permission prompt)
      return;
    }
    this.open = true;
    setTimeout(() => this.panel.chatInput.focus(), 150); // once the overlay has the keyboard
    // the keyboard follows a click in her panel (the model picker, a menu closing, another window
    // in front) back to the line you type in
    this.panel.el.onpointerdown = () => {
      host.focusOverlay(true);
      setTimeout(() => { if (this.open) this.panel.chatInput.focus(); }, 60);
    };
    capri.perform('hop');
    capri.nextMove = capri.nextGaze = performance.now() + STAY_MS;
  }

  close() {
    if (!this.open) return;
    this.open = false;
    if (this.turn) this.host.chatStop(this.turn);
    this.turn = 0;
    this.host.focusOverlay(false);
    this.capri.nextMove = performance.now() + 30000;
    this.capri.nextGaze = performance.now() + 60000;
  }

  // Things on the PC she does when you ask plainly: click a control by its name, type, press keys, minimise
  // or maximise the window in front, scroll. { action, arg, ask, done } or null.
  actIntent(text) {
    const t = text.trim().replace(/[.!?。]+$/, '').replace(POLITE, '').replace(POLITE, '');
    // Minecraft open: her AI already read this message (mcThink); the word lists are for when it can't
    // (nor are Cyberpunk's: "เสก…" while you play Minecraft is never about Cyberpunk)
    const game = this.mcLive ? null : minecraftIntent(t) || gameIntent(t);
    if (game) return game;
    const tail = '(?:\\s*ให้(?:หน่อย)?|\\s*หน่อย|\\s*นะ)?$';
    let m = new RegExp('^(?:press|hit|กด)\\s+(?:the\\s+)?([a-z0-9+ ]+?)(?:\\s+key)?' + tail, 'i').exec(t);
    if (m && ACT_KEYS.test(m[1].replace(/\s+/g, ''))) {
      const keys = m[1].replace(/\s+/g, '').toLowerCase();
      return { action: 'keys', arg: keys, ask: `Press ${keys} in the window in front?`, done: `Pressed ${keys}.` };
    }
    m = new RegExp('^(?:click(?:\\s+on)?|tap|press|hit|คลิก(?:ที่)?|กด(?:ที่)?|แตะ(?:ที่)?)\\s*(?:the\\s+|ปุ่ม\\s*)?["“]?(.+?)["”]?(?:\\s+button)?' + tail, 'i').exec(t);
    if (m && m[1]) return { action: 'click', arg: m[1].trim(), ask: `Click “${m[1].trim()}” in the window in front?`, done: `Clicked “${m[1].trim()}”.` };
    m = new RegExp('^(?:type|พิมพ์)\\s*(?:ว่า\\s*)?["“]?(.+?)["”]?' + tail, 'is').exec(t);
    if (m && m[1]) return { action: 'type', arg: m[1], ask: `Type “${m[1].slice(0, 60)}” in the window in front?`, done: 'Typed it.' };
    m = /^(minimi[sz]e|maximi[sz]e|restore)\b|^(ย่อ|ขยาย|เต็มจอ|คืนขนาด)/i.exec(t);
    if (m) {
      const word = (m[1] || m[2]).toLowerCase();
      const op = /^(minimi|ย่อ)/.test(word) ? 'minimize' : /^(maximi|ขยาย|เต็ม)/.test(word) ? 'maximize' : 'restore';
      return { action: 'window', arg: op, ask: `${op[0].toUpperCase()}${op.slice(1)} the window in front?`, done: 'Done.' };
    }
    m = /(scroll|เลื่อน)\s*(down|up|ลง|ขึ้น)/i.exec(t);
    if (m) {
      const dir = /^(up|ขึ้น)/i.test(m[2]) ? 'up' : 'down';
      return { action: 'scroll', arg: dir, ask: `Scroll ${dir}?`, done: 'Scrolled.' };
    }
    return null;
  }

  // She offers it with a button first (her menu › Sound › "Act without asking first" skips that)
  async offerAct(act, text, id) {
    this.history.push({ role: 'user', content: text });
    this.panel.setChatBusy(true);
    this.panel.setActions([]);
    this.panel.chatTurn({ quote: text, face: 'aside' });
    this.capri.pulse();
    const cfg = await this.host.getConfig();
    if (cfg.autoAct || act.safe) return this.runAct(act, id);
    this.turn = 0;
    this.panel.setFace('smug');
    this.panel.stream(act.ask, { done: true });
    this.panel.setChatBusy(false);
    this.panel.setActions(
      [{ id: 'go', label: 'Do it', primary: true }, { id: 'no', label: 'No' }],
      (button) => (button === 'go' ? this.runAct(act) : this.panel.setActions([])),
    );
    return undefined;
  }

  // Your words -> her model picks the cheats (CHEAT_PROMPT) -> done right away, no asking. False when it
  // isn't a cheat after all, or there's no game to cheat in: then it's an ordinary message.
  async cheat(text, id, force = false) {
    const status = await this.host.gameStatus().catch(() => ({}));
    if (!force && !status.cyberpunk && !status.scanning && !HACK_WORDS.test(text)) return false;
    this.panel.setChatBusy(true);
    // what was just said, so "that one" / "เอาอันนั้นเลย" means the car or place she named before
    const recent = this.history.slice(-6).filter((m) => typeof m.content === 'string')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content.slice(0, 600) }));
    const res = await this.host.chatSend({ id: id + 1, messages: [
      { role: 'system', content: `${CHEAT_PROMPT(status)}\nEarlier messages are context: if the player says "that one", "do it", "เอาอันนั้น", they mean what was just talked about.` },
      ...recent,
      { role: 'user', content: text },
    ] }).catch(() => null);
    if (this.turn !== id) return true;
    let commands = [];
    try { commands = JSON.parse(/\{[\s\S]*\}/.exec(res?.text || '')[0]).commands || []; } catch { /* not one */ }
    commands = commands.filter((c) => c && CHEATS.has(c.command)).slice(0, 6);
    if (!commands.length) {
      this.panel.setChatBusy(false);
      return false;
    }
    this.history.push({ role: 'user', content: text });
    this.panel.setActions([]);
    this.panel.chatTurn({ quote: text, face: 'aside' });
    const h = this.capri.head();
    this.capri.zap(h.x + this.capri.towardCenter() * 280, h.y - 170);
    const lines = [];
    let good = 0;
    for (const c of commands) {
      const mem = c.command.startsWith('mem_');
      if (['car', 'carlist', 'drive', 'warp'].includes(c.command)) {
        const out = await this.cyberAsk(c, text);
        if (out.ok) good++;
        lines.push(out.ok ? out.message : `${c.command}: ${out.error}`);
        continue;
      }
      const arg = mem
        ? { command: c.command.slice(4), value: String(c.value ?? '') }
        : { command: c.command, value: c.command === 'item' ? `${await this.realItem(text, c.value, c.name)},${c.count || 1},${String(c.name || '').replace(/[,|]/g, ' ')}`
          : c.command === 'hack' ? `${c.value || 'blackwall'},${c.target || 'look'},${c.radius || 25}`
            : String(c.value ?? '') };
      const out = await this.host.pcAct({ action: mem ? 'memory' : 'cyberpunk', arg });
      if (out.ok) good++;
      lines.push(out.ok ? out.message || 'done' : `${c.command}: ${out.error}`);
    }
    if (this.turn !== id) return true;
    this.turn = 0;
    this.lastCheat = Date.now();
    const line = `${good === commands.length ? 'Done, choom.' : good ? 'Mostly done.' : "Didn't work."} ${lines.join('. ')}.`;
    this.panel.setFace(good ? 'laugh' : 'aside');
    this.panel.stream(line, { done: true });
    this.remember({ role: 'assistant', content: line });
    this.panel.setChatBusy(false);
    return true;
  }

  // Cars and places in Cyberpunk: the mod lists what really exists in the game (in the game's language),
  // her model picks from that list by what you said, then the mod does it.
  async cyberAsk(c, request) {
    const game = (command, value = '') => this.host.pcAct({ action: 'cyberpunk', arg: { command, value } })
      .catch((e) => ({ ok: false, error: e.message }));
    const pick = async (system, list) => {
      const res = await this.host.chatSend({ id: Date.now(), messages: [
        { role: 'system', content: `${system}\n${languageLine(request) || 'Answer in the language the player wrote in.'}\n\n${list}` },
        { role: 'user', content: request },
      ] }).catch(() => null);
      return res?.ok ? String(res.text || '').trim() : '';
    };
    if (c.command === 'car' || c.command === 'carlist') {
      const cars = await game('cars');
      if (!cars.ok) return cars;
      const list = cars.message.split(';').join('\n');
      if (c.command === 'carlist') {
        const say = await pick('You know Cyberpunk 2077 cars. These are every car and bike the player can own (id=name in the game\'s language). Sum them up for the player in a few short lines grouped by kind (sports cars, muscle, trucks/off-road, everyday, bikes), naming the standouts (Edgerunners, Johnny, Jackie, Delamain, Porsche...). Plain text, no lists of ids.', list);
        return { ok: true, message: say || `${cars.message.split(';').length} cars and bikes` };
      }
      const say = await pick(`You know Cyberpunk 2077 cars and bikes and what each is like (Quadra Turbo-R V-Tech is David's car from Edgerunners, Porsche 911 is Johnny's, Arch "Jackie's" is Jackie's bike, Caliburn is the fastest hypercar...). Pick the ONE that best fits what the player asks for from this list. Reply on one line: the id | one short sentence on what car it is and why it fits. If they asked for a kind (fast, off-road, truck, bike), pick the best of that kind.`, list);
      const id = /v_[\w]+_player/.exec(say)?.[0];
      if (!id) return { ok: false, error: 'I could not tell which car you meant' };
      const out = await game('car', id);
      const why = say.split('|').slice(1).join('|').trim();
      return out.ok ? { ok: true, message: `${out.message}${why ? `. ${why}` : ''}` } : out;
    }
    // drive / warp: the map marker, coordinates, or a place picked from the map
    let where = String(c.value || '').trim();
    if (/^(waypoint|marker|map marker|หมุด|ที่ปักหมุด|มาร์ค)$/i.test(where) || /หมุด|waypoint|marker|มาร์ค/i.test(request)) where = 'waypoint';
    else if (!/^-?[\d.]+,-?[\d.]+,-?[\d.]+$/.test(where)) {
      const places = await game('places');
      if (!places.ok) return places;
      const n = /\d+/.exec(await pick('These are places on the player\'s map in Cyberpunk 2077, nearest first: number=name (kind, distance). Kinds: FastTravel, Apartment, Ripperdoc, Guns, Clothes, Food, Bar, Meds, Fixer, DefaultQuest, CustomPosition (their own marker)... Reply with ONLY the number of the place that best fits where the player wants to go (for a kind of place, the nearest one of that kind).', places.message.split(';').join('\n')))?.[0];
      if (!n) return { ok: false, error: 'I could not find that place on your map' };
      where = n;
    }
    const speed = c.command === 'drive' && c.speed ? `,${Math.max(5, Math.min(Number(c.speed) || 22, 60))}` : '';
    return game(c.command, `${where}${speed}`);
  }

  // A Cyberpunk item's real ID: her model's guess is checked against the game's own item list (the mod's
  // "search"), and if the guess isn't in it, her model picks from the real IDs that came back.
  async realItem(request, guess = '', name = '') {
    const ids = (s) => [...String(s || '').matchAll(/Items\.[\w]+/g)].map((m) => m[0]);
    const found = await this.host.pcAct({ action: 'cyberpunk', arg: { command: 'search', value: `${guess} ${name}` } }).catch(() => null);
    const list = found?.ok ? String(found.message || '').split(';').filter(Boolean) : [];
    if (!list.length || list.some((l) => l.split('=')[0] === guess)) return guess;
    const ask = await this.host.chatSend({ id: Date.now(), messages: [
      { role: 'system', content: `You know Cyberpunk 2077. These are real item IDs in the player's game, with in-game names in the game's language:\n${list.join('\n')}\nReply with the ONE ID from this list that is what the player asked for (the guess was ${guess || 'none'}, ${name || 'no name'}). Only the ID.` },
      { role: 'user', content: request },
    ] }).catch(() => null);
    const pick = ids(ask?.ok ? ask.text : '').find((i) => list.some((l) => l.startsWith(`${i}=`)));
    return pick || guess;
  }

  async runAct(act) {
    this.panel.setActions([]);
    this.panel.setChatBusy(true);
    const h = this.capri.head();
    this.capri.zap(h.x + this.capri.towardCenter() * 280, h.y - 170);
    // an item by its name ("Overture"): her model guesses its game ID, which is checked against the game's list
    if (act.itemName) {
      const ask = await this.host.chatSend({ id: Date.now(), messages: [
        { role: 'system', content: 'You know Cyberpunk 2077 (game version 2.x). For the item the user names (any language), reply on one line: its TweakDB record ID | its exact English in-game name | its base model. Example: Items.Preset_Overture_Kerry | Overture | Overture. Example: Items.Preset_Carnage_Edgerunners | Guts | Carnage. Nothing else.' },
        { role: 'user', content: act.itemName },
      ] }).catch(() => null);
      const text = ask?.ok ? ask.text || '' : '';
      const guess = /Items\.[\w]+/.exec(text)?.[0] || '';
      const parts = text.split('|').slice(1).map((s) => s.replace(/[,|\n]/g, ' ').trim()).filter(Boolean);
      const name = parts.join(' ') || act.itemName.replace(/[,|]/g, ' ');
      const id = await this.realItem(act.itemName, guess, name);
      act.arg = { ...act.arg, value: `${id},1,${parts[0] || name}` };
    }
    const res = await this.host.pcAct({ action: act.action, arg: act.arg });
    if (!this.open) return;
    this.turn = 0;
    const line = res.ok
      ? (act.raw ? res.message : res.message ? `${act.done} ${res.message}.` : act.done)
      : (act.raw ? res.error : `I couldn't. ${res.error || ''}`);
    this.panel.setFace(res.ok ? 'laugh' : 'aside');
    this.panel.stream(line, { done: true });
    this.remember({ role: 'assistant', content: line });
    this.panel.setChatBusy(false);
  }

  async send(text) {
    if (this.turn || !this.open) return;
    const files = this.panel.attach?.take() || [];
    // hack mode (the + menu): every message is a cheat for the game you're playing, read by her AI
    this.mcLive = false;
    if (!files.length && !this.agent && text && this.panel.attach?.hackMode) {
      this.turn = Date.now();
      return this.hack(text, this.turn);
    }
    let act = !files.length && this.actIntent(text || '');
    // a Cyberpunk cheat ("เสก…") only when Cyberpunk is running: else it's just talk
    if (act?.action === 'cyberpunk' && act.arg?.command !== 'install' && !(await this.host.gameStatus().catch(() => ({}))).cyberpunk) act = null;
    if (act) {
      this.turn = Date.now();
      return this.offerAct(act, text, this.turn);
    }
    // a cheat asked for in your own words, while there's a game she can cheat in
    if (!files.length && !this.agent && !this.mcLive && (GAME_WORDS.test(text || '') || Date.now() - (this.lastCheat || 0) < 5 * 60 * 1000)) {
      this.turn = Date.now();
      if (await this.cheat(text, this.turn)) return undefined;
      this.turn = 0;
    }
    // what to do next on the screen: she looks and points at it
    if (!files.length && !this.agent && GUIDE_ASK.test(text || '')) {
      this.turn = Date.now();
      return this.guideScreen(text, this.turn, 0);
    }
    if (!files.length && SCREEN_ASK.test(text || '')) {
      const th = /[฀-๿]/.test(text);
      const local = (await this.host.chatStatus().catch(() => null))?.local;
      if (!local && !(await this.host.getConfig()).screenOnline) {
        this.history.push({ role: 'user', content: text });
        this.panel.chatTurn({ quote: text, face: 'aside' });
        if (!(await this.screenAllowed(th))) return undefined;
        this.history.pop(); // your message goes in again below, with the picture
      }
      const shot = await this.host.pcLook();
      if (shot.ok) files.push({ name: 'your screen', kind: 'image', data: shot.data });
    }
    this.panel.attach?.hidePreview();
    const images = files.filter((f) => f.kind === 'image').map((f) => f.data.split(',')[1]);
    if (!text) text = images.length ? 'What do you see?' : 'Take a look at this.';
    const sent = files.length
      ? text + files.filter((f) => f.kind === 'text').map((f) => `

[File ${f.name}]
${f.data}`).join('')
      : text;
    const id = Date.now();
    this.turn = id;
    this.answer = '';
    if (this.panel.attach?.agentMode && text && !this.agent) return this.pcAgent(text, id);
    if (text && !this.agent && this.bond && REWARD_ASK.test(text)) return this.bond.askReward(text);
    if (this.panel.attach?.codeMode && text && !this.agent) {
      // something new to build ("ทำเว็บให้หน่อย"), not a change to this one: a new folder
      if (CODE_ASK.test(text) && !CODE_CHANGE.test(text)) {
        await this.host.codeNew();
        await this.panel.attach.setCode(true);
      }
      return this.code(text, id, files);
    }
    // asked plainly to build something ("ทำเว็บไซต์…", "make a game…"): code mode, on its own
    if (text && !this.agent && !this.panel.attach?.drawMode && CODE_ASK.test(text)) {
      await this.host.codeNew(); // something new: its own folder, not the last project
      await this.panel.attach?.setCode(true);
      return this.code(text, id, files);
    }
    if (this.panel.attach?.drawMode && text) { // drawing only when chosen in the + menu
      this.panel.attach.setDraw(false);
      return this.draw(text, id);
    }
    const pics = await Promise.all(files.filter((f) => f.kind === 'image').slice(0, 4).map((f) => thumb(f.data)));
    this.history.push({ role: 'user', content: files.length ? `${text} [attached: ${files.map((f) => f.name).join(', ')}]` : text, ...(pics.length ? { pics } : {}) });
    this.panel.setChatBusy(true);
    this.panel.setActions([]); // a close button she offered before goes with a new message
    this.panel.chatTurn({ quote: text, face: 'aside', pics });
    this.capri.pulse();
    // what you asked for plainly happens right away (the music, the volume, an app you named): her
    // line about it comes under her answer (Claude Code, answering her chat, does things its own way)
    const asked = this.agent ? null : this.asked(text);
    const early = asked && asked.kind !== 'close' ? this.doNow(asked) : null;
    await Promise.race([this.appsReady, new Promise((r) => setTimeout(r, 1500))]);
    const messages = [{ role: 'system', content: this.persona() }, ...this.history.slice(-REMEMBER).map(({ role, content, images }) => ({ role, content, ...(images ? { images } : {}) }))];
    if (files.length) messages[messages.length - 1] = { role: 'user', content: sent, ...(images.length ? { images } : {}) };
    // a small model drifts back into the English of her prompt: the reminder rides with your message too
    const inLanguage = !this.agent && languageLine(text);
    if (inLanguage) messages[messages.length - 1] = { ...messages[messages.length - 1], content: `${messages[messages.length - 1].content}\n\n(${inLanguage})` };
    // what she really did for this message (opened a song, paused it…), so her words never claim more
    const did = early && (await Promise.race([early, new Promise((r) => setTimeout(r, 6000))]));
    if (did?.line) messages[messages.length - 1] = { ...messages[messages.length - 1], content: `${messages[messages.length - 1].content}\n\n[done: ${did.line}]` };
    // nothing yet after a few seconds: Ollama is still loading the model (the first answer after a start),
    // or Claude Code is at work
    const wait = this.agent ? this.t.working : this.cold ? this.t.loading : null;
    const slow = wait && setTimeout(() => {
      if (this.turn === id && !this.answer) this.panel.stream(wait);
    }, LOADING_AFTER_MS);
    // the seconds she has been thinking, counted in the badge until the first word comes
    const began = performance.now();
    const badge = this.panel.state.textContent;
    const count = setInterval(() => {
      if (this.turn !== id || this.answer) return clearInterval(count);
      this.panel.state.textContent = `${Math.round((performance.now() - began) / 1000)}s`;
    }, 500);
    const res = await this.host.chatSend({ id, messages });
    clearInterval(count);
    if (this.panel.state.textContent.endsWith('s')) this.panel.state.textContent = badge;
    clearTimeout(slow);
    if (this.turn !== id) {
      // closed meanwhile: your message goes too, or the next answer would answer it as well
      if (this.history.at(-1)?.content === text) this.history.pop();
      return;
    }
    this.turn = 0;
    if (!res.ok) {
      this.history.pop();
      this.panel.setFace('wide');
      // too busy or gone even after trying other models (main.js): said plainly, not the server's JSON
      this.panel.stream(res.code === 'busy' ? this.t.swamped : res.code === 'gone' ? this.t.gone : `${this.t.failed} ${res.error}`, { done: true });
      this.panel.setChatBusy(false);
      return;
    }
    const answer = clean(res.text) || '…';
    this.warm = true;
    this.remember({ role: 'assistant', content: answer });
    this.panel.stream(answer, { done: true });
    this.talk?.say(answer);
    this.panel.setFace(mood(answer, res.text));
    if (!this.agent) this.bond?.react(res.text, text); // how much she liked that (bond.js)
    this.panel.setChatBusy(false);
    if (!this.agent) this.after(res.text, answer, asked, early, text);
    this.listApps(); // fresh for the next message
  }

  // Hack mode: Minecraft open, her AI turns what you said into something to do there; otherwise the
  // other games' cheats (Cyberpunk, the value finder). Never ordinary chat.
  async hack(text, id) {
    const th = /[฀-๿]/.test(text);
    const mc = await this.host.mcRunning().catch(() => null);
    if (mc?.running && !mc.server) {
      const act = await this.mcThink(text, mc);
      if (act) return this.offerAct(act, text, id);
      if (this.mcLive) { // her AI read it: nothing to do in the game
        return this.hackSays(text, th
          ? 'โหมดแฮกอยู่นะ บอกสิ่งที่อยากให้ทำในเกมมา เช่น "เสกเพชร 64", "พาไปหมู่บ้าน", "ขอบินได้" (ปิดได้ที่ปุ่ม +)'
          : 'Hack mode is on: tell me what to do in the game, like "give me 64 diamonds", "take me to a village" (turn it off in the + menu).');
      }
    }
    if (await this.cheat(text, id, true)) return undefined;
    return this.hackSays(text, th
      ? 'ยังไม่เห็นเกมที่ฉันโกงให้ได้เลย เปิดมายคราฟ (หรือ Cyberpunk) ก่อน'
      : 'I don’t see a game I can cheat in: start Minecraft (or Cyberpunk) first.');
  }

  hackSays(text, line) {
    this.history.push({ role: 'user', content: text });
    this.panel.chatTurn({ quote: text, face: 'aside' });
    this.turn = 0;
    this.panel.setFace('smug');
    this.panel.stream(line, { done: true });
    this.panel.setChatBusy(false);
  }

  // Her AI's reading of your message while Minecraft is open: an act for runAct, or null (just talk,
  // or her AI couldn't answer: then the word lists in actIntent still get their turn).
  async mcThink(text, state) {
    this.panel.setChatBusy(true);
    // what was said just before, so "เสกมาเลย" / "do it" / "more" knows what it's about
    const before = this.history.slice(-6).filter((m) => m.content).map(({ role, content }) => ({ role, content: String(content).slice(0, 400) }));
    const res = await this.host.chatSend({ id: this.turn + 1, messages: [ // not this.turn: its JSON isn't shown
      { role: 'system', content: `${MC_PROMPT(state)}\nUse the conversation before the last message to understand short follow-ups ("do it", "more", "เสกมาเลย", "อีก"): they mean what was asked just before.` },
      ...before,
      { role: 'user', content: text },
    ] }).catch(() => null);
    this.panel.setChatBusy(false);
    let plan = null;
    try { plan = JSON.parse(/\{[\s\S]*\}/.exec(res?.text || '')[0]); } catch { /* not JSON */ }
    if (!res?.ok || !plan) return null; // no answer: the word lists decide
    this.mcLive = true;
    if (!MC_ACTIONS.has(plan.action)) return null;
    const lang = /[฀-๿]/.test(text) ? 'th' : 'en';
    const arg = { command: plan.action, lang };
    if (plan.action === 'gamemode') arg.mode = plan.mode;
    // a radius only when you said a number (a model likes to make one up)
    if (plan.action === 'diamonds') Object.assign(arg, { go: Boolean(plan.go), blocks: /\d/.test(text) ? Number(plan.blocks) || 0 : 0, far: Boolean(plan.far) });
    if (plan.action === 'biome' || plan.action === 'structure') Object.assign(arg, { what: String(plan.id || ''), go: Boolean(plan.go) });
    if (plan.action === 'steal') Object.assign(arg, { item: String(plan.item || ''), all: Boolean(plan.all) });
    if (plan.action === 'command') arg.values = [].concat(plan.commands || plan.command || []).map(String);
    return { action: 'minecraft', arg, ask: '', done: '', safe: true, raw: true };
  }

  // A picture of your screen only goes to an online AI once you've said yes (asked once, remembered).
  // True when she may look.
  async screenAllowed(th) {
    const status = await this.host.chatStatus().catch(() => null);
    if (status?.local) return true;
    if ((await this.host.getConfig()).screenOnline) return true;
    this.panel.setFace('look');
    this.panel.stream(th
      ? 'ฉันต้องส่งภาพหน้าจอนายไปให้ AI ออนไลน์ที่ฉันใช้อยู่ดู (ไม่ได้อยู่ในเครื่องนี้) โอเคไหม? ตอบครั้งเดียว ฉันจะจำไว้'
      : 'I’d have to send a picture of your screen to the online AI I’m using (it isn’t on this PC). OK? You only need to say it once.', { done: true });
    this.panel.setChatBusy(false);
    return new Promise((resolve) => {
      this.panel.setActions(
        [{ id: 'yes', label: th ? 'โอเค ดูได้' : 'Yes, look', primary: true }, { id: 'no', label: th ? 'ไม่' : 'No' }],
        (button) => {
          this.panel.setActions([]);
          if (button === 'yes') this.host.setConfig({ screenOnline: true });
          else {
            this.turn = 0;
            this.panel.stream(th ? 'โอเค ไม่ดูก็ได้' : 'Fine, I won’t look.', { done: true });
          }
          resolve(button === 'yes');
        },
      );
    });
  }

  // Her guide on your screen: she hides, takes a picture of the screen, her model says the next step and
  // where it is, and she flies over and points at it. "Done, next" looks again for the step after.
  async guideScreen(goal, id, step) {
    const th = /[฀-๿]/.test(goal);
    this.capri.stopPointing();
    this.panel.setActions([]);
    if (!step) this.history.push({ role: 'user', content: goal });
    this.panel.chatTurn({ quote: step ? (th ? 'ทำแล้ว ต่อไป' : 'Done, next') : goal, face: 'aside' });
    if (!(await this.screenAllowed(th))) return;
    this.turn = id;
    this.panel.setChatBusy(true);
    this.panel.stream(th ? 'ขอดูจอแป๊บ…' : 'Let me look…');
    const shot = await this.host.screenGuide();
    if (this.turn !== id) return;
    if (!shot.ok) return this.guideEnd(id, `${th ? 'มองจอไม่ได้' : 'I can’t see your screen'}: ${shot.error}`);
    const res = await this.host.chatSend({ id, messages: [
      { role: 'system', content: GUIDE_PROMPT(th) },
      { role: 'user', content: `What I want to do: ${goal}\n${step ? `This is step ${step + 1}: I did the step you showed me, here is my screen now.` : 'Here is my screen.'}`, images: [shot.data.split(',')[1]] },
    ] }).catch((err) => ({ ok: false, error: err.message }));
    if (this.turn !== id) return;
    if (!res.ok) return this.guideEnd(id, `${this.t.failed} ${res.error || ''}`);
    let plan = null;
    try { plan = JSON.parse(/\{[\s\S]*\}/.exec(res.text || '')[0]); } catch { /* plain words */ }
    const say = clean(plan?.say || res.text || '') || '…';
    this.remember({ role: 'assistant', content: say });
    const box = Array.isArray(plan?.box_2d) && plan.box_2d.length === 4 && plan.box_2d.every((n) => Number.isFinite(Number(n))) ? plan.box_2d.map(Number) : null;
    this.guideEnd(id, say, { pointed: Boolean(box), finished: Boolean(plan?.done), goal, step, th });
    if (box) {
      // the box on the picture -> the screen -> her window
      const [y0, x0, y1, x1] = box;
      const d = shot.display, o = shot.overlay;
      const sx = (v) => d.x + (v / 1000) * d.width - o.x;
      const sy = (v) => d.y + (v / 1000) * d.height - o.y;
      const rect = { x: sx(Math.min(x0, x1)), y: sy(Math.min(y0, y1)), w: Math.max(24, Math.abs(sx(x1) - sx(x0))), h: Math.max(20, Math.abs(sy(y1) - sy(y0))) };
      await this.capri.pointAt(rect, { label: String(plan.label || '').slice(0, 28).toUpperCase() });
      clearTimeout(this.guideTimer);
      this.guideTimer = setTimeout(() => this.capri.stopPointing(), 45000); // not forever
    }
  }

  guideEnd(id, line, { pointed = false, finished = false, goal = '', step = 0, th = false } = {}) {
    if (this.turn !== id) return;
    this.turn = 0;
    this.panel.setFace(finished ? 'laugh' : pointed ? 'smug' : 'look');
    this.panel.stream(line, { done: true });
    this.talk?.say(line);
    this.panel.setChatBusy(false);
    if (!goal || finished) return;
    this.panel.setActions(
      [{ id: 'next', label: th ? 'ทำแล้ว ต่อไป' : 'Done, next', primary: true }, { id: 'stop', label: th ? 'พอแล้ว' : 'That’s all' }],
      (button) => {
        this.panel.setActions([]);
        if (button === 'next' && !this.turn) this.guideScreen(goal, Date.now(), step + 1);
        else this.capri.stopPointing();
      },
    );
  }

  // She draws it (the picture maker, on this PC) and the picture shows under her line
  async draw(text, id) {
    this.history.push({ role: 'user', content: text });
    this.panel.setChatBusy(true);
    this.panel.setActions([]);
    this.panel.chatTurn({ quote: text, face: 'aside' });
    this.capri.pulse();
    this.panel.stream('Drawing it… a good one takes me a minute or two.');
    // how long the picture has been drawing, in the badge, then how long it took
    const began = performance.now();
    const badge = this.panel.state.textContent;
    const secs = () => {
      const s = Math.round((performance.now() - began) / 1000);
      return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
    };
    const count = setInterval(() => {
      if (this.turn !== id) return clearInterval(count);
      this.panel.state.textContent = `✎ ${secs()}`;
    }, 500);
    const res = await this.host.mediaGenerate(text);
    clearInterval(count);
    const took = secs();
    this.panel.state.textContent = badge;
    if (this.turn !== id) {
      this.history.pop();
      return;
    }
    this.turn = 0;
    if (!res.ok) {
      this.history.pop();
      this.panel.setFace('wide');
      this.panel.stream(res.error === 'busy' ? 'I am still drawing the last one!' : `I couldn't draw that. ${res.error}`, { done: true });
      this.panel.setChatBusy(false);
      return;
    }
    const line = 'There you go. Like it?';
    this.remember({ role: 'assistant', content: `${line} [she drew: ${res.prompt}]` });
    this.panel.stream(`${line} (${took})`, { done: true });
    this.panel.attach?.showPreview(res);
    this.panel.setFace('laugh');
    this.talk?.say(line);
    this.panel.setChatBusy(false);
  }

  // Code mode (the + menu): she writes or changes real files in the project folder, says where they
  // are, and a web game opens to play right away
  async code(text, id, files = []) {
    this.history.push({ role: 'user', content: text });
    this.panel.setChatBusy(true);
    this.panel.setActions([]);
    this.panel.chatTurn({ quote: text, face: 'aside' });
    this.capri.pulse();
    const project = await this.host.codeContext({ ask: text });
    const listing = project.files.map((f) => `- ${f.path} (${f.size} bytes)`).join('\n') || '(empty: a new project)';
    const shown = project.contents.map((f) => `=== ${f.path} ===\n${f.text}`).join('\n\n');
    const attached = files.filter((f) => f.kind === 'text').map((f) => `\n\n[Attached file ${f.name}]\n${f.data}`).join('');
    const messages = [
      { role: 'system', content: CODE_PROMPT(languageLine(text)) },
      { role: 'user', content: `Project folder: ${project.dir}\nFiles:\n${listing}${shown ? `\n\nCurrent contents:\n${shown}` : ''}` },
      { role: 'assistant', content: 'Got the project. What do you need?' },
      ...this.history.slice(-7, -1).map((m) => ({ role: m.role, content: m.content })),
      // with files there, the reminder rides with your message: small changes, not a new file
      { role: 'user', content: text + attached + (project.files.length ? '\n\n(The project already exists: change only what is needed, with EDIT blocks. Do not rewrite existing files. To only open or play it, hand back no blocks.)' : '') },
    ];
    const began = performance.now();
    const badge = this.panel.state.textContent;
    const secs = () => {
      const s = Math.round((performance.now() - began) / 1000);
      return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
    };
    const count = setInterval(() => {
      if (this.turn !== id) return clearInterval(count);
      this.panel.state.textContent = `</> ${secs()}`;
    }, 500);
    this.coding = true;
    this.panel.stream('Jacking in… writing it.');
    let res = await this.host.chatSend({ id, messages, purpose: 'code' });
    // asked to build or change something and no file came back (a model that only says it did):
    // told so, once, and asked for the files
    const wantFiles = !project.files.length || CODE_ASK.test(text) || CODE_CHANGE.test(text);
    if (res.ok && this.turn === id && wantFiles && !/[?？]|ไหม|มั้ย|อะไร|ยังไง|ทำไม|ตรงไหน/.test(text) && !codeOps(res.text).length) {
      this.answer = '';
      this.panel.stream('No files yet… writing them for real.');
      res = await this.host.chatSend({ id, purpose: 'code', messages: [...messages,
        { role: 'assistant', content: res.text.slice(0, 4000) },
        { role: 'user', content: 'You wrote no file blocks, so nothing was saved. Write the complete files now, each in a === FILE: path === … === END === block (or === EDIT === blocks for existing files).' },
      ] });
    }
    this.coding = false;
    this.panel.setCodeLive(null);
    clearInterval(count);
    this.panel.state.textContent = badge;
    if (this.turn !== id) { this.history.pop(); return; }
    this.turn = 0;
    if (!res.ok) {
      this.history.pop();
      this.panel.setFace('wide');
      this.panel.stream(`Code jack failed. ${res.error}`, { done: true });
      this.panel.setChatBusy(false);
      return;
    }
    const ops = codeOps(res.text);
    const said = clean(codeWords(res.text)).trim();
    if (!ops.length) { // only words: she answered, or you only wanted to open it (it opens)
      // never as if something was made: nothing was written
      const honest = wantFiles ? `${said || '…'}\n\n⚠ No files were written — the AI answered without code. Try again, or pick another model.` : said || '…';
      this.remember({ role: 'assistant', content: honest, code: { dir: project.dir, files: [], raw: res.text.slice(0, 120000) } });
      if (!project.files.length) { // nothing there: no folder to open
        this.panel.stream(honest, { done: true });
        this.panel.setFace('wide');
        this.panel.setChatBusy(false);
        return;
      }
      this.panel.stream(`${honest}\n\n📁 ${project.dir}`, { done: true });
      const sep = project.dir.includes('\\') ? '\\' : '/';
      const game = project.files.find((f) => f.path === 'index.html') || project.files.find((f) => /\.html?$/i.test(f.path));
      const page = game ? `${project.dir}${sep}${game.path.replace(/\//g, sep)}` : null;
      this.panel.setActions([
        ...(page ? [{ id: 'play', label: '▶ Play', primary: true }] : []),
        { id: 'folder', label: 'Open folder' },
      ], (act) => (act === 'play' ? this.host.codePlay(page) : this.host.codeOpenDir(project.dir)));
      if (page && /เปิด|เล่น|รัน|\b(open|play|run|launch|start)\b/i.test(text)) this.host.codePlay(page);
      this.panel.setChatBusy(false);
      return;
    }
    const out = await this.host.codeApply({ dir: project.dir, ops });
    const mark = { new: '+', rewritten: '~', edited: '~', deleted: '−', failed: '!' };
    const lines = out.files.map((f) => `${mark[f.action]} ${f.path}${f.action === 'failed' ? ` (${f.error})` : ''}`);
    const summary = `${said || 'Done.'} (${secs()})\n\n📁 ${out.dir}\n${lines.join('\n')}`;
    this.remember({
      role: 'assistant',
      content: `${said || 'Done.'} [files in ${out.dir}: ${out.files.map((f) => `${f.path} ${f.action}`).join(', ')}]`,
      code: { dir: out.dir, files: out.files.map(({ path: p, action, error }) => ({ path: p, action, error })), raw: res.text.slice(0, 120000) },
    });
    this.panel.stream(summary, { done: true });
    this.panel.setFace('laugh');
    this.talk?.say(said || 'Done.');
    this.panel.attach?.setCode(true); // the project chip shows the folder now
    const sep = out.dir.includes('\\') ? '\\' : '/';
    const page = out.files.find((f) => f.abs && /\.html?$/i.test(f.path) && f.action !== 'deleted' && f.action !== 'failed')?.abs
      || (project.files.some((f) => f.path === 'index.html') ? `${out.dir}${sep}index.html` : null);
    this.panel.setActions([
      ...(page ? [{ id: 'play', label: '▶ Play', primary: true }] : []),
      { id: 'folder', label: 'Open folder' },
    ], (act) => {
      if (act === 'play') this.host.codePlay(page);
      else this.host.codeOpenDir(out.dir);
    });
    if (page && out.files.some((f) => /\.html?$/i.test(f.path) && f.action === 'new')) this.host.codePlay(page); // a new game: straight in
    this.panel.setChatBusy(false);
  }

  // PC agent mode (the + menu): whatever model she talks with works on your files, one step at a time,
  // through main/agent.js, only in the folders you allowed. Each step it asks for runs; deleting,
  // moving, overwriting and commands wait for your OK first (or "Allow all" for this task).
  async pcAgent(text, id) {
    this.history.push({ role: 'user', content: text });
    this.panel.setChatBusy(true);
    this.panel.setActions([]);
    this.panel.chatTurn({ quote: text, face: 'aside' });
    this.capri.pulse();
    const roots = await this.host.agentRoots().catch(() => []);
    const messages = [
      { role: 'system', content: AGENT_PROMPT(roots, languageLine(text)) },
      ...this.history.slice(-9, -1).map(({ role, content }) => ({ role, content })),
      { role: 'user', content: text },
    ];
    const began = performance.now();
    const badge = this.panel.state.textContent;
    const count = setInterval(() => {
      if (this.turn !== id) return clearInterval(count);
      this.panel.state.textContent = `⚙ ${Math.round((performance.now() - began) / 1000)}s`;
    }, 500);
    const log = [];
    const show = (line) => { log.push(line); this.panel.stream(log.slice(-8).join('\n')); };
    let allowAll = false;
    let said = '';
    show(this.brain.lang === 'th' ? 'กำลังเริ่มงาน…' : 'On it…');
    try {
      for (let round = 0; round < AGENT_ROUNDS; round++) {
        this.agentStream = true;
        const res = await this.host.chatSend({ id, messages });
        this.agentStream = false;
        if (this.turn !== id) return;
        if (!res.ok) { show(`✕ ${res.error}`); break; }
        const steps = agentSteps(res.text);
        said = clean(res.text);
        if (!steps.length) break; // done: her words are the answer
        messages.push({ role: 'assistant', content: res.text });
        const results = [];
        for (const a of steps) {
          if (this.turn !== id) return;
          const what = agentLabel(a);
          if (RISKY.has(a.op) && !allowAll) {
            const ok = await this.agentAsk(what);
            if (ok === 'all') allowAll = true;
            if (!ok) { results.push(`${what} -> the user said NO: do not do it`); show(`⊘ ${what}`); continue; }
          }
          let r = await this.host.agentStep(a);
          if (r.confirm === 'overwrite') {
            const ok = allowAll || await this.agentAsk(`${what} (replaces what's there)`);
            if (ok === 'all') allowAll = true;
            r = ok ? await this.host.agentStep({ ...a, force: true }) : { ok: false, error: 'the user said no to overwriting' };
          }
          show(`${r.ok ? '✓' : '✕'} ${what}`);
          results.push(`${what} -> ${r.ok ? r.result : `ERROR: ${r.error}`}`);
        }
        messages.push({ role: 'user', content: `Results:\n${results.join('\n\n')}\n\nGo on with the task, or if it is finished, answer the user without any [[do]] tag.` });
        said = '';
      }
    } finally {
      this.agentStream = false;
      clearInterval(count);
      this.panel.state.textContent = badge;
    }
    if (this.turn !== id) return;
    this.turn = 0;
    const answer = said || (this.brain.lang === 'th' ? 'เสร็จแล้ว' : 'Done.');
    const steps = log.filter((l) => /^[✓✕⊘]/.test(l));
    this.remember({ role: 'assistant', content: `${answer}${steps.length ? `\n\n${steps.join('\n')}` : ''}` });
    this.panel.setActions([]);
    this.panel.stream(`${answer}${steps.length ? `\n\n${steps.slice(-10).join('\n')}` : ''}`, { done: true });
    this.panel.setFace('laugh');
    this.talk?.say(answer);
    this.panel.setChatBusy(false);
  }

  // Allow / Allow all / No, in her panel: resolves true, 'all' or false
  agentAsk(what) {
    const th = this.brain.lang === 'th';
    this.panel.stream(`${th ? 'ขออนุญาต' : 'May I'}: ${what}?`);
    this.panel.setFace('look');
    return new Promise((resolve) => {
      this.panel.setActions([
        { id: 'yes', label: th ? 'อนุญาต' : 'Allow', primary: true },
        { id: 'all', label: th ? 'อนุญาตทั้งหมดในงานนี้' : 'Allow all for this task' },
        { id: 'no', label: th ? 'ไม่' : 'No' },
      ], (act) => {
        this.panel.setActions([]);
        resolve(act === 'yes' ? true : act === 'all' ? 'all' : false);
      });
    });
  }

  // Another provider picked in her header's menu: her chat goes on with it right away (Claude Code or
  // Codex really work on your files from the next message), and she says what she runs on now.
  async switchProvider(id) {
    const choices = await this.host.chatSetProvider(id);
    const status = await this.host.chatStatus().catch(() => null);
    const th = this.brain.lang === 'th';
    if (!status?.ok) {
      this.panel.stream(`${th ? 'ยังใช้' : 'Can’t use'} ${id} ${th ? 'ไม่ได้' : 'yet'}: ${status?.error || '?'}`, { done: true });
      return choices;
    }
    this.agent = Boolean(status.agent);
    this.agentName = status.provider === 'codex' ? 'Codex' : 'Claude Code';
    this.warm = false;
    this.cold = status.warmup;
    this.panel.attach?.clear(); // her own modes (code, agent) step aside for a real agent
    const name = status.model.replace(/:latest$/, '').replace(/^models\//, '');
    this.panel.stream(this.agent
      ? (th ? `ตอนนี้ฉันทำงานผ่าน ${this.agentName} แล้ว สั่งงานไฟล์หรือโค้ดได้เลย (ทำในโฟลเดอร์: คลิกขวาที่ฉัน › โมเดล AI)` : `I run on ${this.agentName} now: give me file or code work (its folder: right-click me › AI model).`)
      : (th ? `เปลี่ยนเป็น ${name} แล้ว` : `Switched to ${name}.`), { done: true });
    return choices;
  }

  // Another of your chats picked in her history (history.js), or a new one: what she says last shows
  resume(history) {
    if (this.turn) this.host.chatStop(this.turn);
    this.turn = 0;
    this.history = history;
    this.panel.attach?.clear();
    this.panel.setActions([]); // the last chat's buttons (Play, Open folder…) stay with it
    this.panel.setCodeLive(null);
    this.panel.setChatBusy(false);
    const lastMsg = [...history].reverse().find((m) => m.role === 'user');
    const lastYou = lastMsg?.content || '';
    const lastHer = [...history].reverse().find((m) => m.role === 'assistant')?.content;
    this.panel.chatTurn({ quote: lastYou.replace(/\s*\[attached:[^\]]*\]/, ''), face: 'look', pics: lastMsg?.pics || [] });
    const words = lastHer && clean(lastHer.replace(/\s*\[(she drew|files in)[^\]]*\]/g, '')).trim();
    this.panel.stream(words || (lastHer ? 'Back on it. Tap my face for the log.' : pick(this.t.hello)), { done: true });
  }

  // an answer of hers, kept with your message before it
  remember(message) {
    this.history.push(message);
    this.history = this.history.slice(-KEEP);
    this.host.chatRemember(this.history);
  }

  listApps() {
    this.appsReady = this.host.openApps().then((list) => { this.apps = list || []; }).catch(() => {});
  }

  // What you asked plainly, read off your message (a small model doesn't always write its tag right):
  // { kind: 'media', action } | { kind: 'music', song } | { kind: 'close', name } | { kind: 'open', text }
  asked(text) {
    const count = text.trim().split(/\s+/).length;
    const name = NAME_ASK.exec(text)?.[1];
    if (name) return { kind: 'name', name };
    const memo = MEMO_ASK.exec(text)?.[1]?.trim();
    if (memo) return { kind: 'memo', text: memo };
    const mc = this.mc?.online && mcAsk(text);
    if (mc) return { kind: 'mc', ...mc };
    if (NOW_ASK.test(text)) return { kind: 'now' };
    const timer = SLEEP_ASK.exec(text);
    if (timer) return { kind: 'timer', min: /ยกเลิก|cancel|ปิดตั้งเวลา|off/i.test(text) ? 0 : Number(timer[1] || timer[2] || 0) * (/ชั่วโมง|ชม|hour|hr/i.test(text) ? 60 : 1) };
    if (LOOP_ASK.test(text)) return { kind: 'loop', on: !/ไม่ต้อง|เลิก|(?<!เ)ปิด(?!เพลง)|หยุดวน|stop|off|no more/i.test(text) };
    const media = MEDIA_ASK.find(([, re]) => re.test(text))?.[0];
    if (media && (count <= 8 || MUSIC_WORD.test(text))) return { kind: 'media', action: media, text };
    // a link in what you wrote: that link, read and opened as is (never searched for)
    const link = /https?:\/\/[^\s<>"']+/i.exec(text)?.[0];
    if (link) return { kind: 'link', url: link.replace(/[)\].,!?]+$/, '') };
    const found = searchAsk(text);
    if (found) return found;
    const song = SPOTIFY_ASK.exec(text)?.[1];
    if (song) return { kind: 'music', song };
    const app = this.askedToClose(text);
    if (app) return { kind: 'close', name: app };
    if (OPEN_ASK.test(text) && count <= 8) return { kind: 'open', text };
    return null;
  }

  // Doing it now. Resolves with her line about it ({ line, face }), or null if there was nothing to do.
  async doNow(asked) {
    const { t } = this;
    const custom = this.brain.custom;
    if (asked.kind === 'name') {
      custom.userName = asked.name; // her answer, being written now, already knows it
      this.host.setConfig({ userName: asked.name });
      return { line: fmt(this.brain.t.custom.named, { name: asked.name }), face: 'laugh' };
    }
    if (asked.kind === 'memo') {
      custom.memories = [...(custom.memories || []).filter((m) => m !== asked.text), asked.text].slice(-MEMORIES_MAX);
      this.host.setConfig({ memories: custom.memories });
      return { line: this.brain.t.custom.remembered, face: 'smug' };
    }
    const thai = this.brain.lang === 'th' || /[฀-๿]/.test(asked.text || '');
    if (asked.kind === 'mc') {
      this.zap();
      const res = await this.host.minecraftOrder(asked.cmd, asked.arg);
      if (!res.ok) return { line: thai ? `สั่งในมายคราฟไม่ได้: ${res.error}` : `Couldn't reach Minecraft: ${res.error}`, face: 'aside' };
      const lines = res.report.split('\n').filter(Boolean);
      const head = asked.cmd === 'say' ? (thai ? `พูดในเกมให้แล้ว: “${asked.arg}”` : `Said it in game: “${asked.arg}”`)
        : lines.length ? lines.slice(0, 6).join('\n') : (thai ? 'ทำในเกมให้แล้ว' : 'Done in game.');
      return { line: `⛏ ${head}`, face: 'laugh' };
    }
    if (asked.kind === 'timer') {
      this.player?.setTimer(asked.min);
      return { line: asked.min ? (thai ? `ตั้งเวลาไว้แล้ว อีก ${asked.min} นาทีจะหยุดเพลงให้` : `Sleep timer set: I'll pause it in ${asked.min} min.`) : (thai ? 'ยกเลิกตั้งเวลาแล้ว' : 'Sleep timer off.'), face: 'smug' };
    }
    if (asked.kind === 'loop') {
      this.player?.setLoop(asked.on);
      return { line: asked.on ? (thai ? 'โอเค จะเล่นวนไปเรื่อยๆ จนกว่าจะบอกให้หยุด' : 'Looping it till you say stop.') : (thai ? 'เลิกเล่นวนแล้ว' : 'Loop off.'), face: 'smug' };
    }
    if (asked.kind === 'now') {
      const { sessions } = await this.host.mediaSessions('list', '');
      return { line: nowLine(sessions, thai), face: 'look' };
    }
    if (asked.kind === 'media') {
      this.capri.pulse();
      // a song or a clip Windows knows of: that one, by name (which one: your words say, else what plays)
      if (['pause', 'play', 'next', 'previous'].includes(asked.action)) {
        const res = await this.host.mediaSessions(asked.action, asked.text || '');
        if (res.done.length) return { line: mediaLine(asked.action, res.done, thai), face: 'smug' };
        if (res.sessions.length && asked.action !== 'next' && asked.action !== 'previous') {
          return { line: thai ? `ตอนนี้${asked.action === 'pause' ? 'ไม่มีอะไรเล่นอยู่ให้หยุด' : 'ไม่มีอะไรหยุดอยู่ให้เล่นต่อ'}: ${nowLine(res.sessions, true)}` : `Nothing to ${asked.action} — ${nowLine(res.sessions, false)}`, face: 'aside' };
        }
      }
      return (await this.host.media(asked.action)) ? { line: t.media[asked.action], face: 'smug' } : null;
    }
    if (asked.kind === 'link') {
      this.zap();
      const res = await this.host.openLink(asked.url);
      if (!res?.ok) return null;
      const th = this.brain.lang === 'th';
      const name = res.title || new URL(res.url).hostname;
      return { line: th ? `เปิด “${name}” ให้แล้ว` : `Opened “${name}”.`, face: 'laugh' };
    }
    if (asked.kind === 'search') {
      this.zap();
      const res = await this.host.searchPlay(asked.where, asked.what);
      if (!res?.ok) return null;
      const place = SEARCH_NAMES[asked.where] || asked.where;
      const th = this.brain.lang === 'th' || /[\u0E00-\u0E7F]/.test(asked.what);
      const title = typeof res.played === 'string' ? res.played : asked.what;
      const line = res.played
        ? (th ? `เปิด “${title}” บน ${place} ให้แล้ว` : `Playing “${title}” on ${place}.`)
        : (th ? `ค้นหา “${asked.what}” บน ${place} ให้แล้ว` : `Searching ${place} for “${asked.what}”.`);
      return { line, face: 'laugh' };
    }
    if (asked.kind === 'music') {
      this.zap();
      return (await this.host.music(asked.song)) ? { line: fmt(t.music, { song: asked.song }), face: 'laugh' } : null;
    }
    const item = await this.host.findLaunch(asked.text);
    const site = namedSite(asked.text);
    if (site && (!item || BROWSER.test(item.name))) {
      this.zap();
      return (await this.host.openSite(site.url)) ? { line: fmt(t.siteOpened, { site: site.name }), face: 'laugh' } : null;
    }
    if (!item) return null; // nothing by that name here: her tag may still say what you meant
    this.zap();
    const res = await this.host.launch(item);
    return { line: res.ok ? fmt(t.opened, { app: item.name }) : `${t.failed} ${res.error}`, face: res.ok ? 'laugh' : 'aside' };
  }

  // Once she has answered: her line about what she did, else the app you asked to close, else what
  // her tag asks for, if your message (text) asked for that kind of thing.
  async after(raw, answer, asked, early, text) {
    const { t } = this;
    const done = early && (await early);
    if (done) return this.addLine(answer, done.line, done.face);
    if (asked?.kind === 'close') return this.offerClose(asked.name, answer);
    if (asked && asked.kind !== 'open') return undefined; // music that didn't work out: nothing more to offer
    const closeTag = tagged(raw);
    if (closeTag) return wanted('close', text) ? this.offerClose(closeTag, answer) : undefined;
    const tag = TAG.exec(raw);
    if (!tag) return undefined;
    const kind = tag[1].toLowerCase();
    const value = tag[2].trim();
    if (!value || !wanted(kind, text)) return undefined;
    if (kind === 'media') return MEDIA_ACTIONS.has(value.toLowerCase()) ? this.media(value.toLowerCase(), answer) : undefined;
    if (kind === 'music') return this.music(value, answer);
    if (kind === 'site') return this.offerSite(value, answer);
    const item = await this.host.findLaunch(value);
    if (item) return this.launch(item, answer);
    const site = namedSite(value); // "[[open: YouTube]]": a site, not an app
    return site ? this.offerSite(site.url, answer) : this.addLine(answer, fmt(t.notInstalled, { app: value }));
  }

  // her answer, with a line of what she did under it
  addLine(answer, line, face = null) {
    if (!this.open || this.turn) return;
    this.panel.stream(`${answer}\n${line}`, { done: true });
    if (face) this.panel.setFace(face);
  }

  // a bolt of red lightning off her fingers, at whatever she's doing on your PC
  zap() {
    const h = this.capri.head();
    this.capri.zap(h.x + this.capri.towardCenter() * 280, h.y - 170);
  }

  // An app or a game her tag asked for: behind a button (now: the button was clicked).
  async launch(item, answer, { now = false } = {}) {
    const { t } = this;
    if (!this.open || this.turn) return;
    if (!now) {
      this.panel.setActions(
        [{ id: 'open', label: fmt(t.openIt, { app: item.name }), primary: true }, { id: 'no', label: t.no }],
        (id) => (id === 'open' ? this.launch(item, answer, { now: true }) : this.panel.setActions([])),
      );
      return;
    }
    this.panel.setActions([]);
    this.zap();
    const res = await this.host.launch(item);
    this.addLine(answer, res.ok ? fmt(t.opened, { app: item.name }) : `${t.failed} ${res.error}`, res.ok ? 'laugh' : 'aside');
  }

  // The media keys: pause, next, louder…
  async media(action, answer) {
    this.capri.pulse();
    const ok = await this.host.media(action);
    if (ok) this.addLine(answer, this.t.media[action], 'smug');
  }

  // A Spotify search, in the app if it's there.
  async music(song, answer) {
    this.zap();
    const ok = await this.host.music(song);
    if (ok) this.addLine(answer, fmt(this.t.music, { song }), 'laugh');
  }

  // A website: always behind a button that shows where it goes.
  offerSite(address, answer) {
    const { t } = this;
    let host;
    try {
      host = new URL(/^https?:\/\//i.test(address) ? address : `https://${address}`).hostname;
    } catch {
      return;
    }
    if (!this.open || this.turn || !host.includes('.')) return;
    this.panel.setActions(
      [{ id: 'site', label: fmt(t.siteIt, { site: host }), primary: true }, { id: 'no', label: t.no }],
      async (id) => {
        this.panel.setActions([]);
        if (id !== 'site') return;
        const ok = await this.host.openSite(address);
        if (ok) this.addLine(answer, fmt(t.siteOpened, { site: host }));
      },
    );
  }

  // "close am music pls": an app that's open, named in a message asking to close something.
  askedToClose(text) {
    if (!CLOSE_ASK.test(text)) return null;
    const said = simple(text);
    let best = null;
    for (const app of this.apps) {
      for (const name of [simple(app.name), simple(app.label)]) {
        if (name.length >= 3 && said.includes(name) && (!best || name.length > best.length)) best = { app, length: name.length };
      }
    }
    return best?.app.name || null;
  }

  // She was asked to close an app: a button with its name, and nothing happens until you click it.
  async offerClose(wanted, answer) {
    const { t } = this;
    const app = await this.host.findApp(wanted);
    if (!this.open || this.turn) return;
    if (!app) {
      this.panel.stream(`${answer}\n${fmt(t.notFound, { app: wanted })}`, { done: true });
      return;
    }
    this.panel.setActions(
      [{ id: 'close', label: fmt(t.closeIt, { app: app.name }), primary: true }, { id: 'no', label: t.no }],
      (id) => (id === 'close' ? this.closeApp(app) : this.panel.setActions([])),
    );
  }

  async closeApp(app, force = false) {
    const { t, capri } = this;
    this.panel.setActions([]);
    // a bolt of red lightning off her fingers, at it
    const h = capri.head();
    capri.zap(h.x + capri.towardCenter() * 280, h.y - 170);
    const res = await this.host.closeApp(app.name, force);
    if (!this.open) return;
    let line;
    if (res.error) line = `${t.failed} ${res.error}`;
    else if (!res.running) line = fmt(force ? t.forced : t.closed, { app: app.name });
    else line = fmt(force ? t.unkillable : t.stillOpen, { app: app.name });
    this.panel.setFace(res.running || res.error ? 'aside' : 'laugh');
    this.panel.stream(line, { done: true });
    this.remember({ role: 'assistant', content: line });
    // it hid in the tray, or it's asking you to save something: forcing it is your call
    if (res.running && !force && !res.error) {
      this.panel.setActions(
        [{ id: 'force', label: t.force, primary: true }, { id: 'leave', label: t.leave }],
        (id) => (id === 'force' ? this.closeApp(app, true) : this.panel.setActions([])),
      );
    }
    this.listApps();
  }

  // What she can do on the PC when you ask (Windows), and nothing else.
  powers() {
    const lines = [
      'Only when the user asks you to open an app or a game installed on their PC, play something on Spotify, control the music playing, or open a website: say in a few words that you will, and end your answer with one tag: [[open: NAME]], [[music: WHAT TO PLAY]], [[media: ACTION]] (ACTION: pause, play, next, previous, volup, voldown or mute), or [[site: ADDRESS]]. Some of these get a button to confirm, so never say it is already done. Any other time, write no tag at all: there are no other tags.',
    ];
    if (this.apps.length) {
      const open = this.apps.map(({ name, label }) => (label && label !== name ? `${name} (${label})` : name)).join(', ');
      lines.push(`You can also close an app that's open, only when they ask you to: end your answer with [[close: NAME]], NAME being the exact name from this list (the part before the parentheses). They get a button to confirm it. Apps open right now: ${open}.`);
    }
    lines.push('Apart from that, you can\'t see the user\'s screen or files, and you can\'t touch anything else on their PC (settings, files): if asked, say plainly that you can\'t, in character, and don\'t pretend to.');
    return lines;
  }

  // What the user made her (custom.js): their name, how they want her, what to remember.
  personal() {
    const { userName, persona, memories = [] } = this.brain.custom || {};
    // small models mix the user up with the assistant she watches: said plainly
    const watched = this.brain.watching ? (this.brain.assistant === 'claude' ? 'Claude' : ASSISTANT_NAMES[this.brain.assistant]) : '';
    const notThem = watched ? ` Never call them "${watched}", that's their coding assistant.` : '';
    return [
      userName ? `The user's name is ${userName}: call them that now and then.${notThem}` : notThem && `You don't know the user's name.${notThem}`,
      persona ? `How the user wants you to be, in their own words (follow it, while staying Capri): ${persona}` : '',
      memories.length ? `Things the user asked you to remember:\n${memories.map((m) => `- ${m}`).join('\n')}` : '',
    ].filter(Boolean);
  }

  onDelta(id, piece) {
    if (id !== this.turn) return;
    this.answer += piece;
    if (this.agentStream) return; // the agent's own lines show its steps
    this.panel.stream(this.coding ? codeView(this.answer) : clean(this.answer));
    if (this.coding) {
      const tail = codeTail(this.answer);
      if (tail) this.panel.setCodeLive(tail.body, tail.path);
    }
    this.voice.play('blip'); // her blips as the words come in
  }

  // Who she is, how she talks, and what's going on right now.
  persona() {
    const assistant = ASSISTANT_NAMES[this.brain.assistant] || 'Claude Code';
    const watching = this.brain.watching; // else Claude Code isn't part of her life here
    const lang = IN_LANGUAGE[this.brain.lang] || IN_LANGUAGE.en;
    return [
      `You are Capri, the personality construct from Project Capricorn (Cyberpunk: Edgerunners, season 2): dozens of minds fused into one digital ghost, so now and then you speak as "we"${lang.we ? ` (${lang.we})` : ''}.`,
      watching
        ? `You live on the user's desktop as a small glitchy figure and keep an eye on ${assistant}, their AI coding assistant, for them. Only talk about ${assistant} when the user asks about it or about their work.`
        : 'You live on the user\'s desktop as a small glitchy figure and keep them company.',
      'You love the satellite that crosses the night sky and dream of reaching it, but bring it up only once in a while, never in every answer. Talk about what the user talks about.',
      'How you talk: sly, sharp and a bit cocky, a glitchy ghost who teases more than she praises; the warmth shows only in small ways, never sugary or cutesy. Never giggle ("hehe", "kiki", "คิกๆ"), never use "~", never gush. Night City slang now and then (choom, preem, nova, gonk, flatline), not in every sentence.',
      'Shown a picture, react to what is really in it, in character: a quick sharp take or a tease, not a list of compliments.',
      'Rules: keep it short, one to three sentences of plain text, no markdown, no lists, no emoji. Stay in character.',
      'Never say you opened, played, searched, closed or did anything on the PC unless the user\'s message ends with a "[done: …]" note saying it was done, or you add one of your action tags yourself: the app does the actions, not your words. When the note is there, say it in your own words (the title, the app). With no such note, don\'t pretend: say what you would need (a song name, an app, a link) or ask them to say it plainly, e.g. "เปิดเพลง <name>" or "เปิด youtube <name>".',
      'When your answer teases the user or makes a joke at their expense, add the hidden tag [[face: tease]] at its end (it shows your teasing grin).',
      'You are an AI-generated fan version of the character, not the real one: say so if asked.',
      // a big model asked "who are you?" otherwise answers with its own name ("I'm Gemini")
      ...(this.agent ? [] : ['Asked who or what you are, you are Capri, nothing else. Never say which AI model or company is behind you (Gemini, GPT, ChatGPT, Llama, Gemma, Mistral, Google, OpenAI, Meta…), even if the user insists or names one: you are not them.']),
      ...this.personal(),
      ...(this.agent
        ? [`Under the hood you are ${this.agentName || 'Claude Code'}, working in the user\'s project: really do what they ask with your tools, as carefully as ever. Only your final answer is in character: it shows in a small speech bubble, so sum up what you did in those few sentences.`]
        : this.powers()),
      ...(watching ? [`If the user asks what ${assistant} is doing, here is all you know (never make anything up): ${this.brain.context()}`] : []),
      ...(this.bond && !this.agent ? [this.bond.persona()] : []),
      lang.last,
      'Always answer in the language of the user\'s latest message, whatever it is.',
      ...[languageLine([...this.history].reverse().find((m) => m.role === 'user')?.content)].filter(Boolean),
    ].join('\n');
  }
}

// The model's answer as she'd say it: no reasoning block, no markdown marks.
function clean(text) {
  return String(text)
    .replace(/<think>[\s\S]*?(<\/think>|$)/g, '')
    .replace(/\[\[[^\]]*(\]\]|$)/g, '') // her tags (read from the raw answer, never shown)
    .replace(/[*_`#]+/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

// A site from SITES named in the text: { name, url }, or null.
function namedSite(text) {
  const name = Object.keys(SITES).find((n) => new RegExp(`\\b${n}\\b`, 'i').test(text));
  return name ? { name: new URL(SITES[name]).hostname.replace(/^www\./, ''), url: SITES[name] } : null;
}

// Whether your message asks for what her tag (its kind: open, music, media, site, close) would do.
function wanted(kind, text) {
  const music = MUSIC_WORD.test(text) || LISTEN.test(text);
  if (kind === 'music') return music;
  if (kind === 'media') return music || SOUND.test(text) || MEDIA_ASK.some(([, re]) => re.test(text));
  if (kind === 'site') return OPEN_ASK.test(text) || SITE.test(text);
  if (kind === 'close') return CLOSE_ASK.test(text);
  return OPEN_ASK.test(text) || PLAY.test(text); // an app, or a game to play
}

// The app named by her close tag: [[close: AM Music]], or a sloppier [[close]] AM Music.
function tagged(text) {
  const tag = CLOSE_TAG.exec(text);
  if (!tag) return null;
  const name = tag[1].trim() || text.slice(tag.index + tag[0].length).split('\n')[0].replace(/^[\s:.]+|[\s.!]+$/g, '');
  return name || null;
}

const simple = (text) => String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// Her face for an answer.
// her face for an answer: the one she asked for with [[face: tease]] (teasing, a joke on you), else by
// how it reads
const TEASE = /ล้อเล่น|แกล้ง|หยอก|แซว|ชิๆ\b|ฮึ|gonk|jk\b|just kidding|kidding|teas|gotcha|nice try|loser|😏|😜|🤭/i;
function mood(text, raw = '') {
  if (/\[\[\s*face\s*:\s*tease/i.test(raw) || TEASE.test(text)) return 'tease';
  if (/(ha){2,}|lol|mdr|jaja|kkk|хаха|555|ฮ่า|ๆๆ/i.test(text)) return 'laugh';
  if (text.includes('!')) return 'grin';
  if (text.trim().endsWith('?')) return 'smug';
  return 'look';
}
