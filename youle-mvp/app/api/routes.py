"""Youle MVP API routes — 适配 youle_V4.1 前端接口契约。

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
from pydantic import BaseModel

from app.config import settings
from app.schemas.state import GroupState
from app.logging_config import logger

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


class AuthUpdate(BaseModel):
    level: str


@router.get("/")
async def root():
    return {"service": "youle-mvp", "version": "0.1.0", "status": "ok"}


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
    agent_name = AGENT_DISPLAY.get(agent_id, agent_id)

    def event_stream():
        yield _sse({"type": "start", "agent_id": agent_id, "agent_name": agent_name})
        yield _sse({"type": "progress", "stage": "thinking",
                     "detail": f"{agent_name} 正在处理"})

        reply = f"收到你的消息：「{req.message[:100]}」。我是{agent_name}，正在为你服务。（V0 demo 模式，接入真实模型后将返回 AI 回复）"
        for i in range(0, len(reply), 20):
            yield _sse({"type": "chunk", "text": reply[i:i + 20]})

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


# ==================== /chat/team — 群聊 SSE (LangGraph) ====================

@router.post("/chat/team")
async def chat_team(request: Request, req: TeamChatRequest):
    graph = request.app.state.graph
    session_id = req.session_id or f"group:antiscam-{uuid.uuid4().hex[:12]}"

    if session_id in ARCHIVED_SESSIONS:
        return JSONResponse(status_code=409, content={
            "error": "session_archived",
            "message": f"群聊 '{session_id}' 已归档。"})

    group_id = _safe_dir(session_id)
    config = {"configurable": {"thread_id": f"group_{group_id}"}, "recursion_limit": 50}
    initial_state: GroupState = {
        "group_id": group_id, "thread_id": f"group_{group_id}",
        "user_goal": req.message, "phase": "planning",
        "current_step_index": 0, "approved": True,
        "image_paths": [], "messages": [], "artifacts": [],
        "events": [], "agent_status": {}, "cost_usd": 0.0,
        "errors": [], "retry_count": {},
    }

    agent_map = [
        ("text_agent", "writer", "创", "write script", 1, 4),
        ("image_agent", "analyst", "图", "prepare images", 2, 4),
        ("audio_agent", "distributor", "声", "generate audio", 3, 4),
        ("video_agent", "coder", "剪", "compose video", 4, 4),
    ]

    async def event_stream():
        yield _sse({"type": "start", "mode": "team", "session_id": session_id})
        try:
            result = await asyncio.wait_for(
                graph.ainvoke(initial_state, config), timeout=GRAPH_TIMEOUT)

            plan = result.get("dispatch_plan")
            if plan:
                pd = plan.model_dump() if hasattr(plan, "model_dump") else plan
                steps = [{"to": s["agent"], "task": s["task"]} for s in pd.get("steps", [])]
                yield _sse({"type": "dispatch", "plan": pd.get("goal", ""), "steps": steps})

            for our_id, fe_id, fe_name, task, si, st in agent_map:
                if our_id not in result.get("agent_status", {}):
                    continue
                yield _sse({"type": "handoff", "from": "chief", "to": fe_id,
                            "task": task, "step_idx": si, "step_total": st})
                yield _sse({"type": "agent_start", "agent_id": fe_id,
                            "agent_name": fe_name, "phase": "execute"})
                for art in result.get("artifacts", []):
                    ad = art.model_dump() if hasattr(art, "model_dump") else art
                    if ad.get("by_agent") == our_id:
                        m = _save_artifact_to_outputs(session_id, si, fe_id, fe_name, ad)
                        if m:
                            yield _sse({"type": "artifact_saved", "manifest": m})
                yield _sse({"type": "agent_done", "agent_id": fe_id})

            yield _sse({"type": "agent_start", "agent_id": "chief",
                        "agent_name": "理", "phase": "summary"})
            n = len(result.get("artifacts", []))
            summary = f"任务完成！共产出 {n} 个交付物。可在成果库查看和下载。"
            for i in range(0, len(summary), 15):
                yield _sse({"type": "chunk", "text": summary[i:i + 15], "agent_id": "chief"})
            yield _sse({"type": "agent_done", "agent_id": "chief"})

            with _STATE_LOCK:
                turns = CHAT_HISTORY.setdefault(session_id, [])
                turns.append({"role": "user", "content": req.message, "agent_id": "team"})
                turns.append({"role": "assistant", "content": summary, "agent_id": "chief"})
            _save_history(session_id)

        except asyncio.TimeoutError:
            yield _sse({"type": "error", "message": "执行超时（5分钟）"})
        except Exception as e:
            logger.error("team_chat_failed", error=str(e))
            yield _sse({"type": "error", "message": str(e)})
        yield _sse({"type": "done"})

    return StreamingResponse(
        event_stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


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
