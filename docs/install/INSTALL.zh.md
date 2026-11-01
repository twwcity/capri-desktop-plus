# Capri Desktop Plus 安装指南（中文）

[ไทย](INSTALL.th.md) · [English](INSTALL.en.md) · [日本語](INSTALL.ja.md) · [한국어](INSTALL.ko.md) · **中文** · [Français](INSTALL.fr.md) · [Español](INSTALL.es.md) · [Português](INSTALL.pt.md) · [Русский](INSTALL.ru.md)

Capri Desktop Plus 是 [mochiiwuff 的 Capri Desktop](https://github.com/mochiiwuff/capri-desktop) 的扩展分支。免费、非商业（禁止出售）。

## 需要准备

- Windows 10 或 11（64 位）
- 约 3 GB 可用空间（添加本地 AI 或绘图模型需要更多）
- 首次设置需要联网（使用本地 AI 时之后可完全离线）
- 可放在任意文件夹、外置 SSD 或 U 盘中运行

## 1. 下载

打开 **[Releases 页面](https://github.com/twwcity/capri-desktop-plus/releases/latest)**，下载**两个文件**：

| 文件 | 内容 |
|---|---|
| `Capri-Desktop-Plus-v1.0.0-app.zip` | 程序本体、启动脚本、语音识别（Whisper）、游戏工具 |
| `Capri-Desktop-Plus-v1.0.0-voices.zip` | Capri 的声音（英语、日语、中文、韩语、泰语） |

## 2. 解压到同一位置

1. 右键 `...-app.zip` → **全部解压缩…** → 选择位置（如 `D:\` 或 U 盘）→ **解压缩**。
2. 把 `...-voices.zip` 也解压到**同一位置**。
3. 得到一个 `Capri` 文件夹，里面有 `app`、`voice`、`games`、`Start-Capri.vbs` 等。

> 不要直接在 zip 里运行，请先解压。

## 3. 启动 Capri

双击 `Capri` 文件夹中的 **`Start-Capri.vbs`**。

- 如果出现 **"Windows 已保护你的电脑"**：点 **更多信息** → **仍要运行**。（程序没有公司签名，只在第一次出现）
- 几秒后 Capri 会出现在屏幕下方。

## 4. 设置对话用的 AI

点击 Capri → **Talk to me**。如果还没有 AI，她会问你选哪种：

- **在我的电脑上（Ollama）** — 私密、可离线。Capri 会安装 Ollama 并下载模型（gemma3，3–8 GB）。建议 8 GB 以上内存，旧电脑会较慢。
- **在线，无需账号** — 无需注册即可使用（Pollinations）。简单免费，但没那么聪明。
- **我有密钥** — 质量最好。最简单的免费选择是 **Google Gemini**：
  1. 打开 <https://aistudio.google.com/apikey> 并用 Google 账号登录。
  2. 点击 **Create API key** 并复制。
  3. 在 Capri 中选择 **Google Gemini**，粘贴密钥（加密保存在你的电脑上）。
  4. 点击聊天顶部的模型名来选择。`gemini-3.5-flash-lite` 最快。

随时可以切换 AI：点击聊天顶部的模型名。

## 5. 语言、声音和麦克风

- **语言：** 右键 Capri → **Language** → 选择语言。她也会用你输入的语言回答。
- **声音：** 默认开启（右键 → 声音 → *Speak her answers aloud*）。
- **麦克风：** 输入框旁的麦克风按钮。右键 → **Microphone** 选择麦克风。开始和结束聆听时会有提示音。

## 6. 试试这些

| 在聊天中输入 | 效果 |
|---|---|
| `play Shape of You on youtube` | 打开并播放第一个视频 |
| `what's playing?` | 告诉你正在播放的歌曲或视频；聊天上方出现带封面的媒体栏（±10 秒、跳过、音量、循环、睡眠定时） |
| 粘贴链接 | 先读取标题，再打开 |
| `+` → **Code mode** → `make a snake game` | 编写游戏并直接打开游玩 |
| `+` → **PC agent** → `sort my Downloads folder` | 整理文件（有风险的操作会先询问） |
| `+` → **Create image** | 画图（需要绘图模型，见下文） |
| 聊天顶部的电话图标 | 与 Edgerunners 角色全息通话 |

快捷键：**Ctrl+Alt+C** 隐藏/显示。右键 Capri 查看完整菜单。

## 可选功能

### 插入驱动器时自动启动
在每台电脑上双击一次 `Setup-This-PC.cmd`。撤销：`Remove-From-This-PC.cmd`。

### 用 Claude Code 或 Codex 作为大脑
安装 [Claude Code](https://claude.com/claude-code) 或 [Codex](https://developers.openai.com/codex)，在终端登录一次，然后在模型菜单中选择。工作文件夹：右键 Capri → AI model。

### 绘图
从 [stable-diffusion.cpp releases](https://github.com/leejet/stable-diffusion.cpp/releases) 下载 `sd-cli.exe` 放到 `Capri\imagegen\`，并准备模型：
- 快速：<https://huggingface.co/stabilityai/sd-turbo> 的 `sd_turbo.safetensors` → `Capri\imagegen\`
- 高质量（较慢，需 8 GB 以上显存）：Wan 2.2 TI2V 5B 的 GGUF 文件 → `Capri\imagegen\wan\`

### Omi 和 D 更好的泰语声音
因没有分发许可而未包含。使用 Python 3.10+：`pip install torch transformers onnx huggingface_hub`，运行 `python tools/convert-thai-voice.py out VIZINTZOR/MMS-TTS-THAI-FEMALEV2`，把 `out\model.onnx` 和 `voice\sherpa\vits-mms-tha\tokens.txt` 复制到 `Capri\voice\sherpa\vits-mms-tha-female\`（D 用 MALEV2 → `vits-mms-tha-male`）。

### Minecraft：Capri Link 模组
1. Minecraft Java 版 **1.21.1**。
2. 运行官方 [Fabric Installer](https://fabricmc.net/use/installer/) → Client → Minecraft **1.21.1** → Install。
3. 打开 Minecraft 启动器 → **安装配置** → **新安装配置**：
   - 版本：`fabric-loader-…-1.21.1`
   - 游戏目录：`…\Capri\games\minecraft\capri-1.21.1`
4. 先启动一次 Capri（她会把模组复制到该文件夹），再用这个配置开始游戏。
5. 游戏聊天：`capri help`、`capri scan`、`capri scan diamond`、`capri shock`、`capri shock all`、`capri <问题>`。也可以在桌面聊天里说 "find diamonds" 等来操作。

> 请使用官方 Fabric Installer，不要用其他启动器生成的版本（可能出现 "Unable to prepare assets for download" 错误）。

## 常见问题

| 问题 | 解决 |
|---|---|
| 不回答或很慢 | 点击聊天顶部的模型名换一个（云端模型可能繁忙）。Ollama 启动后的第一次回答可能需要几分钟。 |
| 没有声音 | 确认 voices 的 zip 解压到了同一个 `Capri` 文件夹（需要 `Capri\voice\sherpa\kokoro-multi-lang-v1_0`）。 |
| 麦克风没反应 | 右键 → Microphone → 选择正确的麦克风。 |
| "That model isn't available" | 旧版 Gemini 模型不对新密钥开放，请选 `gemini-3.x`。 |
| 被 Windows 阻止 | 更多信息 → 仍要运行；或解压前右键 zip → 属性 → 勾选 **解除锁定**。 |

## 卸载

关闭 Capri（右键 → Quit），删除 `Capri` 文件夹。如果用过 `Setup-This-PC.cmd`，请先运行 `Remove-From-This-PC.cmd`。
