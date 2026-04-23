"""
SnapChef AI — Image Utilities
Handles image validation, compression, and base64 encoding.
"""

import base64
import io
from PIL import Image
import logging

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE_MB = 10
MAX_DIMENSION = 1344  # Groq recommended max dimension


def validate_image_bytes(image_bytes: bytes, content_type: str) -> tuple[bool, str]:
    """Validates image content type and size. Returns (is_valid, error_message)."""
    if content_type not in ALLOWED_MIME_TYPES:
        return False, f"Unsupported image type '{content_type}'. Allowed: JPEG, PNG, WebP, GIF."

    size_mb = len(image_bytes) / (1024 * 1024)
    if size_mb > MAX_IMAGE_SIZE_MB:
        return False, f"Image is {size_mb:.1f}MB. Maximum allowed size is {MAX_IMAGE_SIZE_MB}MB."

    return True, ""


def compress_image(image_bytes: bytes, content_type: str) -> bytes:
    """
    Resizes image to fit within MAX_DIMENSION x MAX_DIMENSION while maintaining
    aspect ratio. Converts to JPEG for smaller payload. Returns compressed bytes.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))

        # Convert RGBA or P-mode images to RGB
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")

        # Resize if too large
        if max(img.size) > MAX_DIMENSION:
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)
            logger.info(f"Resized image to {img.size}")

        # Save as JPEG
        output = io.BytesIO()
        img.save(output, format="JPEG", quality=85, optimize=True)
        compressed = output.getvalue()

        logger.info(
            f"Compressed image: {len(image_bytes) / 1024:.1f}KB → {len(compressed) / 1024:.1f}KB"
        )
        return compressed

    except Exception as e:
        logger.warning(f"Image compression failed, using original: {e}")
        return image_bytes


def encode_image_base64(image_bytes: bytes) -> str:
    """Encodes image bytes to a base64 data URL string."""
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:image/jpeg;base64,{encoded}"
