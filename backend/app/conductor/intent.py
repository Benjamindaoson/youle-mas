"""意图理解 — 把用户原话解析成结构化 Intent。

V1 实现策略：LLM tool-use，让模型按 IntentSchema 填字段。
当前为占位骨架，详见 docs/v1-architecture.md §3.3。
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


VerticalId = Literal[
    "ecommerce",   # 电商
    "content",     # 内容创作
    "marketing",   # 营销/品牌
    "finance",     # 金融/反诈
    "other",
]

DeliverableType = Literal[
    "image",   # 单/多张图
    "video",   # 视频
    "doc",     # 办公文档（PDF/Excel/PPT）
    "text",    # 纯文本（文案/报告）
    "bundle",  # 多类型组合交付
]


class Intent(BaseModel):
    """用户意图的结构化表示。confidence < 0.7 或 missing_slots 非空 → 走 Clarify。"""
    vertical: VerticalId = "other"
    deliverable_type: DeliverableType = "text"
    subject: str = Field(default="", description="对象/主题简明描述")
    constraints: dict = Field(default_factory=dict, description="平台/语气/长度/期限等")
    raw_user_text: str = ""
    confidence: float = 0.0
    missing_slots: list[str] = Field(default_factory=list)


async def parse_intent(user_text: str, history: list[dict] | None = None) -> Intent:
    """[STUB] 当前直接返回低置信度 Intent，触发 Clarify。

    V1 真实实现：
    - 调用 LLM with structured output (Anthropic tool_use 或 JSON mode)
    - prompt 见 docs/v1-architecture.md §3.3
    - history 用于多轮对话补全 slot
    """
    return Intent(
        raw_user_text=user_text,
        confidence=0.0,
        missing_slots=["vertical", "deliverable_type", "subject"],
    )
