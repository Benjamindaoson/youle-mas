"""反诈视频 skill 私有：把 LangGraph artifact 落盘到 outputs/{sid}/manifest.json。

历史：原本写在 routes.py 里 `_save_artifact_to_outputs`，封 skill 时搬到这里
让 skill 自给自足，不再倒过来依赖 routes 私有函数。
"""
from __future__ import annotations

import json
import os
import re
import threading
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings
from app.logging_config import logger


_OUTPUTS_DIR = Path(settings.ARTIFACT_DIR)

# 每 session 一把锁，避免并发写 manifest.json 互相覆盖
_MANIFEST_LOCKS: dict[str, threading.Lock] = defaultdict(threading.Lock)
_GUARD = threading.Lock()


def _safe_dir(sid: str) -> str:
    s = re.sub(r"[^\w\-]", "_", sid)
    return re.sub(r"_+", "_", s).strip("_") or "default"


def _lock_for(session_id: str) -> threading.Lock:
    with _GUARD:
        return _MANIFEST_LOCKS[session_id]


def save_artifact(
    session_id: str,
    step_idx: int,
    agent_id: str,
    agent_name: str,
    art_data: dict,
) -> dict | None:
    """把 LangGraph 产出落到 outputs/{sid}/00X-{agent}.md 并 append 到 manifest。

    art_data 是 LangGraph artifact 的 dict 形态（含 type / data / title / by_agent 等）。
    返回 manifest entry，前端用作 artifact_saved 事件的 payload。
    """
    safe_sid = _safe_dir(session_id)
    out_dir = _OUTPUTS_DIR / safe_sid
    out_dir.mkdir(parents=True, exist_ok=True)

    safe_agent = re.sub(r"[^\w]", "_", agent_id)
    art_id = f"{step_idx:03d}-{safe_agent}"
    filename = f"{art_id}.md"

    parts: list[str] = []
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

    with _lock_for(session_id):
        path = out_dir / filename
        c = 2
        while path.exists():
            filename = f"{art_id}-{c}.md"
            path = out_dir / filename
            c += 1
        try:
            path.write_text(content, encoding="utf-8")
        except OSError as e:
            logger.warning("antiscam_artifact_write_failed", path=str(path), error=str(e))
            return None

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
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "artifacts": []}
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
