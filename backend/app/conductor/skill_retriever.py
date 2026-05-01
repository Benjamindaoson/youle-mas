"""Skill 检索 — Conductor 根据 Intent 从 skill 市场召回候选 workflow。

V1 MVP 策略：关键词召回 + LLM 选择。
V1.5：embedding 召回 + LLM 重排。

详见 docs/v1-architecture.md §5.2。
"""
from __future__ import annotations

from app.conductor.intent import Intent
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
    """简单打分：deliverable_type 命中 +2，关键词每命中 +1。"""
    score = 0.0
    if skill.deliverable_type == intent.deliverable_type:
        score += 2
    raw = (intent.raw_user_text + " " + intent.subject).lower()
    for kw in skill.intent_keywords:
        if kw.lower() in raw:
            score += 1
    return score
