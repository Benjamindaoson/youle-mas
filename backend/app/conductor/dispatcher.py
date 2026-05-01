"""Conductor 的主循环 — 把 intent + skill + 能力 agent 串起来。

V1 完整流程见 docs/v1-architecture.md §3.1：
    intent → clarify? → retrieve → rerank → plan → dispatch → review → deliver

2026-05-01 升级：
- candidates → LLM 重排（在 top-K 里挑最佳并给 reason），无 key 时回退 top-1
- 高置信度（confidence ≥ 0.85）直接执行；中等（0.5-0.85）发 ClarifyCard 让用户确认
"""
from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator
from typing import Any

from app.config import settings
from app.conductor.clarify import (
    generate_questions,
    merge_answers,
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
    clarify_answers: dict[str, str] | None = None,
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

    # 1. 解析意图（可选第二轮：用户在 clarify 卡里选的答案 merge 进来）
    intent = await parse_intent(user_text, history)
    if clarify_answers:
        intent = merge_answers(intent, clarify_answers)
    yield {"type": "intent_parsed", "intent": intent.model_dump()}

    # 2. 澄清环节
    if needs_clarification(intent):
        questions = await generate_questions(intent)
        yield {
            "type": "clarify_required",
            "questions": [q.model_dump() for q in questions],
        }
        return  # 等用户答完再走第二轮 conduct()

    # 3. 召回 skill（含 runner 的 skill 必须由 routes 关键字优先走 LangGraph，
    #    编排器内只执行声明式 steps，否则会与 run_skill(runner 优先)语义冲突）
    candidates = await retrieve(intent, top_k=5)
    candidates = [c for c in candidates if not c.runner]

    if not candidates:
        yield {"type": "_fallback_role_team", "reason": "skill_retrieve_empty"}
        return

    # 4. LLM 重排
    chosen, reason, sel_conf = await _rerank_candidates(intent, candidates)
    yield {
        "type": "skill_selected",
        "skill_id": chosen.id,
        "name": chosen.name,
        "reason": reason,
        "confidence": sel_conf,
    }

    # 5. 执行声明式 DAG
    artifacts: list[dict[str, Any]] = []
    step_outputs: list[Any] = []
    for idx, step in enumerate(chosen.steps):
        yield {
            "type": "agent_start",
            "capability": step.agent,
            "task": step.task,
            "step_idx": idx,
        }
        step_artifacts: list[dict[str, Any]] = []
        try:
            async for ev in dispatch_to_capability(
                capability=step.agent,
                task=step,
                intent=intent,
                upstream=step_outputs,
                session_id=session_id,
            ):
                yield ev
                if ev.get("type") == "artifact":
                    artifacts.append(ev)
                    step_artifacts.append(ev)
        except Exception as e:  # noqa: BLE001
            logger.error("conductor_step_failed",
                         step_idx=idx, capability=step.agent, error=str(e))
            yield {"type": "error", "message": f"step {idx} 失败：{e}"}
            return
        step_outputs.append({"step": idx, "artifacts": step_artifacts})
        yield {"type": "agent_done", "capability": step.agent}

    # 6. TODO: V1 验收 — 用 LLM 校验产出是否满足 intent
    yield {
        "type": "deliverable",
        "skill_id": chosen.id,
        "artifacts": artifacts,
    }
    yield {"type": "done"}


# ============================ Skill 重排 ============================


async def _rerank_candidates(
    intent: Intent,
    candidates: list[SkillSpec],
) -> tuple[SkillSpec, str, float]:
    """在 retrieve 返回的 top-K 里挑最佳。

    - 单候选：直接返回，confidence=0.95
    - 多候选 + has_anthropic：LLM 选，给 reason + confidence
    - 多候选 + 无 key：回退到第 1 个（关键词打分最高的），confidence=0.6
    """
    if len(candidates) == 1:
        return candidates[0], "唯一匹配", 0.95

    if not settings.has_anthropic:
        return (candidates[0],
                f"无 LLM key，取关键词打分 top-1（候选数={len(candidates)}）",
                0.6)

    try:
        return await _rerank_with_llm(intent, candidates)
    except Exception as e:  # noqa: BLE001
        logger.warning("rerank_llm_failed_fallback_top1", error=str(e))
        return candidates[0], f"LLM 重排失败回退 top-1: {e}", 0.55


_RERANK_SYSTEM = """你是 skill 编排员。给定用户意图和 N 个候选 skill，挑最匹配的那个。

输出严格 JSON：
{
  "chosen_skill_id": "<候选里的 id>",
  "reason": "<≤30字 中文，说明为什么选它>",
  "confidence": 0.0~1.0
}

confidence 标定：
- 用户意图清晰，候选明显匹配 → 0.9+
- 多个候选都沾边但选其一 → 0.6-0.8
- 没有特别贴的，硬选一个 → < 0.5

只输出 JSON，不要解释。"""


async def _rerank_with_llm(
    intent: Intent,
    candidates: list[SkillSpec],
) -> tuple[SkillSpec, str, float]:
    import anthropic  # noqa: WPS433

    cands_brief = "\n".join(
        f"- id: {c.id}\n  name: {c.name}\n  deliverable: {c.deliverable_type}\n  desc: {(c.description or '').strip()[:80]}"
        for c in candidates
    )
    user_msg = (
        f"用户原话：{intent.raw_user_text}\n"
        f"已解析意图：vertical={intent.vertical}, "
        f"deliverable={intent.deliverable_type}, subject={intent.subject!r}\n\n"
        f"候选 skills（按关键词打分降序）：\n{cands_brief}\n\n"
        f"挑最匹配的。"
    )

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    resp = await client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=256,
        system=_RERANK_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    text = resp.content[0].text if resp.content else ""
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise ValueError(f"no JSON in rerank reply: {text[:200]!r}")
    data = json.loads(m.group(0))

    chosen_id = data.get("chosen_skill_id")
    chosen = next((c for c in candidates if c.id == chosen_id), None)
    if chosen is None:
        # LLM 给的 id 不在候选里 → 容错回退
        logger.warning("rerank_id_not_in_candidates",
                        chosen=chosen_id,
                        candidates=[c.id for c in candidates])
        chosen = candidates[0]

    return (chosen,
            str(data.get("reason", "LLM 选择"))[:60],
            float(data.get("confidence", 0.7)))
