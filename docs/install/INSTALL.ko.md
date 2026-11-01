# Capri Desktop Plus 설치 방법 (한국어)

[ไทย](INSTALL.th.md) · [English](INSTALL.en.md) · [日本語](INSTALL.ja.md) · **한국어** · [中文](INSTALL.zh.md) · [Français](INSTALL.fr.md) · [Español](INSTALL.es.md) · [Português](INSTALL.pt.md) · [Русский](INSTALL.ru.md)

Capri Desktop Plus는 [mochiiwuff의 Capri Desktop](https://github.com/mochiiwuff/capri-desktop)을 확장한 포크입니다. 무료, 비상업용(판매 금지).

## 준비물

- Windows 10 또는 11 (64비트)
- 여유 공간 약 3 GB (로컬 AI나 이미지 모델을 추가하면 더 필요)
- 처음 설정할 때 인터넷 연결 (로컬 AI를 쓰면 이후 완전 오프라인 가능)
- 아무 폴더, 외장 SSD, USB 메모리에서도 실행됩니다

## 1. 다운로드

**[Releases 페이지](https://github.com/twwcity/capri-desktop-plus/releases/latest)**에서 **두 파일 모두** 내려받습니다.

| 파일 | 내용 |
|---|---|
| `Capri-Desktop-Plus-v1.0.2-app.zip` | 앱, 실행 스크립트, 음성 인식(Whisper), 게임 도구 |
| `Capri-Desktop-Plus-v1.0.2-voices.zip` | Capri의 목소리 (영어, 일본어, 중국어, 한국어, 태국어) |

## 2. 두 파일을 같은 곳에 압축 해제

1. `...-app.zip` 우클릭 → **압축 풀기…** → 위치 선택 (예: `D:\` 또는 USB) → **압축 풀기**.
2. `...-voices.zip`도 **같은 위치**에 풉니다.
3. `Capri` 폴더 하나 안에 `app`, `voice`, `games`, `Start-Capri.vbs` 등이 있으면 됩니다.

> zip 안에서 바로 실행하지 마세요. 먼저 압축을 풀어야 합니다.

## 3. Capri 실행

`Capri` 폴더의 **`Start-Capri.vbs`**를 더블클릭합니다.

- **"Windows의 PC 보호"** 창이 뜨면: **추가 정보** → **실행**. (회사 서명이 없어서이며 처음 한 번만 나타납니다)
- 몇 초 뒤 화면 아래에 Capri가 나타납니다.

## 4. 대화용 AI 설정

Capri 클릭 → **Talk to me**. AI가 아직 없다면 방식을 물어봅니다.

- **내 PC (Ollama)** — 개인적이고 오프라인 가능. Capri가 Ollama를 설치하고 모델(gemma3, 3~8 GB)을 내려받습니다. RAM 8 GB 이상 권장, 오래된 PC에서는 느립니다.
- **온라인, 계정 없음** — 가입 없이 바로 사용 (Pollinations). 간단하고 무료지만 덜 똑똑합니다.
- **키가 있어요** — 최고 품질. 가장 쉬운 무료 선택은 **Google Gemini**:
  1. <https://aistudio.google.com/apikey> 에서 Google 계정으로 로그인.
  2. **Create API key** 를 눌러 복사.
  3. Capri에서 **Google Gemini** 를 고르고 키를 붙여넣기 (PC에 암호화되어 저장).
  4. 채팅 상단의 모델 이름을 눌러 선택. `gemini-3.5-flash-lite` 가 가장 빠릅니다.

AI는 언제든지 바꿀 수 있습니다: 채팅 상단의 모델 이름 클릭.

## 5. 언어, 음성, 마이크

- **언어:** Capri 우클릭 → **Language** → **한국어** 등. 입력한 언어로도 대답합니다.
- **음성:** 기본으로 켜져 있음 (우클릭 → 사운드 → *Speak her answers aloud*).
- **마이크:** 입력창 옆 마이크 버튼. 우클릭 → **Microphone** 에서 마이크 선택. 듣기 시작/끝에 삐 소리가 납니다.

## 6. 해볼 것

| 채팅에 입력 | 결과 |
|---|---|
| `play Shape of You on youtube` | 첫 번째 영상을 열어 재생 |
| `what's playing?` | 재생 중인 곡/영상을 알려줌. 채팅 위에 앨범 커버가 있는 미디어 바 (±10초, 건너뛰기, 볼륨, 반복, 취침 타이머) |
| 링크 붙여넣기 | 제목을 읽은 뒤 열기 |
| `+` → **Code mode** → `make a snake game` | 게임을 만들고 바로 실행 |
| `+` → **PC agent** → `sort my Downloads folder` | 파일 정리 (위험한 작업 전에 확인) |
| `+` → **Create image** | 그림 그리기 (이미지 모델 필요, 아래 참고) |
| 채팅 상단의 전화 아이콘 | Edgerunners 캐릭터와 홀로콜 |

단축키: **Ctrl+Alt+C** 숨기기/보이기. Capri 우클릭으로 전체 메뉴.

## 선택 사항

### 드라이브를 꽂으면 자동 실행
PC마다 `Setup-This-PC.cmd` 를 한 번 더블클릭. 취소는 `Remove-From-This-PC.cmd`.

### Claude Code / Codex 를 두뇌로
[Claude Code](https://claude.com/claude-code) 또는 [Codex](https://developers.openai.com/codex) 를 설치하고 터미널에서 한 번 로그인한 뒤 모델 메뉴에서 선택. 작업 폴더는 우클릭 → AI model.

### 그림 그리기
[stable-diffusion.cpp releases](https://github.com/leejet/stable-diffusion.cpp/releases) 에서 `sd-cli.exe` 를 `Capri\imagegen\` 에 넣고 모델 준비:
- 빠름: <https://huggingface.co/stabilityai/sd-turbo> 의 `sd_turbo.safetensors` → `Capri\imagegen\`
- 고품질 (느림, VRAM 8 GB 이상): Wan 2.2 TI2V 5B GGUF 파일 → `Capri\imagegen\wan\`

### Omi와 D의 더 좋은 태국어 목소리
배포 권한이 없어 포함하지 않았습니다. Python 3.10 이상에서 `pip install torch transformers onnx huggingface_hub` → `python tools/convert-thai-voice.py out VIZINTZOR/MMS-TTS-THAI-FEMALEV2` 실행 후 `out\model.onnx` 와 `voice\sherpa\vits-mms-tha\tokens.txt` 를 `Capri\voice\sherpa\vits-mms-tha-female\` 로 복사 (D는 MALEV2 → `vits-mms-tha-male`).

### Minecraft: Capri Link 모드
1. Minecraft Java Edition **1.21.1**.
2. 공식 [Fabric Installer](https://fabricmc.net/use/installer/) 실행 → Client → Minecraft **1.21.1** → Install.
3. Minecraft Launcher → **설치 설정** → **새 설치 설정**:
   - 버전: `fabric-loader-…-1.21.1`
   - 게임 디렉터리: `…\Capri\games\minecraft\capri-1.21.1`
4. Capri를 한 번 실행 (모드를 그 폴더에 복사함) 한 뒤 그 설치 설정으로 플레이.
5. 게임 채팅: `capri help`, `capri scan`, `capri scan diamond`, `capri shock`, `capri shock all`, `capri <질문>`. 데스크톱 채팅에서도 "find diamonds" 등으로 조작 가능.

> 다른 런처가 만든 버전 말고 공식 Fabric Installer를 쓰세요 ("Unable to prepare assets for download" 오류가 날 수 있습니다).

## 문제 해결

| 증상 | 해결 |
|---|---|
| 대답이 없거나 매우 느림 | 채팅 상단 모델 이름에서 다른 모델 선택 (클라우드는 붐빌 수 있음). Ollama는 시작 후 첫 대답이 몇 분 걸릴 수 있음. |
| 목소리가 안 나옴 | voices zip을 같은 `Capri` 폴더에 풀었는지 확인 (`Capri\voice\sherpa\kokoro-multi-lang-v1_0` 필요). |
| 마이크가 안 들림 | 우클릭 → Microphone → 올바른 마이크 선택. |
| "That model isn't available" | 옛 Gemini 모델은 새 키로 못 씀. `gemini-3.x` 선택. |
| Windows가 차단함 | 추가 정보 → 실행. 또는 압축 풀기 전에 zip 우클릭 → 속성 → **차단 해제**. |

## 제거

Capri 종료 (우클릭 → Quit) 후 `Capri` 폴더 삭제. `Setup-This-PC.cmd` 를 썼다면 먼저 `Remove-From-This-PC.cmd` 실행.
