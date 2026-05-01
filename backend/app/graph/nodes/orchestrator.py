"""主编排节点（Orchestrator）— 只调度不干活。

决策逻辑（V0 写死，不用 LLM）：
  1. 首次进入 → 生成 DispatchPlan → 等审批或直接执行
  2. 按顺序派活：text → image → audio → video
  3. 全部完成 → 生成 summary → END
"""
from __future__ import annotations

import uuid

from langgraph.graph import END
from langgraph.types import Command

from app.schemas.state import GroupState
from app.schemas.dispatch import DispatchPlan, DispatchStep
from app.utils import make_artifact


def _make_plan(goal: str, group_id: str) -> tuple[DispatchPlan, object]:
    """生成固定的 4 步派活计划（V0 不用 LLM 决策）。"""
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


async def orchestrator_node(state: GroupState) -> Command:
    """Orchestrator 节点 — 根据当前 state 决定下一步派给谁。"""
    group_id = state.get("group_id", "unknown")
    goal = state.get("user_goal", "")

    # 第一次进入：生成派活计划
    if state.get("dispatch_plan") is None:
        plan, art = _make_plan(goal, group_id)
        approved = state.get("approved", False)
        return Command(
            update={
                "dispatch_plan": plan,
                "phase": "executing" if approved else "waiting_approval",
                "next_agent": "text_agent" if approved else "END",
                "artifacts": [art],
                "agent_status": {"orchestrator": "planned"},
                "events": [],
            },
            goto="text_agent" if approved else END,
        )

    # 未审批则直接结束
    if not state.get("approved", False):
        return Command(update={"next_agent": "END"}, goto=END)

    # 按顺序检查各阶段产出，派给下一个 specialist
    if state.get("script") is None:
        return Command(
            update={"next_agent": "text_agent", "current_step_index": 0,
                     "agent_status": {"orchestrator": "dispatching"}},
            goto="text_agent")

    if not state.get("image_paths"):
        return Command(
            update={"next_agent": "image_agent", "current_step_index": 1,
                     "agent_status": {"orchestrator": "dispatching"}},
            goto="image_agent")

    if not state.get("voice_path"):
        return Command(
            update={"next_agent": "audio_agent", "current_step_index": 2,
                     "agent_status": {"orchestrator": "dispatching"}},
            goto="audio_agent")

    if not state.get("video_path"):
        return Command(
            update={"next_agent": "video_agent", "current_step_index": 3,
                     "agent_status": {"orchestrator": "dispatching"}},
            goto="video_agent")

    # 全部完成：生成交付总结 → END
    n_images = len(state.get("image_paths", []))
    summary_text = f"任务完成：脚本 + {n_images} 张图片 + 配音 + 视频。"
    summary_art = make_artifact(
        "summary", "交付总结", "orchestrator", group_id,
        data={"text": summary_text})
    return Command(
        update={
            "next_agent": "END", "phase": "done",
            "artifacts": [summary_art],
            "agent_status": {"orchestrator": "done"},
        },
        goto=END,
    )
