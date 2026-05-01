import pytest
import os
from app.adapters.tools.subtitle_maker import script_to_srt
from app.adapters.tools.ffmpeg_composer import compose_news_video
from app.adapters.tools.video_probe import inspect_video
from app.adapters.tools.thumbnail_maker import create_thumbnail
from app.adapters.tools.placeholder_image import create_placeholder


@pytest.fixture
def script():
    return {
        "hook": "Warning hook",
        "body": ["Case 1 content", "Case 2 content", "Case 3 content"],
        "closing": "Stay safe",
        "estimated_duration_seconds": 60,
    }


async def test_subtitle_generation(script, tmp_path):
    path = await script_to_srt(script, 60.0, str(tmp_path))
    assert os.path.isfile(path)
    content = open(path, encoding="utf-8").read()
    assert "Warning hook" in content
    assert "-->" in content
    assert "Case 1 content" in content


async def test_ffmpeg_fallback(script, tmp_path):
    img = await create_placeholder("test", str(tmp_path))
    result = await compose_news_video(
        images=[img], voice="dummy.wav", bgm="dummy.wav",
        bgm_volume_db=-15.0, subtitles="dummy.srt",
        output=str(tmp_path / "out.mp4"), per_image_duration=5.0)
    import shutil
    if not shutil.which("ffmpeg"):
        assert result is None


async def test_video_probe_fallback():
    result = await inspect_video("nonexistent.mp4")
    assert "duration" in result


async def test_thumbnail_fallback(tmp_path):
    img = await create_placeholder("test", str(tmp_path))
    thumb = await create_thumbnail(None, str(tmp_path), fallback_image=img)
    assert os.path.isfile(thumb)
