"""Photo upload validation and persistence.

Direct port of the TypeScript uploads util. External input is treated as
untrusted: declared MIME type is never trusted, only magic bytes decide what
we accept, and image dimensions are read from raw headers (no heavy image
library with its own parser attack surface)."""

import base64
import re
import uuid
from pathlib import Path

from ..config import settings

ALLOWED_MIME: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

MAX_DIMENSION = 5000

_DATA_URL_RE = re.compile(r"^data:(image/[a-z+]+);base64,(.+)$", re.S)


def assert_allowed_image_signature(buffer: bytes) -> None:
    """Reject any payload whose bytes do not start with a supported signature.

    Keeps malicious/crafted images away from parsers entirely.
    """
    if len(buffer) < 12:
        raise ValueError("Image is too small to be valid.")
    sig = buffer[:12]
    png = sig[:8] == b"\x89PNG\r\n\x1a\n"
    jpeg = sig[0] == 0xFF and sig[1] == 0xD8 and sig[2] == 0xFF
    gif = sig[:6] in (b"GIF87a", b"GIF89a")
    webp = sig[:4] == b"RIFF" and sig[8:12] == b"WEBP"
    if not (png or jpeg or gif or webp):
        raise ValueError(
            "Image contents do not match a supported format (JPEG, PNG, WebP or GIF)."
        )


def _png_dimensions(buf: bytes) -> tuple[int, int] | None:
    if len(buf) < 24 or buf[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return (
        int.from_bytes(buf[16:20], "big"),
        int.from_bytes(buf[20:24], "big"),
    )


def _gif_dimensions(buf: bytes) -> tuple[int, int] | None:
    if len(buf) < 10 or buf[:6] not in (b"GIF87a", b"GIF89a"):
        return None
    return (
        int.from_bytes(buf[6:8], "little"),
        int.from_bytes(buf[8:10], "little"),
    )


def _jpeg_dimensions(buf: bytes) -> tuple[int, int] | None:
    i = 2
    n = len(buf)
    while i + 3 < n:
        if buf[i] != 0xFF:
            i += 1
            continue
        marker = buf[i + 1]
        # Standalone markers with no length field.
        if marker in (0x01, 0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9):
            i += 2
            continue
        # SOF0..SOF3 / SOF5..SOF7 / SOF9..SOF11 / SOF13..SOF15 hold dimensions.
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            if i + 9 >= n:
                return None
            height = int.from_bytes(buf[i + 5 : i + 7], "big")
            width = int.from_bytes(buf[i + 7 : i + 9], "big")
            return (width, height)
        if i + 3 >= n:
            return None
        seg_len = int.from_bytes(buf[i + 2 : i + 4], "big")
        if seg_len < 2:
            return None
        i += 2 + seg_len
    return None


def _webp_dimensions(buf: bytes) -> tuple[int, int] | None:
    if len(buf) < 30 or buf[:4] != b"RIFF" or buf[8:12] != b"WEBP":
        return None
    chunk = buf[12:16]
    if chunk == b"VP8X":
        if len(buf) < 27:
            return None
        return (
            int.from_bytes(buf[21:24], "little") + 1,
            int.from_bytes(buf[24:27], "little") + 1,
        )
    if chunk == b"VP8L":
        if len(buf) < 25:
            return None
        bits = int.from_bytes(buf[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if chunk == b"VP8 ":
        if len(buf) < 30:
            return None
        return (
            int.from_bytes(buf[26:28], "little") & 0x3FFF,
            int.from_bytes(buf[28:30], "little") & 0x3FFF,
        )
    return None


def read_image_dimensions(buffer: bytes) -> tuple[int, int] | None:
    for parser in (_png_dimensions, _gif_dimensions, _jpeg_dimensions, _webp_dimensions):
        result = parser(buffer)
        if result is not None:
            return result
    return None


async def save_photo(data_url: str) -> str:
    """Validate a base64 data-URL image and persist it. Returns the public URL path."""
    match = _DATA_URL_RE.match(data_url)
    if not match:
        raise ValueError("Photo must be a base64 data URL.")
    mime = match.group(1).lower()
    ext = ALLOWED_MIME.get(mime)
    if not ext:
        raise ValueError("Unsupported image type. Use JPEG, PNG, WebP or GIF.")

    buffer = base64.b64decode(match.group(2))
    if len(buffer) == 0:
        raise ValueError("Empty image.")
    if len(buffer) > settings.max_upload_bytes:
        raise ValueError(f"Image is too large (max {settings.max_upload_bytes // (1024 * 1024)} MB).")

    assert_allowed_image_signature(buffer)

    dimensions = read_image_dimensions(buffer)
    if dimensions is None:
        raise ValueError("Could not read image contents - file appears corrupted.")
    width, height = dimensions
    if width > MAX_DIMENSION or height > MAX_DIMENSION:
        raise ValueError(f"Image dimensions too large (max {MAX_DIMENSION}px).")

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}{ext}"
    target = upload_dir / filename
    try:
        with target.open("xb") as fh:
            fh.write(buffer)
    except FileExistsError:
        filename = f"{uuid.uuid4()}{ext}"
        with (upload_dir / filename).open("xb") as fh:
            fh.write(buffer)

    return f"/uploads/{filename}"