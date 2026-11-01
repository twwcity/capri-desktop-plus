# Instalar o Capri Desktop Plus (Português)

[ไทย](INSTALL.th.md) · [English](INSTALL.en.md) · [日本語](INSTALL.ja.md) · [한국어](INSTALL.ko.md) · [中文](INSTALL.zh.md) · [Français](INSTALL.fr.md) · [Español](INSTALL.es.md) · **Português** · [Русский](INSTALL.ru.md)

O Capri Desktop Plus é um fork do [Capri Desktop de mochiiwuff](https://github.com/mochiiwuff/capri-desktop). Gratuito e não comercial (proibido vender).

## O que você precisa

- Windows 10 ou 11, 64 bits.
- Uns 3 GB livres (mais se adicionar IA local ou modelos de imagem).
- Internet na primeira configuração; depois pode funcionar offline com uma IA local.
- Funciona em qualquer pasta, SSD externo ou pendrive.

## 1. Baixar

Abra a **[página de Releases](https://github.com/twwcity/capri-desktop-plus/releases/latest)** e baixe **os dois** arquivos:

| Arquivo | Conteúdo |
|---|---|
| `Capri-Desktop-Plus-v1.0.0-app.zip` | O app, scripts de início, reconhecimento de voz (Whisper), ferramentas de jogos |
| `Capri-Desktop-Plus-v1.0.0-voices.zip` | As vozes dela (inglês, japonês, chinês, coreano, tailandês) |

## 2. Extrair os dois no mesmo lugar

1. Clique com o botão direito em `...-app.zip` → **Extrair tudo…** → escolha um lugar (ex.: `D:\` ou o pendrive) → **Extrair**.
2. Faça o mesmo com `...-voices.zip`, **no mesmo lugar**.
3. Você terá uma pasta `Capri` com `app`, `voice`, `games`, `Start-Capri.vbs` etc.

> Não rode de dentro do zip: extraia antes.

## 3. Abrir a Capri

Dê dois cliques em **`Start-Capri.vbs`** na pasta `Capri`.

- Se o Windows mostrar **"O Windows protegeu o computador"**: **Mais informações** → **Executar assim mesmo** (o app não é assinado; só na primeira vez).
- A Capri aparece na parte de baixo da tela em alguns segundos.

## 4. Dar uma IA para ela

Clique na Capri → **Falar com ela**. Se ainda não houver IA, ela pergunta qual:

- **No meu PC (Ollama)** — privado, offline. A Capri instala o Ollama e baixa um modelo (gemma3, 3–8 GB). 8 GB de RAM ou mais; mais lento em PCs antigos.
- **Online, sem conta** — funciona na hora (Pollinations). Simples e grátis, menos esperta.
- **Tenho uma chave** — a melhor qualidade. O mais fácil e grátis: **Google Gemini**:
  1. Abra <https://aistudio.google.com/apikey> e entre com o Google.
  2. **Create API key** e copie.
  3. Na Capri, escolha **Google Gemini** e cole a chave (guardada criptografada no seu PC).
  4. Clique no nome do modelo no topo do chat para escolher. `gemini-3.5-flash-lite` é o mais rápido.

Dá para trocar de IA quando quiser: clique no nome do modelo no topo do chat.

## 5. Idioma, voz e microfone

- **Idioma:** clique direito na Capri → **Idioma** → o seu. Ela também responde no idioma em que você escreve.
- **Voz:** ligada por padrão (clique direito → Som → *Speak her answers aloud*).
- **Microfone:** o botão de microfone ao lado da linha de texto. Escolha o microfone com clique direito → **Microphone**. Um bipe toca ao começar e ao parar de ouvir.

## 6. Experimente

| Digite no chat | O que acontece |
|---|---|
| `play Shape of You on youtube` | Abre e toca o primeiro vídeo |
| `what's playing?` | Diz o que está tocando; aparece uma barra de mídia com capa, ±10 s, próxima, volume, repetição e timer |
| Um link | Ela lê o título e abre |
| `+` → **Code mode** → `make a snake game` | Escreve o jogo e abre para jogar |
| `+` → **PC agent** → `sort my Downloads folder` | Organiza arquivos, perguntando antes de algo arriscado |
| `+` → **Create image** | Desenha (precisa de modelos de imagem, veja abaixo) |
| O ícone de telefone no topo do chat | Holochamadas com personagens de Edgerunners |

Atalhos: **Ctrl+Alt+C** esconde/mostra. Clique direito nela para o menu completo.

## Opcional

### Abrir ao conectar o drive
Dê dois cliques uma vez em `Setup-This-PC.cmd` em cada PC. Para desfazer: `Remove-From-This-PC.cmd`.

### Claude Code ou Codex como cérebro
Instale o [Claude Code](https://claude.com/claude-code) ou o [Codex](https://developers.openai.com/codex), faça login uma vez num terminal e escolha no menu de modelos. Pasta de trabalho: clique direito → Modelo de IA.

### Imagens
Coloque o `sd-cli.exe` das [releases do stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp/releases) em `Capri\imagegen\` e um modelo:
- rápido: `sd_turbo.safetensors` de <https://huggingface.co/stabilityai/sd-turbo> em `Capri\imagegen\`
- melhor (lento, 8 GB+ de VRAM): os arquivos GGUF do Wan 2.2 TI2V 5B em `Capri\imagegen\wan\`

### Vozes tailandesas melhores para Omi e D
Não incluídas (sem licença para compartilhar). Com Python 3.10+: `pip install torch transformers onnx huggingface_hub`, depois `python tools/convert-thai-voice.py out VIZINTZOR/MMS-TTS-THAI-FEMALEV2`, e copie `out\model.onnx` e `voice\sherpa\vits-mms-tha\tokens.txt` para `Capri\voice\sherpa\vits-mms-tha-female\` (MALEV2 → `vits-mms-tha-male` para o D).

### Minecraft: o mod Capri Link
1. Minecraft Java Edition **1.21.1**.
2. Rode o [instalador oficial do Fabric](https://fabricmc.net/use/installer/) → Client → Minecraft **1.21.1** → Install.
3. Launcher do Minecraft → **Instalações** → **Nova instalação**:
   - Versão: `fabric-loader-…-1.21.1`
   - Diretório do jogo: `…\Capri\games\minecraft\capri-1.21.1`
4. Abra a Capri uma vez (ela copia o mod para essa pasta) e jogue com essa instalação.
5. No chat do jogo: `capri help`, `capri scan`, `capri scan diamond`, `capri shock`, `capri shock all`, ou `capri <uma pergunta>`. Também pelo chat da área de trabalho: "find diamonds".

> Use o instalador oficial do Fabric, não uma versão criada por outro launcher: pode falhar com "Unable to prepare assets for download".

## Problemas

| Problema | Solução |
|---|---|
| Ela não responde ou demora muito | Clique no nome do modelo e escolha outro (modelos na nuvem ficam lotados). Com Ollama, a primeira resposta pode levar minutos. |
| Sem voz | Confira se o zip das vozes foi extraído na mesma pasta `Capri` (`Capri\voice\sherpa\kokoro-multi-lang-v1_0` precisa existir). |
| O microfone não ouve | Clique direito → Microphone → o certo. |
| "That model isn't available" | Modelos Gemini antigos não aceitam chaves novas: escolha um `gemini-3.x`. |
| O Windows bloqueia | Mais informações → Executar assim mesmo, ou clique direito no zip → Propriedades → **Desbloquear** antes de extrair. |

## Desinstalar

Feche a Capri (clique direito → Sair) e apague a pasta `Capri`. Se usou `Setup-This-PC.cmd`, rode antes o `Remove-From-This-PC.cmd`.
