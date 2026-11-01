# Capri Desktop Plus

A heavily extended fork of **[Capri Desktop](https://github.com/mochiiwuff/capri-desktop)** by **[mochiiwuff](https://github.com/mochiiwuff)**: Capri, the Project Capricorn construct from *Cyberpunk: Edgerunners*, living on your Windows desktop. This fork runs fully offline from a USB drive, talks and listens in several languages, makes holo-calls to other Edgerunners characters, writes code, manages files, plays your music, and jacks into Minecraft through her own mod.

> **Original creator:** Capri Desktop was created by **mochiiwuff** — <https://github.com/mochiiwuff/capri-desktop>.
> This fork keeps the original license and its Required Notice (see [LICENSE](LICENSE)).
> **Fork and additions:** [ayla (twwcity)](https://github.com/twwcity), built with Claude Code.
> Free and non-commercial, like the original: it may not be sold, in any form.

## ⬇ Download & install

**[Download the latest release](https://github.com/twwcity/capri-desktop-plus/releases/latest)** (two zips: app + voices), then follow the guide in your language:

[ไทย](docs/install/INSTALL.th.md) · [English](docs/install/INSTALL.en.md) · [日本語](docs/install/INSTALL.ja.md) · [한국어](docs/install/INSTALL.ko.md) · [中文](docs/install/INSTALL.zh.md) · [Français](docs/install/INSTALL.fr.md) · [Español](docs/install/INSTALL.es.md) · [Português](docs/install/INSTALL.pt.md) · [Русский](docs/install/INSTALL.ru.md)

Windows 10/11 64-bit. Extract both zips into the same place, double-click `Start-Capri.vbs`, and pick an AI when she asks. Third-party parts and their licenses: [THIRD-PARTY.md](THIRD-PARTY.md).

*Capri and every Cyberpunk: Edgerunners character belong to their rights holders (CD PROJEKT RED, Studio Trigger). This is an unofficial fan project; the characters are played by an AI and are not the real ones. See [CREDITS.md](CREDITS.md).*

---

## What this fork adds

**Runs anywhere, offline**
- Portable: everything (app, data, AI models, voices) lives on a USB/SSD drive; `portable/` has the launch scripts and a one-time "set up this PC" auto-start.
- Local AI through a portable Ollama, or any cloud provider (Gemini, OpenAI, Groq…), switchable from her chat header; automatic fallback when a cloud model is overloaded, out of quota or silent.
- **Claude Code** or **Codex** as her brain (they really work on your files), or her own **PC agent mode** for any model: list, find, read, write, move, copy, delete (to the Recycle Bin), run commands — only in allowed folders, risky steps confirmed first.

**Voice**
- Offline text-to-speech with sherpa-onnx (`voice-server/`): Kokoro for English, Japanese (custom kana-to-IPA, `ja.js`) and Chinese, a Korean VITS voice (custom Hangul-to-IPA, `ko.js`), Thai male/female MMS voices; per-character voices.
- Offline speech-to-text with whisper.cpp: Thai and English mixed, room-noise calibration, start/stop beeps.

**Chat**
- Answers in the language you write in (Thai, English, Japanese, Korean, Chinese…), stays in character.
- Chat history with archive/delete, a chat log window with the code and pictures of each chat, pasted pictures shown and kept.
- Bond system: hard-won affection from stranger to partner, blushing face and 8-bit hearts, a reward at 100.
- 100 teasing lines when you click her, hologram face effects, live clips while she thinks or speaks.

**Holo-calls**
- Call Edgerunners characters (Omi, D, Weak Kingsley, Talia Yang, Roman Carax, Jessie, Avida Yang, Yupi, Kyoko), each with canon facts from the Cyberpunk Wiki, their own voice, their own bond (friendship-only for some), idle nudges and hang-ups, a movable, minimizable call window.

**Making things**
- Code mode: writes and edits real files in a project folder, shows the code as it's written, opens web games to play right away, floating game overlays.
- Pictures with stable-diffusion.cpp (Wan 2.2 or SD-Turbo), with a timer.

**Your PC**
- Search and play: "เปิดเพลง …" / "play … on YouTube" opens the top video or Spotify track; links are read before opening; searches on Google, Maps, Shopee, TikTok and more.
- Media bar: what's playing (with cover art) from Windows media sessions, play/pause, ±10 s, skip, volume, loop, sleep timer; minimizes to a corner chip.
- Offline single-player game tools: a Cyberpunk 2077 CET mod (`games/cyberpunk/CapriLink`: items by name, cars, self-driving, warp, flying, Blackwall and quickhacks, points, cyberware slots) and a value scanner (`games/memory`) that refuses online games and anti-cheat.

**Minecraft: Capri Link mod** (`minecraft-mod/`, Fabric 1.21.1)
- `capri <anything>` in game chat: Capri answers in chat (through the desktop app), knowing where you stand.
- `capri scan [ore]`: ores within 15 blocks, the 10 closest with X Y Z and direction, glowing through walls for 30 s.
- `capri shock` / `capri kill` (`all`, or a mob name): red Blackwall lightning, one hit, no fire, drops kept; the bolt is drawn red by a Mixin in `LightningEntityRenderer`.
- Driven from the desktop too: telling Capri "หาแร่เพชร" or "ฟ้าผ่าม็อบ" runs it in the game.

---

## Layout

| Folder | What |
|---|---|
| `app/` | The Electron app (the original Capri Desktop source, extended). `app/minecraft/capri-link.jar` is the built mod she installs into the game. |
| `minecraft-mod/` | Source of the Capri Link Fabric mod. |
| `voice-server/` | The sherpa-onnx text-to-speech server (run by `app/src/main/voice.js` with its own node.exe). |
| `games/` | Cyberpunk 2077 CET mod and the value-scanner source (C#). |
| `portable/` | Windows scripts for running from a drive. |

Not included (download them yourself): Electron runtime, `node_modules`, Ollama and its models, whisper.cpp + models, sherpa-onnx + voice models, stable-diffusion.cpp + models.

## Build the Minecraft mod

Needs JDK 21.

```
cd minecraft-mod
gradle build        # Gradle 8.14+, Fabric Loom 1.11
```

The jar lands in `minecraft-mod/build/libs/`. Put it, with Fabric API 0.116.x for 1.21.1, in a Fabric 1.21.1 `mods` folder, or copy it to `app/minecraft/capri-link.jar` and Capri installs it.

## License

Same as the original: **PolyForm Noncommercial 1.0.0**, with the original **Required Notice: Copyright (c) 2026 mochiiwuff (https://github.com/mochiiwuff/capri-desktop)**. Free to use, change and share; never to sell. See [LICENSE](LICENSE). Character artwork is not covered by it: see [CREDITS.md](CREDITS.md).
