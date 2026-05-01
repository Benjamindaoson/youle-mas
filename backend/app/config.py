"""全局配置 — 从 .env 文件加载，所有模块通过 settings 单例访问。"""
from __future__ import annotations

import shutil

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置，字段与 .env.example 一一对应。"""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ---- 运行模式 ----
    # True 时跳过 API Key 校验，所有模型调用走工程 fallback
    DEMO_MODE: bool = True

    # ---- Anthropic（主编排模型）----
    ANTHROPIC_API_KEY: str | None = None
    ANTHROPIC_MODEL: str = "claude-opus-4-7"

    # ---- DeepSeek（中文文本生成）----
    DEEPSEEK_API_KEY: str | None = None
    DEEPSEEK_API_BASE: str = "https://api.deepseek.com/v1"
    DEEPSEEK_MODEL_PRO: str = "deepseek-chat"
    DEEPSEEK_MODEL_FLASH: str = "deepseek-chat"

    # ---- SiliconFlow（图片生成）----
    SILICONFLOW_API_KEY: str | None = None
    SILICONFLOW_API_BASE: str = "https://api.siliconflow.cn/v1"
    # 默认走 FLUX.2-pro（画质优先）；降费可改 FLUX.1-schnell 并同步调整 IMAGE_SIZE
    IMAGE_MODEL: str = "black-forest-labs/FLUX.2-pro"
    # SiliconFlow `/images/generations` 使用 image_size（非 OpenAI 的 size）。
    # FLUX.2 仅支持枚举：512x512、768x1024、1024x768、576x1024、1024x576
    IMAGE_SIZE: str = "768x1024"
    # FLUX.1-dev（1–30）/ FLUX.2-flex（1–50）可读取；其余模型忽略
    IMAGE_INFERENCE_STEPS: int = 28
    IMAGE_GENERATION_TIMEOUT: float = 180.0

    # ---- MiniMax（TTS 语音合成）----
    MINIMAX_API_KEY: str | None = None
    MINIMAX_GROUP_ID: str | None = None
    MINIMAX_TTS_MODEL: str = "speech-2.8-hd"
    MINIMAX_VOICE_ID: str = "male-qn-jingying"

    # ---- 路径与日志 ----
    LOG_LEVEL: str = "INFO"
    ARTIFACT_DIR: str = "./data/artifacts"
    UPLOAD_DIR: str = "./data/uploads"
    CHECKPOINT_PATH: str = "./data/checkpoints/checkpoints.db"
    OBSERVABILITY_DB: str = "./data/observability/traces.db"
    CORS_ORIGIN: str = "http://localhost:3000"
    DEFAULT_BGM_PATH: str = "./assets/bgm/default_warning.mp3"

    # ---- 安全限制 ----
    MAX_UPLOAD_SIZE_MB: int = 20       # 上传文件大小上限
    GRAPH_TIMEOUT_SECONDS: int = 300   # LangGraph 执行超时
    IMAGE_DOWNLOAD_TIMEOUT: int = 10   # 图片下载超时（秒）
    IMAGE_MAX_SIZE_MB: int = 10        # 单张图片大小上限
    FFMPEG_TIMEOUT: int = 120          # FFmpeg 合成超时（秒）
    TTS_TIMEOUT: int = 90              # HD TTS 可能较慢，放宽默认超时

    # ---- 便捷属性：判断各 API Key 是否真实可用 ----

    @property
    def has_anthropic(self) -> bool:
        return bool(self.ANTHROPIC_API_KEY and self.ANTHROPIC_API_KEY != "sk-ant-xxx")

    @property
    def has_deepseek(self) -> bool:
        return bool(self.DEEPSEEK_API_KEY and self.DEEPSEEK_API_KEY != "sk-xxx")

    @property
    def has_siliconflow(self) -> bool:
        return bool(self.SILICONFLOW_API_KEY and self.SILICONFLOW_API_KEY != "sk-xxx")

    @property
    def has_minimax(self) -> bool:
        return bool(self.MINIMAX_API_KEY and self.MINIMAX_API_KEY != "xxx")

    @property
    def ffmpeg_available(self) -> bool:
        """检查系统 PATH 中是否有 ffmpeg 可执行文件。"""
        return shutil.which("ffmpeg") is not None


# 全局单例，其他模块直接 from app.config import settings
settings = Settings()
