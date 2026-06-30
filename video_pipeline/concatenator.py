"""Video concatenation module — combines rendered scenes into final video."""

import subprocess
from pathlib import Path

from config import Config


def concatenate_scenes(scene_paths: list, output_path: Path) -> Path:
    """
    Concatenate all rendered scene videos into one final video.

    Args:
        scene_paths: Ordered list of rendered scene video paths
        output_path: Where to save the final concatenated video

    Returns:
        Path to final video
    """
    # Create concat list file
    concat_file = output_path.parent / "concat_list.txt"
    with open(concat_file, "w") as f:
        for path in scene_paths:
            f.write(f"file '{path.resolve()}'\n")

    # FFmpeg concat
    cmd = [
        Config.FFMPEG_PATH,
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(concat_file),
        "-c:v", Config.VIDEO_CODEC,
        "-preset", Config.VIDEO_PRESET,
        "-crf", str(Config.VIDEO_CRF),
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        str(output_path),
    ]

    print(f"\nConcatenating {len(scene_paths)} scenes into final video...")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"FFmpeg concat error: {result.stderr[-500:]}")
        raise RuntimeError("Failed to concatenate scenes")

    # Cleanup concat list
    concat_file.unlink(missing_ok=True)

    # Get final video info
    duration = _get_video_duration(output_path)
    size_mb = output_path.stat().st_size / (1024 * 1024)

    print(f"\n{'='*60}")
    print(f"FINAL VIDEO COMPLETE")
    print(f"{'='*60}")
    print(f"  File: {output_path}")
    print(f"  Duration: {duration:.1f} seconds ({duration/60:.1f} minutes)")
    print(f"  Size: {size_mb:.1f} MB")
    print(f"  Resolution: {Config.VIDEO_WIDTH}x{Config.VIDEO_HEIGHT}")
    print(f"  FPS: {Config.VIDEO_FPS}")
    print(f"  Codec: {Config.VIDEO_CODEC}")
    print(f"{'='*60}")

    return output_path


def _get_video_duration(video_path: Path) -> float:
    """Get video duration in seconds."""
    import json
    cmd = [
        Config.FFPROBE_PATH,
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        str(video_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])
