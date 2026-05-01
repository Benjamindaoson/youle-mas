"""音频 Agent（声音导演）— TTS 配音 + BGM 选择 + 静音兜底。

Fallback 链路：
  TTS: MiniMax API → 静音音轨
  BGM: 本地文件 → 静音音轨
"""
from __future__ import annotations

import os

from langgraph.types import Command

from app.schemas.state import GroupState
from app.config import settings
from app.adapters.model_gateway import ModelGateway
from app.adapters.tools.tts_client import tts_minimax
from app.adapters.tools.local_bgm import select_bgm
from app.adapters.tools.silent_audio import create_silent
from app.adapters.tools.audio_normalizer import normalize_audio
from app.adapters.storage.artifact_store import ArtifactStore
from app.utils import make_artifact
from app.logging_config import logger


async def audio_node(state: GroupState) -> Command:
    """Audio Agent 节点：生成配音和背景音乐，失败时用静音音轨兜底。"""
    group_id = state.get("group_id", "unknown")
    audio_dir = os.path.join(settings.ARTIFACT_DIR, group_id, "audio")
    os.makedirs(audio_dir, exist_ok=True)
    store = ArtifactStore(settings.ARTIFACT_DIR)

    script = state.get("script", {})
    duration = script.get("estimated_duration_seconds", 60)
    # 拼接完整口播文本：hook + body + closing
    full_text = " ".join(filter(None, [
        script.get("hook", ""),
        " ".join(script.get("body", [])),
        script.get("closing", ""),
    ]))

    async with ModelGateway(settings) as gateway:
        try:
            # TTS 配音（失败则用静音音轨）
            voice_path = await tts_minimax(
                text=full_text.strip(), voice=settings.MINIMAX_VOICE_ID,
                speed=1.05, save_dir=audio_dir, gateway=gateway)
            if not voice_path:
                logger.info("audio_agent", action="tts_fallback_silent")
                voice_path = await create_silent(duration, audio_dir)

            # BGM 选择（文件不存在则用静音）
            bgm_path = select_bgm("serious_warning", settings.DEFAULT_BGM_PATH)
            if not bgm_path:
                logger.info("audio_agent", action="bgm_fallback_silent")
                bgm_path = await create_silent(duration, audio_dir)

            # 统一音频格式（无 FFmpeg 时跳过）
            voice_path = await normalize_audio(voice_path)
            bgm_path = await normalize_audio(bgm_path)

            voice_art = make_artifact(
                "voice-asset", "TTS 配音", "audio_agent", group_id,
                file_path=voice_path, mime_type="audio/wav")
            bgm_art = make_artifact(
                "bgm-asset", "背景音乐", "audio_agent", group_id,
                file_path=bgm_path, mime_type="audio/wav")
            await store.save_file(voice_art, voice_path)
            await store.save_file(bgm_art, bgm_path)

            logger.info("audio_agent", action="done")
            return Command(
                update={
                    "voice_path": voice_path, "bgm_path": bgm_path,
                    "artifacts": [voice_art, bgm_art],
                    "agent_status": {"audio_agent": "done"},
                },
                goto="orchestrator",
            )
        except Exception as e:
            logger.error("audio_agent_failed", error=str(e))
            # 兜底：两条静音音轨，保证链路不崩
            fallback_voice = await create_silent(duration, audio_dir)
            fallback_bgm = await create_silent(duration, audio_dir)
            return Command(
                update={
                    "voice_path": fallback_voice, "bgm_path": fallback_bgm,
                    "errors": [{"agent": "audio_agent", "error": str(e)}],
                    "agent_status": {"audio_agent": "error"},
                },
                goto="orchestrator",
            )
