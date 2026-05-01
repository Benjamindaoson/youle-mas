"""T agent — 文字/语言能力。

包含写作、推理、（V1.5）数据收集、分析。
当前实现：占位 + 复用 V0 的 Anthropic/template fallback 模式。
真正实现见 docs/v1-architecture.md §4.2。
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from app.config import settings
from app.conductor.intent import Intent
from app.skills.registry import SkillStep
from app.logging_config import logger


async def run(
    task: SkillStep,
    intent: Intent,
    upstream: list[Any],
    session_id: str,
) -> AsyncIterator[dict]:
    """[STUB] 渲染 prompt_template → 调 LLM（或模板）→ 流式返回。"""
    prompt = _render_prompt(task, intent, upstream)

    if settings.has_anthropic:
        async for chunk in _stream_anthropic(prompt):
            yield {"type": "chunk", "text": chunk, "capability": "T"}
    else:
        # DEMO 兜底：直接返回 prompt 渲染结果作为"产出"
        yield {"type": "chunk", "text": prompt[:200], "capability": "T"}

    yield {
        "type": "artifact",
        "capability": "T",
        "artifact_type": "markdown",
        "title": task.task or "T 产出",
        "content_inline": prompt[:500],
    }


def _render_prompt(task: SkillStep, intent: Intent, upstream: list[Any]) -> str:
    """skill.prompt_template + intent + upstream 简单拼装。
    V1 真实版用 jinja2 + slot 替换。"""
    tpl = task.prompt_template or task.task or ""
    return (tpl
            .replace("{subject}", intent.subject)
            .replace("{vertical}", intent.vertical)
            .replace("{raw}", intent.raw_user_text))


async def _stream_anthropic(prompt: str) -> AsyncIterator[str]:
    """复用 V0 role_chat 的 Anthropic 流式调用模式。"""
    try:
        import anthropic  # noqa: WPS433
    except ImportError:
        yield "[anthropic SDK 未安装]"
        return
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        async with client.messages.stream(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                yield text
    except Exception as e:  # noqa: BLE001
        logger.warning("text_capability_anthropic_failed", error=str(e))
        yield f"[T agent 调用失败：{e}]"
