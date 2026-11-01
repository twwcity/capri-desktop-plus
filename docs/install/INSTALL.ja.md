# Capri Desktop Plus のインストール（日本語）

[ไทย](INSTALL.th.md) · [English](INSTALL.en.md) · **日本語** · [한국어](INSTALL.ko.md) · [中文](INSTALL.zh.md) · [Français](INSTALL.fr.md) · [Español](INSTALL.es.md) · [Português](INSTALL.pt.md) · [Русский](INSTALL.ru.md)

Capri Desktop Plus は [mochiiwuff 氏の Capri Desktop](https://github.com/mochiiwuff/capri-desktop) を拡張したフォークです。無料・非営利（販売禁止）。

## 必要なもの

- Windows 10 / 11（64ビット）
- 空き容量 約 3 GB（ローカル AI や画像モデルを入れる場合はさらに必要）
- 初回設定時のインターネット接続（ローカル AI を使えば、その後は完全オフラインで動作）
- 任意のフォルダ、外付け SSD、USB メモリで動作

## 1. ダウンロード

**[Releases ページ](https://github.com/twwcity/capri-desktop-plus/releases/latest)** を開き、**2つのファイル両方**をダウンロードします。

| ファイル | 内容 |
|---|---|
| `Capri-Desktop-Plus-v1.0.0-app.zip` | アプリ本体、起動スクリプト、音声認識（Whisper）、ゲーム用ツール |
| `Capri-Desktop-Plus-v1.0.0-voices.zip` | Capri の声（英語・日本語・中国語・韓国語・タイ語） |

## 2. 両方を同じ場所に展開する

1. `...-app.zip` を右クリック → **すべて展開…** → 展開先（例：`D:\` や USB メモリ）を選び → **展開**。
2. `...-voices.zip` も**同じ展開先**に展開します。
3. `Capri` フォルダが1つでき、中に `app`、`voice`、`games`、`Start-Capri.vbs` などがあれば OK です。

> zip の中から直接起動しないでください。必ず先に展開します。

## 3. Capri を起動する

`Capri` フォルダの **`Start-Capri.vbs`** をダブルクリックします。

- **「Windows によって PC が保護されました」** と出た場合：**詳細情報** → **実行**。（企業の署名がないためで、初回のみ表示されます）
- 数秒後、画面の下に Capri が現れます。

## 4. 会話用の AI を設定する

Capri をクリック → **Talk to me**。AI が未設定なら、どの方式にするか聞かれます。

- **自分の PC（Ollama）** — プライベートでオフライン可。Capri が Ollama をインストールし、モデル（gemma3、3〜8 GB）をダウンロードします。RAM 8 GB 以上推奨。古い PC では遅めです。
- **オンライン・アカウント不要** — 登録なしですぐ使えます（Pollinations）。手軽で無料ですが、賢さは控えめ。
- **キーを持っている** — 最高品質。いちばん簡単な無料の選択肢は **Google Gemini**：
  1. <https://aistudio.google.com/apikey> を開き、Google アカウントでログイン。
  2. **Create API key** を押してコピー。
  3. Capri で **Google Gemini** を選び、キーを貼り付け（PC 内に暗号化して保存されます）。
  4. チャット上部のモデル名を押して選択。`gemini-3.5-flash-lite` が最速です。

AI はいつでも切り替え可能：チャット上部のモデル名をクリック。

## 5. 言語・音声・マイク

- **言語：** Capri を右クリック → **Language** → **日本語**。入力した言語でも返事をします。
- **音声：** 初期設定でオン（右クリック → サウンド → *Speak her answers aloud*）。
- **マイク：** 入力欄の横のマイクボタン。右クリック → **Microphone** でマイクを選択。聞き取り開始・終了時にビープ音が鳴ります。

## 6. 試してみよう

| チャットに入力 | 動作 |
|---|---|
| `play Shape of You on youtube` | 最上位の動画を開いて再生 |
| `what's playing?` | 再生中の曲や動画を教えてくれる。チャットの上にジャケット付きメディアバー（±10秒・スキップ・音量・ループ・スリープタイマー） |
| リンクを貼る | タイトルを読み取ってから開く |
| `+` → **Code mode** → `make a snake game` | ゲームを書いて、すぐ遊べるよう開く |
| `+` → **PC agent** → `sort my Downloads folder` | ファイルを整理（危険な操作の前に確認） |
| `+` → **Create image** | 画像生成（画像モデルが必要、下記参照） |
| チャット上部の電話アイコン | Edgerunners のキャラクターとホロ通話 |

ショートカット：**Ctrl+Alt+C** で表示／非表示。Capri を右クリックで全メニュー。

## オプション

### ドライブを挿したら自動起動
各 PC で `Setup-This-PC.cmd` を一度ダブルクリック。元に戻すには `Remove-From-This-PC.cmd`。

### Claude Code / Codex を頭脳にする
[Claude Code](https://claude.com/claude-code) または [Codex](https://developers.openai.com/codex) をインストールし、ターミナルで一度ログイン。モデルメニューで選択します。作業フォルダは右クリック → AI model で設定。

### 画像生成
[stable-diffusion.cpp releases](https://github.com/leejet/stable-diffusion.cpp/releases) から `sd-cli.exe` を `Capri\imagegen\` に置き、モデルを用意：
- 速い：<https://huggingface.co/stabilityai/sd-turbo> の `sd_turbo.safetensors` を `Capri\imagegen\` へ
- 高品質（遅い、VRAM 8 GB 以上）：Wan 2.2 TI2V 5B の GGUF ファイルを `Capri\imagegen\wan\` へ

### Omi と D のより良いタイ語音声
配布許可がないため同梱していません。Python 3.10 以上で `pip install torch transformers onnx huggingface_hub` → `python tools/convert-thai-voice.py out VIZINTZOR/MMS-TTS-THAI-FEMALEV2` を実行し、`out\model.onnx` と `voice\sherpa\vits-mms-tha\tokens.txt` を `Capri\voice\sherpa\vits-mms-tha-female\` にコピー（D は MALEV2 → `vits-mms-tha-male`）。

### Minecraft：Capri Link MOD
1. Minecraft Java Edition **1.21.1**。
2. 公式の [Fabric Installer](https://fabricmc.net/use/installer/) を実行 → Client → Minecraft **1.21.1** → Install。
3. Minecraft Launcher → **起動構成** → **新規作成**：
   - バージョン：`fabric-loader-…-1.21.1`
   - ゲームディレクトリ：`…\Capri\games\minecraft\capri-1.21.1`
4. Capri を一度起動（MOD をそのフォルダにコピーします）してから、その起動構成でプレイ。
5. ゲーム内チャット：`capri help`、`capri scan`、`capri scan diamond`、`capri shock`、`capri shock all`、`capri <質問>`。デスクトップのチャットからも「find diamonds」などで操作できます。

> 他のランチャーが作ったバージョンではなく公式 Fabric Installer を使ってください（"Unable to prepare assets for download" エラーの原因になります）。

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| 返事がない／とても遅い | チャット上部のモデル名から別のモデルを選ぶ（クラウドは混雑することがあります）。Ollama は起動直後の最初の返事に数分かかることがあります。 |
| 声が出ない | voices の zip を同じ `Capri` フォルダに展開したか確認（`Capri\voice\sherpa\kokoro-multi-lang-v1_0` が必要）。 |
| マイクが反応しない | 右クリック → Microphone → 正しいマイクを選択。 |
| "That model isn't available" | 古い Gemini モデルは新しいキーでは使えません。`gemini-3.x` を選択。 |
| Windows にブロックされる | 詳細情報 → 実行。または展開前に zip を右クリック → プロパティ → **許可する** にチェック。 |

## アンインストール

Capri を終了（右クリック → Quit）し、`Capri` フォルダを削除。`Setup-This-PC.cmd` を使った場合は先に `Remove-From-This-PC.cmd` を実行してください。
