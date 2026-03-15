"""
Download best.pt from Google Drive if not already present.
Call this module before loading the model in app.py.
"""

import os
import gdown


def download_model():
    """
    Download best.pt from Google Drive using gdown.
    Skip if file already exists.
    Replace DRIVE_FILE_ID with your actual Google Drive file ID.
    """
    MODEL_PATH = "best.pt"
    DRIVE_FILE_ID = "1ztghMIoauv63T2rChaBvmc0W9lvqVGFA"
    
    # Skip if model already exists
    if os.path.exists(MODEL_PATH):
        print(f"✓ Model already exists: {MODEL_PATH}")
        return
    
    print(f"⏳ Downloading best.pt from Google Drive...")
    try:
        # gdown URL format: https://drive.google.com/uc?id=<FILE_ID>
        url = f"https://drive.google.com/uc?id={DRIVE_FILE_ID}"
        gdown.download(url, MODEL_PATH, quiet=False)
        print(f"✓ Model downloaded successfully: {MODEL_PATH}")
    except Exception as e:
        print(f"✗ Failed to download model: {e}")
        raise


if __name__ == "__main__":
    download_model()
