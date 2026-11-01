# Installing Capri Desktop Plus (English)

[ไทย](INSTALL.th.md) · **English** · [日本語](INSTALL.ja.md) · [한국어](INSTALL.ko.md) · [中文](INSTALL.zh.md) · [Français](INSTALL.fr.md) · [Español](INSTALL.es.md) · [Português](INSTALL.pt.md) · [Русский](INSTALL.ru.md)

Capri Desktop Plus is a fork of [Capri Desktop by mochiiwuff](https://github.com/mochiiwuff/capri-desktop). Free and non-commercial.

## What you need

- Windows 10 or 11, 64-bit.
- About 3 GB of free space (more if you add local AI or image models).
- Internet for the first setup. Afterwards it can run fully offline if you use a local AI.
- Works from any folder, an external SSD or a USB stick.

## 1. Download

Open the **[Releases page](https://github.com/twwcity/capri-desktop-plus/releases/latest)** and download **both** files:

| File | What's inside |
|---|---|
| `Capri-Desktop-Plus-v1.0.2-app.zip` | The app, launch scripts, speech recognition (Whisper), game tools |
| `Capri-Desktop-Plus-v1.0.2-voices.zip` | Her voices (English, Japanese, Chinese, Korean, Thai) |

## 2. Extract both into the same place

1. Right-click `...-app.zip` → **Extract All…** → pick a place, for example `D:\` or your USB drive → **Extract**.
2. Do the same with `...-voices.zip`, **to the same place**.
3. You should now have one folder `Capri` with `app`, `voice`, `games`, `Start-Capri.vbs` and the others inside.

> Don't run it from inside the zip: extract first.

## 3. Start Capri

Double-click **`Start-Capri.vbs`** in the `Capri` folder.

- If Windows shows **"Windows protected your PC"**: click **More info** → **Run anyway**. (The app isn't signed by a company; this only shows the first time.)
- Capri appears at the bottom of your screen after a few seconds.

## 4. Give her an AI to talk with

Click Capri → **Talk to me**. If no AI is set up yet, she asks you which kind:

- **On my PC (Ollama)** — private, works offline. Capri installs Ollama and downloads a model (gemma3, 3–8 GB). Needs 8 GB of RAM or more; slower on older PCs.
- **Online, no account** — works right away, no sign-up (Pollinations). Simple and free, less smart.
- **I have a key** — the best quality. The easiest free one is **Google Gemini**:
  1. Open <https://aistudio.google.com/apikey> and sign in with Google.
  2. Click **Create API key**, copy it.
  3. In Capri choose **Google Gemini** and paste the key. It is stored encrypted on your PC.
  4. In the chat header, click the model name to pick one. `gemini-3.5-flash-lite` is the fastest.

You can switch AI any time: click the model name at the top of her chat.

## 5. Language, voice and microphone

- **Language:** right-click Capri → **Language** → pick yours. She also answers in whatever language you type.
- **Voice:** on by default (right-click → Sounds → *Speak her answers aloud*).
- **Microphone:** the mic button next to the chat line. Pick your microphone with right-click → **Microphone**. You hear a beep when she starts and stops listening.

## 6. Things to try

| Type in her chat | What happens |
|---|---|
| `play Shape of You on youtube` | Opens and plays the top video |
| `what's playing?` | Tells you the song or clip playing; a media bar with cover, ±10 s, skip, volume, loop and sleep timer appears above her chat |
| A link | She reads its title, then opens it |
| `+` button → **Code mode** → `make a snake game` | Writes the game and opens it to play |
| `+` button → **PC agent** → `sort my Downloads folder` | Organizes files, asking before anything risky |
| `+` button → **Create image** | Draws a picture (needs image models, see below) |
| Phone icon in her chat header | Holo-calls with Edgerunners characters |

Shortcuts: **Ctrl+Alt+C** hides/shows her. Right-click her for the full menu.

## Optional extras

### Run when the drive is plugged in
Double-click `Setup-This-PC.cmd` once on each PC. To undo: `Remove-From-This-PC.cmd`.

### Claude Code or Codex as her brain
Install [Claude Code](https://claude.com/claude-code) or [Codex](https://developers.openai.com/codex), sign in once in a terminal, then pick it in her model menu. Right-click Capri → AI model → choose the folder they work in.

### Pictures
Download `sd-cli.exe` from [stable-diffusion.cpp releases](https://github.com/leejet/stable-diffusion.cpp/releases) into `Capri\imagegen\` and a model:
- quick: `sd_turbo.safetensors` from <https://huggingface.co/stabilityai/sd-turbo> into `Capri\imagegen\`
- better (slow, 8 GB+ VRAM): Wan 2.2 TI2V 5B GGUF files into `Capri\imagegen\wan\`

### Better Thai voices for Omi and D
Not included (no license to share them). With Python 3.10+: `pip install torch transformers onnx huggingface_hub`, then run `python tools/convert-thai-voice.py out VIZINTZOR/MMS-TTS-THAI-FEMALEV2` and copy `out\model.onnx` plus `voice\sherpa\vits-mms-tha\tokens.txt` into `Capri\voice\sherpa\vits-mms-tha-female\` (MALEV2 → `vits-mms-tha-male` for D).

### Cyberpunk 2077: the CapriLink mod (single-player only)
1. Close the game, then tell Capri **"install the Cyberpunk mod"**. She downloads Cyber Engine Tweaks from its official GitHub and adds her mod (she finds Steam installs, and GOG or Epic in their default folders).
2. Start the game and load a save. **F1** opens the CET console; the first time, CET may show a short setup window.
3. Then tell Capri what you want, in your own words: "give me Rebecca's shotgun", "the best Sandevistan", "100000 eddies", "add 5 perk points", "unlock all cyberware slots", "give me David's car", "drive to my waypoint" (sitting in a car), "warp to the waypoint", "fly", "Blackwall the one I'm aiming at", "burn the enemies around".
4. After Capri updates the mod, press **Reload all mods** in the CET console.

### Minecraft: the Capri Link mod
1. Minecraft Java Edition, version **1.21.1**.
2. Run the official [Fabric Installer](https://fabricmc.net/use/installer/) → Client → Minecraft **1.21.1** → Install.
3. Open the Minecraft Launcher → **Installations** → **New installation**:
   - Version: `fabric-loader-…-1.21.1`
   - Game directory: `…\Capri\games\minecraft\capri-1.21.1`
4. Start Capri once (she copies her mod into that folder), then play that installation.
5. In game chat: `capri help`, `capri scan`, `capri scan diamond`, `capri shock`, `capri shock all`, or `capri <a question>`. From her desktop chat: "find diamonds", "lightning on the mobs".

> Use the official Fabric Installer, not a version made by another launcher: those can fail with "Unable to prepare assets for download".

## Problems

| Problem | Fix |
|---|---|
| She doesn't answer, or takes very long | Click the model name in her chat and pick another (cloud models get busy). With Ollama, the first answer after starting can take minutes. |
| No voice | Make sure the voices zip was extracted into the same `Capri` folder (`Capri\voice\sherpa\kokoro-multi-lang-v1_0` must exist). |
| The mic hears nothing | Right-click → Microphone → choose the right one. |
| "That model isn't available" | Older Gemini models are closed to new keys: pick a `gemini-3.x` model. |
| Windows blocks it | More info → Run anyway, or right-click the zip → Properties → **Unblock** before extracting. |

## Uninstall

Close Capri (right-click → Quit) and delete the `Capri` folder. If you used `Setup-This-PC.cmd`, run `Remove-From-This-PC.cmd` first.
