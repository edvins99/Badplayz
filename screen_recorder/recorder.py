#!/usr/bin/env python3
"""
Hotkey Screen Recorder (ar pauzi un apgabala izvēli)
====================================================
  F9  = sākt / apturēt ierakstu (un saglabāt)
  F8  = pauze / turpināt
  F7  = izvēlēties ekrāna apgabalu (ar peli)  — kad neraksta
  F10 = iziet

Strādā uz Windows / macOS / Linux (vajag FFmpeg).
"""

import os
import sys
import platform
import subprocess
import datetime
from pathlib import Path

try:
    import keyboard
except ImportError:
    print("Trūkst bibliotēkas 'keyboard'. Instalē: pip install keyboard")
    sys.exit(1)

# ---------------- IESTATĪJUMI ----------------
HOTKEY_TOGGLE = "f9"     # sākt/apturēt
HOTKEY_PAUSE = "f8"      # pauze/turpināt
HOTKEY_REGION = "f7"     # izvēlēties apgabalu
HOTKEY_QUIT = "f10"      # iziet

FPS = 30
RECORD_AUDIO = False
AUDIO_DEVICE = ""
OUTPUT_DIR = Path.home() / "Videos" / "ScreenRecordings"
FFMPEG = os.environ.get("FFMPEG_PATH", "ffmpeg")
CRF = 23
PRESET = "veryfast"

# REGION = None  -> viss ekrāns
# REGION = (x, y, w, h) -> tikai šis apgabals (vari iestatīt manuāli vai ar F7)
REGION = None
# ----------------------------------------------

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TMP_DIR = OUTPUT_DIR / "_segments"
SYS = platform.system()

_proc = None
_recording = False
_paused = False
_segments = []          # ierakstīto daļu faili (pauzes dēļ var būt vairākas)
_final_file = None


# ---------------- APGABALA IZVĒLE (tkinter) ----------------
def pick_region():
    """Atver puscaurspīdīgu logu; ar peli atzīmē taisnstūri. Atgriež (x,y,w,h) vai None."""
    global REGION
    if _recording:
        print("[!] Nevar mainīt apgabalu ieraksta laikā.")
        return
    try:
        import tkinter as tk
    except ImportError:
        print("[!] tkinter nav pieejams — apgabala izvēle nedarbojas.")
        return

    coords = {}

    root = tk.Tk()
    root.attributes("-fullscreen", True)
    try:
        root.attributes("-alpha", 0.25)
    except Exception:
        pass
    root.configure(bg="black")
    root.attributes("-topmost", True)
    canvas = tk.Canvas(root, cursor="cross", bg="black", highlightthickness=0)
    canvas.pack(fill="both", expand=True)
    canvas.create_text(
        root.winfo_screenwidth() // 2, 40,
        text="Velc peli, lai atzīmētu apgabalu  •  ESC = atcelt  •  ENTER = viss ekrāns",
        fill="#00f0ff", font=("Arial", 18)
    )

    rect = {"id": None, "x0": 0, "y0": 0}

    def on_down(e):
        rect["x0"], rect["y0"] = e.x, e.y
        rect["id"] = canvas.create_rectangle(e.x, e.y, e.x, e.y, outline="#00f0ff", width=2)

    def on_move(e):
        if rect["id"] is not None:
            canvas.coords(rect["id"], rect["x0"], rect["y0"], e.x, e.y)

    def on_up(e):
        x0, y0 = rect["x0"], rect["y0"]
        x1, y1 = e.x, e.y
        x, y = min(x0, x1), min(y0, y1)
        w, h = abs(x1 - x0), abs(y1 - y0)
        # FFmpeg prasa pāra skaitļus
        w -= w % 2
        h -= h % 2
        if w >= 16 and h >= 16:
            coords["region"] = (x, y, w, h)
        root.destroy()

    def on_cancel(e):
        root.destroy()

    def on_full(e):
        coords["region"] = None
        root.destroy()

    canvas.bind("<ButtonPress-1>", on_down)
    canvas.bind("<B1-Motion>", on_move)
    canvas.bind("<ButtonRelease-1>", on_up)
    root.bind("<Escape>", on_cancel)
    root.bind("<Return>", on_full)
    root.mainloop()

    if "region" in coords:
        REGION = coords["region"]
        if REGION:
            print(f"[✓] Apgabals iestatīts: x={REGION[0]} y={REGION[1]} {REGION[2]}x{REGION[3]}")
        else:
            print("[✓] Apgabals: viss ekrāns")
    else:
        print("[i] Apgabala izvēle atcelta (paliek iepriekšējais).")


# ---------------- FFMPEG KOMANDA ----------------
def build_command(outfile: Path) -> list:
    cmd = [FFMPEG, "-y"]
    region = REGION

    if SYS == "Windows":
        cmd += ["-f", "gdigrab", "-framerate", str(FPS)]
        if region:
            x, y, w, h = region
            cmd += ["-offset_x", str(x), "-offset_y", str(y),
                    "-video_size", f"{w}x{h}"]
        cmd += ["-i", "desktop"]
        if RECORD_AUDIO and AUDIO_DEVICE:
            cmd += ["-f", "dshow", "-i", f"audio={AUDIO_DEVICE}"]

    elif SYS == "Darwin":  # macOS
        cmd += ["-f", "avfoundation", "-framerate", str(FPS)]
        audio = AUDIO_DEVICE if (RECORD_AUDIO and AUDIO_DEVICE) else ""
        cmd += ["-i", f"1:{audio}" if audio else "1:"]
        if region:  # macOS: apgabals caur crop filtru
            x, y, w, h = region
            cmd += ["-vf", f"crop={w}:{h}:{x}:{y}"]

    else:  # Linux
        display = os.environ.get("DISPLAY", ":0.0")
        cmd += ["-f", "x11grab", "-framerate", str(FPS)]
        if region:
            x, y, w, h = region
            cmd += ["-video_size", f"{w}x{h}", "-i", f"{display}+{x},{y}"]
        else:
            cmd += ["-i", display]
        if RECORD_AUDIO and AUDIO_DEVICE:
            cmd += ["-f", "pulse", "-i", AUDIO_DEVICE]

    cmd += ["-c:v", "libx264", "-preset", PRESET, "-crf", str(CRF), "-pix_fmt", "yuv420p"]
    if RECORD_AUDIO and AUDIO_DEVICE:
        cmd += ["-c:a", "aac", "-b:a", "192k"]
    cmd += [str(outfile)]
    return cmd


# ---------------- IERAKSTA VADĪBA ----------------
def _start_segment():
    global _proc
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    seg = TMP_DIR / f"seg_{len(_segments):03d}.mp4"
    _segments.append(seg)
    cmd = build_command(seg)
    _proc = subprocess.Popen(cmd, stdin=subprocess.PIPE,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _stop_segment():
    global _proc
    if _proc is None:
        return
    try:
        _proc.stdin.write(b"q")
        _proc.stdin.flush()
        _proc.wait(timeout=10)
    except Exception:
        _proc.terminate()
        try:
            _proc.wait(timeout=5)
        except Exception:
            _proc.kill()
    _proc = None


def start_recording():
    global _recording, _paused, _segments, _final_file
    if _recording:
        return
    _segments = []
    ts = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    _final_file = OUTPUT_DIR / f"recording_{ts}.mp4"
    reg = f" [apgabals {REGION[2]}x{REGION[3]}]" if REGION else " [viss ekrāns]"
    print(f"\n[●] IERAKSTS SĀKTS{reg} -> {_final_file}")
    _paused = False
    _recording = True
    _start_segment()


def pause_resume():
    global _paused
    if not _recording:
        return
    if _paused:
        print("[▶] Turpinu...")
        _paused = False
        _start_segment()
    else:
        print("[⏸] Pauze.")
        _paused = True
        _stop_segment()


def stop_recording():
    global _recording, _paused
    if not _recording:
        return
    print("[■] Apturu ierakstu...")
    if not _paused:
        _stop_segment()
    _recording = False
    _paused = False
    _finalize()


def _finalize():
    """Apvieno segmentus (ja vairāki) vienā failā."""
    segs = [s for s in _segments if s.exists() and s.stat().st_size > 0]
    if not segs:
        print("[!] Fails netika izveidots. Pārbaudi FFmpeg iestatījumus.\n")
        return
    if len(segs) == 1:
        segs[0].replace(_final_file)
    else:
        listfile = TMP_DIR / "concat.txt"
        listfile.write_text("".join(f"file '{s.resolve()}'\n" for s in segs))
        cmd = [FFMPEG, "-y", "-f", "concat", "-safe", "0",
               "-i", str(listfile), "-c", "copy", str(_final_file)]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for s in segs:
            s.unlink(missing_ok=True)
        listfile.unlink(missing_ok=True)
    # iztīra tmp
    try:
        for f in TMP_DIR.glob("seg_*.mp4"):
            f.unlink(missing_ok=True)
        TMP_DIR.rmdir()
    except Exception:
        pass

    if _final_file.exists():
        size_mb = _final_file.stat().st_size / (1024 * 1024)
        print(f"[✓] Saglabāts: {_final_file}  ({size_mb:.1f} MB)\n")
    else:
        print("[!] Apvienošana neizdevās.\n")


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
        print("KĻŪDA: FFmpeg nav atrasts. Instalē FFmpeg un pievieno PATH.")
        print("Windows: https://www.gyan.dev/ffmpeg/builds/")
        sys.exit(1)

    print("=" * 52)
    print("   HOTKEY SCREEN RECORDER  (pauze + apgabals)")
    print("=" * 52)
    print(f"  OS:          {SYS}")
    print(f"  Saglabā uz:  {OUTPUT_DIR}")
    print(f"  Audio:       {'IESLĒGTS' if RECORD_AUDIO else 'izslēgts'}")
    print("-" * 52)
    print(f"  [{HOTKEY_TOGGLE.upper()}]  sākt / apturēt + saglabāt")
    print(f"  [{HOTKEY_PAUSE.upper()}]  pauze / turpināt")
    print(f"  [{HOTKEY_REGION.upper()}]  izvēlēties apgabalu (ar peli)")
    print(f"  [{HOTKEY_QUIT.upper()}] iziet")
    print("=" * 52)
    print("Gaidu... (taustiņi strādā jebkurā logā)\n")

    keyboard.add_hotkey(HOTKEY_TOGGLE, toggle)
    keyboard.add_hotkey(HOTKEY_PAUSE, pause_resume)
    keyboard.add_hotkey(HOTKEY_REGION, pick_region)
    keyboard.add_hotkey(HOTKEY_QUIT, quit_app)

    try:
        keyboard.wait()
    except KeyboardInterrupt:
        quit_app()


if __name__ == "__main__":
    main()
