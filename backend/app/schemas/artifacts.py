"""产出物（Artifact）数据模型 — V0 支持 10 种类型。"""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

# V0 支持的 10 种 artifact 类型
ArtifactType = Literal[
    "dispatch-plan",    # 派活计划（orchestrator 生成）
    "video-script",     # 视频脚本（text_agent 生成）
    "image-asset",      # 图片素材（image_agent 生成）
    "voice-asset",      # TTS 配音（audio_agent 生成）
    "bgm-asset",        # 背景音乐（audio_agent 生成）
    "subtitle-asset",   # 字幕文件（video_agent 生成）
    "video-asset",      # 最终视频（video_agent 生成）
    "thumbnail",        # 视频缩略图（video_agent 生成）
    "summary",          # 交付总结（orchestrator 生成）
    "fallback",         # 降级产物（任意 agent 降级时生成）
]


class Artifact(BaseModel):
    """单个产出物的元数据。文件本体存在 data/artifacts/{group_id}/ 下。"""
    id: str                                    # 唯一标识，格式 art_{uuid}
    type: ArtifactType                         # 产出物类型
    title: str                                 # 标题（前端卡片展示用）
    by_agent: str                              # 产出该 artifact 的 agent id
    group_id: str                              # 所属群组
    data: dict = Field(default_factory=dict)   # 结构化数据（如脚本 JSON）
    file_path: str | None = None               # 文件磁盘路径
    mime_type: str | None = None               # MIME 类型
    version: int = 1                           # 版本号（V1 用于修订追踪）
    created_at: datetime                       # 创建时间（UTC）
