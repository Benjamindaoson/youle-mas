"""文字 Agent（爆款脚本官）— 读 Excel 新闻 → 调模型生成 60 秒口播稿。

失败时使用模板脚本兜底，保证链路不崩。
"""
from __future__ import annotations

import os

from langgraph.types import Command

from app.schemas.state import GroupState
from app.config import settings
from app.adapters.model_gateway import ModelGateway
from app.adapters.tools.excel_reader import read_excel
from app.adapters.tools.news_normalizer import normalize_news
from app.adapters.tools.script_validator import validate_script
from app.adapters.storage.artifact_store import ArtifactStore
from app.utils import make_artifact
from app.logging_config import logger


async def text_node(state: GroupState) -> Command:
    """Text Agent 节点：读取新闻数据 → 生成脚本 → 校验 → 保存 artifact。"""
    group_id = state.get("group_id", "unknown")
    store = ArtifactStore(settings.ARTIFACT_DIR)

    async with ModelGateway(settings) as gateway:
        try:
            # 优先读上传的 Excel，没有则用内置样例数据
            file_path = state.get("input_file_path")
            if file_path and os.path.isfile(file_path):
                rows = read_excel(file_path)
            else:
                from scripts.make_sample_input import SAMPLE_NEWS
                rows = [{"idx": i + 1, **n} for i, n in enumerate(SAMPLE_NEWS)]

            news_items = normalize_news(rows)
            logger.info("text_agent", action="read_excel", count=len(news_items))

            # 调模型生成脚本（无 Key 时自动走模板 fallback）
            raw_script = await gateway.text("text.script.zh", {"news_items": news_items})
            script = validate_script(raw_script)
            logger.info("text_agent", action="script_generated",
                        duration=script["estimated_duration_seconds"])

            artifact = make_artifact(
                "video-script", "60 秒反诈口播稿", "text_agent", group_id,
                data=script)
            await store.save(artifact)

            return Command(
                update={
                    "script": script,
                    "excel_rows": [item.model_dump() for item in news_items],
                    "artifacts": [artifact],
                    "agent_status": {"text_agent": "done"},
                },
                goto="orchestrator",
            )
        except Exception as e:
            logger.error("text_agent_failed", error=str(e))
            # 兜底：返回模板脚本，不让链路崩溃
            return Command(
                update={
                    "script": gateway.fallback_script(),
                    "excel_rows": [],
                    "errors": [{"agent": "text_agent", "error": str(e)}],
                    "agent_status": {"text_agent": "error"},
                },
                goto="orchestrator",
            )
