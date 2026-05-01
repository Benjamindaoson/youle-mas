"""图片 Agent（素材侦探）— 为每条新闻准备配图，4 级 fallback 保证不崩。

Fallback 链路：
  1. Excel 中的 image_url → 直接下载
  2. 新闻 URL 的 og:image → 抽取后下载
  3. AI 图片模型 → 生成警示风格图
  4. Pillow 占位图 → 永远成功
"""
from __future__ import annotations

import asyncio
import os

from langgraph.types import Command

from app.schemas.state import GroupState
from app.config import settings
from app.adapters.model_gateway import ModelGateway
from app.adapters.tools.image_downloader import download_image
from app.adapters.tools.og_image_extractor import extract_og_image
from app.adapters.tools.placeholder_image import create_placeholder
from app.adapters.tools.image_processor import resize_image
from app.adapters.storage.artifact_store import ArtifactStore
from app.utils import make_artifact
from app.logging_config import logger


async def _get_image_for_news(news: dict, save_dir: str, gateway: ModelGateway) -> str:
    """为单条新闻获取配图，按 4 级 fallback 依次尝试。"""
    # Level 1: Excel 提供的图片 URL
    image_url = news.get("image_url", "")
    if image_url:
        path = await download_image(image_url, save_dir)
        if path:
            return await resize_image(path)

    # Level 2: 从新闻页面抽取 og:image
    news_url = news.get("url", "")
    if news_url:
        og_url = await extract_og_image(news_url)
        if og_url:
            path = await download_image(og_url, save_dir)
            if path:
                return await resize_image(path)

    # Level 3: AI 生成警示风格图片
    title = news.get("title", "warning")
    prompt = (
        f"Warning poster style, {title} theme. Dark tones, red warning elements. "
        f"No specific human faces, abstract money symbols or broken shield in center. "
        f"Photographic quality, 4K, centered composition."
    )
    gen_url = await gateway.image("image.generate", {"prompt": prompt})
    if gen_url:
        path = await download_image(gen_url, save_dir)
        if path:
            return await resize_image(path)

    # Level 4: Pillow 占位图（永远成功）
    return await create_placeholder(title, save_dir)


async def image_node(state: GroupState) -> Command:
    """Image Agent 节点：并发处理所有新闻的配图，单张失败不阻断全流程。"""
    group_id = state.get("group_id", "unknown")
    img_dir = os.path.join(settings.ARTIFACT_DIR, group_id, "images")
    os.makedirs(img_dir, exist_ok=True)
    store = ArtifactStore(settings.ARTIFACT_DIR)

    async with ModelGateway(settings) as gateway:
        try:
            excel_rows = state.get("excel_rows", [])
            if not excel_rows:
                excel_rows = [{"title": "warning", "idx": 1}]

            # 并发获取所有图片，单张异常不影响其他
            tasks = [_get_image_for_news(n, img_dir, gateway) for n in excel_rows]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            image_paths: list[str] = []
            artifacts = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.warning("image_failed", idx=i, error=str(result))
                    path = await create_placeholder(
                        excel_rows[i].get("title", "error"), img_dir)
                else:
                    path = result

                image_paths.append(path)
                art = make_artifact(
                    "image-asset", f"配图 {i+1}", "image_agent", group_id,
                    file_path=path, mime_type="image/jpeg",
                    data={"news_idx": i + 1})
                await store.save_file(art, path)
                artifacts.append(art)

            logger.info("image_agent", action="done", count=len(image_paths))
            return Command(
                update={
                    "image_paths": image_paths,
                    "artifacts": artifacts,
                    "agent_status": {"image_agent": "done"},
                },
                goto="orchestrator",
            )
        except Exception as e:
            logger.error("image_agent_failed", error=str(e))
            return Command(
                update={
                    "image_paths": [],
                    "errors": [{"agent": "image_agent", "error": str(e)}],
                    "agent_status": {"image_agent": "error"},
                },
                goto="orchestrator",
            )
