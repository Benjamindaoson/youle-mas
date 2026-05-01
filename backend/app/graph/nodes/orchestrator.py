"""主编排节点（Orchestrator）— 只调度不干活。

职责：
  1. 首次进入：生成 DispatchPlan，**先落盘**（artifacts + dispatch_plan + phase）
       - require_approval=True 且未 approved → goto "approval_gate"（在那里 interrupt）
       - approved=True                     → goto "text_agent" 直跑
       - 其他（向后兼容旧测试 approved=False/no-approval）→ goto END
  2. 后续进入：按 text → image → audio → video 顺序派活
  3. 全部完成：写 summary + 结束

LangGraph 1.x 用法：节点返回 Command(update=..., goto=...)，不再依赖 builder
里的 conditional_edges（已删除冗余路由）。

为什么把 interrupt 放到独立的 approval_gate 节点而不是 orchestrator 里？
  interrupt() 是 raise GraphInterrupt，会丢弃当前节点的整个 update。如果在
  orchestrator 里直接 interrupt，dispatch_plan 不会被持久化。拆出 gate 节点后：
  orchestrator 先 commit plan → gate 再 interrupt 等审批，state 历史完整。
"""
from __future__ import annotations

import uuid

from langchain_core.messages import AIMessage
from langgraph.graph import END
from langgraph.types import Command, interrupt

from app.graph.streaming import emit
from app.schemas.dispatch import DispatchPlan, DispatchStep
from app.schemas.state import GroupState
from app.utils import make_artifact

APPROVAL_GATE = "approval_gate"


def _make_plan(goal: str, group_id: str) -> tuple[DispatchPlan, object]:
    plan_id = f"plan_{uuid.uuid4().hex}"
    plan = DispatchPlan(
        id=plan_id, goal=goal,
        steps=[
            DispatchStep(id="s1", agent="text_agent", task="读取 Excel 新闻 + 生成 60 秒脚本",
                         expected_artifact_type="video-script"),
            DispatchStep(id="s2", agent="image_agent", task="准备图片素材（4 级 fallback）",
                         expected_artifact_type="image-asset", depends_on=["s1"]),
            DispatchStep(id="s3", agent="audio_agent", task="TTS 配音 + BGM + 静音兜底",
                         expected_artifact_type="voice-asset", depends_on=["s1"]),
            DispatchStep(id="s4", agent="video_agent", task="字幕 + FFmpeg 合成 mp4",
                         expected_artifact_type="video-asset", depends_on=["s2", "s3"]),
        ],
        estimated_cost_usd=0.05, requires_approval=True,
    )
    artifact = make_artifact(
        "dispatch-plan", "反诈短视频派活计划", "orchestrator", group_id,
        data=plan.model_dump())
    return plan, artifact


def _handoff(to: str, task: str, step_idx: int, total: int = 4) -> None:
    """对应前端的 handoff SSE 事件（chief → specialist）。"""
    emit("handoff", **{
        "from": "chief", "to": to, "task": task,
        "step_idx": step_idx, "step_total": total,
    })


async def orchestrator_node(state: GroupState) -> Command:
    group_id = state.get("group_id", "unknown")
    goal = state.get("user_goal", "")

    # === 第一次进入：生成 dispatch_plan 并先落盘 ===
    if state.get("dispatch_plan") is None:
        plan, art = _make_plan(goal, group_id)
        plan_dict = plan.model_dump()

        # 推送 dispatch 事件（前端可立即渲染计划卡片）
        emit("dispatch",
             plan=plan_dict.get("goal", ""),
             steps=[{"to": s["agent"], "task": s["task"]} for s in plan_dict["steps"]])

        require_approval = state.get("require_approval", False)
        already_approved = state.get("approved", False)

        # 决定第一次的去向（plan/art 在这次 update 一定会落盘）
        if require_approval and not already_approved:
            # 走审批门：approval_gate 节点会 interrupt 等待 resume
            next_goto: str = APPROVAL_GATE
            phase = "waiting_approval"
            status = "planned"
        elif already_approved:
            # 直接进入执行
            _handoff("text_agent", "读取 Excel 新闻 + 生成 60 秒脚本", 1)
            next_goto = "text_agent"
            phase = "executing"
            status = "dispatching"
        else:
            # 既不要求审批也未 approved（向后兼容 test_unapproved_stops）
            next_goto = END
            phase = "waiting_approval"
            status = "planned"

        return Command(
            update={
                "dispatch_plan": plan,
                "phase": phase,
                "current_step_index": 0,
                "artifacts": [art],
                "agent_status": {"orchestrator": status},
            },
            goto=next_goto,
        )

    # === 后续派活：按管道顺序逐个派 ===
    if state.get("script") is None:
        _handoff("text_agent", "读取 Excel 新闻 + 生成 60 秒脚本", 1)
        return Command(
            update={"current_step_index": 0,
                    "agent_status": {"orchestrator": "dispatching"}},
            goto="text_agent")

    if not state.get("image_paths"):
        _handoff("image_agent", "准备图片素材（4 级 fallback）", 2)
        return Command(
            update={"current_step_index": 1,
                    "agent_status": {"orchestrator": "dispatching"}},
            goto="image_agent")

    if not state.get("voice_path"):
        _handoff("audio_agent", "TTS 配音 + BGM + 静音兜底", 3)
        return Command(
            update={"current_step_index": 2,
                    "agent_status": {"orchestrator": "dispatching"}},
            goto="audio_agent")

    if not state.get("video_path"):
        _handoff("video_agent", "字幕 + FFmpeg 合成 mp4", 4)
        return Command(
            update={"current_step_index": 3,
                    "agent_status": {"orchestrator": "dispatching"}},
            goto="video_agent")

    # === 全部完成：summary → END ===
    n_images = len(state.get("image_paths", []))
    summary_text = f"任务完成：脚本 + {n_images} 张图片 + 配音 + 视频。"
    summary_art = make_artifact(
        "summary", "交付总结", "orchestrator", group_id,
        data={"text": summary_text})

    emit("agent_start", agent_id="chief", agent_name="理", phase="summary")
    for i in range(0, len(summary_text), 14):
        emit("chunk", text=summary_text[i:i + 14], agent_id="chief")
    emit("agent_done", agent_id="chief")

    return Command(
        update={
            "phase": "done",
            "artifacts": [summary_art],
            "agent_status": {"orchestrator": "done"},
            "messages": [AIMessage(content=summary_text, name="orchestrator")],
        },
        goto=END,
    )


# ---------- HITL 审批门 ----------

async def approval_gate_node(state: GroupState) -> Command:
    """挂起 graph 等待人工审批；resume(Command(resume={"approved":bool, "reason":str}))
    后根据决定 goto text_agent（通过）或 END（驳回）。

    单独成节点的原因：interrupt() 会丢弃当前节点 update，把它放在 orchestrator
    会让 dispatch_plan 落不了盘。orchestrator 先 commit plan → 这里再 interrupt。
    """
    plan = state.get("dispatch_plan")
    plan_dict = plan.model_dump() if plan and hasattr(plan, "model_dump") else (plan or {})

    decision = interrupt({
        "kind": "approval_required",
        "plan": plan_dict,
        "group_id": state.get("group_id", "unknown"),
    })

    if isinstance(decision, dict):
        approved = bool(decision.get("approved", False))
        reason = str(decision.get("reason", "") or "")
    else:
        approved = bool(decision)
        reason = ""

    if not approved:
        emit("rejected", reason=reason or "user_rejected")
        return Command(
            update={
                "phase": "rejected",
                "approved": False,
                "agent_status": {"orchestrator": "rejected"},
                "messages": [AIMessage(
                    content=f"用户驳回派活方案（reason={reason or 'n/a'}）",
                    name="orchestrator")],
            },
            goto=END,
        )

    _handoff("text_agent", "读取 Excel 新闻 + 生成 60 秒脚本", 1)
    return Command(
        update={
            "approved": True,
            "phase": "executing",
            "agent_status": {"orchestrator": "dispatching"},
            "messages": [AIMessage(
                content="用户审批通过，开始执行派活计划。",
                name="orchestrator")],
        },
        goto="text_agent",
    )
