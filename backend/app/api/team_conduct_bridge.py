"""将 Conductor 事件映射为前端群聊 SSE 语义（Capability → RoleId）。

不处理落盘逻辑；落盘见 routes.py `_ingest_capability_artifact`。"""
from __future__ import annotations

from typing import Any

# T/I/V/D → 群组里可用的不同 RoleId，避免多条气泡撞同一 sender
CAP_TO_AGENT: dict[str, tuple[str, str]] = {
    "T": ("writer", "创"),
    "I": ("frontend", "端"),
    "V": ("distributor", "播"),
    "D": ("planner", "策"),
}


def capability_to_agent(cap: str | None) -> tuple[str, str]:
    if not cap:
        return CAP_TO_AGENT["T"]
    return CAP_TO_AGENT.get(cap.upper(), CAP_TO_AGENT["T"])


def map_conductor_event(ev: dict[str, Any]) -> dict[str, Any]:
    """把 conductor / capability dict 转成与 group-chat 兼容的 SSE body。"""
    t = ev.get("type")

    if t == "chunk" and "capability" in ev:
        aid, name = capability_to_agent(ev["capability"])
        return {"type": "chunk", "text": ev.get("text", ""), "agent_id": aid}

    if t == "agent_start" and "capability" in ev:
        aid, name = capability_to_agent(ev["capability"])
        return {
            "type": "agent_start",
            "agent_id": aid,
            "agent_name": name,
            "phase": "execute",
            "capability": ev["capability"],
            "task_hint": ev.get("task"),
        }

    if t == "agent_done" and ev.get("capability"):
        aid, name = capability_to_agent(ev["capability"])
        return {"type": "agent_done", "agent_id": aid}

    if t == "skill_selected":
        return {
            "type": "skill_selected",
            "skill_id": ev.get("skill_id"),
            "name": ev.get("name"),
            "reason": ev.get("reason"),
            "confidence": ev.get("confidence"),
        }

    if t == "intent_parsed":
        i = ev.get("intent") or {}
        return {
            "type": "intent_parsed",
            "vertical": i.get("vertical"),
            "deliverable_type": i.get("deliverable_type"),
            "subject": i.get("subject"),
            "confidence": i.get("confidence"),
        }

    if t == "clarify_required":
        return {
            "type": "clarify_required",
            "questions": ev.get("questions", []),
        }

    # 直通（含 error / deliverable / done）、或未知事件原样返回
    return ev
