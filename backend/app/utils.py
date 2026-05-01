"""共享工具函数 — SSRF 检查、路径校验、Artifact 工厂等跨模块复用的逻辑。"""
from __future__ import annotations

import ipaddress
import re
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

from app.schemas.artifacts import Artifact, ArtifactType

# 文件/目录名安全字符白名单（ASCII 字母数字 + 下划线 + 连字符）。
# 注意：原先用 \w 会保留 Unicode 字母，在某些文件系统/工具链上仍会被拒。
_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9_\-]")

# SSRF 黑名单主机（含 IPv6 回环）
BLOCKED_HOSTS = frozenset({"localhost", "127.0.0.1", "0.0.0.0", "::1", "::"})


def safe_dir_name(name: str) -> str:
    """将任意字符串转为安全的目录名（只保留字母数字下划线连字符）。"""
    s = _UNSAFE_CHARS.sub("_", name)
    return re.sub(r"_+", "_", s).strip("_") or "default"


def validate_filename(name: str) -> bool:
    """校验文件名不含路径穿越字符。"""
    if not name:
        return False
    return ".." not in name and "/" not in name and "\\" not in name


def is_private_or_loopback(host: str) -> bool:
    """判断主机名/IP 是否为内网或回环地址（SSRF 防护）。"""
    if host in BLOCKED_HOSTS:
        return True
    try:
        ip = ipaddress.ip_address(host)
        return ip.is_private or ip.is_loopback or ip.is_reserved
    except ValueError:
        return False


def check_ssrf(url: str) -> bool:
    """检查 URL 是否安全可访问（非内网、非回环）。返回 True 表示安全。"""
    if not url or not url.startswith("http"):
        return False
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname or ""
        return not is_private_or_loopback(hostname)
    except Exception:
        return False


def make_artifact(
    artifact_type: ArtifactType,
    title: str,
    by_agent: str,
    group_id: str,
    *,
    file_path: str | None = None,
    mime_type: str | None = None,
    data: dict | None = None,
) -> Artifact:
    """Artifact 工厂函数 — 自动生成 UUID id 和时间戳，消除各 agent 的重复代码。"""
    return Artifact(
        id=f"art_{uuid.uuid4().hex}",
        type=artifact_type,
        title=title,
        by_agent=by_agent,
        group_id=group_id,
        file_path=file_path,
        mime_type=mime_type,
        data=data or {},
        created_at=datetime.now(timezone.utc),
    )
