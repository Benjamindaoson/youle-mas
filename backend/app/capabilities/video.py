"""V agent — 视频能力（含音频，作为内部步骤）。

V0 的 audio_agent + video_agent 在 V1 合并到这里。
反诈视频流水线在 V1 是一个 skill，由 V agent 执行其中的视频合成步骤。

详见 docs/v1-architecture.md §4.4 + 附录 B。
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from app.conductor.intent import Intent
from app.skills.registry import SkillStep


async def run(
    task: SkillStep,
    intent: Intent,
    upstream: list[Any],
    session_id: str,
) -> AsyncIterator[dict]:
    """[STUB] V1 实现策略：

    1. TTS：复用 backend/app/adapters/tools/tts_client.py
    2. 静音兜底：复用 backend/app/adapters/tools/silent_audio.py
    3. BGM：（V1.5）从素材库拉
    4. 字幕：复用 backend/app/adapters/tools/subtitle_maker.py
    5. 合成：复用 backend/app/adapters/tools/ffmpeg_composer.py
    6. 缩略图：复用 backend/app/adapters/tools/thumbnail_maker.py

    audio_normalizer / video_probe 都直接搬过来作为内部工具。
    """
    yield {
        "type": "chunk",
        "text": f"[V agent stub] task={task.task!r}",
        "capability": "V",
    }
    yield {
        "type": "artifact",
        "capability": "V",
        "artifact_type": "video",
        "title": task.task or "V 产出",
        "content_inline": "<video placeholder>",
    }
