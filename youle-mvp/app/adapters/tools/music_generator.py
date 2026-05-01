"""音乐生成工具（V0 占位），当前版本不生成音乐，使用本地 BGM 替代。"""

from __future__ import annotations

from app.logging_config import logger


async def generate_music(theme: str, duration_seconds: float, save_dir: str) -> str | None:
    """占位实现，V0 阶段直接跳过音乐生成，返回 None。"""
    logger.info("music_generator", action="skip", reason="V0 uses local BGM")
    return None
