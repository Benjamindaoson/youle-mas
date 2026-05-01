"""LangGraph 1.x StateGraph 构建器。

设计原则（2026-05 重构）：
  1. **路由统一走 Command(goto=...)**：节点自带去向，builder 不再写 conditional_edges
     和 "specialist→orchestrator" 反向静态边，避免双重路由的语义二义性。
  2. **retry_policy** 由 builder 注入：specialist 节点抛 RetriableError 时框架自动
     退避重试；try/except 软失败留作最终兜底（永不让链路崩）。
  3. **HITL 由 orchestrator 内部 `interrupt()` 触发**，不需要在 builder 加任何特殊边。

拓扑：
  START → orchestrator → (Command.goto) → text_agent / image_agent / audio_agent /
                                          video_agent / END
  每个 specialist 完成后通过 Command(goto="orchestrator") 自行回到主编排。
"""
from langgraph.graph import START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import RetryPolicy

from app.schemas.state import GroupState

# specialist 节点的统一重试策略：
# - max_attempts=3：1 次原始 + 2 次重试（应付外部 API 偶发抖动）
# - initial_interval=0.8s，backoff_factor=2.0：0.8s → 1.6s → 3.2s 递增
# - 业务级 fallback（如 LLM schema 校验失败）已在节点内部 catch，不会触发重试；
#   只有真正 raise 的 IO/网络异常会让 retry_policy 介入
SPECIALIST_RETRY = RetryPolicy(
    max_attempts=3,
    initial_interval=0.8,
    backoff_factor=2.0,
    max_interval=10.0,
    jitter=True,
)


async def build_graph(checkpointer) -> CompiledStateGraph:
    """编译 LangGraph StateGraph，绑定 SQLite 检查点。"""
    # 延迟导入避免循环依赖
    from app.graph.nodes.audio_agent import audio_node
    from app.graph.nodes.image_agent import image_node
    from app.graph.nodes.orchestrator import (
        APPROVAL_GATE,
        approval_gate_node,
        orchestrator_node,
    )
    from app.graph.nodes.text_agent import text_node
    from app.graph.nodes.video_agent import video_node

    g = StateGraph(GroupState)

    # orchestrator / approval_gate：决策节点不挂 retry_policy
    # （orchestrator 幂等无副作用；approval_gate 用 interrupt 不可重试）
    g.add_node("orchestrator", orchestrator_node)
    g.add_node(APPROVAL_GATE, approval_gate_node)

    # 4 个 specialist 节点：统一 retry_policy（处理外部 API 偶发抖动）
    g.add_node("text_agent", text_node, retry_policy=SPECIALIST_RETRY)
    g.add_node("image_agent", image_node, retry_policy=SPECIALIST_RETRY)
    g.add_node("audio_agent", audio_node, retry_policy=SPECIALIST_RETRY)
    g.add_node("video_agent", video_node, retry_policy=SPECIALIST_RETRY)

    # 唯一一条静态边：入口
    g.add_edge(START, "orchestrator")

    # 其他所有路由（orchestrator → specialist / approval_gate / END、
    # specialist → orchestrator、approval_gate → text_agent / END）
    # 都在节点内部用 Command(goto=...) 表达，不在这里重复声明。

    return g.compile(checkpointer=checkpointer)
