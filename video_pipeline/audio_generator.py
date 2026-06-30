"""Audio generation module using ElevenLabs API."""

import time
from pathlib import Path

from elevenlabs import ElevenLabs

from config import Config


class AudioGenerator:
    """Generates voice-over audio using ElevenLabs API."""

    def __init__(self):
        self.client = ElevenLabs(api_key=Config.ELEVENLABS_API_KEY)

    def generate_audio(self, text: str, output_path: Path, retries: int = 3) -> Path:
        """
        Generate voice-over audio from text.

        Args:
            text: Narration text to convert to speech
            output_path: Where to save the audio file
            retries: Number of retry attempts

        Returns:
            Path to saved audio file
        """
        for attempt in range(retries):
            try:
                print(f"  Generating audio (attempt {attempt + 1}/{retries})...")

                audio_generator = self.client.text_to_speech.convert(
                    voice_id=Config.VOICE_ID,
                    model_id=Config.ELEVENLABS_MODEL,
                    text=text,
                    output_format="mp3_44100_128",
                )

                # Write audio to file
                with open(output_path, "wb") as f:
                    for chunk in audio_generator:
                        f.write(chunk)

                print(f"  Saved: {output_path}")
                return output_path

            except Exception as e:
                print(f"  Error: {e}")
                if attempt < retries - 1:
                    wait_time = (attempt + 1) * 5
                    print(f"  Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    raise RuntimeError(f"Failed to generate audio after {retries} attempts: {e}")


def generate_all_audio(scenes: list, output_dir: Path) -> list:
    """
    Generate audio for all scenes.

    Args:
        scenes: List of scene dicts with 'narration' key
        output_dir: Directory to save audio files

    Returns:
        List of audio file paths
    """
    generator = AudioGenerator()
    audio_paths = []

    for scene in scenes:
        scene_num = scene["scene_number"]
        output_path = output_dir / f"scene_{scene_num:02d}.mp3"

        # Skip if already exists
        if output_path.exists():
            print(f"  Scene {scene_num}: Audio already exists, skipping.")
            audio_paths.append(output_path)
            continue

        print(f"  Scene {scene_num}: Generating audio...")
        path = generator.generate_audio(scene["narration"], output_path)
        audio_paths.append(path)

        # Rate limiting
        time.sleep(1)

    return audio_paths
