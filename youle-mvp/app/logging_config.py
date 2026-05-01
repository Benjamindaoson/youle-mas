"""日志配置 — 使用 structlog 输出结构化日志。"""
import structlog


def setup_logging(level: str = "INFO") -> None:
    """初始化 structlog，设置日志级别和输出格式。"""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            structlog.stdlib.NAME_TO_LEVEL.get(level.lower(), 20)
        ),
    )


# 全局 logger 实例，其他模块直接 from app.logging_config import logger
logger = structlog.get_logger("youle")
