"""日志配置 — 使用 structlog 输出结构化日志。"""
import logging
import structlog


def setup_logging(level: str = "INFO") -> None:
    """初始化 structlog，设置日志级别和输出格式。"""
    name_to_level = structlog.stdlib.NAME_TO_LEVEL
    key = (level or "").lower()
    if key not in name_to_level:
        # 未识别的 level 不静默回退，至少打一条 warning 让运维感知配置错误
        logging.getLogger("youle").warning(
            "unknown_log_level=%r, falling back to INFO", level)
        resolved = name_to_level["info"]
    else:
        resolved = name_to_level[key]

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(resolved),
    )


# 全局 logger 实例，其他模块直接 from app.logging_config import logger
logger = structlog.get_logger("youle")
