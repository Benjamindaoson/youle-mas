"""TDD: TTS + Audio fallback tests.
Tests written FIRST per v5 §6.2 requirement."""
import pytest
import os
import wave

from app.adapters.tools.silent_audio import create_silent
from app.adapters.tools.local_bgm import select_bgm
from app.adapters.tools.audio_normalizer import normalize_audio
from app.adapters.tools.tts_client import tts_minimax


async def test_silent_audio_creates_valid_wav(tmp_path):
    """Silent audio must produce a valid WAV file."""
    path = await create_silent(5.0, str(tmp_path))
    assert os.path.isfile(path)
    assert path.endswith(".wav")

    with wave.open(path, "r") as wf:
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2
        assert wf.getframerate() == 44100
        duration = wf.getnframes() / wf.getframerate()
        assert abs(duration - 5.0) < 0.1


async def test_silent_audio_various_durations(tmp_path):
    """Different durations all produce valid files."""
    for dur in [1.0, 10.0, 30.0, 60.0]:
        path = await create_silent(dur, str(tmp_path))
        with wave.open(path, "r") as wf:
            actual = wf.getnframes() / wf.getframerate()
            assert abs(actual - dur) < 0.1, f"Expected {dur}s, got {actual}s"


async def test_silent_audio_zero_duration(tmp_path):
    """Zero duration doesn't crash."""
    path = await create_silent(0.0, str(tmp_path))
    assert os.path.isfile(path)


async def test_tts_returns_none_without_key(tmp_path):
    """TTS with no API key returns None immediately."""
    from app.config import settings
    from app.adapters.model_gateway import ModelGateway
    gw = ModelGateway(settings)
    result = await tts_minimax("test text", "voice", 1.0, str(tmp_path), gw)
    assert result is None
    await gw.close()


def test_bgm_returns_none_when_missing():
    """BGM returns None when file doesn't exist."""
    result = select_bgm("serious_warning", "/nonexistent/path.mp3")
    assert result is None


def test_bgm_returns_path_when_exists(tmp_path):
    """BGM returns path when file exists."""
    bgm = tmp_path / "test.mp3"
    bgm.write_bytes(b"fake mp3 data")
    result = select_bgm("serious_warning", str(bgm))
    assert result == str(bgm)


async def test_audio_normalizer_passthrough_no_ffmpeg(tmp_path):
    """Without FFmpeg, normalizer returns input path unchanged."""
    import shutil
    fake = tmp_path / "test.wav"
    fake.write_bytes(b"fake wav")
    result = await normalize_audio(str(fake))
    if not shutil.which("ffmpeg"):
        assert result == str(fake)


async def test_full_audio_fallback_chain(tmp_path):
    """Complete audio fallback: TTS fails -> silent, BGM missing -> silent."""
    from app.config import settings
    from app.adapters.model_gateway import ModelGateway

    gw = ModelGateway(settings)
    save_dir = str(tmp_path)

    # TTS fails (no key) -> use silent
    voice = await tts_minimax("test", "voice", 1.0, save_dir, gw)
    if voice is None:
        voice = await create_silent(60.0, save_dir)
    assert os.path.isfile(voice)

    # BGM missing -> use silent
    bgm = select_bgm("warning", "/nonexistent.mp3")
    if bgm is None:
        bgm = await create_silent(60.0, save_dir)
    assert os.path.isfile(bgm)

    # Both are valid WAV files
    with wave.open(voice, "r") as wf:
        assert wf.getnframes() > 0
    with wave.open(bgm, "r") as wf:
        assert wf.getnframes() > 0

    await gw.close()
