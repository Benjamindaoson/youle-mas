"""音频格式标准化工具，使用 FFmpeg 将音频转换为指定采样率的单声道 WAV。"""

from __future__ import annotations

import asyncio
import os
import shutil
import uuid

from app.logging_config import logger


async def normalize_audio(path: str, sample_rate: int = 44100) -> str:
    """将音频文件转换为单声道 WAV 格式，若 FFmpeg 不可用则原样返回。"""
    if not shutil.which("ffmpeg"):
        logger.warning("ffmpeg_missing, skipping audio normalization")
        return path

    out = os.path.join(os.path.dirname(path), f"norm_{uuid.uuid4().hex}.wav")
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-i", path, "-ar", str(sample_rate), "-ac", "1", out,
        stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
    )
    await asyncio.wait_for(proc.wait(), timeout=30)
    # 转换失败时回退到原文件
    return out if os.path.isfile(out) else path
