"""SSE 事件生成器 — 将 SessionEvent 序列化为标准 SSE 文本格式。"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.schemas.events import SessionEvent, SessionEventType


def make_event(type_: SessionEventType, group_id: str, **fields) -> str:
    """构造一条 SSE 事件文本。

    返回格式：event: <type>\ndata: <json>\n\n
    前端通过 EventSource 或 fetch + ReadableStream 解析。
    """
    ev = SessionEvent(
        event_id=f"evt_{uuid.uuid4().hex[:12]}",
        type=type_,
        group_id=group_id,
        created_at=datetime.now(timezone.utc),
        **fields,
    )
    body = ev.model_dump_json()
    return f"event: {type_}\ndata: {body}\n\n"
