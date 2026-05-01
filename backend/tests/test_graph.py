import pytest
import asyncio
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from app.graph.builder import build_graph


@pytest.fixture
async def graph():
    async with AsyncSqliteSaver.from_conn_string(":memory:") as cp:
        g = await build_graph(cp)
        yield g


def _make_state(group_id="test_g", approved=True, **overrides):
    state = {
        "group_id": group_id,
        "thread_id": f"group_{group_id}",
        "user_goal": "test anti-fraud video",
        "phase": "planning",
        "current_step_index": 0,
        "approved": approved,
        "image_paths": [],
        "messages": [],
        "artifacts": [],
        "events": [],
        "agent_status": {},
        "cost_usd": 0.0,
        "errors": [],
        "retry_count": {},
    }
    state.update(overrides)
    return state


async def test_full_pipeline(graph):
    config = {"configurable": {"thread_id": "test_full"}, "recursion_limit": 50}
    result = await graph.ainvoke(_make_state(), config)
    assert result["phase"] == "done"
    assert len(result["artifacts"]) >= 5
    assert result.get("script") is not None
    assert result.get("voice_path") is not None


async def test_thread_id_required(graph):
    config = {"configurable": {"thread_id": "test_tid"}, "recursion_limit": 50}
    result = await graph.ainvoke(_make_state(), config)
    assert result["phase"] == "done"


async def test_specialist_returns_to_orchestrator(graph):
    config = {"configurable": {"thread_id": "test_spec"}, "recursion_limit": 50}
    result = await graph.ainvoke(_make_state(), config)
    statuses = result.get("agent_status", {})
    for agent in ["text_agent", "image_agent", "audio_agent", "video_agent"]:
        assert agent in statuses, f"{agent} never ran"


async def test_unapproved_stops(graph):
    config = {"configurable": {"thread_id": "test_unapp"}, "recursion_limit": 50}
    result = await graph.ainvoke(_make_state(approved=False), config)
    assert result.get("script") is None
