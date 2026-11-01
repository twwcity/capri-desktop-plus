# Instalar Capri Desktop Plus (Español)

[ไทย](INSTALL.th.md) · [English](INSTALL.en.md) · [日本語](INSTALL.ja.md) · [한국어](INSTALL.ko.md) · [中文](INSTALL.zh.md) · [Français](INSTALL.fr.md) · **Español** · [Português](INSTALL.pt.md) · [Русский](INSTALL.ru.md)

Capri Desktop Plus es un fork de [Capri Desktop de mochiiwuff](https://github.com/mochiiwuff/capri-desktop). Gratis y no comercial (prohibido venderlo).

## Lo que necesitas

- Windows 10 u 11, 64 bits.
- Unos 3 GB libres (más si añades IA local o modelos de imagen).
- Internet para la primera configuración; después puede funcionar sin conexión con una IA local.
- Funciona desde cualquier carpeta, un SSD externo o una memoria USB.

## 1. Descargar

Abre la **[página de Releases](https://github.com/twwcity/capri-desktop-plus/releases/latest)** y descarga **los dos** archivos:

| Archivo | Contenido |
|---|---|
| `Capri-Desktop-Plus-v1.0.2-app.zip` | La app, los scripts de inicio, el reconocimiento de voz (Whisper), herramientas de juegos |
| `Capri-Desktop-Plus-v1.0.2-voices.zip` | Sus voces (inglés, japonés, chino, coreano, tailandés) |

## 2. Extraer ambos en el mismo lugar

1. Clic derecho en `...-app.zip` → **Extraer todo…** → elige un lugar (por ejemplo `D:\` o la USB) → **Extraer**.
2. Lo mismo con `...-voices.zip`, **en el mismo lugar**.
3. Tendrás una carpeta `Capri` con `app`, `voice`, `games`, `Start-Capri.vbs` y demás.

> No lo ejecutes dentro del zip: extrae primero.

## 3. Iniciar Capri

Haz doble clic en **`Start-Capri.vbs`** dentro de `Capri`.

- Si Windows muestra **"Windows protegió su PC"**: **Más información** → **Ejecutar de todas formas** (la app no está firmada; solo la primera vez).
- Capri aparece en la parte inferior de la pantalla en unos segundos.

## 4. Darle una IA

Haz clic en Capri → **Hablar con ella**. Si no hay IA configurada, te pregunta cuál:

- **En mi PC (Ollama)** — privado, sin conexión. Capri instala Ollama y descarga un modelo (gemma3, 3–8 GB). 8 GB de RAM o más; más lento en PCs viejos.
- **En línea, sin cuenta** — funciona al instante (Pollinations). Simple y gratis, menos lista.
- **Tengo una clave** — la mejor calidad. Lo más fácil y gratis: **Google Gemini**:
  1. Abre <https://aistudio.google.com/apikey> e inicia sesión con Google.
  2. **Create API key** y cópiala.
  3. En Capri elige **Google Gemini** y pega la clave (se guarda cifrada en tu PC).
  4. Haz clic en el nombre del modelo arriba del chat para elegir uno. `gemini-3.5-flash-lite` es el más rápido.

Puedes cambiar de IA cuando quieras: clic en el nombre del modelo arriba del chat.

## 5. Idioma, voz y micrófono

- **Idioma:** clic derecho en Capri → **Idioma** → el tuyo. También responde en el idioma en que escribes.
- **Voz:** activada por defecto (clic derecho → Sonido → *Speak her answers aloud*).
- **Micrófono:** el botón de micro junto a la línea de texto. Elige el micro con clic derecho → **Microphone**. Suena un pitido al empezar y terminar de escuchar.

## 6. Pruébalo

| Escribe en el chat | Qué pasa |
|---|---|
| `play Shape of You on youtube` | Abre y reproduce el primer video |
| `what's playing?` | Te dice qué suena; aparece una barra multimedia con portada, ±10 s, siguiente, volumen, bucle y temporizador |
| Un enlace | Lee su título y lo abre |
| `+` → **Code mode** → `make a snake game` | Escribe el juego y lo abre para jugar |
| `+` → **PC agent** → `sort my Downloads folder` | Ordena archivos, preguntando antes de algo riesgoso |
| `+` → **Create image** | Dibuja (necesita modelos de imagen, ver abajo) |
| El icono de teléfono arriba del chat | Holollamadas con personajes de Edgerunners |

Atajos: **Ctrl+Alt+C** la oculta/muestra. Clic derecho sobre ella para el menú completo.

## Opcional

### Iniciar al conectar la unidad
Doble clic una vez en `Setup-This-PC.cmd` en cada PC. Para deshacer: `Remove-From-This-PC.cmd`.

### Claude Code o Codex como cerebro
Instala [Claude Code](https://claude.com/claude-code) o [Codex](https://developers.openai.com/codex), inicia sesión una vez en una terminal y elígelo en el menú de modelos. Carpeta de trabajo: clic derecho → Modelo de IA.

### Imágenes
Pon `sd-cli.exe` de las [releases de stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp/releases) en `Capri\imagegen\` y un modelo:
- rápido: `sd_turbo.safetensors` de <https://huggingface.co/stabilityai/sd-turbo> en `Capri\imagegen\`
- mejor (lento, 8 GB+ de VRAM): los archivos GGUF de Wan 2.2 TI2V 5B en `Capri\imagegen\wan\`

### Mejores voces tailandesas para Omi y D
No incluidas (sin licencia para compartirlas). Con Python 3.10+: `pip install torch transformers onnx huggingface_hub`, luego `python tools/convert-thai-voice.py out VIZINTZOR/MMS-TTS-THAI-FEMALEV2`, y copia `out\model.onnx` y `voice\sherpa\vits-mms-tha\tokens.txt` a `Capri\voice\sherpa\vits-mms-tha-female\` (MALEV2 → `vits-mms-tha-male` para D).

### Minecraft: el mod Capri Link
1. Minecraft Java Edition **1.21.1**.
2. Ejecuta el [instalador oficial de Fabric](https://fabricmc.net/use/installer/) → Client → Minecraft **1.21.1** → Install.
3. Launcher de Minecraft → **Instalaciones** → **Nueva instalación**:
   - Versión: `fabric-loader-…-1.21.1`
   - Directorio del juego: `…\Capri\games\minecraft\capri-1.21.1`
4. Abre Capri una vez (copia su mod a esa carpeta) y juega con esa instalación.
5. En el chat del juego: `capri help`, `capri scan`, `capri scan diamond`, `capri shock`, `capri shock all`, o `capri <una pregunta>`. También desde el chat del escritorio: "find diamonds".

> Usa el instalador oficial de Fabric, no una versión creada por otro launcher: puede fallar con "Unable to prepare assets for download".

## Problemas

| Problema | Solución |
|---|---|
| No responde o tarda mucho | Haz clic en el nombre del modelo y elige otro (los modelos en la nube se saturan). Con Ollama, la primera respuesta puede tardar minutos. |
| Sin voz | Comprueba que el zip de voces está extraído en la misma carpeta `Capri` (debe existir `Capri\voice\sherpa\kokoro-multi-lang-v1_0`). |
| El micro no oye | Clic derecho → Microphone → el correcto. |
| "That model isn't available" | Los modelos Gemini antiguos están cerrados a claves nuevas: elige un `gemini-3.x`. |
| Windows lo bloquea | Más información → Ejecutar de todas formas, o clic derecho en el zip → Propiedades → **Desbloquear** antes de extraer. |

## Desinstalar

Cierra Capri (clic derecho → Salir) y borra la carpeta `Capri`. Si usaste `Setup-This-PC.cmd`, ejecuta antes `Remove-From-This-PC.cmd`.
