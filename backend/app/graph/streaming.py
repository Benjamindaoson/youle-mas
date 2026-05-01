"""LangGraph 1.x custom-stream 推送 helper。

节点内部调 `emit("agent_start", agent_id="text_agent", phase="execute")`，
路由层 `astream(stream_mode=["updates","custom"])` 就能立刻收到该事件并转 SSE。

为什么不直接调 `get_stream_writer()`？
  - 在测试 / 离线 invoke 模式下没有 stream writer，会抛 RuntimeError；
  - 这里统一 try/except，让节点代码两种场景下都能跑（生产时推流，测试时静默）。
"""
from __future__ import annotations

from typing import Any

try:  # 1.x stable path
    from langgraph.config import get_stream_writer
except ImportError:  # pragma: no cover
    get_stream_writer = None  # type: ignore[assignment]


def emit(kind: str, **fields: Any) -> None:
    """推一条 custom 事件到 graph stream（mode='custom'）。

    路由层会拿到 dict：{"kind": kind, **fields}，直接转成 SSE。
    若不在 stream 上下文里（如 unit test），静默忽略。
    """
    if get_stream_writer is None:
        return
    try:
        writer = get_stream_writer()
    except Exception:
        return
    if writer is None:
        return
    try:
        writer({"kind": kind, **fields})
    except Exception:
        pass
