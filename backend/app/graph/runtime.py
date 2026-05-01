"""Graph 执行入口 — 封装 astream 调用，供 API 层使用。"""
from app.schemas.state import GroupState


async def run_graph(graph, initial_state: GroupState, config: dict):
    """以流式模式执行 graph，逐步 yield (stream_mode, event) 元组。"""
    async for stream_mode, ev in graph.astream(
        initial_state, config, stream_mode=["custom", "messages"],
    ):
        yield stream_mode, ev
