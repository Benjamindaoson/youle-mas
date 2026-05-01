"""派活计划数据模型 — Orchestrator 生成，用户审批后执行。"""
from typing import Literal
from pydantic import BaseModel, Field


class DispatchStep(BaseModel):
    """派活计划中的单个步骤。"""
    id: str                                                                    # 步骤 ID（如 s1, s2）
    agent: Literal["text_agent", "image_agent", "audio_agent", "video_agent"]  # 执行该步骤的 agent
    task: str                                                                  # 任务描述
    expected_artifact_type: str                                                # 预期产出类型
    depends_on: list[str] = Field(default_factory=list)                        # 依赖的前置步骤 ID
    max_retries: int = 1                                                       # 最大重试次数


class DispatchPlan(BaseModel):
    """完整的派活计划，包含多个有序步骤。"""
    id: str                            # 计划 ID
    goal: str                          # 用户目标
    steps: list[DispatchStep]          # 步骤列表（按执行顺序）
    estimated_cost_usd: float = 0.0    # 预估成本（美元）
    requires_approval: bool = True     # 是否需要用户审批
