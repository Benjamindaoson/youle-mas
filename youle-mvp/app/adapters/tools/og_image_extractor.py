"""og:image 元标签抽取工具，从网页 HTML 中提取 Open Graph 图片链接。"""

from __future__ import annotations

import httpx
from bs4 import BeautifulSoup

from app.logging_config import logger
from app.utils import check_ssrf


async def extract_og_image(news_url: str, timeout: int = 10) -> str | None:
    """请求新闻页面并解析 og:image 标签，返回图片 URL；失败返回 None。"""
    if not check_ssrf(news_url):
        return None
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(news_url)
            resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        meta = soup.find("meta", property="og:image")
        if meta and meta.get("content"):
            return meta["content"]
        return None
    except Exception as e:
        logger.warning("og_image_failed", url=news_url, error=str(e))
        return None
