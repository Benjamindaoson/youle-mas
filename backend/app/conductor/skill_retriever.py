"""Skill 检索 — Conductor 根据 Intent 从 skill 市场召回候选 workflow。

V1 MVP 策略：关键词召回 + LLM 选择。
V1.5：embedding 召回 + LLM 重排。

2026-05-01 加入：
- `confirm_match(spec, message)` — 给 routes.py 在快速 skill_match 命中后做 LLM 二次确认，
  防止"做小红书冷启动方案" 被误中"小红书爆款标题" skill 之类的问题
"""
from __future__ import annotations

import json
import re

from app.config import settings
from app.conductor.intent import Intent
from app.logging_config import logger
from app.skills.registry import SkillSpec, list_skills


async def retrieve(intent: Intent, top_k: int = 3) -> list[SkillSpec]:
    """[STUB] 简单的关键词打分召回，V1 接 LLM 选择。"""
    scored: list[tuple[float, SkillSpec]] = []
    for skill in list_skills():
        score = _score(intent, skill)
        if score > 0:
            scored.append((score, skill))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [s for _, s in scored[:top_k]]


def _score(intent: Intent, skill: SkillSpec) -> float:
    """deliverable_type 对齐 + intent 关键词打分；否决词任一命中分数归零。"""
    raw_full = (intent.raw_user_text + " " + intent.subject).lower()
    for neg in getattr(skill, "negative_keywords", None) or []:
        if neg and neg.lower() in raw_full:
            return 0.0
    score = 0.0
    if skill.deliverable_type == intent.deliverable_type:
        score += 2
    raw = raw_full
    for kw in skill.intent_keywords:
        if kw.lower() in raw:
            score += 1
    return score


# ============================ 二次确认（防误命中）============================

# routes.py 快速 skill_match 命中后调用本函数。
# 用 LLM 判断这条消息是否真的应该走这个 skill（避免关键词重叠误命中）。
# 无 ANTHROPIC_API_KEY 时退化为 (True, ...) 保留原行为。

_CONFIRM_SYSTEM = """你是 skill 守门员。给定用户消息和一个候选 skill，判断这条消息是否真的应该执行这个 skill。

很多时候用户消息会偶然包含 skill 关键词，但意图其实不是。比如：
- "做一份小红书冷启动方案" 含"小红书"，但意图是写"方案"，不是写"标题"
- "电商详情页文案" 含"详情页"但意图是写文字，不是出图

输出严格 JSON：
{
  "should_execute": true | false,
  "confidence": 0.0~1.0,
  "reason": "<≤30字 中文>"
}

判断标准：
- 用户的核心动作 / 名词 与 skill 的产出物（deliverable_type + name）一致 → should_execute=true
- 关键词只是巧合，意图明显不同 → should_execute=false
- 拿不准 → should_execute=true 但 confidence < 0.7

只输出 JSON。"""


async def confirm_match(
    spec: SkillSpec,
    message: str,
) -> tuple[bool, str, float]:
    """二次确认 spec 是否真的匹配 message。

    Returns:
        (should_execute, reason, confidence)
        - 无 LLM key：(True, "no llm guard", 0.6)
        - LLM 失败：(True, "llm error fallback", 0.55)
        - LLM say no：(False, reason, conf)
        - LLM say yes：(True, reason, conf)
    """
    if not settings.has_anthropic:
        return True, "no llm guard, executing keyword match", 0.6

    try:
        return await _confirm_with_llm(spec, message)
    except Exception as e:  # noqa: BLE001
        logger.warning("confirm_match_llm_failed", skill_id=spec.id, error=str(e))
        return True, f"llm error fallback executing: {e}", 0.55


async def _confirm_with_llm(
    spec: SkillSpec,
    message: str,
) -> tuple[bool, str, float]:
    import anthropic  # noqa: WPS433

    user_msg = (
        f"用户消息: {message!r}\n\n"
        f"候选 skill:\n"
        f"  id: {spec.id}\n"
        f"  name: {spec.name}\n"
        f"  deliverable: {spec.deliverable_type}\n"
        f"  描述: {(spec.description or '').strip()[:120]}\n\n"
        f"用户的真实意图是要执行这个 skill 吗？"
    )

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    resp = await client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=256,
        system=_CONFIRM_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    text = resp.content[0].text if resp.content else ""
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise ValueError(f"no JSON in confirm reply: {text[:200]!r}")
    data = json.loads(m.group(0))

    return (
        bool(data.get("should_execute", True)),
        str(data.get("reason", ""))[:60],
        float(data.get("confidence", 0.7)),
    )
