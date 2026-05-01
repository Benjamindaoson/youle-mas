"""SRT 字幕生成工具，根据脚本内容和音频时长生成等分时间轴的字幕文件。"""

from __future__ import annotations

import os

import aiofiles


async def script_to_srt(script: dict, audio_duration: float, save_dir: str) -> str:
    """将脚本的 hook/body/closing 拆分为字幕段落，按音频时长等分时间轴并写入 SRT 文件。"""
    segments: list[str] = []
    if script.get("hook"):
        segments.append(script["hook"])
    segments.extend(script.get("body", []))
    if script.get("closing"):
        segments.append(script["closing"])
    if not segments:
        segments = ["..."]

    # 每段字幕均分总时长
    per_seg = audio_duration / len(segments)
    lines: list[str] = []
    for i, text in enumerate(segments):
        start = i * per_seg
        end = (i + 1) * per_seg
        lines.append(str(i + 1))
        lines.append(f"{_fmt(start)} --> {_fmt(end)}")
        lines.append(text)
        lines.append("")

    os.makedirs(save_dir, exist_ok=True)
    path = os.path.join(save_dir, "subtitles.srt")
    async with aiofiles.open(path, "w", encoding="utf-8") as f:
        await f.write("\n".join(lines))
    return path


def _fmt(seconds: float) -> str:
    """将秒数格式化为 SRT 时间戳格式 HH:MM:SS,mmm。"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
