"""Skill 注册表 — 启动时扫描 YAML 加载到内存。

数据契约严格按 docs/v1-architecture.md §5.1 的 SkillSpec schema。

Phase 0 扩展（2026-05-01）：
- SkillSpec 加 `runner` 字段：可选的 Python 入口（"module.path:func"）
- `match(message)`: 关键词召回（V1 阶段会换成 LLM intent router）
- `run_skill(skill, ctx)`: 统一执行器，有 runner 时走 Python 函数，
  否则降级为 declarative steps（V0 暂未实现）
"""
from __future__ import annotations

import importlib
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any, Literal

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

    steps: list[SkillStep] = Field(default_factory=list)

    # Phase 0 引入：当 skill 是已有 Python 流水线（如反诈视频 LangGraph）
    # 而非纯声明式 DAG 时，runner 指向真正执行的入口。
    # 格式 "app.skills.builtin.anti_scam_video.runner:run"
    runner: str | None = None

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


# ===================== Phase 0：召回 + 执行 =====================


def match(message: str) -> SkillSpec | None:
    """关键词召回 — V1 阶段会被 LLM-based intent router 替换。

    返回得分最高的 skill；同分时取注册顺序靠前的；
    无关键词命中返回 None。
    """
    text = (message or "").lower()
    best: tuple[int, SkillSpec] | None = None
    for spec in _REGISTRY.values():
        score = sum(1 for kw in spec.intent_keywords if kw and kw.lower() in text)
        if score == 0:
            continue
        if best is None or score > best[0]:
            best = (score, spec)
    return best[1] if best else None


def _resolve_runner(path: str) -> Callable[..., Awaitable[Any]]:
    """把 'module.path:func' 字符串解析成可调用对象。"""
    if ":" not in path:
        raise ValueError(f"invalid runner path: {path!r} (expect 'module.path:func')")
    mod_path, func_name = path.split(":", 1)
    mod = importlib.import_module(mod_path)
    func = getattr(mod, func_name, None)
    if func is None or not callable(func):
        raise ValueError(f"runner not callable: {path!r}")
    return func


async def run_skill(spec: SkillSpec, ctx: dict[str, Any]):
    """执行 skill。

    - 有 runner 时：调用 Python 入口函数（async generator yielding SSE 事件）
    - 无 runner 时：声明式 DAG，按 spec.steps 顺序派给能力 agent

    runner 入口约定：`async def run(ctx) -> AsyncIterator[dict]`
    yield 出来的 dict 会被 routes.py 包装成 SSE。

    ctx 协议（声明式路径需要）：
        message:     str   用户原话
        session_id:  str
        intent:      Intent | None  可选；无则用启发式实时构造
    """
    if spec.runner:
        runner = _resolve_runner(spec.runner)
        async for event in runner(ctx):
            yield event
        return

    async for event in _run_declarative(spec, ctx):
        yield event


async def _run_declarative(spec: SkillSpec, ctx: dict[str, Any]):
    """无 runner 的纯声明式 skill 执行器：按 spec.steps 顺序派给能力 agent。

    依赖 app.capabilities.dispatch_to_capability。
    每步的产出转成 upstream 喂给下一步。
    """
    # 延迟导入：registry 避免在导入期挂上 conductor 依赖
    from app.capabilities import dispatch_to_capability
    from app.conductor.intent import Intent, parse_intent

    if not spec.steps:
        yield {"type": "error",
               "message": f"skill '{spec.id}' 无 runner 也无 steps，无法执行"}
        return

    intent: Intent | None = ctx.get("intent")
    if intent is None:
        intent = await parse_intent(ctx.get("message", ""))

    session_id = ctx.get("session_id", "default")
    upstream: list[Any] = []

    yield {"type": "skill_started", "skill_id": spec.id, "name": spec.name}

    for idx, step in enumerate(spec.steps):
        yield {
            "type": "agent_start",
            "capability": step.agent,
            "task": step.task,
            "step_idx": idx,
        }
        step_artifacts: list[dict] = []
        try:
            async for ev in dispatch_to_capability(
                capability=step.agent, task=step,
                intent=intent, upstream=upstream,
                session_id=session_id,
            ):
                yield ev
                if ev.get("type") == "artifact":
                    step_artifacts.append(ev)
        except Exception as e:  # noqa: BLE001
            logger.warning("declarative_step_failed",
                           skill_id=spec.id, step_idx=idx, error=str(e))
            yield {"type": "error",
                   "message": f"step {idx} ({step.agent}) 失败：{e}"}
            return
        yield {"type": "agent_done", "capability": step.agent, "step_idx": idx}
        upstream.append({"step": idx, "artifacts": step_artifacts})

    yield {"type": "skill_done", "skill_id": spec.id}
