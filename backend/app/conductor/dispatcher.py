"""Conductor 的主循环 — 把 intent + skill + 能力 agent 串起来。

V1 完整流程见 docs/v1-architecture.md §3.1：
    intent → clarify? → retrieve → plan → dispatch → review → deliver

当前为骨架占位，关键路径标 TODO。
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from app.conductor.clarify import (
    generate_questions,
    needs_clarification,
)
from app.conductor.intent import Intent, parse_intent
from app.conductor.skill_retriever import retrieve
from app.capabilities import dispatch_to_capability
from app.skills.registry import SkillSpec
from app.logging_config import logger


async def conduct(
    user_text: str,
    session_id: str,
    history: list[dict] | None = None,
) -> AsyncIterator[dict]:
    """主编排入口。流式 yield 事件给 SSE 上层。

    yield 事件契约（与 V0 SSE 兼容 + V1 新事件）：
        {type: "start", session_id}
        {type: "intent_parsed", intent: {...}}
        {type: "clarify_required", questions: [...]}    # 终止流，等用户答
        {type: "skill_selected", skill_id, name, reason}
        {type: "agent_start", capability: "T|I|V|D"}
        {type: "chunk", text}
        {type: "agent_done"}
        {type: "deliverable", artifacts: [...]}
        {type: "done"}
    """
    yield {"type": "start", "session_id": session_id}

    # 1. 解析意图
    intent = await parse_intent(user_text, history)
    yield {"type": "intent_parsed", "intent": intent.model_dump()}

    # 2. 澄清环节
    if needs_clarification(intent):
        questions = await generate_questions(intent)
        yield {
            "type": "clarify_required",
            "questions": [q.model_dump() for q in questions],
        }
        return  # 等用户答完再走第二轮 conduct()

    # 3. 召回 skill
    candidates = await retrieve(intent, top_k=3)
    if not candidates:
        yield {
            "type": "error",
            "message": "skill 库里暂时没有匹配的 workflow，请试试其他场景。",
        }
        return

    # TODO: V1.0 这里用 LLM 在 candidates 里二选一并给 reason
    chosen: SkillSpec = candidates[0]
    yield {
        "type": "skill_selected",
        "skill_id": chosen.id,
        "name": chosen.name,
        "reason": "MVP: 取检索 top-1",
    }

    # 4. 按 skill.steps 派给能力 agent（V1 当前为顺序执行；V1.5 支持 DAG 并发）
    artifacts: list[dict[str, Any]] = []
    step_outputs: list[Any] = []
    for idx, step in enumerate(chosen.steps):
        yield {
            "type": "agent_start",
            "capability": step.agent,
            "task": step.task,
            "step_idx": idx,
        }
        try:
            async for ev in dispatch_to_capability(
                capability=step.agent,
                task=step,
                intent=intent,
                upstream=step_outputs,
                session_id=session_id,
            ):
                # 转发能力 agent 的 chunk / artifact 事件
                yield ev
                if ev.get("type") == "artifact":
                    artifacts.append(ev)
        except Exception as e:  # noqa: BLE001
            logger.error("conductor_step_failed",
                         step_idx=idx, capability=step.agent, error=str(e))
            yield {"type": "error", "message": f"step {idx} 失败：{e}"}
            return
        step_outputs.append({"step": idx, "ok": True})
        yield {"type": "agent_done", "capability": step.agent}

    # 5. TODO: V1 验收 — 用 LLM 校验产出是否满足 intent
    yield {
        "type": "deliverable",
        "skill_id": chosen.id,
        "artifacts": artifacts,
    }
    yield {"type": "done"}
