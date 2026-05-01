"""LangChain BaseCallbackHandler 实现 — 把每次节点 / LLM / tool 调用写入 TraceStore。

LangGraph 1.x 在每次节点执行时会触发 on_chain_start/end，name 字段就是 graph
节点名（'orchestrator' / 'text_agent' 等）。我们在 metadata['langgraph_step'] /
metadata['langgraph_node'] 还能拿到 super-step 序号。

LLM 调用（暂未集成 langchain LLM，但保留接口）会触发 on_llm_start/end，
response.llm_output 通常含 token_usage 信息。
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from langchain_core.callbacks import BaseCallbackHandler

from app.observability.trace_store import TraceStore


def _thread_id_from_metadata(metadata: dict | None) -> str | None:
    """LangGraph callback metadata 里有 thread_id（来自 config['configurable']）。"""
    if not metadata:
        return None
    return metadata.get("thread_id") or metadata.get("langgraph_thread_id")


def _node_name(serialized: dict | None, kwargs: dict, metadata: dict | None) -> str | None:
    """优先用 LangGraph 注入的 langgraph_node，否则回退到 serialized.name / kwargs.name。"""
    if metadata and metadata.get("langgraph_node"):
        return metadata["langgraph_node"]
    if kwargs.get("name"):
        return kwargs["name"]
    if serialized and isinstance(serialized, dict):
        return serialized.get("name") or serialized.get("id", [None])[-1]
    return None


def _classify(serialized: dict | None, metadata: dict | None) -> str:
    if metadata and metadata.get("langgraph_node"):
        return "node"
    if serialized and isinstance(serialized, dict):
        kind = serialized.get("kwargs", {}).get("_type")
        if kind:
            return str(kind)
    return "chain"


class LocalTraceCallback(BaseCallbackHandler):
    """把所有 LangGraph / LangChain 事件写入本地 SQLite trace store。"""

    # 全部回调都是同步的；写 SQLite 是 hot path 但单条 INSERT，~1ms
    raise_error = False  # 永远不要因为 callback 异常打断 graph

    def __init__(self, store: TraceStore):
        self.store = store

    # ---------- chain (= LangGraph node) ----------

    def on_chain_start(self, serialized, inputs, *, run_id: UUID,
                       parent_run_id: UUID | None = None,
                       tags: list[str] | None = None,
                       metadata: dict | None = None, **kwargs: Any) -> Any:
        try:
            self.store.start_run(
                str(run_id),
                parent_run_id=str(parent_run_id) if parent_run_id else None,
                thread_id=_thread_id_from_metadata(metadata),
                node_name=_node_name(serialized, kwargs, metadata),
                kind=_classify(serialized, metadata),
                input_preview=inputs,
                metadata={"tags": tags or [], **(metadata or {})},
            )
        except Exception:
            pass

    def on_chain_end(self, outputs, *, run_id: UUID,
                     parent_run_id: UUID | None = None, **kwargs: Any) -> Any:
        try:
            self.store.end_run(str(run_id), status="ok", output_preview=outputs)
        except Exception:
            pass

    def on_chain_error(self, error: BaseException, *, run_id: UUID,
                       parent_run_id: UUID | None = None, **kwargs: Any) -> Any:
        try:
            err_str = f"{type(error).__name__}: {error}"
            # GraphInterrupt 不算错误，标 interrupted
            status = "interrupted" if "Interrupt" in type(error).__name__ else "error"
            self.store.end_run(str(run_id), status=status, error=err_str)
        except Exception:
            pass

    # ---------- LLM ----------

    def on_llm_start(self, serialized, prompts, *, run_id: UUID,
                     parent_run_id: UUID | None = None,
                     tags: list[str] | None = None,
                     metadata: dict | None = None, **kwargs: Any) -> Any:
        try:
            self.store.start_run(
                str(run_id),
                parent_run_id=str(parent_run_id) if parent_run_id else None,
                thread_id=_thread_id_from_metadata(metadata),
                node_name=_node_name(serialized, kwargs, metadata) or "llm",
                kind="llm",
                input_preview={"prompts": prompts},
                metadata={"tags": tags or [], **(metadata or {})},
            )
        except Exception:
            pass

    def on_llm_end(self, response, *, run_id: UUID,
                   parent_run_id: UUID | None = None, **kwargs: Any) -> Any:
        try:
            text = ""
            try:
                gens = getattr(response, "generations", None) or []
                if gens and gens[0]:
                    text = getattr(gens[0][0], "text", "") or ""
            except Exception:
                pass
            self.store.end_run(str(run_id), status="ok", output_preview=text)
            # 提取 token usage（如果有）
            try:
                llm_out = getattr(response, "llm_output", None) or {}
                usage = llm_out.get("token_usage") or llm_out.get("usage") or {}
                t_in = usage.get("prompt_tokens") or usage.get("input_tokens") or 0
                t_out = usage.get("completion_tokens") or usage.get("output_tokens") or 0
                if t_in:
                    self.store.record_metric(str(run_id), None, "token_in", t_in)
                if t_out:
                    self.store.record_metric(str(run_id), None, "token_out", t_out)
            except Exception:
                pass
        except Exception:
            pass

    def on_llm_error(self, error: BaseException, *, run_id: UUID,
                     parent_run_id: UUID | None = None, **kwargs: Any) -> Any:
        try:
            self.store.end_run(str(run_id), status="error",
                               error=f"{type(error).__name__}: {error}")
        except Exception:
            pass

    # ---------- Tool ----------

    def on_tool_start(self, serialized, input_str, *, run_id: UUID,
                      parent_run_id: UUID | None = None,
                      tags: list[str] | None = None,
                      metadata: dict | None = None, **kwargs: Any) -> Any:
        try:
            self.store.start_run(
                str(run_id),
                parent_run_id=str(parent_run_id) if parent_run_id else None,
                thread_id=_thread_id_from_metadata(metadata),
                node_name=_node_name(serialized, kwargs, metadata) or "tool",
                kind="tool",
                input_preview=input_str,
                metadata={"tags": tags or [], **(metadata or {})},
            )
        except Exception:
            pass

    def on_tool_end(self, output, *, run_id: UUID,
                    parent_run_id: UUID | None = None, **kwargs: Any) -> Any:
        try:
            self.store.end_run(str(run_id), status="ok", output_preview=output)
        except Exception:
            pass

    def on_tool_error(self, error: BaseException, *, run_id: UUID,
                      parent_run_id: UUID | None = None, **kwargs: Any) -> Any:
        try:
            self.store.end_run(str(run_id), status="error",
                               error=f"{type(error).__name__}: {error}")
        except Exception:
            pass

    # ---------- 自定义事件（LangGraph emit() / writer） ----------

    def on_custom_event(self, name: str, data: Any, *, run_id: UUID,
                        tags: list[str] | None = None,
                        metadata: dict | None = None, **kwargs: Any) -> Any:
        # custom 事件不开 run，只作为单点记录（用 run_id + 'custom-' 后缀避免冲突）
        try:
            stub_id = f"custom-{run_id}-{name}"
            now_thread = _thread_id_from_metadata(metadata)
            self.store.start_run(
                stub_id,
                parent_run_id=str(run_id),
                thread_id=now_thread,
                node_name=name,
                kind="custom",
                input_preview=data,
                metadata={"tags": tags or [], **(metadata or {})},
            )
            self.store.end_run(stub_id, status="ok", output_preview=data)
        except Exception:
            pass
