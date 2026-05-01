"""反诈视频 skill 的 runner — 包装 V0 LangGraph 5 节点流水线。

Skill registry 会通过 `run(ctx)` 调用本入口。

ctx 协议：
    {
        "graph": CompiledStateGraph,    # 必传，FastAPI lifespan 注入
        "session_id": str,
        "message": str,
        "input_file_path": str | None,  # 可选，上传的 Excel 路径
    }

yield 出的 dict 由 routes.py 包装成 SSE 帧。事件类型与前端契约一致：
    start (mode=team) / dispatch / handoff / agent_start / artifact_saved /
    agent_done / chunk / error / done
"""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Any

from app.logging_config import logger
from app.schemas.state import GroupState
from app.skills.builtin.anti_scam_video.persistence import save_artifact, _safe_dir


GRAPH_TIMEOUT = 300

# V0 LangGraph 的 5 个 specialist 节点 → 前端 9 员工 UI 的映射
# (内部 agent_id, 前端 agent_id, 前端 agent_name, 任务描述, step_idx, total)
_AGENT_MAP = [
    ("text_agent", "writer", "创", "write script", 1, 4),
    ("image_agent", "analyst", "图", "prepare images", 2, 4),
    ("audio_agent", "distributor", "声", "generate audio", 3, 4),
    ("video_agent", "coder", "剪", "compose video", 4, 4),
]


async def run(ctx: dict[str, Any]) -> AsyncIterator[dict]:
    """跑反诈视频流水线，按顺序 yield SSE-shaped 事件 dict。"""
    graph = ctx.get("graph")
    session_id: str = ctx["session_id"]
    message: str = ctx["message"]
    input_file_path = ctx.get("input_file_path")

    if graph is None:
        yield {"type": "error", "message": "anti_scam_video skill 需要 LangGraph 实例"}
        return

    group_id = _safe_dir(session_id)
    config = {"configurable": {"thread_id": f"group_{group_id}"}, "recursion_limit": 50}
    initial_state: GroupState = {
        "group_id": group_id,
        "thread_id": f"group_{group_id}",
        "user_goal": message,
        "phase": "planning",
        "current_step_index": 0,
        "approved": True,
        "input_file_path": input_file_path,
        "image_paths": [],
        "messages": [],
        "artifacts": [],
        "events": [],
        "agent_status": {},
        "cost_usd": 0.0,
        "errors": [],
        "retry_count": {},
    }

    yield {"type": "start", "mode": "team", "session_id": session_id}

    try:
        result = await asyncio.wait_for(
            graph.ainvoke(initial_state, config), timeout=GRAPH_TIMEOUT
        )

        plan = result.get("dispatch_plan")
        if plan:
            pd = plan.model_dump() if hasattr(plan, "model_dump") else plan
            steps = [{"to": s["agent"], "task": s["task"]} for s in pd.get("steps", [])]
            yield {"type": "dispatch", "plan": pd.get("goal", ""), "steps": steps}

        for our_id, fe_id, fe_name, task, si, st in _AGENT_MAP:
            if our_id not in result.get("agent_status", {}):
                continue
            yield {"type": "handoff", "from": "chief", "to": fe_id,
                   "task": task, "step_idx": si, "step_total": st}
            yield {"type": "agent_start", "agent_id": fe_id,
                   "agent_name": fe_name, "phase": "execute"}
            for art in result.get("artifacts", []):
                ad = art.model_dump() if hasattr(art, "model_dump") else art
                if ad.get("by_agent") == our_id:
                    manifest = save_artifact(session_id, si, fe_id, fe_name, ad)
                    if manifest:
                        yield {"type": "artifact_saved", "manifest": manifest}
            yield {"type": "agent_done", "agent_id": fe_id}

        yield {"type": "agent_start", "agent_id": "chief",
               "agent_name": "理", "phase": "summary"}
        n = len(result.get("artifacts", []))
        summary = f"反诈短视频流水线完成！共产出 {n} 个交付物。可在成果库查看和下载。"
        for i in range(0, len(summary), 15):
            yield {"type": "chunk", "text": summary[i:i + 15], "agent_id": "chief"}
        yield {"type": "agent_done", "agent_id": "chief"}

        # 把汇总文本回传给 routes.py 用于历史持久化
        yield {"type": "_history_hint", "summary": summary}

    except asyncio.TimeoutError:
        yield {"type": "error", "message": "反诈视频流水线执行超时（5分钟）"}
    except Exception as e:  # noqa: BLE001
        logger.error("antiscam_pipeline_failed", error=str(e))
        yield {"type": "error", "message": str(e)}

    yield {"type": "done"}
