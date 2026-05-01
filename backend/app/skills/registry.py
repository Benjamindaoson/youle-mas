"""Skill 注册表 — 启动时扫描 YAML 加载到内存。

数据契约严格按 docs/v1-architecture.md §5.1 的 SkillSpec schema。
"""
from __future__ import annotations

from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field

from app.logging_config import logger


CapabilityKey = Literal["T", "I", "V", "D"]


class SkillStep(BaseModel):
    """skill 中的一步。Conductor 按顺序派给指定 capability agent。"""
    agent: CapabilityKey
    task: str = Field(default="", description="人话描述这步要做什么")
    prompt_template: str = Field(default="", description="支持 {subject} 等占位符")
    inputs: dict = Field(default_factory=dict)
    outputs: list[str] = Field(default_factory=list, description="期待的产出 artifact 类型")


class SkillSpec(BaseModel):
    """单个 skill 的完整描述。"""
    id: str
    name: str
    version: str = "1.0"
    description: str = ""
    deliverable_type: str = "bundle"

    intent_keywords: list[str] = Field(default_factory=list,
                                        description="关键词召回用")
    required_slots: list[str] = Field(default_factory=list)
    optional_slots: list[str] = Field(default_factory=list)

    steps: list[SkillStep]

    expected_cost_usd: float = 0.0


_REGISTRY: dict[str, SkillSpec] = {}


# backend/skills/*.yaml 是 SkillSpec 的实际定义存放位置
DEFAULT_SKILLS_DIR = Path(__file__).resolve().parents[2] / "skills"


def load_all(skills_dir: Path | str | None = None) -> int:
    """扫描目录加载所有 YAML，返回加载到的 skill 数量。"""
    base = Path(skills_dir) if skills_dir else DEFAULT_SKILLS_DIR
    _REGISTRY.clear()
    if not base.is_dir():
        logger.warning("skills_dir_missing", path=str(base))
        return 0
    count = 0
    for f in sorted(base.glob("*.yaml")):
        try:
            data = yaml.safe_load(f.read_text(encoding="utf-8"))
            spec = SkillSpec(**data)
            if spec.id in _REGISTRY:
                logger.warning("skill_id_duplicate", id=spec.id)
                continue
            _REGISTRY[spec.id] = spec
            count += 1
        except Exception as e:  # noqa: BLE001
            logger.warning("skill_load_failed", file=str(f), error=str(e))
    logger.info("skills_loaded", count=count, dir=str(base))
    return count


def list_skills() -> list[SkillSpec]:
    return list(_REGISTRY.values())


def get_skill(skill_id: str) -> SkillSpec | None:
    return _REGISTRY.get(skill_id)
