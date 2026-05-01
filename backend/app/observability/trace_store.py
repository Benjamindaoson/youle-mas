"""SQLite trace store — 持久化 LangGraph / LangChain 节点执行记录。

设计目标：
  - 零外部依赖（标准库 sqlite3 + threading.Lock）
  - 写入路径必须快（callback hot path），所以单条 insert/update，不做 batch
  - 读取/聚合接口给 dashboard 用，写少读多

数据模型：
  traces:    每个 chain/llm/tool/custom 调用一行（含嵌套关系 parent_run_id）
  metrics:   每条 run 关联的可聚合指标（cost_usd / token_in / token_out / artifact_count）
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterable

_SCHEMA = """
CREATE TABLE IF NOT EXISTS traces (
    run_id         TEXT PRIMARY KEY,
    parent_run_id  TEXT,
    thread_id      TEXT,
    node_name      TEXT,
    kind           TEXT,                 -- chain | llm | tool | custom
    status         TEXT NOT NULL,        -- running | ok | error | interrupted
    started_at     TEXT NOT NULL,        -- ISO 8601 UTC
    ended_at       TEXT,
    duration_ms    INTEGER,
    error          TEXT,
    input_preview  TEXT,
    output_preview TEXT,
    metadata       TEXT
);

CREATE INDEX IF NOT EXISTS idx_traces_thread    ON traces(thread_id);
CREATE INDEX IF NOT EXISTS idx_traces_started   ON traces(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_parent    ON traces(parent_run_id);
CREATE INDEX IF NOT EXISTS idx_traces_node      ON traces(node_name);

CREATE TABLE IF NOT EXISTS metrics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id      TEXT NOT NULL,
    thread_id   TEXT,
    name        TEXT NOT NULL,
    value       REAL NOT NULL,
    recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_metrics_run    ON metrics(run_id);
CREATE INDEX IF NOT EXISTS idx_metrics_thread ON metrics(thread_id);
CREATE INDEX IF NOT EXISTS idx_metrics_name   ON metrics(name);
"""

_PREVIEW_LIMIT = 1000  # input/output 截断长度，避免 SQLite 行膨胀


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_preview(obj: Any, limit: int = _PREVIEW_LIMIT) -> str:
    """把任意对象转成可读 preview，避开循环引用 / 二进制 / 巨型 dict。"""
    try:
        if isinstance(obj, (str, int, float, bool)) or obj is None:
            s = str(obj)
        else:
            s = json.dumps(obj, ensure_ascii=False, default=str)
    except Exception:
        s = repr(obj)
    if len(s) > limit:
        s = s[:limit] + f"…(+{len(s) - limit} chars)"
    return s


class TraceStore:
    """同步 SQLite trace store。callback hot path 直接调用，写一行就 commit。"""

    def __init__(self, db_path: str):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
        self._lock = threading.Lock()
        with self._connect() as cx:
            cx.executescript(_SCHEMA)

    @contextmanager
    def _connect(self):
        # check_same_thread=False：FastAPI 工作线程 + asyncio 多 task 共享
        cx = sqlite3.connect(self.db_path, check_same_thread=False, timeout=5.0)
        cx.row_factory = sqlite3.Row
        try:
            yield cx
            cx.commit()
        finally:
            cx.close()

    # ---------- 写入（callback hot path） ----------

    def start_run(
        self,
        run_id: str,
        *,
        parent_run_id: str | None,
        thread_id: str | None,
        node_name: str | None,
        kind: str,
        input_preview: Any = None,
        metadata: dict | None = None,
    ) -> None:
        with self._lock, self._connect() as cx:
            cx.execute(
                """
                INSERT OR REPLACE INTO traces
                (run_id, parent_run_id, thread_id, node_name, kind, status,
                 started_at, input_preview, metadata)
                VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?)
                """,
                (run_id, parent_run_id, thread_id, node_name, kind, _utc_iso(),
                 _safe_preview(input_preview),
                 json.dumps(metadata or {}, ensure_ascii=False, default=str)),
            )

    def end_run(
        self,
        run_id: str,
        *,
        status: str = "ok",
        output_preview: Any = None,
        error: str | None = None,
    ) -> None:
        ended = _utc_iso()
        with self._lock, self._connect() as cx:
            row = cx.execute(
                "SELECT started_at FROM traces WHERE run_id = ?", (run_id,)
            ).fetchone()
            if row is None:
                # end_run 找不到对应 start（不应发生），插一行兜底
                cx.execute(
                    """
                    INSERT INTO traces
                    (run_id, kind, status, started_at, ended_at, duration_ms,
                     error, output_preview)
                    VALUES (?, 'unknown', ?, ?, ?, 0, ?, ?)
                    """,
                    (run_id, status, ended, ended, error,
                     _safe_preview(output_preview)),
                )
                return
            try:
                started = datetime.fromisoformat(row["started_at"])
                duration = int((datetime.fromisoformat(ended) - started).total_seconds() * 1000)
            except Exception:
                duration = None
            cx.execute(
                """
                UPDATE traces
                SET status = ?, ended_at = ?, duration_ms = ?,
                    error = ?, output_preview = ?
                WHERE run_id = ?
                """,
                (status, ended, duration, error,
                 _safe_preview(output_preview), run_id),
            )

    def record_metric(
        self,
        run_id: str,
        thread_id: str | None,
        name: str,
        value: float,
    ) -> None:
        with self._lock, self._connect() as cx:
            cx.execute(
                """
                INSERT INTO metrics (run_id, thread_id, name, value, recorded_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (run_id, thread_id, name, float(value), _utc_iso()),
            )

    # ---------- 读取（dashboard / API） ----------

    def list_threads(self, *, limit: int = 50, offset: int = 0) -> list[dict]:
        """按 thread_id 聚合，返回最近的若干次完整 run。"""
        sql = """
        SELECT
            thread_id,
            MIN(started_at) AS started_at,
            MAX(COALESCE(ended_at, started_at)) AS last_event_at,
            COUNT(*) AS node_count,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error_count,
            SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running_count,
            SUM(COALESCE(duration_ms, 0)) AS total_duration_ms
        FROM traces
        WHERE thread_id IS NOT NULL
        GROUP BY thread_id
        ORDER BY started_at DESC
        LIMIT ? OFFSET ?
        """
        with self._connect() as cx:
            rows = cx.execute(sql, (limit, offset)).fetchall()
        return [dict(r) for r in rows]

    def thread_timeline(self, thread_id: str) -> list[dict]:
        """单个 thread 的所有 trace（按 started_at 升序）。"""
        with self._connect() as cx:
            rows = cx.execute(
                """
                SELECT * FROM traces
                WHERE thread_id = ?
                ORDER BY started_at ASC
                """,
                (thread_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def thread_metrics(self, thread_id: str) -> dict[str, float]:
        with self._connect() as cx:
            rows = cx.execute(
                """
                SELECT name, SUM(value) AS total
                FROM metrics
                WHERE thread_id = ?
                GROUP BY name
                """,
                (thread_id,),
            ).fetchall()
        return {r["name"]: r["total"] for r in rows}

    def overall_stats(self) -> dict[str, Any]:
        """全局统计：总 thread 数、总 run 数、错误率、平均 latency、总 cost。"""
        with self._connect() as cx:
            stats = cx.execute(
                """
                SELECT
                    COUNT(DISTINCT thread_id) AS thread_count,
                    COUNT(*) AS run_count,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error_count,
                    AVG(duration_ms) AS avg_duration_ms,
                    MAX(duration_ms) AS max_duration_ms
                FROM traces
                WHERE thread_id IS NOT NULL
                """
            ).fetchone()
            cost_row = cx.execute(
                "SELECT SUM(value) AS total FROM metrics WHERE name = 'cost_usd'"
            ).fetchone()
            tokens_row = cx.execute(
                """
                SELECT name, SUM(value) AS total
                FROM metrics
                WHERE name IN ('token_in', 'token_out')
                GROUP BY name
                """
            ).fetchall()

        out = dict(stats) if stats else {}
        out["cost_usd"] = (cost_row["total"] if cost_row else 0) or 0
        for r in tokens_row:
            out[r["name"]] = r["total"] or 0
        return out

    def node_breakdown(self, *, limit_threads: int = 100) -> list[dict]:
        """按 node_name 聚合：调用次数 / 平均耗时 / 错误率。"""
        with self._connect() as cx:
            rows = cx.execute(
                """
                SELECT
                    node_name,
                    COUNT(*) AS calls,
                    AVG(duration_ms) AS avg_ms,
                    MAX(duration_ms) AS max_ms,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors
                FROM traces
                WHERE node_name IS NOT NULL AND status IN ('ok', 'error')
                GROUP BY node_name
                ORDER BY calls DESC
                """
            ).fetchall()
        return [dict(r) for r in rows]

    def purge_older_than(self, before_iso: str) -> int:
        """清理早于 before_iso 的 trace（含其 metrics）。"""
        with self._lock, self._connect() as cx:
            run_ids = [r["run_id"] for r in cx.execute(
                "SELECT run_id FROM traces WHERE started_at < ?",
                (before_iso,)).fetchall()]
            if not run_ids:
                return 0
            qs = ",".join(["?"] * len(run_ids))
            cx.execute(f"DELETE FROM metrics WHERE run_id IN ({qs})", run_ids)
            cx.execute(f"DELETE FROM traces  WHERE run_id IN ({qs})", run_ids)
        return len(run_ids)
