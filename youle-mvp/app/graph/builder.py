"""LangGraph 图构建器 — 定义 5 个节点和边的拓扑结构。

图形状：
  START → orchestrator → [text/image/audio/video/END]
  每个 specialist 完成后必回 orchestrator（红线约束）。
"""
from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph
from app.schemas.state import GroupState


async def build_graph(checkpointer) -> CompiledStateGraph:
    """编译 LangGraph StateGraph，绑定 SQLite 检查点。"""
    # 延迟导入避免循环依赖
    from app.graph.nodes.orchestrator import orchestrator_node
    from app.graph.nodes.text_agent import text_node
    from app.graph.nodes.image_agent import image_node
    from app.graph.nodes.audio_agent import audio_node
    from app.graph.nodes.video_agent import video_node

    g = StateGraph(GroupState)

    # 注册 5 个节点
    g.add_node("orchestrator", orchestrator_node)
    g.add_node("text_agent", text_node)
    g.add_node("image_agent", image_node)
    g.add_node("audio_agent", audio_node)
    g.add_node("video_agent", video_node)

    # 入口边：START → orchestrator
    g.add_edge(START, "orchestrator")

    # 条件边：orchestrator 根据 next_agent 字段路由到不同 specialist 或 END
    g.add_conditional_edges(
        "orchestrator",
        lambda s: s.get("next_agent", "END"),
        {
            "text_agent": "text_agent",
            "image_agent": "image_agent",
            "audio_agent": "audio_agent",
            "video_agent": "video_agent",
            "END": END,
        },
    )

    # 普通边：每个 specialist 完成后必回 orchestrator（不允许 specialist → specialist）
    g.add_edge("text_agent", "orchestrator")
    g.add_edge("image_agent", "orchestrator")
    g.add_edge("audio_agent", "orchestrator")
    g.add_edge("video_agent", "orchestrator")

    return g.compile(checkpointer=checkpointer)
