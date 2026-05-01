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
        "require_approval": False,
        "image_paths": [],
        "messages": [],
        "artifacts": [],
        "events": [],
        "agent_status": {},
        "cost_usd": 0.0,
        "errors": [],
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


async def test_interrupt_then_resume(graph):
    """HITL: require_approval=True → graph 在 orchestrator interrupt 挂起；
    通过 Command(resume={"approved": True}) 注入审批后能继续跑完。"""
    from langgraph.types import Command

    config = {"configurable": {"thread_id": "test_hitl"}, "recursion_limit": 50}

    # 第一次 invoke：应该 hit interrupt 而不是跑完
    result1 = await graph.ainvoke(
        _make_state(approved=False, require_approval=True), config)
    # interrupt 时 graph 返回当前 state；script 应未生成
    assert result1.get("script") is None
    art_types = {a.type for a in result1.get("artifacts", [])}
    assert "dispatch-plan" in art_types
    assert "video-script" not in art_types

    # state snapshot 应该处于挂起状态
    snap = await graph.aget_state(config)
    assert snap.next, "graph should be paused waiting for resume"

    # resume：注入审批通过
    result2 = await graph.ainvoke(Command(resume={"approved": True}), config)
    assert result2["phase"] == "done"
    assert result2.get("script") is not None
    assert result2.get("video_path") is not None


async def test_interrupt_then_reject(graph):
    """HITL: 用户驳回时 graph 进入 phase='rejected' 不再产出 specialist 产物。"""
    from langgraph.types import Command

    config = {"configurable": {"thread_id": "test_hitl_rej"}, "recursion_limit": 50}
    result1 = await graph.ainvoke(
        _make_state(approved=False, require_approval=True), config)
    assert result1.get("script") is None

    result2 = await graph.ainvoke(
        Command(resume={"approved": False, "reason": "scope creep"}), config)
    assert result2["phase"] == "rejected"
    assert result2.get("script") is None
    art_types = {a.type for a in result2.get("artifacts", [])}
    assert "video-script" not in art_types
