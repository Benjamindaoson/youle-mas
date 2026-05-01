"""TraceStore + LocalTraceCallback 单测。"""
from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.observability.callback import LocalTraceCallback
from app.observability.trace_store import TraceStore


@pytest.fixture
def store(tmp_path):
    return TraceStore(str(tmp_path / "obs.db"))


# ---------- TraceStore 基础 ----------

def test_start_then_end_run_records_duration(store):
    rid = str(uuid4())
    store.start_run(rid, parent_run_id=None, thread_id="t1",
                    node_name="orchestrator", kind="chain",
                    input_preview={"goal": "x"})
    time.sleep(0.02)
    store.end_run(rid, status="ok", output_preview={"ok": True})

    timeline = store.thread_timeline("t1")
    assert len(timeline) == 1
    row = timeline[0]
    assert row["status"] == "ok"
    assert row["duration_ms"] is not None and row["duration_ms"] >= 10
    assert "goal" in row["input_preview"]


def test_end_run_with_error_marks_status(store):
    rid = str(uuid4())
    store.start_run(rid, parent_run_id=None, thread_id="t2",
                    node_name="text_agent", kind="chain")
    store.end_run(rid, status="error", error="boom")
    rows = store.thread_timeline("t2")
    assert rows[0]["status"] == "error"
    assert rows[0]["error"] == "boom"


def test_orphan_end_run_creates_stub(store):
    rid = str(uuid4())
    store.end_run(rid, status="ok", output_preview="late")
    # 找不到 thread_id 但应该不崩
    rows = store.thread_timeline("none")
    assert rows == []


def test_metrics_aggregation(store):
    rid = str(uuid4())
    store.start_run(rid, parent_run_id=None, thread_id="t3",
                    node_name="image_agent", kind="chain")
    store.record_metric(rid, "t3", "cost_usd", 0.001)
    store.record_metric(rid, "t3", "cost_usd", 0.0025)
    store.record_metric(rid, "t3", "token_in", 120)
    store.end_run(rid, status="ok")

    m = store.thread_metrics("t3")
    assert m["cost_usd"] == pytest.approx(0.0035)
    assert m["token_in"] == 120


def test_list_threads_returns_recent_first(store):
    for i in range(3):
        rid = str(uuid4())
        store.start_run(rid, parent_run_id=None, thread_id=f"t_{i}",
                        node_name="orchestrator", kind="chain")
        store.end_run(rid, status="ok")
        time.sleep(0.005)
    items = store.list_threads(limit=10)
    assert [i["thread_id"] for i in items][0] == "t_2"
    assert len(items) == 3


def test_overall_stats_counts_errors_and_cost(store):
    for status in ["ok", "ok", "error"]:
        rid = str(uuid4())
        store.start_run(rid, parent_run_id=None, thread_id="ts",
                        node_name="x", kind="chain")
        store.end_run(rid, status=status, error="e" if status == "error" else None)
        store.record_metric(rid, "ts", "cost_usd", 0.01)

    s = store.overall_stats()
    assert s["thread_count"] == 1
    assert s["run_count"] == 3
    assert s["error_count"] == 1
    assert s["cost_usd"] == pytest.approx(0.03)


def test_node_breakdown_groups_by_node(store):
    for n in ["text_agent", "text_agent", "image_agent"]:
        rid = str(uuid4())
        store.start_run(rid, parent_run_id=None, thread_id="t",
                        node_name=n, kind="chain")
        store.end_run(rid, status="ok")
    items = {r["node_name"]: r for r in store.node_breakdown()}
    assert items["text_agent"]["calls"] == 2
    assert items["image_agent"]["calls"] == 1


def test_purge_removes_old_rows(store):
    rid_old = str(uuid4())
    store.start_run(rid_old, parent_run_id=None, thread_id="t",
                    node_name="x", kind="chain")
    store.end_run(rid_old, status="ok")
    # 把这一条改成 8 天前
    import sqlite3
    cx = sqlite3.connect(store.db_path)
    cx.execute("UPDATE traces SET started_at = ? WHERE run_id = ?",
               ((datetime.now(timezone.utc) - timedelta(days=8)).isoformat(), rid_old))
    cx.commit(); cx.close()

    rid_new = str(uuid4())
    store.start_run(rid_new, parent_run_id=None, thread_id="t",
                    node_name="x", kind="chain")
    store.end_run(rid_new, status="ok")

    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    n = store.purge_older_than(cutoff)
    assert n == 1
    timeline = store.thread_timeline("t")
    assert len(timeline) == 1
    assert timeline[0]["run_id"] == rid_new


# ---------- LocalTraceCallback 集成 ----------

def test_callback_records_chain_lifecycle(store):
    cb = LocalTraceCallback(store)
    rid = uuid4()

    cb.on_chain_start(
        serialized={"name": "orchestrator"},
        inputs={"user_goal": "x"},
        run_id=rid,
        metadata={"thread_id": "cb_t1", "langgraph_node": "orchestrator"},
    )
    cb.on_chain_end(outputs={"phase": "done"}, run_id=rid)

    rows = store.thread_timeline("cb_t1")
    assert len(rows) == 1
    assert rows[0]["node_name"] == "orchestrator"
    assert rows[0]["status"] == "ok"


def test_callback_classifies_interrupt_as_interrupted(store):
    cb = LocalTraceCallback(store)
    rid = uuid4()

    cb.on_chain_start(serialized={"name": "approval_gate"},
                      inputs={}, run_id=rid,
                      metadata={"thread_id": "cb_t2",
                                "langgraph_node": "approval_gate"})

    # 模拟 GraphInterrupt：类名包含 "Interrupt"
    class GraphInterrupt(Exception):
        pass
    cb.on_chain_error(GraphInterrupt("await approval"), run_id=rid)

    rows = store.thread_timeline("cb_t2")
    assert rows[0]["status"] == "interrupted"


def test_callback_swallows_store_errors(monkeypatch, store):
    """callback 永远不应让 store 异常打断 graph 执行。"""
    cb = LocalTraceCallback(store)

    def boom(*a, **kw):
        raise RuntimeError("DB down")
    monkeypatch.setattr(store, "start_run", boom)

    # 不应抛出
    cb.on_chain_start(serialized={"name": "x"}, inputs={},
                      run_id=uuid4(), metadata={"thread_id": "x"})
