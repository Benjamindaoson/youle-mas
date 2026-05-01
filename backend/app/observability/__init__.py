"""本地可观测性模块 — SQLite trace + LangChain callback + 内嵌 dashboard。

零外部依赖（不需要 LangSmith / Langfuse / Phoenix），所有 trace 落到
`./data/observability/traces.db`，dashboard 走 FastAPI 直接 serve。
"""
from app.observability.trace_store import TraceStore  # noqa: F401
from app.observability.callback import LocalTraceCallback  # noqa: F401
