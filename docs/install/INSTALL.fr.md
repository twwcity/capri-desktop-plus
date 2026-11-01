# Installer Capri Desktop Plus (Français)

[ไทย](INSTALL.th.md) · [English](INSTALL.en.md) · [日本語](INSTALL.ja.md) · [한국어](INSTALL.ko.md) · [中文](INSTALL.zh.md) · **Français** · [Español](INSTALL.es.md) · [Português](INSTALL.pt.md) · [Русский](INSTALL.ru.md)

Capri Desktop Plus est un fork de [Capri Desktop de mochiiwuff](https://github.com/mochiiwuff/capri-desktop). Gratuit et non commercial (vente interdite).

## Ce qu'il faut

- Windows 10 ou 11, 64 bits.
- Environ 3 Go libres (plus si vous ajoutez une IA locale ou des modèles d'images).
- Internet pour la première configuration ; ensuite tout peut marcher hors ligne avec une IA locale.
- Fonctionne depuis n'importe quel dossier, un SSD externe ou une clé USB.

## 1. Télécharger

Ouvrez la **[page Releases](https://github.com/twwcity/capri-desktop-plus/releases/latest)** et téléchargez **les deux** fichiers :

| Fichier | Contenu |
|---|---|
| `Capri-Desktop-Plus-v1.0.1-app.zip` | L'application, les scripts de lancement, la reconnaissance vocale (Whisper), les outils de jeu |
| `Capri-Desktop-Plus-v1.0.1-voices.zip` | Ses voix (anglais, japonais, chinois, coréen, thaï) |

## 2. Extraire les deux au même endroit

1. Clic droit sur `...-app.zip` → **Extraire tout…** → choisissez un endroit (par ex. `D:\` ou la clé USB) → **Extraire**.
2. Pareil pour `...-voices.zip`, **au même endroit**.
3. Vous obtenez un dossier `Capri` contenant `app`, `voice`, `games`, `Start-Capri.vbs`, etc.

> Ne lancez rien depuis l'intérieur du zip : extrayez d'abord.

## 3. Lancer Capri

Double-cliquez sur **`Start-Capri.vbs`** dans le dossier `Capri`.

- Si Windows affiche **« Windows a protégé votre ordinateur »** : **Informations complémentaires** → **Exécuter quand même** (l'app n'est pas signée ; seulement la première fois).
- Capri apparaît en bas de l'écran après quelques secondes.

## 4. Lui donner une IA

Cliquez sur Capri → **Lui parler**. Si aucune IA n'est configurée, elle vous demande laquelle :

- **Sur mon PC (Ollama)** — privé, hors ligne. Capri installe Ollama et télécharge un modèle (gemma3, 3–8 Go). 8 Go de RAM ou plus ; plus lent sur un vieux PC.
- **En ligne, sans compte** — marche tout de suite (Pollinations). Simple et gratuit, moins malin.
- **J'ai une clé** — la meilleure qualité. Le plus simple et gratuit : **Google Gemini** :
  1. Ouvrez <https://aistudio.google.com/apikey> et connectez-vous avec Google.
  2. **Create API key**, copiez-la.
  3. Dans Capri, choisissez **Google Gemini** et collez la clé (gardée chiffrée sur votre PC).
  4. Cliquez sur le nom du modèle en haut du chat pour en choisir un. `gemini-3.5-flash-lite` est le plus rapide.

Vous pouvez changer d'IA à tout moment : cliquez sur le nom du modèle en haut du chat.

## 5. Langue, voix et micro

- **Langue :** clic droit sur Capri → **Langue** → la vôtre. Elle répond aussi dans la langue que vous écrivez.
- **Voix :** activée par défaut (clic droit → Son → *Speak her answers aloud*).
- **Micro :** le bouton micro à côté de la ligne de saisie. Choisissez le micro via clic droit → **Microphone**. Un bip au début et à la fin de l'écoute.

## 6. À essayer

| Tapez dans le chat | Ce qui se passe |
|---|---|
| `play Shape of You on youtube` | Ouvre et lance la première vidéo |
| `what's playing?` | Vous dit ce qui joue ; une barre média avec pochette, ±10 s, suivant, volume, boucle et minuteur apparaît au-dessus du chat |
| Un lien | Elle lit son titre puis l'ouvre |
| `+` → **Code mode** → `make a snake game` | Écrit le jeu et l'ouvre pour jouer |
| `+` → **PC agent** → `sort my Downloads folder` | Range les fichiers, en demandant avant tout risque |
| `+` → **Create image** | Dessine (modèles d'images nécessaires, voir plus bas) |
| L'icône téléphone en haut du chat | Holo-appels avec les personnages d'Edgerunners |

Raccourcis : **Ctrl+Alt+C** la cache/montre. Clic droit sur elle pour tout le menu.

## En option

### Lancement quand le disque est branché
Double-cliquez une fois `Setup-This-PC.cmd` sur chaque PC. Pour annuler : `Remove-From-This-PC.cmd`.

### Claude Code ou Codex comme cerveau
Installez [Claude Code](https://claude.com/claude-code) ou [Codex](https://developers.openai.com/codex), connectez-vous une fois dans un terminal, puis choisissez-le dans le menu des modèles. Dossier de travail : clic droit → Modèle IA.

### Images
Mettez `sd-cli.exe` des [releases de stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp/releases) dans `Capri\imagegen\`, plus un modèle :
- rapide : `sd_turbo.safetensors` de <https://huggingface.co/stabilityai/sd-turbo> dans `Capri\imagegen\`
- meilleur (lent, 8 Go de VRAM ou plus) : les fichiers GGUF de Wan 2.2 TI2V 5B dans `Capri\imagegen\wan\`

### Meilleures voix thaïes pour Omi et D
Non incluses (pas de licence pour les partager). Avec Python 3.10+ : `pip install torch transformers onnx huggingface_hub`, puis `python tools/convert-thai-voice.py out VIZINTZOR/MMS-TTS-THAI-FEMALEV2`, et copiez `out\model.onnx` et `voice\sherpa\vits-mms-tha\tokens.txt` dans `Capri\voice\sherpa\vits-mms-tha-female\` (MALEV2 → `vits-mms-tha-male` pour D).

### Minecraft : le mod Capri Link
1. Minecraft Java Edition **1.21.1**.
2. Lancez l'[installeur Fabric](https://fabricmc.net/use/installer/) officiel → Client → Minecraft **1.21.1** → Install.
3. Launcher Minecraft → **Configurations** → **Nouvelle configuration** :
   - Version : `fabric-loader-…-1.21.1`
   - Dossier de jeu : `…\Capri\games\minecraft\capri-1.21.1`
4. Lancez Capri une fois (elle copie son mod dans ce dossier), puis jouez avec cette configuration.
5. Dans le chat du jeu : `capri help`, `capri scan`, `capri scan diamond`, `capri shock`, `capri shock all`, ou `capri <une question>`. Depuis le chat du bureau aussi : « find diamonds ».

> Utilisez l'installeur Fabric officiel, pas une version créée par un autre launcher : elle peut échouer avec « Unable to prepare assets for download ».

## Problèmes

| Problème | Solution |
|---|---|
| Elle ne répond pas, ou très lentement | Cliquez sur le nom du modèle dans le chat et prenez-en un autre (les modèles en ligne saturent). Avec Ollama, la première réponse peut prendre quelques minutes. |
| Pas de voix | Vérifiez que le zip des voix est extrait dans le même dossier `Capri` (`Capri\voice\sherpa\kokoro-multi-lang-v1_0` doit exister). |
| Le micro n'entend rien | Clic droit → Microphone → le bon. |
| « That model isn't available » | Les anciens modèles Gemini sont fermés aux nouvelles clés : prenez un `gemini-3.x`. |
| Windows le bloque | Informations complémentaires → Exécuter quand même, ou clic droit sur le zip → Propriétés → **Débloquer** avant d'extraire. |

## Désinstaller

Fermez Capri (clic droit → Quitter) et supprimez le dossier `Capri`. Si vous avez utilisé `Setup-This-PC.cmd`, lancez d'abord `Remove-From-This-PC.cmd`.
