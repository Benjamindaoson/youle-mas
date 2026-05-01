"""ffprobe 视频元数据检查工具，提取视频时长、编码格式和分辨率信息。"""

from __future__ import annotations

import asyncio
import json
import shutil

from app.logging_config import logger


async def inspect_video(path: str) -> dict:
    """使用 ffprobe 提取视频元数据，返回包含时长、编码、宽高的字典。"""
    if not shutil.which("ffprobe"):
        logger.warning("ffprobe_missing, returning mock metadata")
        return {"duration": 0, "codec": "unknown", "width": 0, "height": 0, "note": "ffprobe not available"}

    try:
        proc = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_format", "-show_streams", path,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
        data = json.loads(stdout.decode())

        duration = float(data.get("format", {}).get("duration", 0))
        # 从流列表中找到第一个视频流
        video_stream = next((s for s in data.get("streams", []) if s["codec_type"] == "video"), {})
        return {
            "duration": duration,
            "codec": video_stream.get("codec_name", "unknown"),
            "width": int(video_stream.get("width", 0)),
            "height": int(video_stream.get("height", 0)),
        }
    except Exception as e:
        logger.warning("ffprobe_failed", error=str(e))
        return {"duration": 0, "codec": "unknown", "width": 0, "height": 0}
