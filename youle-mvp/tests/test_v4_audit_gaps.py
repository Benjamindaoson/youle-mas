"""TDD: Tests for v4 audit gaps - must all pass after fixes."""
import pytest
import json
import os
import wave

from app.sse import make_event


# --- Gap 1: MusicGenerator tool must exist ---

def test_music_generator_module_exists():
    """§3.2.3: music_generator.py must be importable."""
    from app.adapters.tools.music_generator import generate_music
    assert callable(generate_music)


async def test_music_generator_returns_none():
    """V0: music generation always returns None."""
    from app.adapters.tools.music_generator import generate_music
    result = await generate_music("serious_warning", 60.0, "/tmp")
    assert result is None


# --- Gap 2: SSE must emit all 13 event types ---

def test_sse_agent_start_event():
    """§3.5: agent_start event must be emittable."""
    raw = make_event("agent_start", "g1", agent_id="text_agent", agent_name="爆款脚本官")
    assert "agent_start" in raw
    data = json.loads([l for l in raw.strip().split("\n") if l.startswith("data: ")][0][6:])
    assert data["agent_id"] == "text_agent"


def test_sse_chunk_event():
    """§3.5: chunk event must carry text data."""
    raw = make_event("chunk", "g1", agent_id="text_agent", data={"text": "正在分析..."})
    data = json.loads([l for l in raw.strip().split("\n") if l.startswith("data: ")][0][6:])
    assert data["type"] == "chunk"
    assert data["data"]["text"] == "正在分析..."


def test_sse_handoff_event():
    """§3.5: handoff event must carry from/to agents."""
    raw = make_event("handoff", "g1", agent_id="orchestrator",
                     data={"from": "orchestrator", "to": "text_agent"})
    data = json.loads([l for l in raw.strip().split("\n") if l.startswith("data: ")][0][6:])
    assert data["type"] == "handoff"
    assert data["data"]["to"] == "text_agent"


def test_sse_approval_required_event():
    """§3.5: approval_required event must be emittable."""
    raw = make_event("approval_required", "g1",
                     data={"plan_id": "plan_123", "message": "请审批派活计划"})
    data = json.loads([l for l in raw.strip().split("\n") if l.startswith("data: ")][0][6:])
    assert data["type"] == "approval_required"


def test_sse_agent_done_event():
    """§3.5: agent_done event must be emittable."""
    raw = make_event("agent_done", "g1", agent_id="text_agent", agent_name="爆款脚本官")
    data = json.loads([l for l in raw.strip().split("\n") if l.startswith("data: ")][0][6:])
    assert data["type"] == "agent_done"


def test_sse_cost_update_event():
    """§3.5: cost_update event must carry cost data."""
    raw = make_event("cost_update", "g1", data={"cost_usd": 0.05, "capability": "text.script.zh"})
    data = json.loads([l for l in raw.strip().split("\n") if l.startswith("data: ")][0][6:])
    assert data["type"] == "cost_update"


# --- Gap 3: Full pipeline SSE must include agent_start, handoff, agent_done ---

async def test_full_run_emits_all_event_types():
    """Full run SSE stream must include agent_start, handoff, agent_done events."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app, lifespan

    async with lifespan(app):
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            r = await client.post(
                "/chat/team",
                json={"message": "test video", "session_id": "group:audit-test"},
                timeout=120.0,
            )
            events = []
            for line in r.text.split("\n"):
                if line.startswith("data: "):
                    try:
                        events.append(json.loads(line[6:]))
                    except json.JSONDecodeError:
                        pass

            types = {e["type"] for e in events}
            assert "agent_start" in types, f"missing agent_start, got: {sorted(types)}"
            assert "handoff" in types, f"missing handoff, got: {sorted(types)}"
            assert "agent_done" in types, f"missing agent_done, got: {sorted(types)}"


# --- Gap 4: BGM file or silent fallback ---

async def test_bgm_silent_fallback_produces_valid_wav(tmp_path):
    """When BGM file missing, silent WAV must be valid audio."""
    from app.adapters.tools.local_bgm import select_bgm
    from app.adapters.tools.silent_audio import create_silent

    bgm = select_bgm("warning", "/nonexistent.mp3")
    assert bgm is None

    silent = await create_silent(60.0, str(tmp_path))
    with wave.open(silent, "r") as wf:
        dur = wf.getnframes() / wf.getframerate()
        assert abs(dur - 60.0) < 0.1
