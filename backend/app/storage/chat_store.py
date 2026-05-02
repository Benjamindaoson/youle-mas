"""聊天历史的 SQLite 存储后端。

替换 V0 的 ./data/history/*.json 单文件方案。

API（与 routes.py 用法对齐）：
    load_all() -> dict[str, list[dict]]      # 启动时一次性把全部 session load 到内存 cache
    save_session(sid, turns)                  # 落盘整 session（保持简单；turns 列表多写但 SQLite IO 快）
    delete_session(sid) -> bool

为了平滑过渡，启动时会把残留的 ./data/history/*.json 一次性 import 进 SQLite，
import 完成后将旧 JSON 重命名为 .json.imported 防止再次重复入库。
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from pathlib import Path

from app.config import settings
from app.logging_config import logger


_DB_PATH = Path(settings.ARTIFACT_DIR).parent / "chat_history.db"
_LEGACY_JSON_DIR = Path("./data/history")

# SQLite 单 connection + 应用层锁；MVP 单 worker 够用，多 worker 上 Postgres
_LOCK = threading.Lock()
_CONN: sqlite3.Connection | None = None


def _get_conn() -> sqlite3.Connection:
    global _CONN
    if _CONN is None:
        _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _CONN = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
        _CONN.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                session_id TEXT PRIMARY KEY,
                turns_json TEXT NOT NULL,
                updated_at REAL NOT NULL DEFAULT (julianday('now'))
            )
        """)
        _CONN.commit()
        logger.info("chat_store_initialized", path=str(_DB_PATH))
    return _CONN


def save_session(session_id: str, turns: list[dict]) -> None:
    """整 session 落盘（覆盖式）。turns 是 routes.CHAT_HISTORY[sid] 的当前快照。"""
    payload = json.dumps(turns, ensure_ascii=False)
    with _LOCK:
        c = _get_conn()
        c.execute(
            "INSERT INTO chat_sessions(session_id, turns_json) VALUES(?, ?) "
            "ON CONFLICT(session_id) DO UPDATE SET turns_json=excluded.turns_json, "
            "updated_at=julianday('now')",
            (session_id, payload),
        )
        c.commit()


def delete_session(session_id: str) -> bool:
    with _LOCK:
        c = _get_conn()
        cur = c.execute("DELETE FROM chat_sessions WHERE session_id=?", (session_id,))
        c.commit()
        return cur.rowcount > 0


def load_all() -> dict[str, list[dict]]:
    """启动时一次性加载所有 session（含从旧 JSON 平滑迁移）。"""
    _import_legacy_json_once()
    with _LOCK:
        c = _get_conn()
        rows = c.execute("SELECT session_id, turns_json FROM chat_sessions").fetchall()
    out: dict[str, list[dict]] = {}
    for sid, payload in rows:
        try:
            turns = json.loads(payload)
            if isinstance(turns, list):
                out[sid] = turns
        except json.JSONDecodeError as e:
            logger.warning("chat_store_load_corrupt", sid=sid, error=str(e))
    logger.info("chat_store_loaded", session_count=len(out))
    return out


def _import_legacy_json_once() -> None:
    """把残留的 ./data/history/*.json 一次性导入 SQLite。导入后改名 .imported 防重。"""
    if not _LEGACY_JSON_DIR.is_dir():
        return
    imported = 0
    for f in _LEGACY_JSON_DIR.glob("*.json"):
        try:
            turns = json.loads(f.read_text(encoding="utf-8"))
            if not isinstance(turns, list):
                continue
            sid = f.stem.replace("_", ":", 1)
            save_session(sid, turns)
            os.replace(str(f), str(f) + ".imported")
            imported += 1
        except (OSError, json.JSONDecodeError) as e:
            logger.warning("chat_store_legacy_import_failed", file=str(f), error=str(e))
    if imported:
        logger.info("chat_store_legacy_imported", count=imported)


__all__ = ["load_all", "save_session", "delete_session"]
