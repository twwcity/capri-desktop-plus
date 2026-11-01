# Third-party software and models in the release zips

Everything here is redistributed under its own license, for free and non-commercial use only (the
strictest terms below, CC BY-NC and PolyForm Noncommercial, apply to the bundle as a whole).

| Part | Where in the zip | License |
|---|---|---|
| Capri Desktop (original app) by mochiiwuff, and this fork's code | `app/resources/app/` | PolyForm Noncommercial 1.0.0, Required Notice: Copyright (c) 2026 mochiiwuff (https://github.com/mochiiwuff/capri-desktop) — see `LICENSE` |
| Electron / Chromium runtime | `app/` | MIT (`app/LICENSE.electron.txt`), Chromium licenses (`app/LICENSES.chromium.html`) |
| Node.js runtime (for the voice server) | `voice/sherpa/node.exe` | MIT |
| sherpa-onnx (`sherpa-onnx-node`, `sherpa-onnx-win-x64`) | `voice/sherpa/node_modules/` | Apache 2.0 |
| kuromoji.js (+ doublearray, async, lodash, zlibjs) | `voice/sherpa/node_modules/` | Apache 2.0 / MIT |
| Kokoro-82M v1.0 multi-language (sherpa-onnx export) | `voice/sherpa/kokoro-multi-lang-v1_0/` | Apache 2.0 — https://huggingface.co/hexgrad/Kokoro-82M |
| MMS-TTS Thai (sherpa-onnx export) | `voice/sherpa/vits-mms-tha/` | CC BY-NC 4.0 — Meta AI, https://huggingface.co/facebook/mms-tts-tha |
| Korean voice, mimic3 ko_KO-kss_low (sherpa-onnx export) | `voice/sherpa/vits-mimic3-ko_KO-kss_low/` | Trained on the KSS dataset, CC BY-NC-SA 4.0 — Kyubyong Park |
| whisper.cpp | `voice/whisper/Release/` | MIT |
| Whisper `small` model (ggml) | `voice/whisper/ggml-small.bin` | MIT — OpenAI |
| Silero VAD v5 (ggml) | `voice/whisper/ggml-silero-v5.1.2.bin` | MIT |
| Fabric API 0.116.17 for Minecraft 1.21.1 | `games/minecraft/capri-1.21.1/mods/` | Apache 2.0 |

**Not included** (download them yourself, see the install guide): Ollama and its AI models, image
models (Wan 2.2, SD-Turbo), Cyber Engine Tweaks, and the Thai voices
`VIZINTZOR/MMS-TTS-THAI-FEMALEV2` / `MALEV2` used for Omi and D, which carry no license on Hugging Face
(so they can't be passed on): `tools/convert-thai-voice.py` builds them on your own PC from the
author's own download. Without them Omi and D speak Thai with the MMS voice.

Character artwork: see `CREDITS.md`.
