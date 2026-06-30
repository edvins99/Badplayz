"""Scene renderer — combines image, audio, subtitles, and Ken Burns effect using FFmpeg."""

import json
import random
import subprocess
from pathlib import Path

from config import Config


def get_audio_duration(audio_path: Path) -> float:
    """Get duration of an audio file in seconds using ffprobe."""
    cmd = [
        Config.FFPROBE_PATH,
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        str(audio_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])


def get_ken_burns_filter(effect: str, duration: float) -> str:
    """
    Generate FFmpeg zoompan filter for Ken Burns effect.

    Args:
        effect: Type of effect — 'zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'pan_up'
        duration: Duration of the clip in seconds

    Returns:
        FFmpeg zoompan filter string
    """
    fps = Config.VIDEO_FPS
    total_frames = int(duration * fps)
    w = Config.VIDEO_WIDTH
    h = Config.VIDEO_HEIGHT

    # Base zoom range
    z_start = 1.0
    z_end = 1.12  # Subtle zoom

    if effect == "zoom_in":
        zoom_expr = f"min(zoom+{(z_end - z_start) / total_frames:.6f},{z_end})"
        x_expr = f"iw/2-(iw/zoom/2)"
        y_expr = f"ih/2-(ih/zoom/2)"
    elif effect == "zoom_out":
        zoom_expr = f"max(zoom-{(z_end - z_start) / total_frames:.6f},{z_start})"
        x_expr = f"iw/2-(iw/zoom/2)"
        y_expr = f"ih/2-(ih/zoom/2)"
    elif effect == "pan_left":
        zoom_expr = f"{z_end}"  # Slight zoom held constant
        pan_pixels = int(w * 0.05)
        x_expr = f"(iw-iw/zoom)/2-{pan_pixels}*(1-on/{total_frames})"
        y_expr = f"(ih-ih/zoom)/2"
    elif effect == "pan_right":
        zoom_expr = f"{z_end}"
        pan_pixels = int(w * 0.05)
        x_expr = f"(iw-iw/zoom)/2+{pan_pixels}*(on/{total_frames})"
        y_expr = f"(ih-ih/zoom)/2"
    elif effect == "pan_up":
        zoom_expr = f"{z_end}"
        pan_pixels = int(h * 0.04)
        x_expr = f"(iw-iw/zoom)/2"
        y_expr = f"(ih-ih/zoom)/2-{pan_pixels}*(on/{total_frames})"
    else:
        # Default: gentle zoom in
        zoom_expr = f"min(zoom+{(z_end - z_start) / total_frames:.6f},{z_end})"
        x_expr = f"iw/2-(iw/zoom/2)"
        y_expr = f"ih/2-(ih/zoom/2)"

    return (
        f"zoompan=z='{zoom_expr}'"
        f":x='{x_expr}'"
        f":y='{y_expr}'"
        f":d={total_frames}"
        f":s={w}x{h}"
        f":fps={fps}"
    )


def get_subtitle_filter(subtitle_text: str) -> str:
    """
    Generate FFmpeg drawtext filter for subtitles.
    Positioned at the bottom of the frame (92-95% height).
    """
    # Escape special characters for FFmpeg
    escaped = (
        subtitle_text
        .replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace(":", "\\:")
        .replace("%", "\\%")
    )

    margin_bottom = Config.SUBTITLE_MARGIN_BOTTOM
    fontsize = Config.SUBTITLE_FONTSIZE
    border_w = Config.SUBTITLE_BORDER_WIDTH

    return (
        f"drawtext="
        f"text='{escaped}'"
        f":fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        f":fontsize={fontsize}"
        f":fontcolor=white"
        f":borderw={border_w}"
        f":bordercolor=black"
        f":x=(w-text_w)/2"
        f":y=h-{margin_bottom}-text_h"
        f":line_spacing=8"
    )


def pick_ken_burns_effect(scene: dict) -> str:
    """Pick a Ken Burns effect based on scene direction or random."""
    ken_burns_text = scene.get("ken_burns", "").lower()

    if "zoom in" in ken_burns_text:
        return "zoom_in"
    elif "zoom out" in ken_burns_text:
        return "zoom_out"
    elif "pan left" in ken_burns_text or "pan across" in ken_burns_text:
        return "pan_left"
    elif "pan right" in ken_burns_text:
        return "pan_right"
    elif "pan up" in ken_burns_text or "tilt" in ken_burns_text:
        return "pan_up"
    else:
        # Random selection with zoom_in weighted higher
        return random.choice(["zoom_in", "zoom_in", "zoom_out", "pan_left", "pan_right"])


def render_scene(
    scene: dict,
    image_path: Path,
    audio_path: Path,
    output_path: Path,
) -> Path:
    """
    Render a single scene — image + Ken Burns + subtitle + audio → MP4.

    Args:
        scene: Scene dictionary with metadata
        image_path: Path to the scene image
        audio_path: Path to the scene audio
        output_path: Where to save the rendered scene

    Returns:
        Path to rendered scene video
    """
    # Get audio duration (this determines scene length)
    duration = get_audio_duration(audio_path)

    # Add 0.5s padding at end for breathing room
    total_duration = duration + 0.5

    # Pick Ken Burns effect
    effect = pick_ken_burns_effect(scene)

    # Build filter chain
    ken_burns_filter = get_ken_burns_filter(effect, total_duration)
    subtitle_filter = get_subtitle_filter(scene.get("subtitle_text", ""))

    # Full filter complex
    filter_complex = f"[0:v]{ken_burns_filter},format=yuv420p,{subtitle_filter}[v]"

    # FFmpeg command
    cmd = [
        Config.FFMPEG_PATH,
        "-y",  # Overwrite
        "-loop", "1",
        "-i", str(image_path),  # Input image
        "-i", str(audio_path),  # Input audio
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-map", "1:a",
        "-c:v", Config.VIDEO_CODEC,
        "-preset", Config.VIDEO_PRESET,
        "-crf", str(Config.VIDEO_CRF),
        "-c:a", "aac",
        "-b:a", "192k",
        "-t", str(total_duration),
        "-shortest",
        str(output_path),
    ]

    print(f"  Rendering scene {scene['scene_number']}... ({total_duration:.1f}s)")

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  FFmpeg error: {result.stderr[-500:]}")
        raise RuntimeError(f"FFmpeg failed for scene {scene['scene_number']}")

    print(f"  Saved: {output_path}")
    return output_path


def render_all_scenes(scenes: list, dirs: dict) -> list:
    """
    Render all scenes.

    Args:
        scenes: List of scene dictionaries
        dirs: Directory paths dict (images, audio, scenes)

    Returns:
        List of rendered scene video paths
    """
    scene_paths = []

    for scene in scenes:
        scene_num = scene["scene_number"]
        image_path = dirs["images"] / f"scene_{scene_num:02d}.png"
        audio_path = dirs["audio"] / f"scene_{scene_num:02d}.mp3"
        output_path = dirs["scenes"] / f"scene_{scene_num:02d}.mp4"

        # Skip if already rendered
        if output_path.exists():
            print(f"  Scene {scene_num}: Already rendered, skipping.")
            scene_paths.append(output_path)
            continue

        # Check dependencies
        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio not found: {audio_path}")

        path = render_scene(scene, image_path, audio_path, output_path)
        scene_paths.append(path)

    return scene_paths
