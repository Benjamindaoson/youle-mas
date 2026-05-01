"""Tests for frontend-compatible API endpoints."""
import pytest
import json
from httpx import AsyncClient, ASGITransport
from app.main import app, lifespan


@pytest.fixture
async def client():
    async with lifespan(app):
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        ) as c:
            yield c


async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


async def test_root(client):
    r = await client.get("/")
    assert r.json()["service"] == "youle-backend"


async def test_agents_list(client):
    r = await client.get("/agents")
    agents = r.json()["agents"]
    assert len(agents) == 9
    ids = {a["id"] for a in agents}
    assert "chief" in ids
    assert "writer" in ids
    for a in agents:
        assert "name" in a and "role" in a and "available" in a


async def test_chat_sse(client):
    r = await client.post("/chat", json={
        "message": "hello", "agent_id": "chief", "session_id": "solo:chief"})
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]
    events = _parse_sse(r.text)
    types = {e["type"] for e in events}
    assert "start" in types
    assert "chunk" in types
    assert "done" in types


async def test_team_chat_sse(client):
    r = await client.post("/chat/team", json={
        "message": "make video", "session_id": "group:test-api"}, timeout=120)
    assert r.status_code == 200
    events = _parse_sse(r.text)
    types = {e["type"] for e in events}
    assert "start" in types
    assert "dispatch" in types
    assert "handoff" in types
    assert "agent_start" in types
    assert "agent_done" in types
    assert "done" in types


async def test_artifacts_after_team(client):
    await client.post("/chat/team", json={
        "message": "test", "session_id": "group:test-arts"}, timeout=120)
    r = await client.get("/artifacts/group:test-arts")
    assert r.status_code == 200
    data = r.json()
    assert len(data["artifacts"]) >= 1


async def test_all_artifacts(client):
    r = await client.get("/artifacts?limit=10")
    assert r.status_code == 200
    assert "items" in r.json()


async def test_auth_get_set(client):
    r = await client.get("/auth/solo:chief")
    assert r.json()["level"] == "L0"
    r = await client.post("/auth/solo:chief", json={"level": "L2"})
    assert r.json()["level"] == "L2"
    r = await client.get("/auth/solo:chief")
    assert r.json()["level"] == "L2"


async def test_archive_lifecycle(client):
    sid = "group:archive-test"
    r = await client.get(f"/chat/archive/{sid}")
    assert r.json()["archived"] is False
    r = await client.post(f"/chat/archive/{sid}")
    assert r.json()["archived"]["archived_at"]
    r = await client.get(f"/chat/archive/{sid}")
    assert r.json()["archived"] is True
    r = await client.delete(f"/chat/archive/{sid}")
    assert r.json()["was_archived"] is True


async def test_history_clear(client):
    await client.post("/chat", json={
        "message": "hi", "agent_id": "chief", "session_id": "solo:hist-test"})
    r = await client.get("/history/solo:hist-test")
    assert len(r.json()["turns"]) >= 1
    r = await client.delete("/history/solo:hist-test")
    assert r.json()["cleared"] is True


async def test_upload(client, tmp_path):
    test_file = tmp_path / "test.txt"
    test_file.write_text("hello world")
    with open(test_file, "rb") as f:
        r = await client.post("/upload",
                              data={"session_id": "group:upload-test"},
                              files={"file": ("test.txt", f, "text/plain")})
    assert r.status_code == 200
    assert r.json()["name"] == "test.txt"
    assert r.json()["size"] == 11


async def test_artifact_download_404(client):
    r = await client.get("/artifacts/nonexistent/nonexistent.md/download")
    assert r.status_code == 404


async def test_path_traversal_blocked(client):
    r = await client.get("/artifacts/group:test/../../etc/passwd")
    assert r.status_code in (400, 404, 307)


def _parse_sse(text: str) -> list[dict]:
    events = []
    for line in text.split("\n"):
        if line.startswith("data: "):
            try:
                events.append(json.loads(line[6:]))
            except json.JSONDecodeError:
                pass
    return events
