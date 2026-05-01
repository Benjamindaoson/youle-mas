"""TDD: Image Agent 4-level fallback tests.
Tests written FIRST per v5 §6.2 requirement."""
import pytest
import os
import asyncio
from unittest.mock import patch, AsyncMock

from app.adapters.tools.image_downloader import download_image
from app.adapters.tools.og_image_extractor import extract_og_image
from app.adapters.tools.placeholder_image import create_placeholder
from app.adapters.tools.image_processor import resize_image


async def test_download_image_ssrf_blocked(tmp_path):
    """SSRF: localhost/internal IPs must be blocked."""
    result = await download_image("http://127.0.0.1/evil.jpg", str(tmp_path))
    assert result is None

    result = await download_image("http://localhost/evil.jpg", str(tmp_path))
    assert result is None

    result = await download_image("http://10.0.0.1/evil.jpg", str(tmp_path))
    assert result is None

    result = await download_image("http://192.168.1.1/evil.jpg", str(tmp_path))
    assert result is None


async def test_download_image_invalid_url(tmp_path):
    """Invalid URLs return None, not crash."""
    assert await download_image("", str(tmp_path)) is None
    assert await download_image("not-a-url", str(tmp_path)) is None
    assert await download_image("ftp://bad.com/x.jpg", str(tmp_path)) is None


async def test_download_image_timeout(tmp_path):
    """Timeout returns None, not hang."""
    result = await download_image("http://httpbin.org/delay/30", str(tmp_path), timeout=1)
    assert result is None


async def test_og_image_invalid_url():
    """Invalid URLs return None."""
    assert await extract_og_image("") is None
    assert await extract_og_image("not-a-url") is None


async def test_og_image_ssrf_blocked():
    """SSRF blocked for og:image extraction too."""
    assert await extract_og_image("http://127.0.0.1/page") is None
    assert await extract_og_image("http://localhost/page") is None


async def test_placeholder_always_succeeds(tmp_path):
    """Placeholder image NEVER fails - this is the ultimate fallback."""
    path = await create_placeholder("Test title", str(tmp_path))
    assert os.path.isfile(path)
    assert path.endswith(".jpg")
    assert os.path.getsize(path) > 0


async def test_placeholder_with_long_text(tmp_path):
    """Long text gets truncated, doesn't crash."""
    long_text = "A" * 500
    path = await create_placeholder(long_text, str(tmp_path))
    assert os.path.isfile(path)


async def test_placeholder_with_chinese(tmp_path):
    """Chinese text works."""
    path = await create_placeholder("男子轻信高回报投资被骗500万", str(tmp_path))
    assert os.path.isfile(path)


async def test_placeholder_with_empty_text(tmp_path):
    """Empty text doesn't crash."""
    path = await create_placeholder("", str(tmp_path))
    assert os.path.isfile(path)


async def test_resize_image(tmp_path):
    """Resize produces correct dimensions."""
    from PIL import Image
    img = Image.new("RGB", (2000, 1000), color="red")
    src = str(tmp_path / "big.jpg")
    img.save(src)

    result = await resize_image(src, "1024x1024")
    resized = Image.open(result)
    assert resized.size == (1024, 1024)


async def test_resize_preserves_file(tmp_path):
    """Resize doesn't delete the file."""
    from PIL import Image
    img = Image.new("RGB", (500, 500), color="blue")
    src = str(tmp_path / "small.jpg")
    img.save(src)

    result = await resize_image(src, "1024x1024")
    assert os.path.isfile(result)


async def test_full_fallback_chain(tmp_path):
    """4-level fallback: all fail -> placeholder succeeds."""
    save_dir = str(tmp_path)

    path = await download_image("http://nonexistent.invalid/img.jpg", save_dir)
    assert path is None

    og_url = await extract_og_image("http://nonexistent.invalid/page")
    assert og_url is None

    path = await create_placeholder("Fallback test", save_dir)
    assert os.path.isfile(path)
