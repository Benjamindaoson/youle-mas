"""SSE 事件数据模型 — 定义前端可接收的 13 种事件类型。"""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

# 前端 lib/api.ts 中 TeamSSEEvent 对应的 13 种事件类型
SessionEventType = Literal[
    "graph_start",          # Graph 开始执行
    "group_created",        # 工作群已创建
    "agent_joined",         # Agent 加入群
    "dispatch_plan",        # 派活计划生成
    "approval_required",    # 等待用户审批（interrupt 点）
    "agent_start",          # Specialist 开始工作
    "chunk",                # 流式文本片段
    "handoff",              # Agent 间交接
    "artifact",             # 产出物生成
    "agent_done",           # Specialist 完成工作
    "cost_update",          # 成本更新
    "error",                # 错误（recoverable=true 不中断链路）
    "done",                 # 全部完成，关闭 SSE 流
]


class SessionEvent(BaseModel):
    """单条 SSE 事件的数据结构，序列化后作为 data: 行发送给前端。"""
    event_id: str                              # 事件唯一 ID
    type: SessionEventType                     # 事件类型
    group_id: str                              # 所属群组
    agent_id: str | None = None                # 相关 agent ID
    agent_name: str | None = None              # agent 显示名
    message: str | None = None                 # 人类可读消息
    data: dict = Field(default_factory=dict)   # 事件附加数据
    created_at: datetime                       # 事件时间（UTC）
