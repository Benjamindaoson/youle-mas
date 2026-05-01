"""4 个能力 agent — V1 按"能力"切分（vs V0 按"角色"）。

  T (text)  — 文字/语言：写作、推理、收集、分析
  I (image) — 图：理解 / 生成 / 改
  V (video) — 视频（含音频）：理解 / 生成 / 改
  D (doc)   — 办公文档：PDF / Excel / PPT

公开入口：
    async for ev in dispatch_to_capability(capability, task, intent, upstream, session_id):
        ...

每个能力 agent 暴露统一签名：
    async def run(task, intent, upstream, session_id) -> AsyncIterator[Event]
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, TYPE_CHECKING

from app.capabilities import doc, image, text, video
from app.skills.registry import SkillStep

if TYPE_CHECKING:
    # 避免与 conductor 循环导入：Intent 仅作类型提示
    from app.conductor.intent import Intent


_ROUTER = {
    "T": text.run,
    "I": image.run,
    "V": video.run,
    "D": doc.run,
}


async def dispatch_to_capability(
    capability: str,
    task: SkillStep,
    intent: "Intent",
    upstream: list[Any],
    session_id: str,
) -> AsyncIterator[dict]:
    """根据 skill step 指定的 capability key (T/I/V/D) 路由到具体能力 agent。"""
    runner = _ROUTER.get(capability)
    if runner is None:
        yield {"type": "error",
               "message": f"unknown capability: {capability!r}"}
        return
    async for ev in runner(task=task, intent=intent,
                           upstream=upstream, session_id=session_id):
        yield ev


__all__ = ["dispatch_to_capability"]
