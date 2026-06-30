#!/usr/bin/env python3
"""
Scenario Markdown to JSON Converter
====================================

Converts scenario .md files (the format used in our scripts)
into the JSON format required by the video generation pipeline.

Usage:
    python scenario_converter.py input.md output.json
"""

import argparse
import json
import re
from pathlib import Path


def parse_scenario_md(md_path: str) -> dict:
    """Parse a scenario markdown file into structured JSON."""

    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract title
    title_match = re.search(r'^# SCENARIO \d+: "(.+?)"', content, re.MULTILINE)
    title = title_match.group(1) if title_match else "Untitled"

    # Extract genre
    genre_match = re.search(r'## Genre: (.+)', content)
    genre = genre_match.group(1).strip() if genre_match else ""

    # Extract duration
    duration_match = re.search(r'## Duration: (.+)', content)
    duration = duration_match.group(1).strip() if duration_match else ""

    # Parse scenes
    scenes = []
    scene_blocks = re.split(r'\*\*Scene (\d+)\*\*', content)

    for i in range(1, len(scene_blocks), 2):
        scene_num = int(scene_blocks[i])
        scene_content = scene_blocks[i + 1] if i + 1 < len(scene_blocks) else ""

        # Extract narration
        narration_match = re.search(
            r'- Narration: "(.+?)"',
            scene_content,
            re.DOTALL
        )
        narration = narration_match.group(1).strip() if narration_match else ""

        # Extract image prompt
        image_match = re.search(
            r'- Image Prompt: "(.+?)"',
            scene_content,
            re.DOTALL
        )
        image_prompt = image_match.group(1).strip() if image_match else ""

        # Extract subtitle
        subtitle_match = re.search(
            r'- Subtitle: "(.+?)"',
            scene_content,
        )
        subtitle_text = subtitle_match.group(1).strip() if subtitle_match else ""

        # Extract Ken Burns direction
        ken_burns_match = re.search(
            r'- Ken Burns: (.+)',
            scene_content,
        )
        ken_burns = ken_burns_match.group(1).strip() if ken_burns_match else ""

        if narration:  # Only add if we found narration
            scenes.append({
                "scene_number": scene_num,
                "narration": narration,
                "image_prompt": image_prompt,
                "subtitle_text": subtitle_text,
                "ken_burns": ken_burns,
            })

    result = {
        "title": title,
        "genre": genre,
        "duration": duration,
        "total_scenes": len(scenes),
        "scenes": scenes,
    }

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Convert scenario .md to pipeline .json"
    )
    parser.add_argument("input", help="Input .md scenario file")
    parser.add_argument("output", help="Output .json file")

    args = parser.parse_args()

    print(f"Converting: {args.input} → {args.output}")

    result = parse_scenario_md(args.input)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"  Title: {result['title']}")
    print(f"  Scenes parsed: {result['total_scenes']}")
    print(f"  Saved: {args.output}")


if __name__ == "__main__":
    main()
