"""Image generation module using OpenAI API."""

import base64
import time
from pathlib import Path

from openai import OpenAI
from PIL import Image
import io

from config import Config


class ImageGenerator:
    """Generates images using OpenAI's image generation API."""

    def __init__(self):
        self.client = OpenAI(api_key=Config.OPENAI_API_KEY)

    def generate_image(self, prompt: str, output_path: Path, retries: int = 3) -> Path:
        """
        Generate an image from a prompt and save it as 1920x1080.

        Args:
            prompt: The image generation prompt
            output_path: Where to save the final image
            retries: Number of retry attempts on failure

        Returns:
            Path to the saved image
        """
        for attempt in range(retries):
            try:
                print(f"  Generating image (attempt {attempt + 1}/{retries})...")

                response = self.client.images.generate(
                    model=Config.IMAGE_MODEL,
                    prompt=prompt,
                    n=1,
                    size=Config.IMAGE_SIZE,
                    response_format="b64_json",
                )

                # Decode base64 image
                image_data = base64.b64decode(response.data[0].b64_json)
                image = Image.open(io.BytesIO(image_data))

                # Resize/crop to 1920x1080
                image = self._resize_and_crop(image, Config.VIDEO_WIDTH, Config.VIDEO_HEIGHT)

                # Save
                image.save(output_path, "PNG", quality=95)
                print(f"  Saved: {output_path}")
                return output_path

            except Exception as e:
                print(f"  Error: {e}")
                if attempt < retries - 1:
                    wait_time = (attempt + 1) * 5
                    print(f"  Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    raise RuntimeError(f"Failed to generate image after {retries} attempts: {e}")

    def _resize_and_crop(self, image: Image.Image, target_w: int, target_h: int) -> Image.Image:
        """
        Resize and center-crop image to target dimensions.
        Maintains aspect ratio, crops excess.
        """
        img_w, img_h = image.size
        target_ratio = target_w / target_h
        img_ratio = img_w / img_h

        if img_ratio > target_ratio:
            # Image is wider — scale by height, crop width
            new_h = target_h
            new_w = int(img_w * (target_h / img_h))
        else:
            # Image is taller — scale by width, crop height
            new_w = target_w
            new_h = int(img_h * (target_w / img_w))

        image = image.resize((new_w, new_h), Image.LANCZOS)

        # Center crop
        left = (new_w - target_w) // 2
        top = (new_h - target_h) // 2
        image = image.crop((left, top, left + target_w, top + target_h))

        return image


def generate_all_images(scenes: list, output_dir: Path) -> list:
    """
    Generate images for all scenes.

    Args:
        scenes: List of scene dictionaries with 'image_prompt' key
        output_dir: Directory to save images

    Returns:
        List of image file paths
    """
    generator = ImageGenerator()
    image_paths = []

    for scene in scenes:
        scene_num = scene["scene_number"]
        output_path = output_dir / f"scene_{scene_num:02d}.png"

        # Skip if already exists
        if output_path.exists():
            print(f"  Scene {scene_num}: Image already exists, skipping.")
            image_paths.append(output_path)
            continue

        print(f"  Scene {scene_num}: Generating image...")
        path = generator.generate_image(scene["image_prompt"], output_path)
        image_paths.append(path)

        # Rate limiting — avoid hitting API limits
        time.sleep(2)

    return image_paths
