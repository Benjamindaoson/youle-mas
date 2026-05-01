"""Skill 市场 — V1 可变层的 workflow 注册表。

skill 用 YAML 描述（见 backend/skills/*.yaml），
启动时 registry.py 扫描加载到内存。

主编排（Conductor）通过 skill_retriever.retrieve() 召回候选，
再调度给能力 agent (T/I/V/D) 按 skill.steps 顺序执行。

详见 docs/v1-architecture.md §5。
"""
from __future__ import annotations

from app.skills.registry import (
    SkillSpec,
    SkillStep,
    list_skills,
    get_skill,
    load_all,
    match,
    run_skill,
)

__all__ = [
    "SkillSpec",
    "SkillStep",
    "list_skills",
    "get_skill",
    "load_all",
    "match",
    "run_skill",
]
