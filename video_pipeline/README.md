# YouTube Documentary Video Generation Pipeline

Automated pipeline for generating faceless documentary-style YouTube videos from scenario scripts.

## Features
- AI image generation (OpenAI GPT-image-1 / DALL-E 3)
- Voice-over narration (ElevenLabs)
- Subtitle overlay (Netflix-style, bottom-positioned)
- Ken Burns effect (zoom/pan animation)
- FFmpeg scene rendering & final concatenation
- Full 1920x1080, 30fps, H.264 output

## Requirements

```bash
pip install -r requirements.txt
```

- Python 3.10+
- FFmpeg installed and in PATH (or specify path in config)
- OpenAI API key
- ElevenLabs API key

## Usage

```bash
# Generate video from a scenario JSON file
python generate_video.py --scenario scenario.json --output output/final_video.mp4

# Generate from a specific scenario number (reads from scenarios/ folder)
python generate_video.py --scenario-number 1 --output output/

# Only generate images
python generate_video.py --scenario scenario.json --step images

# Only generate audio
python generate_video.py --scenario scenario.json --step audio

# Only render scenes (images + audio must exist)
python generate_video.py --scenario scenario.json --step render

# Only concatenate (rendered scenes must exist)
python generate_video.py --scenario scenario.json --step concat
```

## Configuration

Copy `.env.example` to `.env` and fill in your API keys:

```
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
OUTPUT_DIR=./output
VOICE_ID=adam
ELEVENLABS_MODEL=eleven_flash_v2_5
```

## Scenario JSON Format

```json
{
  "title": "The Dyatlov Pass Incident",
  "scenes": [
    {
      "scene_number": 1,
      "narration": "On February first, nineteen fifty-nine...",
      "image_prompt": "Snow-covered Ural Mountains at dusk..., cinematic photorealistic, 4K",
      "subtitle_text": "FEBRUARY 1959 — URAL MOUNTAINS, SOVIET UNION",
      "ken_burns": "zoom_in"
    }
  ]
}
```

## Pipeline Steps

1. **Image Generation** → `output/images/scene_01.png`
2. **Audio Generation** → `output/audio/scene_01.mp3`
3. **Scene Rendering** → `output/scenes/scene_01.mp4` (image + audio + subtitle + Ken Burns)
4. **Concatenation** → `output/final_video.mp4`
