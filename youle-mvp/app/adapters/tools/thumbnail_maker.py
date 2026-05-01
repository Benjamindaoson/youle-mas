"""缩略图生成工具，优先从视频截取帧，回退到缩放图片或纯色占位图。"""

from __future__ import annotations

import asyncio
import os
import shutil
import uuid

from PIL import Image

from app.logging_config import logger


async def create_thumbnail(
    video_path: str | None, save_dir: str, fallback_image: str | None = None,
) -> str:
    """生成视频缩略图，按优先级尝试: FFmpeg 截帧 -> 缩放备选图 -> 纯色占位图。"""
    os.makedirs(save_dir, exist_ok=True)
    out = os.path.join(save_dir, f"thumb_{uuid.uuid4().hex}.jpg")

    # 优先使用 FFmpeg 从视频第 3 秒截取一帧
    if video_path and shutil.which("ffmpeg"):
        try:
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y", "-i", video_path, "-ss", "00:00:03",
                "-vframes", "1", out,
                stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(proc.wait(), timeout=15)
            if os.path.isfile(out):
                return out
        except Exception as e:
            logger.warning("thumbnail_ffmpeg_failed", error=str(e))

    # 回退方案: 缩放备选图片
    if fallback_image and os.path.isfile(fallback_image):
        img = Image.open(fallback_image)
        img = img.resize((640, 640), Image.LANCZOS)
        img.save(out, "JPEG", quality=85)
        return out

    # 最终兜底: 生成深灰色纯色图
    img = Image.new("RGB", (640, 640), color=(50, 50, 50))
    img.save(out, "JPEG")
    return out
