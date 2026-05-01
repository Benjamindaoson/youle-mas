"""FFmpeg 视频合成工具，将图片序列、语音、BGM 和字幕合成为最终视频。"""

from __future__ import annotations

import asyncio
import os
import shutil

import aiofiles

from app.logging_config import logger
from app.errors import FFmpegError


async def compose_news_video(
    images: list[str],
    voice: str,
    bgm: str,
    bgm_volume_db: float,
    subtitles: str,
    output: str,
    per_image_duration: float,
    resolution: str = "1024x1024",
    encoding: dict | None = None,
    timeout: int = 120,
) -> str | None:
    """将图片序列与音频合成为视频文件，支持 BGM 混音和自定义编码参数。"""
    if not shutil.which("ffmpeg"):
        logger.warning("ffmpeg_missing, cannot compose video")
        return None

    enc = encoding or {}
    w, h = resolution.split("x")
    os.makedirs(os.path.dirname(output), exist_ok=True)

    # 生成 FFmpeg concat 协议所需的文件列表
    concat_file = output + ".concat.txt"
    lines: list[str] = []
    for img in images:
        abs_path = os.path.abspath(img).replace("\\", "/")
        lines.append(f"file '{abs_path}'")
        lines.append(f"duration {per_image_duration}")
    # concat 协议要求最后一张图片重复声明以确保时长正确
    if images:
        abs_path = os.path.abspath(images[-1]).replace("\\", "/")
        lines.append(f"file '{abs_path}'")

    async with aiofiles.open(concat_file, "w", encoding="utf-8") as f:
        await f.write("\n".join(lines))

    # 构建 FFmpeg 命令: 视频缩放+填充、BGM 降音量后与语音混音
    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0", "-i", concat_file,
        "-i", voice, "-i", bgm,
        "-filter_complex",
        f"[0:v]scale={w}:{h}:force_original_aspect_ratio=decrease,"
        f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v];"
        f"[2:a]volume={bgm_volume_db}dB[bgm];"
        f"[1:a][bgm]amix=inputs=2:duration=first[a]",
        "-map", "[v]", "-map", "[a]",
        "-c:v", enc.get("video_codec", "libx264"),
        "-pix_fmt", enc.get("pixel_format", "yuv420p"),
        "-c:a", enc.get("audio_codec", "aac"),
        "-movflags", enc.get("movflags", "+faststart"),
        "-shortest", output,
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        if proc.returncode != 0:
            raise FFmpegError(f"FFmpeg failed: {stderr.decode()[-500:]}")
    except asyncio.TimeoutError:
        proc.kill()
        raise FFmpegError("FFmpeg timed out")
    finally:
        # 清理临时 concat 文件
        if os.path.isfile(concat_file):
            os.remove(concat_file)

    if not os.path.isfile(output):
        raise FFmpegError("FFmpeg produced no output file")
    return output
