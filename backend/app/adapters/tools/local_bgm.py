"""本地 BGM 选择工具，根据主题返回预置的背景音乐文件路径。"""

from __future__ import annotations

import os

from app.logging_config import logger


def select_bgm(theme: str = "serious_warning", bgm_path: str = "./assets/bgm/default_warning.mp3") -> str | None:
    """检查指定 BGM 文件是否存在，存在则返回路径，否则返回 None。"""
    if os.path.isfile(bgm_path):
        return bgm_path
    logger.warning("bgm_not_found", path=bgm_path)
    return None
