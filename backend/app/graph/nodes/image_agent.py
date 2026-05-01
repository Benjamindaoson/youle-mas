"""图片 Agent（素材侦探）— 为每条新闻准备配图，4 级 fallback 保证不崩。

Fallback 链路：
  1. Excel 中的 image_url → 直接下载
  2. 新闻 URL 的 og:image → 抽取后下载
  3. AI 图片模型 → 生成警示风格图
  4. Pillow 占位图 → 永远成功

LangGraph 1.x 集成：
  - 每张图完成时通过 emit('progress') 推送 N/total 进度，前端进度条可用
  - 入口/出口 emit agent_start / agent_done

设计取舍：当前用 asyncio.gather 在节点内部并发；未来若要让 LangGraph
Send 接管每张图（独立 retry / checkpoint），可拆出 image_one 子节点。
"""
from __future__ import annotations

import asyncio
import os

from langchain_core.messages import AIMessage
from langgraph.types import Command

from app.adapters.model_gateway import ModelGateway
from app.adapters.storage.artifact_store import ArtifactStore
from app.adapters.tools.image_downloader import download_image
from app.adapters.tools.image_processor import resize_image
from app.adapters.tools.og_image_extractor import extract_og_image
from app.adapters.tools.placeholder_image import create_placeholder
from app.config import settings
from app.graph.streaming import emit
from app.logging_config import logger
from app.schemas.state import GroupState
from app.utils import make_artifact


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

    emit("agent_start", agent_id="image_agent", agent_name="图", phase="execute")

    async with ModelGateway(settings) as gateway:
        try:
            excel_rows = state.get("excel_rows", [])
            if not excel_rows:
                excel_rows = [{"title": "warning", "idx": 1}]

            total = len(excel_rows)
            emit("progress", agent_id="image_agent",
                 stage="fetching", detail=f"准备 {total} 张配图")

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
                emit("progress", agent_id="image_agent",
                     stage="generated", detail=f"{i+1}/{total}", current=i + 1, total=total)

            logger.info("image_agent", action="done", count=len(image_paths))
            emit("agent_done", agent_id="image_agent")
            return Command(
                update={
                    "image_paths": image_paths,
                    "artifacts": artifacts,
                    "agent_status": {"image_agent": "done"},
                    "messages": [AIMessage(
                        content=f"配图已就绪：{len(image_paths)} 张",
                        name="image_agent")],
                },
                goto="orchestrator",
            )
        except Exception as e:
            logger.error("image_agent_failed", error=str(e))
            emit("error", agent_id="image_agent", message=str(e))
            emit("agent_done", agent_id="image_agent")
            return Command(
                update={
                    "image_paths": [],
                    "errors": [{"agent": "image_agent", "error": str(e)}],
                    "agent_status": {"image_agent": "error"},
                    "messages": [AIMessage(
                        content=f"image_agent 走 fallback：{e}",
                        name="image_agent")],
                },
                goto="orchestrator",
            )
