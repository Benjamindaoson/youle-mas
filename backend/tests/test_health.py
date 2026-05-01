import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app, lifespan


@pytest.fixture
async def client():
    async with lifespan(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c


async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["service"] == "youle-backend"


async def test_agents(client):
    r = await client.get("/agents")
    assert r.status_code == 200
    assert len(r.json()["agents"]) == 9
