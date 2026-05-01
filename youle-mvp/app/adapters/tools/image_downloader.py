"""图片下载工具，支持异步下载并内置 SSRF 防护和文件大小限制。"""

from __future__ import annotations

import os
import uuid

import aiofiles
import httpx

from app.logging_config import logger
from app.utils import check_ssrf


async def download_image(
    url: str, save_dir: str, timeout: int = 10, max_size_mb: int = 10,
) -> str | None:
    """从 URL 异步下载图片并保存到本地，返回文件路径；失败返回 None。"""
    # 先做 SSRF 检查，防止请求内网地址
    if not check_ssrf(url):
        return None
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()

            ct = resp.headers.get("content-type", "")
            if not ct.startswith("image/"):
                return None
            if len(resp.content) > max_size_mb * 1024 * 1024:
                return None

            # 根据 Content-Type 推断扩展名
            ext = "jpg"
            if "png" in ct:
                ext = "png"
            elif "webp" in ct:
                ext = "webp"

            os.makedirs(save_dir, exist_ok=True)
            fname = f"{uuid.uuid4().hex}.{ext}"
            path = os.path.join(save_dir, fname)
            async with aiofiles.open(path, "wb") as f:
                await f.write(resp.content)
            return path
    except Exception as e:
        logger.warning("image_download_failed", url=url, error=str(e))
        return None
