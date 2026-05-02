"""V agent 可用的工具。

让"视频"能力 agent 不只是"出视频"，还能"看视频、抽字幕、切场景"。
对应用户原话：agent3 = 理解视频、生成视频、改视频（含音频）。

V1 提供 3 个工具：
    - video_probe        : ffprobe 拿视频元信息（分辨率/时长/编码）
    - extract_keyframes  : 抽 N 张关键帧（用于 vision 理解）
    - subtitle_to_script : 已有 .srt 字幕 → 拼回纯文本脚本

工具失败永不抛异常，返回带 error 的 dict。
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

from app.config import settings
from app.logging_config import logger


TOOL_DEFS: list[dict[str, Any]] = [
    {
        "name": "video_probe",
        "description": (
            "用 ffprobe 看视频元信息：duration_s / width x height / fps / "
            "video codec / audio codec / bit_rate。需要系统装 ffmpeg。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string"},
            },
            "required": ["file_path"],
        },
    },
    {
        "name": "extract_keyframes",
        "description": (
            "从视频里均匀抽 N 张关键帧到 artifacts/{sid}/video/keyframes/。"
            "适用：拿到帧后再调 image_inspect（vision）理解内容。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string"},
                "n": {"type": "integer", "default": 4,
                       "description": "抽几张，1-12"},
                "session_id": {"type": "string",
                                "description": "session_id 用于落盘到对应目录"},
            },
            "required": ["file_path", "session_id"],
        },
    },
    {
        "name": "subtitle_to_script",
        "description": (
            "把 .srt 字幕拼回纯文本脚本（去掉时间码 + 序号），按段落拼。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string"},
            },
            "required": ["file_path"],
        },
    },
]


# ============================ 工具实现 ============================


def _validate_path(file_path: str) -> tuple[str | None, dict | None]:
    abs_path = os.path.abspath(file_path)
    allowed_roots = [
        os.path.abspath(settings.UPLOAD_DIR),
        os.path.abspath(settings.ARTIFACT_DIR),
    ]
    if not any(abs_path.startswith(r) for r in allowed_roots):
        return None, {"error": "path_not_allowed", "file_path": file_path}
    if not os.path.isfile(abs_path):
        return None, {"error": "file_not_found", "file_path": file_path}
    return abs_path, None


def _ffmpeg_bin() -> str | None:
    return shutil.which("ffmpeg")


def _ffprobe_bin() -> str | None:
    return shutil.which("ffprobe")


async def video_probe(file_path: str) -> dict:
    abs_path, err = _validate_path(file_path)
    if err:
        return err
    probe = _ffprobe_bin()
    if not probe:
        return {"error": "ffprobe_missing", "hint": "需要系统安装 ffmpeg/ffprobe"}

    try:
        out = subprocess.run(  # noqa: S603
            [probe, "-v", "error", "-print_format", "json",
             "-show_format", "-show_streams", abs_path],
            capture_output=True, text=True, timeout=30, check=False,
        )
        if out.returncode != 0:
            return {"error": "ffprobe_failed", "stderr": out.stderr[:300]}
        data = json.loads(out.stdout or "{}")
    except (subprocess.TimeoutExpired, json.JSONDecodeError, OSError) as e:
        return {"error": "probe_exception", "reason": str(e)}

    fmt = data.get("format", {})
    streams = data.get("streams", []) or []
    v = next((s for s in streams if s.get("codec_type") == "video"), {})
    a = next((s for s in streams if s.get("codec_type") == "audio"), {})

    return {
        "file_path": file_path,
        "duration_s": float(fmt.get("duration", 0) or 0),
        "size_bytes": int(fmt.get("size", 0) or 0),
        "bit_rate": int(fmt.get("bit_rate", 0) or 0),
        "video": {
            "codec": v.get("codec_name", ""),
            "width": v.get("width", 0),
            "height": v.get("height", 0),
            "fps": _parse_fps(v.get("r_frame_rate", "")),
        },
        "audio": {
            "codec": a.get("codec_name", ""),
            "sample_rate": int(a.get("sample_rate", 0) or 0),
            "channels": a.get("channels", 0),
        },
    }


def _parse_fps(rate: str) -> float:
    """ffprobe r_frame_rate 形如 '30/1' 或 '24000/1001'，转成 float。"""
    try:
        if "/" in rate:
            num, den = rate.split("/", 1)
            return round(int(num) / int(den or 1), 2)
        return float(rate)
    except (ValueError, ZeroDivisionError):
        return 0.0


async def extract_keyframes(file_path: str, session_id: str, n: int = 4) -> dict:
    n = max(1, min(int(n or 4), 12))
    abs_path, err = _validate_path(file_path)
    if err:
        return err
    ff = _ffmpeg_bin()
    if not ff:
        return {"error": "ffmpeg_missing"}

    # 取 duration 做均匀采样
    probe_info = await video_probe(file_path)
    if "error" in probe_info:
        return probe_info
    dur = float(probe_info.get("duration_s") or 0)
    if dur <= 0:
        return {"error": "zero_duration"}

    safe_sid = "".join(c if c.isalnum() or c in "-_" else "_" for c in session_id)
    out_dir = os.path.join(settings.ARTIFACT_DIR, safe_sid, "video", "keyframes")
    os.makedirs(out_dir, exist_ok=True)

    paths: list[str] = []
    for i in range(n):
        t = (i + 0.5) * dur / n
        out_path = os.path.join(out_dir, f"frame_{i + 1:02d}.jpg")
        try:
            r = subprocess.run(  # noqa: S603
                [ff, "-y", "-ss", f"{t:.2f}", "-i", abs_path,
                 "-vframes", "1", "-q:v", "3", out_path],
                capture_output=True, timeout=30, check=False,
            )
            if r.returncode == 0 and os.path.isfile(out_path):
                paths.append(out_path)
        except (subprocess.TimeoutExpired, OSError) as e:
            logger.warning("keyframe_extract_failed", t=t, error=str(e))

    return {"file_path": file_path, "n_requested": n,
            "frames": paths, "duration_s": dur}


async def subtitle_to_script(file_path: str) -> dict:
    abs_path, err = _validate_path(file_path)
    if err:
        return err
    ext = Path(abs_path).suffix.lower()
    if ext not in (".srt", ".vtt"):
        return {"error": "unsupported_subtitle_format", "ext": ext}

    try:
        with open(abs_path, "r", encoding="utf-8", errors="ignore") as f:
            raw = f.read()
    except OSError as e:
        return {"error": "read_failed", "reason": str(e)}

    # 去掉序号行 / 时间码行 / 空行，留正文
    lines: list[str] = []
    for ln in raw.splitlines():
        s = ln.strip()
        if not s:
            continue
        if s.isdigit():
            continue
        # 时间码：00:00:00,000 --> 00:00:05,000
        if "-->" in s:
            continue
        if ext == ".vtt" and s.startswith("WEBVTT"):
            continue
        lines.append(s)

    return {"file_path": file_path, "script": " ".join(lines)[:8000],
            "line_count": len(lines)}


# ============================ Dispatch ============================


_TOOL_DISPATCH = {
    "video_probe": video_probe,
    "extract_keyframes": extract_keyframes,
    "subtitle_to_script": subtitle_to_script,
}


async def call_tool(name: str, tool_input: dict) -> dict:
    fn = _TOOL_DISPATCH.get(name)
    if fn is None:
        return {"error": "unknown_tool", "name": name}
    try:
        return await fn(**(tool_input or {}))
    except TypeError as e:
        return {"error": "bad_arguments", "name": name, "reason": str(e)}
    except Exception as e:  # noqa: BLE001
        logger.warning("video_tool_call_failed", name=name, error=str(e))
        return {"error": "tool_failed", "name": name, "reason": str(e)}


__all__ = ["TOOL_DEFS", "call_tool"]
