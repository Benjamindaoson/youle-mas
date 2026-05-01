import json
from app.sse import make_event
from app.schemas.events import SessionEvent


def test_make_event_format():
    raw = make_event("graph_start", "group_123")
    assert raw.startswith("event: graph_start\n")
    assert "data: " in raw
    assert raw.endswith("\n\n")


def test_make_event_json():
    raw = make_event("chunk", "group_123", agent_id="text_agent", data={"text": "hello"})
    lines = raw.strip().split("\n")
    data_line = [l for l in lines if l.startswith("data: ")][0]
    payload = json.loads(data_line[6:])
    assert payload["type"] == "chunk"
    assert payload["group_id"] == "group_123"
    assert payload["agent_id"] == "text_agent"
    assert "event_id" in payload
    assert "created_at" in payload


def test_all_event_types():
    types = [
        "graph_start", "group_created", "agent_joined", "dispatch_plan",
        "approval_required", "agent_start", "chunk", "handoff", "artifact",
        "agent_done", "cost_update", "error", "done",
    ]
    for t in types:
        raw = make_event(t, "g1")
        assert f"event: {t}" in raw


def test_session_event_schema():
    raw = make_event("artifact", "g1", agent_id="image_agent", agent_name="test")
    data_line = [l for l in raw.strip().split("\n") if l.startswith("data: ")][0]
    ev = SessionEvent(**json.loads(data_line[6:]))
    assert ev.type == "artifact"
    assert ev.agent_id == "image_agent"
