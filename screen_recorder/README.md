# 🎥 Hotkey Screen Recorder

Vienkārša programma: **nospied taustiņu → sākas ekrāna ieraksts. Nospied vēlreiz → apstājas un saglabā MP4.**

- **F9** = sākt / apturēt ierakstu
- **F10** = iziet

Strādā uz **Windows / macOS / Linux**.

---

## 📦 1. Kas jāinstalē

### a) Python 3.8+
Lejupielādē: https://www.python.org/downloads/
> Windows: instalēšanas laikā atzīmē **"Add Python to PATH"**

### b) FFmpeg (video dzinējs)
- **Windows:** lejupielādē no https://www.gyan.dev/ffmpeg/builds/ → izņem ZIP → pievieno `bin` mapi PATH
  (vai vienkārši ieliec `ffmpeg.exe` tajā pašā mapē, kur `recorder.py`, un palaid no turienes)
- **macOS:** `brew install ffmpeg`
- **Linux:** `sudo apt install ffmpeg`

### c) Python bibliotēka
```bash
pip install -r requirements.txt
```

---

## ▶️ 2. Kā palaist

```bash
python recorder.py
```

> **Windows:** palaid **kā administrators** (labais klikšķis → "Run as administrator"),
> citādi globālie hotkey var nestrādāt.
>
> **macOS/Linux:** vajag `sudo python recorder.py` (keyboard bibliotēka prasa root piekļuvi).

Pēc palaišanas redzēsi izvēlni. Nospied **F9** jebkurā logā, lai sāktu ierakstu.

Faili tiek saglabāti šeit:
```
<tava mape>/Videos/ScreenRecordings/recording_2026-06-30_21-45-00.mp4
```

---

## ⚙️ 3. Iestatījumi (recorder.py augšā)

```python
HOTKEY_TOGGLE = "f9"     # taustiņš sākt/apturēt
HOTKEY_QUIT   = "f10"    # taustiņš iziet
FPS           = 30       # kadri sekundē
RECORD_AUDIO  = False    # True = ieraksta arī skaņu
AUDIO_DEVICE  = ""       # skaņas ierīces nosaukums (skat. zemāk)
CRF           = 23       # kvalitāte (mazāks = labāks, lielāks fails)
```

Vari nomainīt taustiņus uz jebkuriem, piem. `"ctrl+shift+r"`.

---

## 🔊 4. Kā ieslēgt skaņas ierakstu (nav obligāti)

### Windows
1. Uzzini mikrofona nosaukumu:
   ```bash
   ffmpeg -list_devices true -f dshow -i dummy
   ```
2. Sarakstā atrodi savu ierīci, piem. `Microphone (Realtek Audio)`
3. Iestati `recorder.py`:
   ```python
   RECORD_AUDIO = True
   AUDIO_DEVICE = "Microphone (Realtek Audio)"
   ```

> Lai ierakstītu **sistēmas skaņu** (to, kas skan datorā), Windows vajag iespējot
> "Stereo Mix" skaņas iestatījumos, vai izmantot virtuālo audio kabeli (VB-Audio).

### macOS
`AUDIO_DEVICE` = audio ieejas indekss no:
```bash
ffmpeg -f avfoundation -list_devices true -i ""
```

### Linux
`AUDIO_DEVICE = "default"` (PulseAudio) parasti pietiek.

---

## ❓ Biežākās problēmas

| Problēma | Risinājums |
|----------|-----------|
| "FFmpeg nav atrasts" | Instalē FFmpeg un pievieno PATH |
| Hotkey nestrādā | Windows: palaid kā administrators |
| Tukšs/bojāts video | Pārbaudi FPS un ka ekrāns netiek bloķēts |
| Melns ekrāns (Linux) | Pārbaudi `DISPLAY` mainīgo (`echo $DISPLAY`) |
| Liels faila izmērs | Palielini `CRF` (piem. 28) vai samazini `FPS` |

---

## 💡 Padoms

- Noklusētā kvalitāte (CRF 23, 30fps) ir laba YouTube/CapCut montāžai
- Ieraksti tiek saglabāti ar laika zīmogu, tāpēc nekas netiek pārrakstīts
- Vari ierakstīto MP4 uzreiz vilkt CapCut montāžai
