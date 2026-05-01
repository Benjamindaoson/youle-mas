"""静音音轨生成工具，使用 wave 模块生成指定时长的无声 WAV 文件。"""

from __future__ import annotations

import os
import uuid
import wave
import struct

MAX_DURATION_SECONDS = 600
# 每次写入的采样帧数，避免一次性分配过大内存
CHUNK_FRAMES = 44100


async def create_silent(duration_seconds: float, save_dir: str, sample_rate: int = 44100) -> str:
    """生成指定时长的静音 WAV 文件，时长上限 600 秒，返回文件路径。"""
    # 限制时长在合理范围内
    duration_seconds = min(max(duration_seconds, 0.0), MAX_DURATION_SECONDS)
    os.makedirs(save_dir, exist_ok=True)
    fname = f"silent_{uuid.uuid4().hex[:12]}.wav"
    path = os.path.join(save_dir, fname)

    total_frames = int(duration_seconds * sample_rate)
    # 预构建一个完整 chunk 的零值缓冲区，循环复用
    chunk = struct.pack(f"<{CHUNK_FRAMES}h", *([0] * CHUNK_FRAMES))

    with wave.open(path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        written = 0
        while written < total_frames:
            remaining = total_frames - written
            if remaining >= CHUNK_FRAMES:
                wf.writeframes(chunk)
                written += CHUNK_FRAMES
            else:
                # 尾部不足一个 chunk 时单独打包
                small = struct.pack(f"<{remaining}h", *([0] * remaining))
                wf.writeframes(small)
                written += remaining

    return path
