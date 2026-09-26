"""
NeuroScreen — Vosk Model Download Script
==========================================
Downloads Vosk speech recognition models for English and Kannada.

Usage:
    python scripts/download_vosk_models.py

Models are downloaded to ml/models/ directory:
  - vosk-model-small-en-us (~40MB)  — English
  - vosk-model-small-kn   (~50MB)  — Kannada

These models are required by the speech processor service
for server-side speech-to-text. Without them, the speech
module will still work but will fall back to energy-based
speech rate estimation (no transcript).
"""

import os
import sys
import zipfile
import urllib.request
import shutil

# Model URLs from https://alphacephei.com/vosk/models
MODELS = {
    "vosk-model-small-en-us-0.15": {
        "url": "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip",
        "target_dir": "vosk-model-small-en-us",
        "description": "English (US) — small model (~40MB)",
    },
    "vosk-model-small-kn-0.1": {
        # Note: Kannada model may not be available from Vosk.
        # If unavailable, the speech module falls back to energy-based estimation.
        "url": "https://alphacephei.com/vosk/models/vosk-model-small-kn-0.1.zip",
        "target_dir": "vosk-model-small-kn",
        "description": "Kannada — small model (~50MB)",
    },
}

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "ml", "models")


def download_model(name: str, info: dict) -> bool:
    """Download and extract a single Vosk model."""
    target = os.path.join(MODELS_DIR, info["target_dir"])

    if os.path.isdir(target):
        print(f"  ✓ {info['description']} already exists at {target}")
        return True

    zip_path = os.path.join(MODELS_DIR, f"{name}.zip")

    print(f"  ↓ Downloading {info['description']}...")
    print(f"    URL: {info['url']}")

    try:
        urllib.request.urlretrieve(info["url"], zip_path)
    except Exception as e:
        print(f"  ✗ Download failed: {e}")
        print(f"    The speech module will fall back to energy-based estimation.")
        return False

    print(f"  ↻ Extracting to {target}...")
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(MODELS_DIR)

        # Rename extracted directory to target name
        extracted_dir = os.path.join(MODELS_DIR, name)
        if os.path.isdir(extracted_dir) and extracted_dir != target:
            if os.path.exists(target):
                shutil.rmtree(target)
            os.rename(extracted_dir, target)

        print(f"  ✓ {info['description']} ready")
        return True

    except Exception as e:
        print(f"  ✗ Extraction failed: {e}")
        return False

    finally:
        # Clean up zip file
        if os.path.exists(zip_path):
            os.remove(zip_path)


def main():
    print("=" * 60)
    print("NeuroScreen — Vosk Model Downloader")
    print("=" * 60)
    print()

    os.makedirs(MODELS_DIR, exist_ok=True)

    success_count = 0
    for name, info in MODELS.items():
        if download_model(name, info):
            success_count += 1
        print()

    print(f"Downloaded {success_count}/{len(MODELS)} models.")

    if success_count < len(MODELS):
        print()
        print("Note: Missing models are optional. The speech module will")
        print("fall back to energy-based speech rate estimation without")
        print("transcript support for the missing language(s).")

    print()
    print("Models directory:", os.path.abspath(MODELS_DIR))


if __name__ == "__main__":
    main()
