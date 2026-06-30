#!/usr/bin/env python3
"""
Hotkey Screen Recorder
======================
Nospied karsto taustiņu -> sākas ekrāna ieraksts.
Nospied vēlreiz -> apstājas un saglabā MP4.

Default taustiņi:
  F9  = sākt / apturēt ierakstu
  F10 = iziet no programmas

Strādā uz Windows / macOS / Linux (vajag FFmpeg).
"""

import os
import sys
import platform
import subprocess
import datetime
from pathlib import Path

try:
    import keyboard  # global hotkeys
except ImportError:
    print("Trūkst bibliotēkas 'keyboard'. Instalē: pip install keyboard")
    sys.exit(1)

# ---------------- IESTATĪJUMI ----------------
HOTKEY_TOGGLE = "f9"     # sākt/apturēt
HOTKEY_QUIT = "f10"      # iziet
FPS = 30                 # kadri sekundē
RECORD_AUDIO = False     # True = ieraksta arī mikrofonu (skat. README)
AUDIO_DEVICE = ""        # Windows dshow / macOS index / Linux pulse (skat. README)
OUTPUT_DIR = Path.home() / "Videos" / "ScreenRecordings"
FFMPEG = os.environ.get("FFMPEG_PATH", "ffmpeg")
CRF = 23                 # kvalitāte (mazāks = labāks, lielāks fails)
PRESET = "veryfast"      # x264 ātrums vs izmērs
# ----------------------------------------------

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
SYS = platform.system()  # 'Windows', 'Darwin', 'Linux'

_proc = None
_recording = False
_current_file = None


def build_command(outfile: Path) -> list:
    """Izveido FFmpeg komandu atkarībā no operētājsistēmas."""
    cmd = [FFMPEG, "-y"]

    if SYS == "Windows":
        cmd += ["-f", "gdigrab", "-framerate", str(FPS), "-i", "desktop"]
        if RECORD_AUDIO and AUDIO_DEVICE:
            cmd += ["-f", "dshow", "-i", f"audio={AUDIO_DEVICE}"]
    elif SYS == "Darwin":  # macOS
        # avfoundation: "screen_index:audio_index"
        screen = "1"
        audio = AUDIO_DEVICE if (RECORD_AUDIO and AUDIO_DEVICE) else "none"
        inp = f"{screen}:{audio}" if audio != "none" else f"{screen}:"
        cmd += ["-f", "avfoundation", "-framerate", str(FPS), "-i", inp]
    else:  # Linux
        display = os.environ.get("DISPLAY", ":0.0")
        cmd += ["-f", "x11grab", "-framerate", str(FPS), "-i", display]
        if RECORD_AUDIO and AUDIO_DEVICE:
            cmd += ["-f", "pulse", "-i", AUDIO_DEVICE]

    # Video kodēšana
    cmd += [
        "-c:v", "libx264",
        "-preset", PRESET,
        "-crf", str(CRF),
        "-pix_fmt", "yuv420p",
    ]
    if RECORD_AUDIO and AUDIO_DEVICE:
        cmd += ["-c:a", "aac", "-b:a", "192k"]

    cmd += [str(outfile)]
    return cmd


def start_recording():
    global _proc, _recording, _current_file
    if _recording:
        return
    ts = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    _current_file = OUTPUT_DIR / f"recording_{ts}.mp4"
    cmd = build_command(_current_file)

    print(f"\n[●] IERAKSTS SĀKTS -> {_current_file}")
    # stdin=PIPE lai vēlāk varētu nosūtīt 'q' korektai apturēšanai
    _proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    _recording = True


def stop_recording():
    global _proc, _recording
    if not _recording or _proc is None:
        return
    print("[■] Apturu ierakstu...")
    try:
        # Nosūtam 'q' lai FFmpeg korekti aizver MP4 failu
        _proc.stdin.write(b"q")
        _proc.stdin.flush()
        _proc.wait(timeout=10)
    except Exception:
        _proc.terminate()
        try:
            _proc.wait(timeout=5)
        except Exception:
            _proc.kill()
    _recording = False
    _proc = None
    if _current_file and _current_file.exists():
        size_mb = _current_file.stat().st_size / (1024 * 1024)
        print(f"[✓] Saglabāts: {_current_file}  ({size_mb:.1f} MB)\n")
    else:
        print("[!] Brīdinājums: fails netika izveidots. Pārbaudi FFmpeg iestatījumus.\n")


def toggle():
    if _recording:
        stop_recording()
    else:
        start_recording()


def quit_app():
    if _recording:
        stop_recording()
    print("Aizveru programmu. Uz redzēšanos!")
    os._exit(0)


def check_ffmpeg():
    try:
        subprocess.run([FFMPEG, "-version"], stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, check=True)
        return True
    except Exception:
        return False


def main():
    if not check_ffmpeg():
        print("KĻŪDA: FFmpeg nav atrasts.")
        print("Instalē FFmpeg un pārliecinies, ka tas ir PATH (vai iestati FFMPEG_PATH).")
        print("Windows: https://www.gyan.dev/ffmpeg/builds/")
        sys.exit(1)

    print("=" * 50)
    print("   HOTKEY SCREEN RECORDER")
    print("=" * 50)
    print(f"  OS:            {SYS}")
    print(f"  Saglabā uz:    {OUTPUT_DIR}")
    print(f"  Audio:         {'IESLĒGTS' if RECORD_AUDIO else 'izslēgts'}")
    print("-" * 50)
    print(f"  [{HOTKEY_TOGGLE.upper()}]  sākt / apturēt ierakstu")
    print(f"  [{HOTKEY_QUIT.upper()}] iziet")
    print("=" * 50)
    print("Gaidu... (nospied taustiņu jebkurā logā)\n")

    keyboard.add_hotkey(HOTKEY_TOGGLE, toggle)
    keyboard.add_hotkey(HOTKEY_QUIT, quit_app)

    try:
        keyboard.wait()  # bloķē līdz os._exit
    except KeyboardInterrupt:
        quit_app()


if __name__ == "__main__":
    main()
