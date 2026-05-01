"""I agent — 图能力。

理解 / 生成 / 改图。V1 直接搬 V0 的 image_agent 4 级 fallback：
    Excel image_url → og:image → AI 生成 → 占位图

详见 docs/v1-architecture.md §4.3。
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
    """[STUB] V1 接入策略：

    1. 复用 backend/app/adapters/tools/image_downloader.py（已含 SSRF + 流式校验）
    2. 复用 backend/app/adapters/tools/og_image_extractor.py
    3. 复用 backend/app/adapters/model_gateway.py 的 image() 入口
    4. 复用 backend/app/adapters/tools/placeholder_image.py 兜底

    skill 把"用什么 prompt 生成"写在 task.prompt_template，I agent 只负责执行。
    """
    yield {
        "type": "chunk",
        "text": f"[I agent stub] task={task.task!r}",
        "capability": "I",
    }
    yield {
        "type": "artifact",
        "capability": "I",
        "artifact_type": "image",
        "title": task.task or "I 产出",
        "content_inline": "<image placeholder>",
    }
