"""LangGraph 全局状态定义 — 所有 agent 共享的 GroupState TypedDict。

带 Annotated 的字段使用自定义 reducer：
  - messages: LangGraph 内置 add_messages（自动去重追加 AIMessage / HumanMessage）
  - artifacts / events / errors: append_list（列表拼接）
  - agent_status: merge_dict（字典合并）
  - cost_usd: sum_float（累加）
"""
from typing import Annotated, Literal, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

from app.graph.reducers import append_list, merge_dict, sum_float
from app.schemas.artifacts import Artifact
from app.schemas.dispatch import DispatchPlan
from app.schemas.events import SessionEvent

AgentId = Literal[
    "orchestrator", "text_agent", "image_agent", "audio_agent", "video_agent",
]

Phase = Literal[
    "planning",           # 生成派活计划中
    "waiting_approval",   # 等待用户审批（interrupt 挂起）
    "executing",          # 正在执行
    "finalizing",         # 汇总中
    "done",               # 完成
    "rejected",           # 用户驳回
    "failed",             # 失败
]


class GroupState(TypedDict, total=False):
    """LangGraph StateGraph 的状态类型。每个字段的含义见行内注释。"""

    # ---- 业务标识 ----
    group_id: str                  # 群组 ID
    thread_id: str                 # LangGraph checkpoint 线程 ID = group_{group_id}
    user_id: str | None            # 用户 ID（V1 鉴权用）
    user_goal: str                 # 用户输入的目标
    input_file_path: str | None    # 上传的 Excel/CSV 文件路径

    # ---- 编排控制 ----
    phase: Phase                           # 当前执行阶段
    current_step_index: int                # 当前执行到第几步
    dispatch_plan: DispatchPlan | None     # 派活计划
    approved: bool                         # 用户是否已审批（True 跳过 interrupt）
    require_approval: bool                 # 是否在 orchestrator 触发 interrupt 等审批

    # ---- 数据流（各 agent 的产出，下游 agent 读取）----
    excel_rows: list[dict]         # text_agent 读取的新闻数据
    script: dict | None            # text_agent 生成的脚本
    image_paths: list[str]         # image_agent 准备的图片路径列表
    voice_path: str | None         # audio_agent 生成的配音路径
    bgm_path: str | None           # audio_agent 选择的 BGM 路径
    subtitle_path: str | None      # video_agent 生成的字幕路径
    video_path: str | None         # video_agent 合成的视频路径
    thumbnail_path: str | None     # video_agent 截取的缩略图路径

    # ---- Reducer 字段（节点只返增量，LangGraph 自动合并）----
    messages: Annotated[list[BaseMessage], add_messages]       # 对话消息（LangSmith trace）
    artifacts: Annotated[list[Artifact], append_list]          # 产出物列表
    events: Annotated[list[SessionEvent], append_list]         # SSE 事件
    agent_status: Annotated[dict[str, str], merge_dict]        # 各 agent 状态
    cost_usd: Annotated[float, sum_float]                      # 累计成本（美元）
    errors: Annotated[list[dict], append_list]                 # 错误记录
