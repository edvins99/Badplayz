#!/usr/bin/env python3
"""
YouTube Documentary Video Generation Pipeline
=============================================

Generates a complete faceless documentary-style YouTube video from a JSON scenario.

Usage:
    python generate_video.py --scenario scenario.json
    python generate_video.py --scenario scenario.json --step images
    python generate_video.py --scenario scenario.json --step audio
    python generate_video.py --scenario scenario.json --step render
    python generate_video.py --scenario scenario.json --step concat
"""

import argparse
import json
import sys
from pathlib import Path

from config import Config
from image_generator import generate_all_images
from audio_generator import generate_all_audio
from scene_renderer import render_all_scenes
from concatenator import concatenate_scenes


def load_scenario(scenario_path: str) -> dict:
    """Load scenario from JSON file."""
    path = Path(scenario_path)
    if not path.exists():
        raise FileNotFoundError(f"Scenario not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Validate structure
    if "scenes" not in data:
        raise ValueError("Scenario must contain 'scenes' list")

    title = data.get("title", "Untitled")
    scenes = data["scenes"]

    print(f"\nLoaded scenario: {title}")
    print(f"  Scenes: {len(scenes)}")

    return data


def run_pipeline(scenario: dict, step: str = "all", output_dir: Path = None):
    """
    Run the video generation pipeline.

    Args:
        scenario: Loaded scenario dictionary
        step: Which step to run (all, images, audio, render, concat)
        output_dir: Override output directory
    """
    # Setup directories
    base_dir = output_dir or Config.OUTPUT_DIR
    dirs = Config.setup_directories(base_dir)

    scenes = scenario["scenes"]
    title = scenario.get("title", "Untitled")

    print(f"\n{'='*60}")
    print(f"VIDEO GENERATION PIPELINE")
    print(f"{'='*60}")
    print(f"  Title: {title}")
    print(f"  Scenes: {len(scenes)}")
    print(f"  Output: {base_dir}")
    print(f"  Step: {step}")
    print(f"{'='*60}\n")

    # Step 1: Generate Images
    if step in ("all", "images"):
        print("\n[STEP 1/4] Generating Images...")
        print("-" * 40)
        generate_all_images(scenes, dirs["images"])
        print(f"\n  Images complete: {dirs['images']}")

    # Step 2: Generate Audio
    if step in ("all", "audio"):
        print("\n[STEP 2/4] Generating Audio...")
        print("-" * 40)
        generate_all_audio(scenes, dirs["audio"])
        print(f"\n  Audio complete: {dirs['audio']}")

    # Step 3: Render Scenes
    if step in ("all", "render"):
        print("\n[STEP 3/4] Rendering Scenes...")
        print("-" * 40)
        scene_paths = render_all_scenes(scenes, dirs)
        print(f"\n  Scenes rendered: {len(scene_paths)}")

    # Step 4: Concatenate
    if step in ("all", "concat"):
        print("\n[STEP 4/4] Concatenating Final Video...")
        print("-" * 40)

        # Get scene paths
        scene_paths = sorted(dirs["scenes"].glob("scene_*.mp4"))
        if not scene_paths:
            raise FileNotFoundError("No rendered scenes found")

        # Final output
        safe_title = "".join(c if c.isalnum() or c in " -_" else "" for c in title)
        safe_title = safe_title.replace(" ", "_")[:50]
        final_path = dirs["final"] / f"{safe_title}_final.mp4"

        concatenate_scenes(scene_paths, final_path)

    print("\n\nDONE!")


def main():
    parser = argparse.ArgumentParser(
        description="Generate YouTube documentary video from scenario"
    )
    parser.add_argument(
        "--scenario", "-s",
        required=True,
        help="Path to scenario JSON file"
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Output directory (default: from config)"
    )
    parser.add_argument(
        "--step",
        choices=["all", "images", "audio", "render", "concat"],
        default="all",
        help="Which pipeline step to run"
    )

    args = parser.parse_args()

    # Validate config
    try:
        Config.validate()
    except ValueError as e:
        print(f"\nConfiguration Error:\n{e}")
        print(f"\nCreate a .env file based on .env.example")
        sys.exit(1)

    # Load scenario
    scenario = load_scenario(args.scenario)

    # Set output directory
    output_dir = Path(args.output) if args.output else None

    # Run
    run_pipeline(scenario, step=args.step, output_dir=output_dir)


if __name__ == "__main__":
    main()
