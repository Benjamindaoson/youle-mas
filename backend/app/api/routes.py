"""Youle Backend API routes — 适配 frontend (Next.js) 接口契约。

前端 lib/api.ts 期望的端点：
  POST /chat          — 单聊 SSE
  POST /chat/team     — 群聊 SSE（dispatch/discuss）
  GET  /agents        — agent 列表
  GET  /artifacts/{session_id}                — 按 session 列 artifacts
  GET  /artifacts                             — 全局 artifacts
  GET  /artifacts/by-agent/{agent_id}         — 按 agent 列 artifacts
  GET  /artifacts/{session_id}/{filename}     — 读 artifact 内容
  GET  /artifacts/{session_id}/{filename}/download — 下载
  POST /upload        — 文件上传
  GET/POST /auth/{session_id}  — 授权档位
  GET/POST/DELETE /chat/archive/{session_id} — 归档
  DELETE /history/{session_id} — 清历史
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import threading
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from langgraph.types import Command as LGCommand
from pydantic import BaseModel

from app.config import settings
from app.schemas.state import GroupState
from app.logging_config import logger
from app.agents.role_chat import stream_role_reply, role_meta
from app.agents.dispatcher import plan_dispatch, is_antiscam_video_request
from app.conductor import conduct as v1_conduct
from app.skills.registry import list_skills as v1_list_skills, load_all as v1_load_skills

router = APIRouter()

MAX_UPLOAD_SIZE = 20 * 1024 * 1024
GRAPH_TIMEOUT = 300

AUTH_STATE: dict[str, str] = {}
ARCHIVED_SESSIONS: dict[str, dict] = {}
CHAT_HISTORY: dict[str, list[dict]] = {}

# 全局 dict 在 MVP 单 worker 下"够用"，但仍需锁住读改写以保持一致性。
# 用 threading.Lock 是因为 SSE 生成器是 sync 上下文，asyncio.Lock 不通用。
# 注：多 worker / 多进程部署需迁移到 Redis。
_STATE_LOCK = threading.Lock()

# 每个 session 一把锁，避免并发写 manifest.json 互相覆盖
_MANIFEST_LOCKS: dict[str, threading.Lock] = defaultdict(threading.Lock)
_MANIFEST_LOCKS_GUARD = threading.Lock()


def _manifest_lock_for(session_id: str) -> threading.Lock:
    with _MANIFEST_LOCKS_GUARD:
        return _MANIFEST_LOCKS[session_id]

_OUTPUTS_DIR = Path(settings.ARTIFACT_DIR)
_UPLOADS_DIR = Path(settings.UPLOAD_DIR)
_HISTORY_DIR = Path("./data/history")
_HISTORY_DIR.mkdir(parents=True, exist_ok=True)

AGENT_DISPLAY = {
    "orchestrator": "理", "text_agent": "创", "image_agent": "图",
    "audio_agent": "声", "video_agent": "剪",
    "chief": "理", "analyst": "析", "planner": "策", "writer": "创",
    "distributor": "播", "monitor": "观", "coder": "工",
    "frontend": "端", "tester": "测",
}


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


def _safe_dir(sid: str) -> str:
    s = re.sub(r"[^\w\-]", "_", sid)
    return re.sub(r"_+", "_", s).strip("_") or "default"


def _history_path(sid: str) -> Path:
    return _HISTORY_DIR / f"{_safe_dir(sid)}.json"


def _save_history(sid: str) -> None:
    with _STATE_LOCK:
        turns = list(CHAT_HISTORY.get(sid, []))
    try:
        _history_path(sid).write_text(
            json.dumps(turns, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass


def _load_all_history() -> None:
    for f in _HISTORY_DIR.glob("*.json"):
        try:
            turns = json.loads(f.read_text(encoding="utf-8"))
            if isinstance(turns, list):
                with _STATE_LOCK:
                    CHAT_HISTORY[f.stem.replace("_", ":", 1)] = turns
        except (OSError, json.JSONDecodeError):
            continue


_load_all_history()


class ChatRequest(BaseModel):
    message: str
    agent_id: str = "chief"
    session_id: Optional[str] = None
    auto_route: bool = False


class TeamChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    mode: str = "dispatch"
    members: Optional[list[str]] = None
    # HITL: 仅在反诈视频流水线生效；True 时 orchestrator 会触发 interrupt 等待
    # 前端 POST /chat/team/resume/{thread_id} 注入 {"approved": true|false}
    require_approval: bool = False


class ResumeRequest(BaseModel):
    """POST /chat/team/resume/{thread_id} 的 body。"""
    approved: bool = True
    reason: Optional[str] = None


class AuthUpdate(BaseModel):
    level: str


@router.get("/")
async def root():
    return {"service": "youle-backend", "version": "0.1.0", "status": "ok"}


@router.get("/agents")
async def list_agents():
    agents = [
        {"id": "chief", "name": "理", "role": "首席助理", "available": True},
        {"id": "analyst", "name": "析", "role": "分析员", "available": True},
        {"id": "planner", "name": "策", "role": "策划员", "available": True},
        {"id": "writer", "name": "创", "role": "创作员", "available": True},
        {"id": "distributor", "name": "播", "role": "播报员", "available": True},
        {"id": "monitor", "name": "观", "role": "观测员", "available": True},
        {"id": "coder", "name": "工", "role": "后端工程师", "available": True},
        {"id": "frontend", "name": "端", "role": "前端工程师", "available": True},
        {"id": "tester", "name": "测", "role": "测试工程师", "available": True},
    ]
    return {"agents": agents}


# ==================== /chat — 单聊 SSE ====================

@router.post("/chat")
async def chat(req: ChatRequest):
    agent_id = req.agent_id
    meta = role_meta(agent_id)
    agent_name = meta["name"]
    if req.session_id:
        with _STATE_LOCK:
            history = list(CHAT_HISTORY.get(req.session_id, []))
    else:
        history = []

    async def event_stream():
        yield _sse({"type": "start", "agent_id": agent_id, "agent_name": agent_name})
        yield _sse({"type": "progress", "stage": "thinking",
                     "detail": f"{agent_name} 正在处理"})

        collected: list[str] = []
        try:
            async for chunk in stream_role_reply(agent_id, req.message, history):
                collected.append(chunk)
                yield _sse({"type": "chunk", "text": chunk})
        except Exception as e:  # noqa: BLE001
            logger.error("chat_stream_failed", error=str(e), agent=agent_id)
            yield _sse({"type": "error", "message": str(e)})
            return

        reply = "".join(collected)
        if req.session_id:
            with _STATE_LOCK:
                turns = CHAT_HISTORY.setdefault(req.session_id, [])
                turns.append({"role": "user", "content": req.message, "agent_id": agent_id})
                turns.append({"role": "assistant", "content": reply, "agent_id": agent_id})
            _save_history(req.session_id)

        yield _sse({"type": "done"})

    return StreamingResponse(
        event_stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ==================== /chat/team — 群聊 SSE ====================
#
# 两条路径：
#   A. 通用动态派活（默认）：dispatcher 选 1-3 个员工，逐个用 role_chat 流式回复，
#      产出落到 artifacts，最后由 chief 汇总。
#   B. 反诈视频流水线（关键词触发）：走原 LangGraph 5 节点。
# ===========================================================

@router.post("/chat/team")
async def chat_team(request: Request, req: TeamChatRequest):
    session_id = req.session_id or f"group:adhoc-{uuid.uuid4().hex[:12]}"
    if session_id in ARCHIVED_SESSIONS:
        return JSONResponse(status_code=409, content={
            "error": "session_archived",
            "message": f"群聊 '{session_id}' 已归档。"})

    if is_antiscam_video_request(req.message):
        graph = request.app.state.graph
        cb = getattr(request.app.state, "trace_callback", None)
        return _stream_antiscam_pipeline(graph, session_id, req, trace_callback=cb)

    return _stream_generic_team(session_id, req)


def _stream_generic_team(session_id: str, req: TeamChatRequest) -> StreamingResponse:
    """通用动态派活 — 不再写死反诈视频流水线。"""

    async def event_stream():
        yield _sse({"type": "start", "mode": "team", "session_id": session_id})
        try:
            mode = (req.mode or "dispatch").lower()
            if mode == "discuss":
                async for ev in _run_discuss(session_id, req):
                    yield ev
            else:
                async for ev in _run_dispatch(session_id, req):
                    yield ev
        except Exception as e:  # noqa: BLE001
            logger.error("team_chat_generic_failed", error=str(e))
            yield _sse({"type": "error", "message": str(e)})
        yield _sse({"type": "done"})

    return StreamingResponse(
        event_stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


async def _run_dispatch(session_id: str, req: TeamChatRequest):
    """dispatch 模式：chief 拆活 → 员工逐个执行 → 出 artifact → chief 汇总。"""
    plan = plan_dispatch(req.message, req.members)
    yield _sse({"type": "dispatch", "plan": plan.plan,
                "steps": [s.to_dict() for s in plan.steps]})

    if not plan.steps:
        yield _sse({"type": "agent_start", "agent_id": "chief",
                    "agent_name": "理", "phase": "direct"})
        async for c in stream_role_reply("chief", req.message, []):
            yield _sse({"type": "chunk", "text": c, "agent_id": "chief"})
        yield _sse({"type": "agent_done", "agent_id": "chief"})

        with _STATE_LOCK:
            turns = CHAT_HISTORY.setdefault(session_id, [])
            turns.append({"role": "user", "content": req.message, "agent_id": "team"})
            turns.append({"role": "assistant", "content": plan.plan, "agent_id": "chief"})
        _save_history(session_id)
        return

    total = len(plan.steps)
    artifact_count = 0
    for idx, step in enumerate(plan.steps, start=1):
        meta = role_meta(step.to)
        fe_name = meta["name"]

        yield _sse({"type": "handoff", "from": "chief", "to": step.to,
                    "task": step.task, "step_idx": idx, "step_total": total})
        yield _sse({"type": "agent_start", "agent_id": step.to,
                    "agent_name": fe_name, "phase": "execute"})

        collected: list[str] = []
        prompt = f"{step.task}\n\n（用户原始消息：{req.message}）"
        async for c in stream_role_reply(step.to, prompt, []):
            collected.append(c)
            yield _sse({"type": "chunk", "text": c, "agent_id": step.to})

        yield _sse({"type": "agent_done", "agent_id": step.to})

        full = "".join(collected).strip()
        if full:
            manifest = _save_text_artifact(
                session_id=session_id, step_idx=idx,
                agent_id=step.to, agent_name=fe_name,
                title=f"{fe_name}的产出 #{idx}",
                body=full, summary_hint=step.task,
            )
            if manifest:
                artifact_count += 1
                yield _sse({"type": "artifact_saved", "manifest": manifest})

    yield _sse({"type": "agent_start", "agent_id": "chief",
                "agent_name": "理", "phase": "summary"})
    names = " / ".join(role_meta(s.to)["name"] for s in plan.steps)
    summary_msg = (
        f"刚才{names}各自跑完了，共产出 {artifact_count} 个归档（左侧成果库可查）。"
        "要我把这些拼成一份总结发给你，还是直接进入下一步？"
    )
    for i in range(0, len(summary_msg), 14):
        yield _sse({"type": "chunk", "text": summary_msg[i:i + 14], "agent_id": "chief"})
    yield _sse({"type": "agent_done", "agent_id": "chief"})

    with _STATE_LOCK:
        turns = CHAT_HISTORY.setdefault(session_id, [])
        turns.append({"role": "user", "content": req.message, "agent_id": "team"})
        turns.append({"role": "assistant", "content": summary_msg, "agent_id": "chief"})
    _save_history(session_id)


async def _run_discuss(session_id: str, req: TeamChatRequest):
    """discuss 模式：chief 抛议题 → 2-3 个员工各发一段 → chief 收束。"""
    plan = plan_dispatch(req.message, req.members)
    participants = [s.to for s in plan.steps[:3]] or ["analyst", "planner", "writer"]

    snippet = req.message[:24] + ("…" if len(req.message) > 24 else "")
    yield _sse({
        "type": "discussion",
        "flow_type": "discuss",
        "topic": f"围绕「{snippet}」的快速讨论",
        "question": "各位先按自己专业角度说一段，最后我来收拢。",
        "scope_in": ["关键判断", "分歧点"],
        "scope_out": ["执行细节"],
        "deadline_turns": 2,
        "participants": participants,
    })

    for aid in participants:
        meta = role_meta(aid)
        yield _sse({"type": "agent_start", "agent_id": aid,
                    "agent_name": meta["name"], "phase": "discuss"})
        async for c in stream_role_reply(aid, req.message, []):
            yield _sse({"type": "chunk", "text": c, "agent_id": aid})
        yield _sse({"type": "agent_done", "agent_id": aid})

    yield _sse({"type": "agent_start", "agent_id": "chief",
                "agent_name": "理", "phase": "discuss-summary"})
    names = " / ".join(role_meta(p)["name"] for p in participants)
    closing = (
        f"我把{names}的发言收一下：核心分歧不大，建议先做一个最小动作验证假设。需要我安排吗？"
    )
    for i in range(0, len(closing), 14):
        yield _sse({"type": "chunk", "text": closing[i:i + 14], "agent_id": "chief"})
    yield _sse({"type": "agent_done", "agent_id": "chief"})

    with _STATE_LOCK:
        turns = CHAT_HISTORY.setdefault(session_id, [])
        turns.append({"role": "user", "content": req.message, "agent_id": "team"})
        turns.append({"role": "assistant", "content": closing, "agent_id": "chief"})
    _save_history(session_id)


_AGENT_FE_MAP = {
    "text_agent":  ("writer",      "创", 1, 4),
    "image_agent": ("analyst",     "图", 2, 4),
    "audio_agent": ("distributor", "声", 3, 4),
    "video_agent": ("coder",       "剪", 4, 4),
    "orchestrator": ("chief",      "理", 0, 4),
}


def _fe_for(node_id: str) -> tuple[str, str, int, int]:
    """把 graph 内部 node_id 映射到前端 agent_id / 名 / step_idx / step_total。"""
    return _AGENT_FE_MAP.get(node_id, (node_id, node_id, 0, 4))


def _antiscam_initial_state(session_id: str, message: str, *, approved: bool,
                             require_approval: bool) -> tuple[GroupState, dict]:
    """构造 LangGraph 初始 state + config（thread_id 用于 checkpoint resume）。"""
    group_id = _safe_dir(session_id)
    thread_id = f"group_{group_id}"
    # metadata['thread_id'] 让 LocalTraceCallback 能读出 thread_id 关联 trace
    config = {
        "configurable": {"thread_id": thread_id},
        "recursion_limit": 50,
        "metadata": {"thread_id": thread_id, "session_id": session_id},
    }
    initial_state: GroupState = {
        "group_id": group_id, "thread_id": f"group_{group_id}",
        "user_goal": message, "phase": "planning",
        "current_step_index": 0,
        "approved": approved,
        "require_approval": require_approval,
        "image_paths": [], "messages": [], "artifacts": [],
        "events": [], "agent_status": {}, "cost_usd": 0.0,
        "errors": [],
    }
    return initial_state, config


async def _stream_graph_events(graph, stream_input, config, session_id: str):
    """把 LangGraph astream(updates+custom) 事件适配成前端 SSE 事件流。

    关键不变量：**astream 必须自然耗尽**才能让 LangGraph 完成 checkpoint commit。
    如果 client 提前 break + server 跟着 return，会触发 generator close → astream
    aclose → 内部 task cancel → checkpoint 回滚（resume 时看到 next=()）。

    所以 interrupt 路径也是：先把所有 yield 都缓存（buffered），等 astream 跑完
    再一次性 flush。代价：interrupt 场景非真流式（但本来 interrupt 也只有 1-2 个
    super-step，没多少可流的）。Non-interrupt 场景仍然真流式。
    """
    pending: list[str] = []
    interrupt_seen = False
    artifact_seen: set[str] = set()

    def _flush():
        nonlocal pending
        out, pending = pending, []
        return out

    async for mode, ev in graph.astream(
        stream_input,
        config,
        stream_mode=["updates", "custom"],
    ):
        if mode == "custom":
            kind = ev.pop("kind", "progress")
            pending.append(_sse({"type": kind, **ev}))
        elif mode == "updates":
            for node_name, update in ev.items():
                # interrupt 事件：node_name == "__interrupt__"，update 是 tuple[Interrupt, ...]
                if node_name == "__interrupt__":
                    interrupts_iter = update if isinstance(update, (list, tuple)) else [update]
                    payloads = []
                    for it in interrupts_iter:
                        val = getattr(it, "value", None)
                        if val is None:
                            val = it if isinstance(it, dict) else {"raw": str(it)}
                        payloads.append(val)
                    pending.append(_sse({
                        "type": "approval_required",
                        "thread_id": config["configurable"]["thread_id"],
                        "interrupts": payloads,
                    }))
                    interrupt_seen = True
                    continue

                update = update or {}
                for art in update.get("artifacts", []) or []:
                    ad = art.model_dump() if hasattr(art, "model_dump") else art
                    art_id = ad.get("id")
                    if art_id and art_id in artifact_seen:
                        continue
                    if art_id:
                        artifact_seen.add(art_id)
                    fe_id, fe_name, step_idx, _ = _fe_for(ad.get("by_agent", node_name))
                    m = _save_artifact_to_outputs(session_id, step_idx, fe_id, fe_name, ad)
                    if m:
                        pending.append(_sse({"type": "artifact_saved", "manifest": m}))

        # 仅在非 interrupt 路径上立刻 flush 缓存（保留真流式）
        # 一旦看到 interrupt，就暂存所有后续事件，等 astream 自然结束再 flush
        if not interrupt_seen:
            for sse in _flush():
                yield sse

    # astream 已自然耗尽 → checkpoint 已 commit。flush 剩余 buffered 事件。
    for sse in _flush():
        yield sse
    # interrupt 路径不发 done，让前端识别"挂起"；非 interrupt 路径发 done
    if not interrupt_seen:
        yield _sse({"type": "done"})


def _stream_antiscam_pipeline(graph, session_id: str, req: TeamChatRequest,
                               trace_callback=None) -> StreamingResponse:
    """关键词命中"反诈视频"时走 LangGraph 流水线（真流式 / 支持 HITL interrupt）。"""
    initial_state, config = _antiscam_initial_state(
        session_id, req.message,
        approved=not req.require_approval,
        require_approval=req.require_approval,
    )
    if trace_callback is not None:
        config["callbacks"] = [trace_callback]

    async def event_stream():
        yield _sse({"type": "start", "mode": "team", "session_id": session_id,
                    "thread_id": config["configurable"]["thread_id"]})
        try:
            async for sse in _stream_graph_events(
                    graph, initial_state, config, session_id):
                yield sse
        except asyncio.TimeoutError:
            yield _sse({"type": "error", "message": "执行超时"})
        except Exception as e:  # noqa: BLE001
            logger.error("antiscam_pipeline_failed", error=str(e))
            yield _sse({"type": "error", "message": str(e)})

        # 历史落盘：把最近一轮简短记录到 chat history
        with _STATE_LOCK:
            turns = CHAT_HISTORY.setdefault(session_id, [])
            turns.append({"role": "user", "content": req.message, "agent_id": "team"})
            turns.append({"role": "assistant",
                          "content": "反诈视频流水线已触发，详见上方进度。",
                          "agent_id": "chief"})
        _save_history(session_id)

    return StreamingResponse(
        event_stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/chat/team/resume/{thread_id}")
async def resume_team(thread_id: str, body: ResumeRequest, request: Request):
    """HITL 恢复点：把用户审批结果通过 Command(resume=...) 注入挂起的 graph。

    返回新的 SSE 事件流（接着上次 interrupt 处继续跑，直到再次 interrupt 或完成）。
    """
    graph = request.app.state.graph
    cb = getattr(request.app.state, "trace_callback", None)
    config: dict = {
        "configurable": {"thread_id": thread_id},
        "recursion_limit": 50,
        "metadata": {"thread_id": thread_id, "resumed": True},
    }
    if cb is not None:
        config["callbacks"] = [cb]
    # 反推 session_id（thread_id 形如 group_{safe_sid}）
    session_id = thread_id[len("group_"):] if thread_id.startswith("group_") else thread_id

    # 校验 checkpoint 是否存在；不存在直接 400，避免静默从头重跑
    snap = await graph.aget_state(config)
    if not snap.tasks and not snap.values.get("dispatch_plan"):
        logger.warning("resume_no_checkpoint", thread_id=thread_id)
        return JSONResponse(
            status_code=404,
            content={"error": "no_checkpoint",
                     "message": f"thread_id={thread_id} 无挂起的 checkpoint，无法 resume",
                     "thread_id": thread_id})
    logger.info("resume_team", thread_id=thread_id, next=str(snap.next),
                approved=body.approved)

    cmd = LGCommand(resume={
        "approved": body.approved,
        "reason": body.reason or "",
    })

    async def event_stream():
        yield _sse({"type": "start", "mode": "team-resume",
                    "thread_id": thread_id, "approved": body.approved,
                    "snapshot_next": list(snap.next) if snap.next else []})
        try:
            async for sse in _stream_graph_events(graph, cmd, config, session_id):
                yield sse
        except Exception as e:  # noqa: BLE001
            logger.error("resume_failed", error=str(e), thread_id=thread_id)
            yield _sse({"type": "error", "message": str(e)})

    return StreamingResponse(
        event_stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ==================== V1 Conductor 端点 ====================
#
# 新模型：1 主编排 (Conductor) + 4 能力 agent (T/I/V/D) + skill 市场。
# 不动 V0 的 /chat /chat/team，平行迭代。详见 docs/v1-architecture.md。
# ===========================================================

class V1ConductRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    # 当上一轮返回 clarify_required，前端把答案塞进 clarify_answers 再请求一次
    clarify_answers: Optional[dict[str, str]] = None


@router.get("/v1/skills")
async def v1_list_skills_endpoint():
    """暴露 skill 市场的当前注册表，前端 skill 市集 UI 用。"""
    return {
        "count": len(v1_list_skills()),
        "items": [s.model_dump() for s in v1_list_skills()],
    }


@router.post("/v1/conduct")
async def v1_conduct_endpoint(req: V1ConductRequest):
    """V1 主编排 SSE 入口。

    流程（详见 conductor/dispatcher.py）：
        start → intent_parsed → (clarify_required ⤴ 等下次调用)
              → skill_selected → agent_start/chunk/agent_done* → deliverable → done
    """
    session_id = req.session_id or f"v1:{uuid.uuid4().hex[:12]}"

    # 把 clarify_answers 拼进 user_text 让下游 parse_intent 一并消化（MVP 简化版）
    text = req.message
    if req.clarify_answers:
        annot = " | ".join(f"{k}={v}" for k, v in req.clarify_answers.items())
        text = f"{text}\n[澄清补充] {annot}"

    async def event_stream():
        async for ev in v1_conduct(text, session_id=session_id):
            yield _sse(ev)

    return StreamingResponse(
        event_stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


def _save_text_artifact(session_id: str, step_idx: int, agent_id: str,
                        agent_name: str, title: str, body: str,
                        summary_hint: str) -> dict | None:
    """把员工的纯文本产出落到 outputs/{sid}/00X-{agent}.md，并 append 到 manifest.json。"""
    safe_sid = _safe_dir(session_id)
    out_dir = _OUTPUTS_DIR / safe_sid
    out_dir.mkdir(parents=True, exist_ok=True)

    safe_agent = re.sub(r"[^\w]", "_", agent_id)
    art_id = f"{step_idx:03d}-{safe_agent}"
    filename = f"{art_id}.md"
    content = f"# {title}\n\n_任务_：{summary_hint}\n\n---\n\n{body}\n"

    with _manifest_lock_for(session_id):
        path = out_dir / filename
        c = 2
        while path.exists():
            filename = f"{art_id}-{c}.md"
            path = out_dir / filename
            c += 1
        try:
            path.write_text(content, encoding="utf-8")
        except OSError as e:
            logger.warning("artifact_write_failed", path=str(path), error=str(e))
            return None

        summary_text = body[:120].replace("\n", " ").strip()
        entry = {
            "id": art_id, "step_idx": step_idx,
            "agent_id": agent_id, "agent_name": agent_name,
            "title": title, "summary": summary_text or summary_hint[:120],
            "file": filename, "size": len(content),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "artifact_type": "markdown",
        }

        mp = out_dir / "manifest.json"
        manifest = {"session_id": session_id,
                    "created_at": datetime.now(timezone.utc).isoformat(), "artifacts": []}
        if mp.exists():
            try:
                manifest = json.loads(mp.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        manifest.setdefault("artifacts", []).append(entry)
        tmp = mp.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, mp)

    return entry


def _save_artifact_to_outputs(session_id: str, step_idx: int, agent_id: str,
                               agent_name: str, art_data: dict) -> dict | None:
    safe_sid = _safe_dir(session_id)
    out_dir = _OUTPUTS_DIR / safe_sid
    out_dir.mkdir(parents=True, exist_ok=True)

    safe_agent = re.sub(r"[^\w]", "_", agent_id)
    art_id = f"{step_idx:03d}-{safe_agent}"
    filename = f"{art_id}.md"

    parts = []
    atype = art_data.get("type", "")
    if atype == "video-script":
        s = art_data.get("data", {})
        parts.append(f"# {s.get('hook', 'Script')}\n")
        for line in s.get("body", []):
            parts.append(f"- {line}\n")
        parts.append(f"\n{s.get('closing', '')}\n")
    elif atype == "dispatch-plan":
        parts.append(f"# Dispatch Plan\n\nGoal: {art_data.get('data', {}).get('goal', '')}\n")
    elif atype == "summary":
        parts.append(f"# Summary\n\n{art_data.get('data', {}).get('text', '')}\n")
    else:
        parts.append(f"# {art_data.get('title', 'Artifact')}\n\nType: {atype}\n")

    content = "".join(parts)

    # 文件落盘 + manifest 更新整体串行化，避免并发 SSE run 互相覆盖
    with _manifest_lock_for(session_id):
        path = out_dir / filename
        c = 2
        while path.exists():
            filename = f"{art_id}-{c}.md"
            path = out_dir / filename
            c += 1
        path.write_text(content, encoding="utf-8")

        entry = {
            "id": art_id, "step_idx": step_idx,
            "agent_id": agent_id, "agent_name": agent_name,
            "title": art_data.get("title", "Artifact"),
            "summary": content[:120], "file": filename,
            "size": len(content),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "artifact_type": "markdown",
        }

        mp = out_dir / "manifest.json"
        manifest = {"session_id": session_id,
                    "created_at": datetime.now(timezone.utc).isoformat(), "artifacts": []}
        if mp.exists():
            try:
                manifest = json.loads(mp.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        manifest.setdefault("artifacts", []).append(entry)
        tmp = mp.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, mp)
    return entry


# ==================== Artifacts ====================

@router.get("/artifacts")
async def get_all_artifacts(limit: int = 200):
    items: list[dict] = []
    if not _OUTPUTS_DIR.exists():
        return {"count": 0, "items": []}
    for sd in _OUTPUTS_DIR.iterdir():
        if not sd.is_dir():
            continue
        mp = sd / "manifest.json"
        if not mp.exists():
            continue
        try:
            data = json.loads(mp.read_text(encoding="utf-8"))
            sid = data.get("session_id", sd.name)
            for a in data.get("artifacts", []):
                items.append({**a, "session_id": sid})
        except (json.JSONDecodeError, OSError):
            continue
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"count": len(items[:limit]), "items": items[:limit]}


@router.get("/artifacts/by-agent/{agent_id}")
async def get_agent_artifacts(agent_id: str, limit: int = 30):
    all_data = await get_all_artifacts(500)
    items = [a for a in all_data["items"] if a.get("agent_id") == agent_id][:limit]
    return {"agent_id": agent_id, "count": len(items), "items": items}


@router.get("/artifacts/{session_id}")
async def get_session_artifacts(session_id: str):
    safe = _safe_dir(session_id)
    mp = _OUTPUTS_DIR / safe / "manifest.json"
    if not mp.exists():
        return {"session_id": session_id, "created_at": "", "artifacts": []}
    try:
        return json.loads(mp.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"session_id": session_id, "created_at": "", "artifacts": []}


def _is_safe_filename(name: str) -> bool:
    # 只允许"裸文件名"：basename 等于自身且不含分隔符/相对路径片段
    if not name or name in (".", ".."):
        return False
    if "/" in name or "\\" in name or "\x00" in name:
        return False
    return Path(name).name == name


@router.get("/artifacts/{session_id}/{filename}")
async def get_artifact_file(session_id: str, filename: str):
    if not _is_safe_filename(filename):
        return JSONResponse(status_code=400, content={"error": "invalid_filename"})
    path = _OUTPUTS_DIR / _safe_dir(session_id) / filename
    if not path.exists() or not path.is_file():
        return JSONResponse(status_code=404, content={"error": "not_found"})
    try:
        return {"session_id": session_id, "filename": filename,
                "content": path.read_text(encoding="utf-8")}
    except (OSError, UnicodeDecodeError):
        return JSONResponse(status_code=404, content={"error": "not_text_file"})


@router.get("/artifacts/{session_id}/{filename}/download")
async def download_artifact_file(session_id: str, filename: str):
    if not _is_safe_filename(filename):
        return JSONResponse(status_code=400, content={"error": "invalid_filename"})
    path = _OUTPUTS_DIR / _safe_dir(session_id) / filename
    if not path.exists() or not path.is_file():
        return JSONResponse(status_code=404, content={"error": "not_found"})
    return FileResponse(path=str(path), filename=filename)


# ==================== Upload ====================

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), session_id: str = Form(default="")):
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        return JSONResponse(status_code=413, content={"error": "file_too_large"})
    sub = _safe_dir(session_id) if session_id else "misc"
    target_dir = _UPLOADS_DIR / sub
    target_dir.mkdir(parents=True, exist_ok=True)
    orig = file.filename or "unnamed"
    safe_name = re.sub(r"[/\\]", "_", orig).replace("..", "_")
    final_name = f"{int(time.time() * 1000)}_{uuid.uuid4().hex[:12]}_{safe_name}"
    (target_dir / final_name).write_bytes(content)
    return {"path": str((target_dir / final_name).resolve()),
            "name": orig, "size": len(content), "mime": file.content_type or ""}


# ==================== Auth ====================

@router.get("/auth/{session_id}")
async def get_auth(session_id: str):
    with _STATE_LOCK:
        return {"session_id": session_id, "level": AUTH_STATE.get(session_id, "L0")}


@router.post("/auth/{session_id}")
async def set_auth(session_id: str, body: AuthUpdate):
    if body.level not in ("L0", "L1", "L2"):
        return JSONResponse(status_code=400, content={"error": "invalid_level"})
    with _STATE_LOCK:
        AUTH_STATE[session_id] = body.level
    return {"session_id": session_id, "level": body.level}


# ==================== Archive ====================

@router.get("/chat/archive/{session_id}")
async def get_archive_status(session_id: str):
    with _STATE_LOCK:
        if session_id not in ARCHIVED_SESSIONS:
            return {"session_id": session_id, "archived": False}
        return {"session_id": session_id, "archived": True,
                "snapshot": ARCHIVED_SESSIONS[session_id]}


@router.post("/chat/archive/{session_id}")
async def archive_session(session_id: str):
    with _STATE_LOCK:
        if session_id in ARCHIVED_SESSIONS:
            return {"session_id": session_id, "already_archived": True,
                    "archived": ARCHIVED_SESSIONS[session_id]}
        turns = CHAT_HISTORY.get(session_id, [])
        snapshot = {
            "archived_at": datetime.now(timezone.utc).isoformat(),
            "turn_count": len(turns), "artifact_count": 0,
            "participants": list({t.get("agent_id", "") for t in turns if t.get("agent_id")}),
        }
        ARCHIVED_SESSIONS[session_id] = snapshot
    return {"session_id": session_id, "already_archived": False, "archived": snapshot}


@router.delete("/chat/archive/{session_id}")
async def unarchive_session(session_id: str):
    with _STATE_LOCK:
        existed = session_id in ARCHIVED_SESSIONS
        ARCHIVED_SESSIONS.pop(session_id, None)
    return {"session_id": session_id, "was_archived": existed}


# ==================== History ====================

@router.get("/history/{session_id}")
async def get_history(session_id: str):
    with _STATE_LOCK:
        return {"session_id": session_id, "turns": list(CHAT_HISTORY.get(session_id, []))}


@router.delete("/history/{session_id}")
async def clear_history(session_id: str):
    with _STATE_LOCK:
        existed = session_id in CHAT_HISTORY
        CHAT_HISTORY.pop(session_id, None)
    try:
        p = _history_path(session_id)
        if p.exists():
            p.unlink()
    except OSError:
        pass
    return {"session_id": session_id, "cleared": existed}
