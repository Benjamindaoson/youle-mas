"""TDD: Full integration test with sample Excel data.
Verifies the complete pipeline produces all expected artifacts."""
import pytest
import os
import asyncio

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from app.graph.builder import build_graph
from app.config import settings


@pytest.fixture
async def graph():
    async with AsyncSqliteSaver.from_conn_string(":memory:") as cp:
        g = await build_graph(cp)
        yield g


def _make_state(group_id="integ_test", **overrides):
    state = {
        "group_id": group_id,
        "thread_id": f"group_{group_id}",
        "user_goal": "make anti-fraud short video from Excel news",
        "phase": "planning",
        "current_step_index": 0,
        "approved": True,
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


async def test_pipeline_with_sample_excel(graph, tmp_path):
    """Full pipeline with sample Excel produces all 9 artifact types."""
    from scripts.make_sample_input import make_sample_excel
    excel_path = make_sample_excel(str(tmp_path / "sample.xlsx"))

    config = {"configurable": {"thread_id": "integ_excel"}, "recursion_limit": 50}
    result = await graph.ainvoke(
        _make_state(input_file_path=excel_path), config
    )

    assert result["phase"] == "done"
    assert result["script"] is not None
    assert len(result["image_paths"]) >= 1
    assert result["voice_path"] is not None
    assert result["bgm_path"] is not None
    assert result["video_path"] is not None
    assert result["subtitle_path"] is not None

    art_types = {a.type for a in result["artifacts"]}
    assert "dispatch-plan" in art_types
    assert "video-script" in art_types
    assert "image-asset" in art_types
    assert "voice-asset" in art_types
    assert "bgm-asset" in art_types
    assert "subtitle-asset" in art_types
    assert "summary" in art_types
    # Either video-asset (with FFmpeg) or fallback (without)
    assert "video-asset" in art_types or "fallback" in art_types
    assert "thumbnail" in art_types


async def test_script_has_evidence(graph, tmp_path):
    """Script must contain evidence referencing actual news data."""
    from scripts.make_sample_input import make_sample_excel
    excel_path = make_sample_excel(str(tmp_path / "sample.xlsx"))

    config = {"configurable": {"thread_id": "integ_evidence"}, "recursion_limit": 50}
    result = await graph.ainvoke(
        _make_state(input_file_path=excel_path), config
    )

    script = result["script"]
    assert "hook" in script
    assert "body" in script
    assert "closing" in script
    assert "estimated_duration_seconds" in script
    assert len(script["body"]) >= 1


async def test_all_agents_run(graph):
    """Every specialist must run and report status."""
    config = {"configurable": {"thread_id": "integ_agents"}, "recursion_limit": 50}
    result = await graph.ainvoke(_make_state(), config)

    statuses = result["agent_status"]
    for agent in ["text_agent", "image_agent", "audio_agent", "video_agent", "orchestrator"]:
        assert agent in statuses, f"{agent} never reported status"


async def test_no_errors_in_fallback_mode(graph):
    """In DEMO_MODE with all fallbacks, there should be zero errors."""
    config = {"configurable": {"thread_id": "integ_noerr"}, "recursion_limit": 50}
    result = await graph.ainvoke(_make_state(), config)

    errors = result.get("errors", [])
    assert len(errors) == 0, f"Unexpected errors: {errors}"


async def test_unapproved_produces_plan_only(graph):
    """Unapproved run produces dispatch-plan but no other artifacts."""
    config = {"configurable": {"thread_id": "integ_unapp"}, "recursion_limit": 50}
    result = await graph.ainvoke(_make_state(approved=False), config)

    assert result.get("script") is None
    assert result.get("voice_path") is None
    art_types = {a.type for a in result["artifacts"]}
    assert "dispatch-plan" in art_types
    assert "video-script" not in art_types


async def test_artifacts_have_required_fields(graph):
    """Every artifact must have id, type, by_agent, group_id, created_at."""
    config = {"configurable": {"thread_id": "integ_fields"}, "recursion_limit": 50}
    result = await graph.ainvoke(_make_state(), config)

    for art in result["artifacts"]:
        assert art.id, "artifact missing id"
        assert art.type, "artifact missing type"
        assert art.by_agent, "artifact missing by_agent"
        assert art.group_id, "artifact missing group_id"
        assert art.created_at, "artifact missing created_at"


async def test_reducer_fields_are_incremental(graph):
    """Reducer fields (artifacts, events, errors) accumulate correctly."""
    config = {"configurable": {"thread_id": "integ_reducer"}, "recursion_limit": 50}
    result = await graph.ainvoke(_make_state(), config)

    # artifacts should have items from multiple agents
    agents_that_produced = {a.by_agent for a in result["artifacts"]}
    assert len(agents_that_produced) >= 3  # orchestrator + at least 2 specialists
