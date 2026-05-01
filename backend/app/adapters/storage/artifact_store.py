"""Artifact 存储服务 — 管理产出物的元数据和文件落盘。

存储结构：data/artifacts/{safe_group_id}/{artifact_id}.meta.json
文件本体由各 agent 直接写入，ArtifactStore 只记录元数据和路径。
内置路径穿越防护：所有路径操作都经过 realpath 校验。
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

import aiofiles

from app.schemas.artifacts import Artifact

_SAFE_NAME_RE = re.compile(r"^[\w\-]+$")
_UNSAFE_CHARS = re.compile(r"[^\w\-]")


def _safe_dir_name(name: str) -> str:
    s = _UNSAFE_CHARS.sub("_", name)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "default"


def _validate_path_component(name: str) -> bool:
    if not name or ".." in name or "/" in name or "\\" in name:
        return False
    return True


class ArtifactStore:
    def __init__(self, base_dir: str = "./data/artifacts"):
        self.base_dir = os.path.abspath(base_dir)

    def _session_dir(self, session_id: str) -> str:
        safe = _safe_dir_name(session_id)
        return os.path.join(self.base_dir, safe)

    def _ensure_within_base(self, path: str) -> bool:
        # 使用 Path.resolve() + is_relative_to，规避 startswith 的前缀混淆漏洞
        # （如 /data/artifacts 与 /data/artifactsX 都以同一前缀开头）
        try:
            real = Path(path).resolve()
            base = Path(self.base_dir).resolve()
            return real == base or base in real.parents
        except (OSError, ValueError):
            return False

    async def save(self, artifact: Artifact, content: bytes | None = None) -> Artifact:
        d = self._session_dir(artifact.group_id)
        os.makedirs(d, exist_ok=True)

        if not self._ensure_within_base(d):
            raise ValueError("path traversal blocked")

        meta_path = os.path.join(d, f"{artifact.id}.meta.json")
        async with aiofiles.open(meta_path, "w", encoding="utf-8") as f:
            await f.write(artifact.model_dump_json(indent=2))

        if content and artifact.file_path:
            fname = os.path.basename(artifact.file_path)
            full = os.path.join(d, fname)
            artifact.file_path = full
            mode = "wb" if isinstance(content, bytes) else "w"
            async with aiofiles.open(full, mode) as f:
                await f.write(content)
            async with aiofiles.open(meta_path, "w", encoding="utf-8") as f:
                await f.write(artifact.model_dump_json(indent=2))

        return artifact

    async def save_file(self, artifact: Artifact, src_path: str) -> Artifact:
        d = self._session_dir(artifact.group_id)
        os.makedirs(d, exist_ok=True)
        if not self._ensure_within_base(d):
            raise ValueError("path traversal blocked")
        artifact.file_path = src_path

        meta_path = os.path.join(d, f"{artifact.id}.meta.json")
        async with aiofiles.open(meta_path, "w", encoding="utf-8") as f:
            await f.write(artifact.model_dump_json(indent=2))
        return artifact

    async def list_by_group(self, group_id: str) -> list[Artifact]:
        d = self._session_dir(group_id)
        if not os.path.isdir(d):
            return []
        results = []
        for name in os.listdir(d):
            if not name.endswith(".meta.json"):
                continue
            meta = os.path.join(d, name)
            try:
                async with aiofiles.open(meta, "r", encoding="utf-8") as f:
                    data = json.loads(await f.read())
                results.append(Artifact(**data))
            except (json.JSONDecodeError, OSError):
                continue
        return results

    async def get(self, artifact_id: str) -> Artifact | None:
        if not _validate_path_component(artifact_id):
            return None
        for group_name in os.listdir(self.base_dir):
            meta = os.path.join(self.base_dir, group_name, f"{artifact_id}.meta.json")
            if os.path.isfile(meta):
                try:
                    async with aiofiles.open(meta, "r", encoding="utf-8") as f:
                        return Artifact(**json.loads(await f.read()))
                except (json.JSONDecodeError, OSError):
                    return None
        return None

    async def get_file_path(self, artifact_id: str) -> str | None:
        if not _validate_path_component(artifact_id):
            return None
        art = await self.get(artifact_id)
        if not art or not art.file_path:
            return None
        if not self._ensure_within_base(art.file_path):
            return None
        path = str(Path(art.file_path).resolve())
        if not os.path.isfile(path):
            return None
        return path
