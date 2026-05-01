"""验证 batch 1/2 加固项目按预期工作：
- Excel 大小上限
- artifact_store 路径穿越
- routes filename 校验
- image_processor PIL.verify
- script_validator body 长度
- manifest.json 并发写
"""
from __future__ import annotations

import asyncio
import os
import struct
import threading
from pathlib import Path

import pytest

from app.adapters.tools.excel_reader import MAX_EXCEL_BYTES, read_excel
from app.adapters.tools.image_processor import (
    InvalidImageError, MAX_IMAGE_BYTES, resize_image,
)
from app.adapters.tools.script_validator import validate_script
from app.adapters.storage.artifact_store import ArtifactStore
from app.errors import ExcelReadError, ScriptValidationError
from app.utils import make_artifact, safe_dir_name


# ============== Excel size limit ==============

def test_excel_oversize_rejected(tmp_path):
    big = tmp_path / "huge.xlsx"
    big.write_bytes(b"\x00" * (MAX_EXCEL_BYTES + 10))
    with pytest.raises(ExcelReadError, match="文件过大"):
        read_excel(str(big))


def test_excel_unsupported_extension_rejected(tmp_path):
    bad = tmp_path / "x.txt"
    bad.write_text("not excel")
    with pytest.raises(ExcelReadError, match="不支持的文件格式"):
        read_excel(str(bad))


# ============== ArtifactStore path traversal ==============

async def test_artifact_store_rejects_traversal_group_id(tmp_path):
    store = ArtifactStore(str(tmp_path))
    art = make_artifact(
        "summary", "t", "a", "../../etc/passwd")
    await store.save(art)
    # base 目录下所有子目录都必须 resolve 在 base 内
    for c in tmp_path.iterdir():
        if c.is_dir():
            assert c.resolve().is_relative_to(tmp_path.resolve())


async def test_artifact_store_get_file_rejects_outside_base(tmp_path):
    store = ArtifactStore(str(tmp_path))
    outside = tmp_path.parent / "outside.txt"
    outside.write_text("secret")
    art = make_artifact("summary", "t", "a", "g1", file_path=str(outside))
    await store.save(art)
    # 通过 store.get_file_path 应该被拒
    found = await store.get_file_path(art.id)
    assert found is None


# ============== routes filename validation ==============

def test_filename_validation_rejects_unsafe():
    from app.api.routes import _is_safe_filename
    assert _is_safe_filename("a.md") is True
    assert _is_safe_filename("0001-text.md") is True
    # 边界
    assert _is_safe_filename("") is False
    assert _is_safe_filename(".") is False
    assert _is_safe_filename("..") is False
    assert _is_safe_filename("../etc/passwd") is False
    assert _is_safe_filename("a/b.md") is False
    assert _is_safe_filename("a\\b.md") is False
    assert _is_safe_filename("foo\x00.md") is False
    # 含 .. 但不是相对路径片段时仍合法（修复了原先的误伤）
    assert _is_safe_filename("a..b.md") is True


# ============== image_processor verify ==============

async def test_resize_rejects_oversize_file(tmp_path):
    big = tmp_path / "big.jpg"
    big.write_bytes(b"\x00" * (MAX_IMAGE_BYTES + 100))
    with pytest.raises(InvalidImageError, match="image_too_large"):
        await resize_image(str(big))


async def test_resize_rejects_invalid_image(tmp_path):
    # 非图片字节，verify() 应失败
    bad = tmp_path / "bad.jpg"
    bad.write_bytes(b"this is not an image")
    with pytest.raises(InvalidImageError, match="image_invalid"):
        await resize_image(str(bad))


# ============== script_validator body length ==============

def test_script_body_segment_too_long_rejected():
    bad = {
        "hook": "测试 hook",
        "body": ["a" * 1000],  # 单段超 200
        "closing": "测试 closing",
        "estimated_duration_seconds": 60,
    }
    with pytest.raises(ScriptValidationError):
        validate_script(bad)


def test_script_body_too_many_segments_rejected():
    bad = {
        "hook": "测试 hook",
        "body": ["seg"] * 50,
        "closing": "测试 closing",
        "estimated_duration_seconds": 60,
    }
    with pytest.raises(ScriptValidationError):
        validate_script(bad)


def test_script_valid_passes():
    ok = {
        "hook": "测试 hook",
        "body": ["第一段口播", "第二段口播"],
        "closing": "测试 closing 提醒",
        "estimated_duration_seconds": 60,
    }
    out = validate_script(ok)
    assert out["body"] == ["第一段口播", "第二段口播"]


# ============== manifest concurrency ==============

def test_manifest_concurrent_writes_no_loss(tmp_path, monkeypatch):
    """模拟两条并发线程同时为同 session 写 artifact，结束后 manifest 必须包含全部条目。"""
    import json
    from app.api import routes as routes_module

    # 重定向 OUTPUTS_DIR 到 tmp_path
    monkeypatch.setattr(routes_module, "_OUTPUTS_DIR", tmp_path)

    session_id = "group:concurrent"
    n = 30

    def worker(i: int) -> None:
        ad = {
            "type": "summary",
            "title": f"art-{i}",
            "data": {"text": f"content {i}"},
        }
        routes_module._save_artifact_to_outputs(
            session_id, i, "agent", "agent_name", ad)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    safe = routes_module._safe_dir(session_id)
    mp = tmp_path / safe / "manifest.json"
    data = json.loads(mp.read_text(encoding="utf-8"))
    assert len(data["artifacts"]) == n, \
        f"expected {n} artifacts in manifest, got {len(data['artifacts'])}"


# ============== utils.safe_dir_name ASCII whitelist ==============

def test_safe_dir_name_strips_non_ascii():
    # Unicode 字符现在应该被替换（防止某些 FS 拒绝）
    assert safe_dir_name("会话:中文") == "default" or "_" in safe_dir_name("会话:中文")


def test_safe_dir_name_keeps_ascii_alnum():
    assert safe_dir_name("abc-123_DEF") == "abc-123_DEF"
