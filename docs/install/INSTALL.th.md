# วิธีติดตั้ง Capri Desktop Plus (ภาษาไทย)

**ไทย** · [English](INSTALL.en.md) · [日本語](INSTALL.ja.md) · [한국어](INSTALL.ko.md) · [中文](INSTALL.zh.md) · [Français](INSTALL.fr.md) · [Español](INSTALL.es.md) · [Português](INSTALL.pt.md) · [Русский](INSTALL.ru.md)

Capri Desktop Plus ต่อยอดมาจาก [Capri Desktop ของ mochiiwuff](https://github.com/mochiiwuff/capri-desktop) ใช้ฟรี ห้ามนำไปขาย

## สิ่งที่ต้องมี

- Windows 10 หรือ 11 แบบ 64 บิต
- พื้นที่ว่างประมาณ 3 GB (ถ้าลง AI ในเครื่องหรือโมเดลวาดรูป ต้องใช้มากกว่านี้)
- อินเทอร์เน็ตตอนตั้งค่าครั้งแรก หลังจากนั้นใช้แบบออฟไลน์ได้ ถ้าใช้ AI ในเครื่อง
- วางไว้โฟลเดอร์ไหนก็ได้ รวมถึง SSD ภายนอกหรือแฟลชไดรฟ์

## 1. ดาวน์โหลด

เปิด **[หน้า Releases](https://github.com/twwcity/capri-desktop-plus/releases/latest)** แล้วโหลด**ทั้ง 2 ไฟล์**:

| ไฟล์ | มีอะไร |
|---|---|
| `Capri-Desktop-Plus-v1.0.2-app.zip` | ตัวโปรแกรม สคริปต์เปิด ระบบฟังเสียง (Whisper) และเครื่องมือเกม |
| `Capri-Desktop-Plus-v1.0.2-voices.zip` | เสียงพูดของ Capri (อังกฤษ ญี่ปุ่น จีน เกาหลี ไทย) |

## 2. แตกไฟล์ทั้งสองไว้ที่เดียวกัน

1. คลิกขวาที่ `...-app.zip` → **แตกไฟล์ทั้งหมด… (Extract All…)** → เลือกที่วาง เช่น `D:\` หรือแฟลชไดรฟ์ → **แตกไฟล์**
2. ทำแบบเดียวกันกับ `...-voices.zip` โดย**เลือกที่วางเดียวกัน**
3. จะได้โฟลเดอร์ `Capri` โฟลเดอร์เดียว ข้างในมี `app`, `voice`, `games`, `Start-Capri.vbs` และไฟล์อื่น ๆ

> อย่าเปิดจากในไฟล์ zip ต้องแตกไฟล์ก่อน

## 3. เปิด Capri

ดับเบิลคลิก **`Start-Capri.vbs`** ในโฟลเดอร์ `Capri`

- ถ้า Windows ขึ้น **"Windows protected your PC"** ให้กด **More info (ข้อมูลเพิ่มเติม)** → **Run anyway (เรียกใช้เลย)** เพราะโปรแกรมนี้ไม่ได้ลงลายเซ็นของบริษัท จะขึ้นแค่ครั้งแรก
- รอสักครู่ Capri จะโผล่มาที่ด้านล่างของจอ

## 4. เลือก AI ให้ Capri ใช้คุย

คลิกที่ Capri → **คุยกับฉัน (Talk to me)** ถ้ายังไม่ได้ตั้ง AI เธอจะถามว่าจะใช้แบบไหน:

- **ในเครื่องฉัน (Ollama):** เป็นส่วนตัว ใช้ออฟไลน์ได้ Capri จะลง Ollama และโหลดโมเดล gemma3 (3–8 GB) ให้ ต้องมี RAM 8 GB ขึ้นไป เครื่องเก่าจะตอบช้า
- **ออนไลน์ ไม่ต้องมีบัญชี:** ใช้ได้ทันที ไม่ต้องสมัคร (Pollinations) ง่ายและฟรี แต่ฉลาดน้อยกว่า
- **ฉันมีคีย์:** คุณภาพดีที่สุด แบบฟรีที่ง่ายที่สุดคือ **Google Gemini**:
  1. เปิด <https://aistudio.google.com/apikey> แล้วล็อกอินด้วยบัญชี Google
  2. กด **Create API key** แล้วคัดลอกคีย์
  3. ใน Capri เลือก **Google Gemini** แล้ววางคีย์ คีย์จะเก็บแบบเข้ารหัสไว้ในเครื่องคุณ
  4. กดที่ชื่อโมเดลบนหัวแชทเพื่อเลือกโมเดล `gemini-3.5-flash-lite` ตอบเร็วที่สุด

เปลี่ยน AI ได้ตลอด โดยกดที่ชื่อโมเดลบนหัวแชท

## 5. ภาษา เสียง และไมค์

- **ภาษา:** คลิกขวาที่ Capri → **ภาษา (Language)** → **ไทย** เธอจะตอบตามภาษาที่คุณพิมพ์ด้วย
- **เสียงพูด:** เปิดไว้แล้วเป็นค่าเริ่มต้น ปิดได้ที่คลิกขวา → เสียง → *Speak her answers aloud*
- **ไมค์:** ปุ่มไมค์ข้างช่องพิมพ์ เลือกไมค์ได้ที่คลิกขวา → **Microphone** มีเสียงบี๊บตอนเริ่มฟังและตอนหยุดฟัง พูดไทยปนอังกฤษได้

## 6. ลองใช้

| พิมพ์ในแชท | ผล |
|---|---|
| `เปิดเพลงลาลาลอย` | เปิดคลิปแรกบน YouTube ให้เลย |
| `ตอนนี้เพลงอะไรเล่นอยู่` | บอกชื่อเพลงหรือคลิปที่เล่นอยู่ และมีแถบเพลงเหนือแชท (ปก, ±10 วิ, ข้าม, เสียง, เล่นวน, ตั้งเวลาปิด) |
| วางลิงก์ | อ่านชื่อจากลิงก์ก่อน แล้วเปิดให้ |
| ปุ่ม `+` → **Code mode** → `ทำเกมงู` | เขียนเกมให้แล้วเปิดให้เล่น |
| ปุ่ม `+` → **PC agent** → `จัดไฟล์ใน Downloads` | จัดไฟล์ให้ และถามก่อนทำสิ่งที่เสี่ยง |
| ปุ่ม `+` → **Create image** | วาดรูป (ต้องโหลดโมเดลวาดรูปก่อน ดูหัวข้อด้านล่าง) |
| ไอคอนโทรศัพท์บนหัวแชท | โทรหาตัวละคร Edgerunners |

คีย์ลัด: **Ctrl+Alt+C** ซ่อนหรือเรียก Capri กลับมา คลิกขวาที่ตัว Capri เพื่อดูเมนูทั้งหมด

## ส่วนเสริม (ไม่บังคับ)

### ให้เปิดเองเมื่อเสียบไดรฟ์
ดับเบิลคลิก `Setup-This-PC.cmd` หนึ่งครั้งในแต่ละเครื่อง ถ้าจะยกเลิก ให้เปิด `Remove-From-This-PC.cmd`

### ใช้ Claude Code หรือ Codex เป็นสมองของ Capri
ลง [Claude Code](https://claude.com/claude-code) หรือ [Codex](https://developers.openai.com/codex) แล้วล็อกอินในหน้าต่าง terminal หนึ่งครั้ง จากนั้นเลือกในเมนูโมเดลของ Capri ตั้งโฟลเดอร์ที่ให้ทำงานได้ที่คลิกขวาที่ Capri → โมเดล AI

### วาดรูป
โหลด `sd-cli.exe` จาก [stable-diffusion.cpp releases](https://github.com/leejet/stable-diffusion.cpp/releases) ไปไว้ใน `Capri\imagegen\` แล้วโหลดโมเดล:
- **แบบเร็ว:** `sd_turbo.safetensors` จาก <https://huggingface.co/stabilityai/sd-turbo> ไว้ใน `Capri\imagegen\`
- **แบบสวยกว่า (ช้า ต้องมี VRAM 8 GB ขึ้นไป):** ไฟล์ GGUF ของ Wan 2.2 TI2V 5B ไว้ใน `Capri\imagegen\wan\`

### เสียงไทยของ Omi และ D ที่ดีกว่า
ไม่ได้ใส่มาให้ เพราะไม่มีสิทธิ์แจกต่อ วิธีสร้างเอง (ต้องมี Python 3.10 ขึ้นไป):
1. `pip install torch transformers onnx huggingface_hub`
2. `python tools/convert-thai-voice.py out VIZINTZOR/MMS-TTS-THAI-FEMALEV2`
3. คัดลอก `out\model.onnx` กับ `voice\sherpa\vits-mms-tha\tokens.txt` ไปไว้ที่ `Capri\voice\sherpa\vits-mms-tha-female\`

สำหรับ D ให้ใช้ `MALEV2` แล้ววางใน `vits-mms-tha-male`

### Cyberpunk 2077: ม็อด CapriLink (เล่นคนเดียวเท่านั้น)
1. ปิดเกมก่อน แล้วพิมพ์บอก Capri ว่า **"ติดตั้ง mod cyberpunk"** เธอจะโหลด Cyber Engine Tweaks จาก GitHub ทางการ แล้วใส่ม็อดของเธอให้ (หาเกมใน Steam เจอเอง ส่วน GOG กับ Epic ต้องลงไว้ที่โฟลเดอร์ปกติของมัน)
2. เปิดเกมแล้วโหลดเซฟ กด **F1** เพื่อเปิดหน้าต่าง CET ครั้งแรกอาจมีหน้าตั้งค่าสั้น ๆ ขึ้นมา
3. จากนั้นบอก Capri ได้เลยว่าอยากได้อะไร เช่น "อยากได้ปืนลูกซองของรีเบกก้า", "ขอซานเดวิสทานตัวที่ดีที่สุด", "เสกเงิน 100000", "เพิ่มแต้ม perk 5", "ปลดล็อกช่องไซเบอร์แวร์ทั้งหมด", "เสกรถของเดวิด", "ขับไปที่หมุด" (ต้องนั่งในรถ), "วาร์ปไปที่หมุด", "บิน", "Blackwall คนที่ฉันเล็ง", "เผาศัตรูรอบตัว"
4. ทุกครั้งที่ Capri อัปเดตม็อด ให้กด **Reload all mods** ในหน้าต่าง CET

### Minecraft: ม็อด Capri Link
1. ใช้ Minecraft Java Edition เวอร์ชัน **1.21.1**
2. เปิด [Fabric Installer](https://fabricmc.net/use/installer/) ตัวทางการ → Client → Minecraft **1.21.1** → Install
3. เปิด Minecraft Launcher → **Installations** → **New installation**:
   - Version: `fabric-loader-…-1.21.1`
   - Game directory: `…\Capri\games\minecraft\capri-1.21.1`
4. เปิด Capri หนึ่งครั้ง เธอจะคัดลอกม็อดไปไว้ในโฟลเดอร์นั้นให้ แล้วกดเล่นโปรไฟล์ที่สร้างไว้
5. **พิมพ์ในแชทเกม:** `capri help`, `capri scan`, `capri หาแร่ เพชร`, `capri shock`, `capri shock all` หรือ `capri <คำถาม>`
6. **สั่งจากแชทของ Capri บนเดสก์ท็อป:** เช่น "หาแร่เพชร", "ฟ้าผ่าม็อบ", "พูดในเกมว่า สวัสดี"

> ใช้ Fabric Installer ตัวทางการ อย่าใช้เวอร์ชันที่ลงจาก Launcher ตัวอื่น (เช่น TLauncher) เพราะอาจขึ้น error "Unable to prepare assets for download"

## แก้ปัญหา

| อาการ | วิธีแก้ |
|---|---|
| ไม่ตอบ หรือตอบช้ามาก | กดชื่อโมเดลบนหัวแชทแล้วเปลี่ยนตัว (โมเดลคลาวด์มักคิวเต็ม) ถ้าใช้ Ollama คำตอบแรกหลังเปิดอาจใช้เวลาหลายนาที |
| ไม่มีเสียง | เช็กว่าแตก voices zip ไว้ในโฟลเดอร์ `Capri` เดียวกัน (ต้องมี `Capri\voice\sherpa\kokoro-multi-lang-v1_0`) |
| ไมค์ไม่ได้ยิน | คลิกขวา → Microphone → เลือกไมค์ที่ถูกตัว |
| ขึ้นว่า "That model isn't available" | โมเดล Gemini รุ่นเก่าปิดรับคีย์ใหม่แล้ว ให้เลือกรุ่น `gemini-3.x` |
| Windows บล็อกไม่ให้เปิด | กด More info → Run anyway หรือคลิกขวาที่ไฟล์ zip → Properties → ติ๊ก **Unblock** ก่อนแตกไฟล์ |

## ถอนการติดตั้ง

ปิด Capri (คลิกขวา → ออก) แล้วลบโฟลเดอร์ `Capri` ทิ้ง ถ้าเคยใช้ `Setup-This-PC.cmd` ให้เปิด `Remove-From-This-PC.cmd` ก่อน
