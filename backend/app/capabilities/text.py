"""T agent — 文字/语言能力。

Phase 2 实现：
- prompt 渲染（{subject} {vertical} {raw} 占位 + vertical_prompts 叠加）
- 有 ANTHROPIC_API_KEY → Anthropic 流式
- 无 key → 模板 fallback（针对常见 skill 类别给"够看"的占位输出）

详见 docs/v1-architecture.md §4.2。
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import yaml

from typing import TYPE_CHECKING

from app.config import settings
from app.skills.registry import SkillStep
from app.logging_config import logger

if TYPE_CHECKING:
    from app.conductor.intent import Intent


# 行业垂直 prompt 增量缓存
_VERTICAL_DIR = Path(__file__).resolve().parents[2] / "vertical_prompts"
_VERTICAL_CACHE: dict[str, dict] = {}


def _load_vertical(vertical: str) -> dict:
    if vertical in _VERTICAL_CACHE:
        return _VERTICAL_CACHE[vertical]
    f = _VERTICAL_DIR / f"{vertical}.yaml"
    if not f.is_file():
        f = _VERTICAL_DIR / "default.yaml"
    if not f.is_file():
        return {}
    try:
        data = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
    except Exception as e:  # noqa: BLE001
        logger.warning("vertical_prompt_load_failed", vertical=vertical, error=str(e))
        data = {}
    _VERTICAL_CACHE[vertical] = data
    return data


def _render_prompt(task: SkillStep, intent: Intent, upstream: list[Any]) -> str:
    """skill.prompt_template + vertical 叠加 + slot 替换。"""
    vertical_cfg = _load_vertical(intent.vertical or "default")
    t_cfg = (vertical_cfg.get("T") or {})
    prefix = (t_cfg.get("prefix") or "").strip()
    suffix = (t_cfg.get("suffix") or "").strip()

    body = (task.prompt_template or task.task or "").strip()
    body = (body
            .replace("{subject}", intent.subject or "")
            .replace("{vertical}", intent.vertical or "other")
            .replace("{raw}", intent.raw_user_text or ""))

    parts = [p for p in (prefix, body, suffix) if p]
    return "\n\n".join(parts)


async def run(
    task: SkillStep,
    intent: Intent,
    upstream: list[Any],
    session_id: str,
) -> AsyncIterator[dict]:
    prompt = _render_prompt(task, intent, upstream)

    full_text = ""
    if settings.has_anthropic:
        try:
            async for chunk in _stream_anthropic(prompt):
                full_text += chunk
                yield {"type": "chunk", "text": chunk, "capability": "T"}
        except Exception as e:  # noqa: BLE001
            logger.warning("text_capability_anthropic_failed_fallback", error=str(e))
            full_text = _template_fallback(task, intent)
            yield {"type": "chunk", "text": full_text, "capability": "T"}
    else:
        full_text = _template_fallback(task, intent)
        yield {"type": "chunk", "text": full_text, "capability": "T"}

    yield {
        "type": "artifact",
        "capability": "T",
        "artifact_type": "markdown",
        "title": task.task or "T 产出",
        "content_inline": full_text,
        "session_id": session_id,
    }


async def _stream_anthropic(prompt: str) -> AsyncIterator[str]:
    import anthropic  # noqa: WPS433
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    async with client.messages.stream(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        async for text in stream.text_stream:
            yield text


def _template_fallback(task: SkillStep, intent: Intent) -> str:
    """无 LLM 时根据 task / intent 生成一份"够看"的模板产出。

    不假装是 AI 输出 — 明确标注为 [DEMO 模板]，让用户知道接 key 后会有真内容。"""
    subj = intent.subject or "目标对象"
    task_desc = (task.task or "").lower()

    if "标题" in task_desc:
        # 小红书 / 公众号标题
        titles = [
            f"{subj} 的 3 个秘密，第 2 个我没敢告诉闺蜜 ✨",
            f"7 天做完 {subj}，我妈说像换了个人 😯",
            f"我用 100 块搞定了 {subj}，附详细清单",
            f"为什么人人都在做 {subj}？亲测 30 天有变化 💡",
            f"关于 {subj}，可能 90% 的人都搞错了",
        ]
        return "[DEMO 模板·配 ANTHROPIC_API_KEY 后切换为真 LLM]\n\n" + \
               "\n".join(f"- {t}" for t in titles)

    if "prompt" in task_desc or "图" in task_desc:
        # 图片生成 prompt
        return ("[DEMO 模板·配 LLM key 后切换为真生成 prompt]\n\n"
                f'{{"prompts": [\n'
                f'  "{subj}, white background, studio lighting, '
                f'product photography, hyper-realistic, 8k",\n'
                f'  "{subj}, lifestyle scene, soft natural light, '
                f'minimalist composition, photography 4k"\n'
                f"]}}")

    if "alt" in task_desc or "caption" in task_desc:
        return ("[DEMO 模板·配 LLM key 后切换为真文案]\n\n"
                f"alt：精选 {subj} · 实拍图 · 高清细节\n"
                f"详情副标题：用心选材，每个细节都为你考虑。"
                f"今天为你带来 {subj}，看看是否合心意。")

    # 通用兜底
    return ("[DEMO 模板·配 ANTHROPIC_API_KEY 后切换为真 LLM]\n\n"
            f"针对你的需求「{intent.raw_user_text}」，"
            f"以下是初版思路：\n"
            f"1. 主题：{subj}\n"
            f"2. 行业：{intent.vertical}\n"
            f"3. 形式：{intent.deliverable_type}\n\n"
            f"配置 LLM key 后此处会替换为按 prompt 模板真实生成的内容。")
