"""Conductor — V1 主编排 agent。

负责把用户模糊的话变成结构化需求，从 skill 市场选 workflow，
分派给能力 agent 执行，验收并交付。

公开入口：
    async for ev in conduct(user_text, session_id, history):
        ...

V1 状态：骨架占位，业务逻辑在 docs/v1-architecture.md 中描述。
"""
from __future__ import annotations

from app.conductor.dispatcher import conduct

__all__ = ["conduct"]
