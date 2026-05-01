"""FastAPI 应用入口 — 启动时校验环境、初始化 LangGraph 和 SQLite 检查点。"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from app.config import settings
from app.logging_config import setup_logging, logger
from app.graph.builder import build_graph


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理：启动时校验 → 建目录 → 编译 Graph → 就绪。"""
    setup_logging(settings.LOG_LEVEL)

    # 非 DEMO 模式：缺 Key 直接拒绝启动（不能用 assert，python -O 会剥离）
    if not settings.DEMO_MODE:
        required = [
            ("ANTHROPIC_API_KEY", settings.ANTHROPIC_API_KEY),
            ("DEEPSEEK_API_KEY", settings.DEEPSEEK_API_KEY),
            ("SILICONFLOW_API_KEY", settings.SILICONFLOW_API_KEY),
            ("MINIMAX_API_KEY", settings.MINIMAX_API_KEY),
        ]
        missing = [name for name, val in required if not val]
        if missing:
            raise RuntimeError(
                f"非 DEMO 模式下缺少必需配置: {', '.join(missing)}"
            )
        if not settings.ffmpeg_available:
            raise RuntimeError("非 DEMO 模式下要求 FFmpeg 可用")
    else:
        # DEMO 模式：缺 Key 只警告，走 fallback
        for name, check in [
            ("ANTHROPIC_API_KEY", settings.has_anthropic),
            ("DEEPSEEK_API_KEY", settings.has_deepseek),
            ("SILICONFLOW_API_KEY", settings.has_siliconflow),
            ("MINIMAX_API_KEY", settings.has_minimax),
        ]:
            if not check:
                logger.warning(f"{name} 未设置，将使用 fallback")
        if not settings.ffmpeg_available:
            logger.warning("FFmpeg 未安装，视频合成将使用 fallback")

    # 确保数据目录存在
    for d in [settings.ARTIFACT_DIR, settings.UPLOAD_DIR,
              os.path.dirname(settings.CHECKPOINT_PATH), "./data/history"]:
        os.makedirs(d, exist_ok=True)

    # 初始化 SQLite 检查点 + 编译 LangGraph
    async with AsyncSqliteSaver.from_conn_string(settings.CHECKPOINT_PATH) as cp:
        app.state.graph = await build_graph(cp)
        app.state.settings = settings
        app.state.checkpointer = cp
        logger.info("youle-backend 已启动", demo_mode=settings.DEMO_MODE, port=8001)
        yield


app = FastAPI(lifespan=lifespan, title="Youle Backend", version="0.1.0")

# CORS：允许所有 localhost 端口（前端 3000 / 其他调试端口）
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://localhost:\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.routes import router  # noqa: E402  # 延迟导入避免循环依赖
app.include_router(router)


@app.get("/health")
async def health():
    """健康检查 — 返回服务状态、DEMO 模式、FFmpeg 可用性。"""
    db_ok = hasattr(app.state, "checkpointer") and app.state.checkpointer is not None
    return {
        "ok": db_ok,
        "service": "youle-backend",
        "version": "0.1.0",
        "demo_mode": settings.DEMO_MODE,
        "ffmpeg": settings.ffmpeg_available,
    }
