"""MiniMax TTS 客户端，通过网关调用语音合成接口并保存音频文件。"""

from __future__ import annotations

import os
import uuid

import aiofiles

from app.logging_config import logger


async def tts_minimax(
    text: str, voice: str, speed: float, save_dir: str, gateway,
) -> str | None:
    """调用 MiniMax TTS 网关合成语音，保存为 MP3 文件并返回路径；失败返回 None。"""
    try:
        audio_bytes = await gateway.tts("voice.tts.zh", {
            "text": text, "voice": voice, "speed": speed,
        })
        if audio_bytes:
            os.makedirs(save_dir, exist_ok=True)
            path = os.path.join(save_dir, f"voice_{uuid.uuid4().hex}.mp3")
            async with aiofiles.open(path, "wb") as f:
                await f.write(audio_bytes)
            return path
        return None
    except Exception as e:
        logger.warning("tts_failed", error=str(e))
        return None
