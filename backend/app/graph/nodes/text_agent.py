"""文字 Agent（爆款脚本官）— 读 Excel 新闻 → 调模型生成 60 秒口播稿。

失败时使用模板脚本兜底，保证链路不崩。

LangGraph 1.x 集成：
  - 入口 emit('agent_start') → 出口 emit('agent_done')，让 SSE 实时拿到节点状态
  - update['messages'] 写入 AIMessage，LangSmith trace 能看到完整对话
  - 真正的网络/IO 异常 raise 让 builder 的 retry_policy 接管；
    业务级 fallback（如 LLM 返回 schema 不合法）走 ScriptValidatorError 静默兜底
"""
from __future__ import annotations

import os

from langchain_core.messages import AIMessage
from langgraph.types import Command

from app.adapters.model_gateway import ModelGateway
from app.adapters.storage.artifact_store import ArtifactStore
from app.adapters.tools.excel_reader import read_excel
from app.adapters.tools.news_normalizer import normalize_news
from app.adapters.tools.script_validator import validate_script
from app.config import settings
from app.graph.streaming import emit
from app.logging_config import logger
from app.schemas.state import GroupState
from app.utils import make_artifact


async def text_node(state: GroupState) -> Command:
    """Text Agent 节点：读取新闻数据 → 生成脚本 → 校验 → 保存 artifact。"""
    group_id = state.get("group_id", "unknown")
    store = ArtifactStore(settings.ARTIFACT_DIR)

    emit("agent_start", agent_id="text_agent", agent_name="创", phase="execute")

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

            preview = (script.get("hook") or "")[:80]
            emit("chunk", agent_id="text_agent", text=preview)
            emit("agent_done", agent_id="text_agent")
            return Command(
                update={
                    "script": script,
                    "excel_rows": [item.model_dump() for item in news_items],
                    "artifacts": [artifact],
                    "agent_status": {"text_agent": "done"},
                    "messages": [AIMessage(
                        content=f"脚本已生成（约 {script.get('estimated_duration_seconds', 60)}s）：{preview}",
                        name="text_agent")],
                },
                goto="orchestrator",
            )
        except Exception as e:
            logger.error("text_agent_failed", error=str(e))
            emit("error", agent_id="text_agent", message=str(e))
            emit("agent_done", agent_id="text_agent")
            # 兜底：返回模板脚本，不让链路崩溃
            return Command(
                update={
                    "script": gateway.fallback_script(),
                    "excel_rows": [],
                    "errors": [{"agent": "text_agent", "error": str(e)}],
                    "agent_status": {"text_agent": "error"},
                    "messages": [AIMessage(
                        content=f"text_agent 走 fallback：{e}",
                        name="text_agent")],
                },
                goto="orchestrator",
            )
