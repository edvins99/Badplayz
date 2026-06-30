"""Configuration module for the video generation pipeline."""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Pipeline configuration loaded from environment variables."""

    # API Keys
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")

    # FFmpeg
    FFMPEG_PATH: str = os.getenv("FFMPEG_PATH", "ffmpeg")
    FFPROBE_PATH: str = os.getenv("FFPROBE_PATH", "ffprobe")

    # Output
    OUTPUT_DIR: Path = Path(os.getenv("OUTPUT_DIR", "./output"))

    # Voice settings
    VOICE_ID: str = os.getenv("VOICE_ID", "pNInz6obpgDQGcFmaJgB")  # Adam
    ELEVENLABS_MODEL: str = os.getenv("ELEVENLABS_MODEL", "eleven_flash_v2_5")

    # Image settings
    IMAGE_MODEL: str = os.getenv("IMAGE_MODEL", "gpt-image-1")
    IMAGE_SIZE: str = os.getenv("IMAGE_SIZE", "1536x1024")  # 3:2 aspect ratio

    # Video settings
    VIDEO_WIDTH: int = 1920
    VIDEO_HEIGHT: int = 1080
    VIDEO_FPS: int = 30
    VIDEO_CRF: int = 23
    VIDEO_CODEC: str = "libx264"
    VIDEO_PRESET: str = "medium"

    # Ken Burns settings
    KB_ZOOM_RANGE: tuple = (1.0, 1.15)  # Min and max zoom factor
    KB_PAN_RANGE: float = 0.05  # Max pan as fraction of image size

    # Subtitle settings
    SUBTITLE_FONT: str = "Arial-Bold"
    SUBTITLE_FONTSIZE: int = 48
    SUBTITLE_MARGIN_BOTTOM: int = 60  # pixels from bottom
    SUBTITLE_BORDER_WIDTH: int = 3
    SUBTITLE_MAX_WIDTH: int = 1632  # 85% of 1920

    @classmethod
    def validate(cls):
        """Validate that required configuration is present."""
        errors = []
        if not cls.OPENAI_API_KEY:
            errors.append("OPENAI_API_KEY is not set")
        if not cls.ELEVENLABS_API_KEY:
            errors.append("ELEVENLABS_API_KEY is not set")
        if errors:
            raise ValueError(
                "Configuration errors:\n" + "\n".join(f"  - {e}" for e in errors)
            )

    @classmethod
    def setup_directories(cls, base_dir: Path = None):
        """Create output directory structure."""
        base = base_dir or cls.OUTPUT_DIR
        dirs = {
            "images": base / "images",
            "audio": base / "audio",
            "scenes": base / "scenes",
            "final": base,
        }
        for d in dirs.values():
            d.mkdir(parents=True, exist_ok=True)
        return dirs
