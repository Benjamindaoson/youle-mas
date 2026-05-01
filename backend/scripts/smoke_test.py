"""End-to-end smoke test for Youle MVP — frontend-compatible API."""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def main():
    from httpx import AsyncClient, ASGITransport
    from app.main import app, lifespan

    async with lifespan(app):
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            # 1. Health
            r = await c.get("/health")
            assert r.status_code == 200 and r.json()["ok"], "health failed"
            print("[1/10] Health OK")

            # 2. Agents
            r = await c.get("/agents")
            assert len(r.json()["agents"]) == 9
            print("[2/10] Agents: 9 agents")

            # 3. Single chat
            r = await c.post("/chat", json={"message": "hi", "agent_id": "chief", "session_id": "solo:chief"})
            events = _parse(r.text)
            assert any(e["type"] == "done" for e in events)
            print(f"[3/10] Chat: {len(events)} events")

            # 4. Team chat (LangGraph pipeline)
            r = await c.post("/chat/team", json={
                "message": "make anti-fraud video", "session_id": "group:smoke"}, timeout=120)
            events = _parse(r.text)
            types = {e["type"] for e in events}
            assert "start" in types
            assert "dispatch" in types
            assert "handoff" in types
            assert "agent_start" in types
            assert "done" in types
            print(f"[4/10] Team chat: {len(events)} events, types={sorted(types)}")

            # 5. Artifacts
            r = await c.get("/artifacts/group:smoke")
            arts = r.json()["artifacts"]
            assert len(arts) >= 1
            print(f"[5/10] Artifacts: {len(arts)} items")

            # 6. Artifact content
            if arts:
                r = await c.get(f"/artifacts/group:smoke/{arts[0]['file']}")
                assert r.status_code == 200
                assert "content" in r.json()
                print(f"[6/10] Artifact content: {len(r.json()['content'])} chars")
            else:
                print("[6/10] Skipped (no artifacts)")

            # 7. Auth
            r = await c.post("/auth/solo:chief", json={"level": "L1"})
            assert r.json()["level"] == "L1"
            print("[7/10] Auth: set L1")

            # 8. Archive
            r = await c.post("/chat/archive/group:smoke")
            assert "archived" in r.json()
            print("[8/10] Archive: OK")

            # 9. Upload
            r = await c.post("/upload", data={"session_id": "group:smoke"},
                             files={"file": ("test.txt", b"hello", "text/plain")})
            assert r.json()["size"] == 5
            print("[9/10] Upload: OK")

            # 10. History
            r = await c.get("/history/solo:chief")
            assert "turns" in r.json()
            print("[10/10] History: OK")

            print("\n=== SMOKE TEST PASSED ===")


def _parse(text):
    events = []
    for line in text.split("\n"):
        if line.startswith("data: "):
            try:
                events.append(json.loads(line[6:]))
            except json.JSONDecodeError:
                pass
    return events


if __name__ == "__main__":
    asyncio.run(main())
