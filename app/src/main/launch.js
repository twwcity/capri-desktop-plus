'use strict';

// Opening things when you ask her to (chat.js): an app from the Start menu (Store apps like Spotify
// included), a Steam or Epic game, your music (the media keys: pause, next…, so it works with
// Spotify and most players), a Spotify search, or a website. Windows only.

const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { shell } = require('electron');
const { powershell } = require('./apps');

const WIN = process.platform === 'win32';
// not things to open from a chat: uninstallers, help pages and the like
const SKIP = /uninstall|désinstaller|desinstalar|deinstall|readme|documentation|release notes|support center|website|manual/i;
const STEAM_SKIP = /redistributable|dedicated server|steamworks/i;
// words that don't tell apps apart ("Roblox Player" is "roblox")
const FILLER = new Set(['player', 'launcher', 'app', 'the', 'for', 'windows', 'desktop', 'client', 'x64', 'x86', 'beta']);
const CACHE_MS = 10 * 60 * 1000; // installed apps hardly change

let cache = null; // { at, items }

const plain = (text) => String(text || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const words = (text) => plain(text).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);

// Everything she can open: [{ name, kind: 'app' | 'steam' | 'epic', id }]
async function launchables() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.items;
  if (!WIN) return [];
  const items = [];
  const seen = new Set();
  const add = (item) => {
    const key = words(item.name).join(' ');
    if (!key || seen.has(key) || SKIP.test(item.name)) return;
    seen.add(key);
    items.push(item);
  };
  // games first: a game's own entry wins over a shortcut to it
  for (const game of [...steamGames(await steamRoot()), ...epicGames()]) add(game);
  // the Start menu's list is slow the first time (PowerShell starting cold): main.js asks for it early
  const out = await powershell('Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress', 45000).catch(() => null);
  for (const { Name, AppID } of [].concat(out ? JSON.parse(out) : [])) {
    if (Name && AppID && !/^https?:/i.test(AppID)) add({ name: Name, kind: 'app', id: AppID });
  }
  if (out !== null) cache = { at: Date.now(), items }; // a list that failed isn't kept: next time, again
  return items;
}

function steamRoot() {
  return new Promise((resolve) => {
    execFile('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { windowsHide: true, timeout: 5000 }, (err, out) => {
      const found = !err && /SteamPath\s+REG_SZ\s+(.+)/.exec(String(out))?.[1].trim();
      resolve(found ? path.normalize(found) : null);
    });
  });
}

// Steam's games, from the manifests in each of its libraries
function steamGames(root) {
  if (!root) return [];
  const libraries = new Set([root]);
  try {
    const vdf = fs.readFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) libraries.add(path.normalize(m[1].replace(/\\\\/g, '\\')));
  } catch {
    // one library, the main one
  }
  const games = [];
  for (const library of libraries) {
    let files = [];
    try {
      files = fs.readdirSync(path.join(library, 'steamapps')).filter((f) => /^appmanifest_\d+\.acf$/.test(f));
    } catch {
      continue;
    }
    for (const file of files) {
      try {
        const acf = fs.readFileSync(path.join(library, 'steamapps', file), 'utf8');
        const id = /"appid"\s+"(\d+)"/.exec(acf)?.[1];
        const name = /"name"\s+"([^"]+)"/.exec(acf)?.[1];
        if (id && name && !STEAM_SKIP.test(name)) games.push({ name, kind: 'steam', id });
      } catch {
        // a manifest being written: skip it
      }
    }
  }
  return games;
}

// Epic's games, from its launcher's manifests (not the Unreal Engine plugins it also keeps there)
function epicGames() {
  const dir = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.item'));
  } catch {
    return [];
  }
  const games = [];
  for (const file of files) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (m.bIsIncompleteInstall || m.CatalogNamespace === 'ue' || !m.DisplayName || !m.AppName) continue;
      games.push({ name: m.DisplayName, kind: 'epic', id: `${m.CatalogNamespace}:${m.CatalogItemId}:${m.AppName}` });
    } catch {
      // not one of its manifests
    }
  }
  return games;
}

// The one of `items` named in `text` (your message, or the name in her tag): all the words of its
// name in it, else at least half of them; the closest wins. null if nothing fits well enough.
function match(items, text) {
  const said = new Set(words(text));
  const joined = words(text).join('');
  let best = null;
  for (const item of items) {
    const key = words(item.name).filter((w) => !FILLER.has(w));
    if (!key.length) continue;
    const hits = key.filter((w) => said.has(w) || (w.length >= 5 && joined.includes(w)));
    if (!hits.some((w) => w.length >= 3) || hits.length / key.length < 0.5) continue;
    const rank = (hits.length / key.length) * 10 + hits.join('').length / 10;
    if (!best || rank > best.rank) best = { item, rank };
  }
  return best?.item || null;
}

async function find(text) {
  return match(await launchables(), text);
}

// Opens one of them (only something she listed herself): a Start menu app through its AppsFolder
// entry (desktop and Store apps alike), a game through its launcher's link.
async function launch({ kind, id } = {}) {
  const item = (await launchables()).find((i) => i.kind === kind && i.id === id);
  if (!item) throw new Error('not found');
  if (kind === 'steam') return shell.openExternal(`steam://rungameid/${id}`);
  if (kind === 'epic') return shell.openExternal(`com.epicgames.launcher://apps/${encodeURIComponent(id)}?action=launch&silent=true`);
  spawn('explorer.exe', [`shell:AppsFolder\\${id}`], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  return undefined;
}

// The media keys, as if pressed on the keyboard: whatever plays music (Spotify, a browser…) reacts.
// Play and pause are the same key; the volume moves a few steps at a time. Sent as keys (their virtual
// key codes), not typed: typed, they come out as "³" or "°" on a German keyboard.
const MEDIA = { pause: [0xb3, 1], play: [0xb3, 1], next: [0xb0, 1], previous: [0xb1, 1], volup: [0xaf, 5], voldown: [0xae, 5], mute: [0xad, 1] };
const KEY_DOWN = 1; // KEYEVENTF_EXTENDEDKEY
const KEY_UP = 3;   // ...and KEYEVENTF_KEYUP

async function media(action) {
  if (!WIN || !MEDIA[action]) return false;
  const [key, times] = MEDIA[action];
  return powershell(
    'Add-Type -Namespace Capri -Name Keys -MemberDefinition \'[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, System.UIntPtr extra);\'; '
    + `1..${times} | ForEach-Object { [Capri.Keys]::keybd_event(${key}, 0, ${KEY_DOWN}, [UIntPtr]::Zero); [Capri.Keys]::keybd_event(${key}, 0, ${KEY_UP}, [UIntPtr]::Zero) }`,
  ).then(() => true, () => false);
}

// What's playing, from Windows' own media sessions (Spotify, a browser tab, a game…), and those
// sessions told to pause, play, skip. The request goes in as base64 JSON: nothing of yours is ever
// pasted into the script. action: 'list' | 'pause' | 'play' | 'toggle' | 'next' | 'previous';
// hint: words naming one ("spotify", "youtube", a title): else pause hits what plays, play what paused.
const SESSIONS_PS = String.raw`
$req = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:CAPRI_MEDIA)) | ConvertFrom-Json
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation` + '`' + String.raw`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(5000) | Out-Null; $t.Result }
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$all = foreach ($s in $mgr.GetSessions()) {
  $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  [pscustomobject]@{ s = $s; app = $s.SourceAppUserModelId; title = $p.Title; artist = $p.Artist; status = [string]$s.GetPlaybackInfo().PlaybackStatus }
}
$all = @($all)
$hint = [string]$req.hint
$pick = $all
$web = $hint -match 'youtube|tiktok|netflix|twitch|facebook|ยูทู|ติ๊กต็อก|เว็บ|browser|chrome'
if ($hint) { $m = @($all | Where-Object { ($web -and $_.app -match 'chrome|msedge|firefox|opera|brave|vivaldi') -or $hint -match [regex]::Escape(($_.app -replace '\.exe$','' -replace '^.*[\\!]','')) -or ($_.title -and $hint.ToLower().Contains($_.title.ToLower())) -or ($_.title -and $_.title.ToLower().Contains($hint.ToLower())) }); if ($m.Count) { $pick = $m } }
$done = @()
if ($req.action -ne 'list') {
  if ($req.action -eq 'pause') { $pick = @($pick | Where-Object { $_.status -eq 'Playing' }) }
  elseif ($req.action -eq 'play') { $pick = @($pick | Where-Object { $_.status -ne 'Playing' } | Select-Object -First 1) }
  else { $playing = @($pick | Where-Object { $_.status -eq 'Playing' }); $pick = if ($playing.Count) { $playing } else { @($pick | Select-Object -First 1) } }
  foreach ($x in $pick) {
    $op = switch ($req.action) { 'pause' { $x.s.TryPauseAsync() } 'play' { $x.s.TryPlayAsync() } 'next' { $x.s.TrySkipNextAsync() } 'previous' { $x.s.TrySkipPreviousAsync() } default { $x.s.TryTogglePlayPauseAsync() } }
    if (Await $op ([bool])) { $done += $x }
  }
}
[Console]::OutputEncoding = [Text.Encoding]::UTF8
@{ sessions = @($all | Select-Object app, title, artist, status); done = @($done | Select-Object app, title, artist, status) } | ConvertTo-Json -Compress -Depth 4
`;

async function mediaSessions(action = 'list', hint = '') {
  if (!WIN) return { sessions: [], done: [] };
  const { execFile } = require('node:child_process');
  const req = Buffer.from(JSON.stringify({ action, hint: String(hint || '').slice(0, 200) })).toString('base64');
  const out = await new Promise((resolve, reject) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', SESSIONS_PS],
    { env: { ...process.env, CAPRI_MEDIA: req }, timeout: 20000, windowsHide: true }, (err, stdout) => (err ? reject(err) : resolve(stdout))));
  const j = JSON.parse(out.trim() || '{}');
  const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const tidy = (x) => ({ app: String(x.app || '').replace(/\.exe$/i, '').replace(/^.*[\\!]/, ''), title: x.title || '', artist: x.artist || '', status: x.status });
  return { sessions: arr(j.sessions).map(tidy), done: arr(j.done).map(tidy) };
}

// The media bar in her chat (media.js in the overlay) asks every second or so: one PowerShell kept
// running for it, a JSON request per line in (base64), a JSON answer per line out. Each session: its
// app, title, artist, status, position and length (seconds; position as of now), and what it allows.
const PLAYER_PS = String.raw`
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation` + '`' + String.raw`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(5000) | Out-Null; $t.Result }
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
[Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Console]::OutputEncoding = [Text.Encoding]::UTF8
while ($null -ne ($line = [Console]::In.ReadLine())) {
  try {
    $req = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($line)) | ConvertFrom-Json
    $list = @(foreach ($s in $mgr.GetSessions()) {
      $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $i = $s.GetPlaybackInfo(); $t = $s.GetTimelineProperties(); $c = $i.Controls
      $pos = $t.Position.TotalSeconds
      if ([string]$i.PlaybackStatus -eq 'Playing') { $pos += ([DateTimeOffset]::Now - $t.LastUpdatedTime).TotalSeconds }
      [pscustomobject]@{ s = $s; key = $s.SourceAppUserModelId + '|' + $p.Title; app = $s.SourceAppUserModelId; title = $p.Title; artist = $p.Artist; status = [string]$i.PlaybackStatus; pos = [math]::Round([math]::Max(0, [math]::Min($pos, $t.EndTime.TotalSeconds)), 1); end = [math]::Round($t.EndTime.TotalSeconds, 1); seek = $c.IsPlaybackPositionEnabled; next = $c.IsNextEnabled; prev = $c.IsPreviousEnabled }
    })
    $x = @($list | Where-Object { $_.key -eq $req.key }) + @($list | Where-Object { $_.status -eq 'Playing' }) + $list | Select-Object -First 1
    $ok = $false
    $thumb = $null
    if ($x -and $req.action -eq 'thumb') {
      $p = Await ($x.s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      if ($p.Thumbnail) {
        $st = Await ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
        $size = [Windows.Storage.Streams.IRandomAccessStream].GetProperty('Size').GetValue($st)
        $in = [Windows.Storage.Streams.IRandomAccessStream].GetMethod('GetInputStreamAt').Invoke($st, @([uint64]0))
        $rd = [Windows.Storage.Streams.DataReader]::new($in)
        $n = Await ($rd.LoadAsync([uint32]$size)) ([uint32])
        $bytes = [byte[]]::new($n); $rd.ReadBytes($bytes)
        $thumb = [Convert]::ToBase64String($bytes)
      }
    }
    if ($x -and $req.action -ne 'state' -and $req.action -ne 'thumb') {
      $op = switch ($req.action) {
        'toggle' { $x.s.TryTogglePlayPauseAsync() } 'pause' { $x.s.TryPauseAsync() } 'play' { $x.s.TryPlayAsync() }
        'next' { $x.s.TrySkipNextAsync() } 'previous' { $x.s.TrySkipPreviousAsync() }
        'seek' { $x.s.TryChangePlaybackPositionAsync([long]([math]::Max(0, [double]$req.value) * 10000000)) }
      }
      if ($op) { $ok = Await $op ([bool]) }
    }
    @{ id = $req.id; ok = $ok; thumb = $thumb; key = $x.key; sessions = @($list | Select-Object key, app, title, artist, status, pos, end, seek, next, prev) } | ConvertTo-Json -Compress -Depth 4
  } catch { @{ id = $null; error = $_.Exception.Message } | ConvertTo-Json -Compress }
}
`;

let player = null;
function playerServer() {
  if (player && !player.child.killed && player.child.exitCode === null) return player;
  const { spawn } = require('node:child_process');
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PLAYER_PS], { windowsHide: true });
  const waiting = new Map();
  let buffer = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const w = waiting.get(msg.id);
      if (w) { waiting.delete(msg.id); w(msg); }
    }
  });
  child.on('exit', () => { for (const w of waiting.values()) w({ sessions: [] }); waiting.clear(); });
  player = { child, waiting, next: 1 };
  return player;
}

// action: 'state' | 'thumb' (its cover) | 'toggle' | 'pause' | 'play' | 'next' | 'previous' | 'seek' (value: seconds); key: which session
function playerCommand(action, key = '', value = 0) {
  if (!WIN) return Promise.resolve({ sessions: [] });
  const p = playerServer();
  const id = p.next++;
  const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  return new Promise((resolve) => {
    const timer = setTimeout(() => { p.waiting.delete(id); resolve({ sessions: [] }); }, 8000);
    p.waiting.set(id, (msg) => {
      clearTimeout(timer);
      // the cover: its kind told by its first bytes (Windows doesn't say)
      const t = msg.thumb;
      const kind = !t ? null : t.startsWith('iVBOR') ? 'png' : t.startsWith('UklGR') ? 'webp' : t.startsWith('R0lG') ? 'gif' : 'jpeg';
      resolve({ ok: Boolean(msg.ok), thumb: t ? `data:image/${kind};base64,${t}` : null, key: msg.key || null, sessions: arr(msg.sessions).map((x) => ({ ...x, app: String(x.app || '').replace(/\.exe$/i, '').replace(/^.*[\\!]/, '') })) });
    });
    p.child.stdin.write(`${Buffer.from(JSON.stringify({ id, action, key, value })).toString('base64')}\n`);
  });
}

// A Spotify search for it: in the app if it's installed, else on the web.
async function music(query) {
  const q = String(query || '').trim().slice(0, 200);
  if (!q) return false;
  try {
    await shell.openExternal(`spotify:search:${encodeURIComponent(q)}`);
  } catch {
    await shell.openExternal(`https://open.spotify.com/search/${encodeURIComponent(q)}`);
  }
  return true;
}

// Asked to find something somewhere ("เปิด youtube แล้วหาเพลง X", "search X on google"): YouTube plays
// its top video, Spotify its top track; everywhere else, that site's search for it.
const SEARCH = {
  google: 'https://www.google.com/search?q=',
  images: 'https://www.google.com/search?tbm=isch&q=',
  maps: 'https://www.google.com/maps/search/',
  tiktok: 'https://www.tiktok.com/search?q=',
  facebook: 'https://www.facebook.com/search/top?q=',
  instagram: 'https://www.instagram.com/explore/search/keyword/?q=',
  x: 'https://x.com/search?q=',
  reddit: 'https://www.reddit.com/search/?q=',
  shopee: 'https://shopee.co.th/search?keyword=',
  lazada: 'https://www.lazada.co.th/catalog/?q=',
  wikipedia: 'https://th.wikipedia.org/w/index.php?search=',
  netflix: 'https://www.netflix.com/search?q=',
  steam: 'https://store.steampowered.com/search/?term=',
  github: 'https://github.com/search?q=',
  twitch: 'https://www.twitch.tv/search?term=',
  soundcloud: 'https://soundcloud.com/search?q=',
  pantip: 'https://pantip.com/search?q=',
  youtube: 'https://www.youtube.com/results?search_query=',
  spotify: 'https://open.spotify.com/search/',
};
const BROWSER_UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', 'Accept-Language': 'th,en;q=0.8' };

// the first video YouTube lists for it (read off its results page: no key needed), or null
async function youtubeTop(q) {
  const res = await fetch(`${SEARCH.youtube}${encodeURIComponent(q)}`, { headers: BROWSER_UA, signal: AbortSignal.timeout(8000) });
  const html = await res.text();
  const m = /"videoRenderer":\{"videoId":"([\w-]{11})"[\s\S]{0,4000}?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/.exec(html)
    || /"videoId":"([\w-]{11})"/.exec(html);
  return m ? { id: m[1], title: m[2] ? JSON.parse(`"${m[2]}"`) : null } : null;
}

// the first Spotify track a web search finds for it, or null
async function spotifyTop(q) {
  // DuckDuckGo's light page (its full one answers bots with a challenge); links come URL-encoded
  const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(`${q} spotify track`)}`, { headers: BROWSER_UA, signal: AbortSignal.timeout(8000) });
  const html = await res.text();
  const m = /open\.spotify\.com(?:\/intl-\w+)?\/track\/([A-Za-z0-9]{22})/.exec(html)
    || /open\.spotify\.com%2F(?:intl-\w+%2F)?track%2F([A-Za-z0-9]{22})/.exec(html);
  return m ? m[1] : null;
}

// where: a key of SEARCH. { ok, played: title | true when it plays, else false (a search page opened) }
async function searchPlay(where, query) {
  const q = String(query || '').trim().slice(0, 200);
  if (!q || !SEARCH[where]) return { ok: false };
  if (where === 'youtube') {
    const top = await youtubeTop(q).catch(() => null);
    if (top) {
      await shell.openExternal(`https://www.youtube.com/watch?v=${top.id}`);
      return { ok: true, played: top.title || true };
    }
  }
  if (where === 'spotify') {
    const id = await spotifyTop(q).catch(() => null);
    if (id) {
      try {
        await shell.openExternal(`spotify:track:${id}`); // the app, on that track
        // the track comes up selected: Enter plays it (only while Spotify is the window in front)
        if (WIN) {
          setTimeout(() => powershell(
            'Add-Type -Namespace Capri -Name Front -MemberDefinition \'[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr h, out uint p); [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, System.UIntPtr extra);\'; '
            + '$p = 0; [void][Capri.Front]::GetWindowThreadProcessId([Capri.Front]::GetForegroundWindow(), [ref]$p); '
            + 'if ((Get-Process -Id $p -ErrorAction SilentlyContinue).ProcessName -eq "Spotify") { [Capri.Front]::keybd_event(13, 0, 0, [UIntPtr]::Zero); [Capri.Front]::keybd_event(13, 0, 2, [UIntPtr]::Zero) }',
          ).catch(() => {}), 3500);
        }
      } catch {
        await shell.openExternal(`https://open.spotify.com/track/${id}`);
      }
      return { ok: true, played: true };
    }
    await music(q); // no track found: Spotify's own search
    return { ok: true, played: false };
  }
  await shell.openExternal(`${SEARCH[where]}${encodeURIComponent(q)}`);
  return { ok: true, played: false };
}

// A link you gave her: read first (its title: YouTube's own oEmbed, else the page's <title>), then
// opened as is (a Spotify track or playlist in the app). { ok, title, url }
async function openLink(address) {
  const url = siteUrl(String(address || '').trim());
  if (!url) return { ok: false };
  let title = null;
  try {
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(url.hostname)) {
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(6000) });
      if (r.ok) { const j = await r.json(); title = j.author_name ? `${j.title} — ${j.author_name}` : j.title; }
    } else {
      const r = await fetch(url, { headers: BROWSER_UA, signal: AbortSignal.timeout(6000) });
      const m = /<title[^>]*>([^<]{1,200})<\/title>/i.exec((await r.text()).slice(0, 200000));
      if (m) title = m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
    }
  } catch { /* opened all the same */ }
  const sp = /open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|artist|episode)\/([A-Za-z0-9]{22})/.exec(url.toString());
  try {
    await shell.openExternal(sp ? `spotify:${sp[1]}:${sp[2]}` : url.toString());
  } catch {
    await shell.openExternal(url.toString());
  }
  return { ok: true, title, url: url.toString() };
}

// A website: http or https, with a real host name.
function siteUrl(address) {
  try {
    const url = new URL(/^https?:\/\//i.test(address) ? address : `https://${address}`);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') ? url : null;
  } catch {
    return null;
  }
}

async function site(address) {
  const url = siteUrl(String(address || '').trim());
  if (!url) return false;
  await shell.openExternal(url.toString());
  return true;
}

module.exports = { launchables, match, find, launch, media, music, site, siteUrl, searchPlay, openLink, mediaSessions, playerCommand };
