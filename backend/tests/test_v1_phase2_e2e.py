"""V1 Phase 2 端到端测试 — 跑一次小红书爆款标题 skill。

DEMO 模式下（无 ANTHROPIC_API_KEY）：
- parse_intent 走启发式 → 提取出"小红书"+"标题" → vertical=content, deliverable=text
- retrieve 命中 xiaohongshu_hook_title.yaml
- T agent 走 _template_fallback → 出 5 条占位标题
- 全程 yield 出预期事件序列

接 ANTHROPIC_API_KEY 时：
- parse_intent 走 LLM；T agent 走 Anthropic 流式
- 事件序列一致，只是 chunk 内容来自真模型

本测试只验证 DEMO 模式（CI 友好）。
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.conductor import conduct
from app.conductor.intent import parse_intent
from app.conductor.skill_retriever import retrieve
from app.skills.registry import list_skills, load_all


@pytest.fixture(autouse=True, scope="module")
def _bootstrap_skills():
    n = load_all()
    assert n >= 1
    yield


# ============================ 单元 ============================

async def test_intent_heuristic_extracts_xiaohongshu_subject():
    intent = await parse_intent("帮我给面膜写小红书标题")
    assert intent.vertical == "content"
    assert intent.deliverable_type == "text"
    assert "面膜" in intent.subject
    # 三槽都齐 → 高置信度，不应触发 clarify
    assert intent.confidence >= 0.85
    assert not intent.missing_slots


async def test_intent_heuristic_marks_missing_slots():
    intent = await parse_intent("帮我做点东西")
    # 模糊提问 → 至少缺 deliverable_type 和 vertical
    assert intent.confidence < 0.7
    missing = set(intent.missing_slots)
    assert "deliverable_type" in missing or "vertical" in missing


async def test_retriever_finds_xiaohongshu_skill():
    intent = await parse_intent("帮我给面膜写小红书标题")
    candidates = await retrieve(intent, top_k=3)
    assert candidates, "至少要召回一个 skill"
    ids = [s.id for s in candidates]
    assert "xiaohongshu_hook_title" in ids


# ============================ 端到端 ============================

async def _drain(user_text: str, session_id: str) -> list[dict]:
    out: list[dict] = []
    async for ev in conduct(user_text, session_id=session_id):
        out.append(ev)
    return out


async def test_xiaohongshu_skill_end_to_end_demo_mode(monkeypatch):
    """DEMO 模式下完整跑一次小红书 skill：clarify 不应触发，T agent 出兜底标题。

    强制清掉 ANTHROPIC_API_KEY 让 conductor 走启发式路径 — 否则配了真 key
    时 LLM 可能（合理地）判出缺失槽位，与本测试"无 LLM 时启发式不假阳性"的本意冲突。
    """
    from app.config import settings as global_settings
    monkeypatch.setattr(global_settings, "ANTHROPIC_API_KEY", None, raising=False)

    events = await _drain("帮我给面膜写小红书标题", session_id="v1:e2e-xhs")

    types = [e["type"] for e in events]

    # 必须的事件序列
    assert "start" in types
    assert "intent_parsed" in types
    assert "clarify_required" not in types, \
        f"清晰提问不应触发 clarify，实际事件: {types}"
    assert "skill_selected" in types
    assert "agent_start" in types
    assert "chunk" in types
    assert "agent_done" in types
    assert "deliverable" in types
    assert "done" in types

    # 选中的 skill 必须是 xiaohongshu_hook_title
    skill_evt = next(e for e in events if e["type"] == "skill_selected")
    assert skill_evt["skill_id"] == "xiaohongshu_hook_title"

    # T agent 必须有非空 chunk
    chunks = [e for e in events if e["type"] == "chunk"]
    body = "".join(c["text"] for c in chunks)
    assert len(body) > 20

    # 至少有一个 artifact
    artifacts = [e for e in events if e["type"] == "artifact"]
    assert artifacts


async def test_vague_input_triggers_clarify_then_resolves_with_answers(monkeypatch):
    """模糊输入 → 触发 clarify。前端把答案塞进 clarify_answers 重发 → 走完。

    强制 DEMO 路径（启发式 conductor），让 missing_slots 行为可预测。
    """
    from app.config import settings as global_settings
    monkeypatch.setattr(global_settings, "ANTHROPIC_API_KEY", None, raising=False)

    # 第一轮：模糊
    first = await _drain("帮我做个东西", session_id="v1:e2e-clarify-1")
    assert any(e["type"] == "clarify_required" for e in first)

    # 第二轮：用户答完澄清，把关键词补进原话再发（routes 层就是这么拼的）
    enriched = "帮我给面膜写小红书标题"
    second = await _drain(enriched, session_id="v1:e2e-clarify-2")
    types2 = [e["type"] for e in second]
    assert "clarify_required" not in types2
    assert "deliverable" in types2


# ============================ HTTP 端点 ============================

@pytest.fixture
async def client():
    from app.main import app, lifespan
    async with lifespan(app):
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        ) as c:
            yield c


async def test_http_skills_endpoint_returns_registered_skills(client):
    r = await client.get("/v1/skills")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] >= 2
    ids = {s["id"] for s in data["items"]}
    assert "xiaohongshu_hook_title" in ids
    assert "ecommerce_main_image" in ids


async def test_http_conduct_endpoint_streams_sse(client, monkeypatch):
    """HTTP /v1/conduct 端点冒烟。强制 DEMO 让事件序列稳定可断言。"""
    from app.config import settings as global_settings
    monkeypatch.setattr(global_settings, "ANTHROPIC_API_KEY", None, raising=False)

    r = await client.post("/v1/conduct", json={
        "message": "帮我给面膜写小红书标题",
        "session_id": "v1:http-e2e",
    }, timeout=60)
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]

    # 解析 SSE
    import json
    events = []
    for line in r.text.split("\n"):
        if line.startswith("data: "):
            try:
                events.append(json.loads(line[6:]))
            except json.JSONDecodeError:
                pass

    types = {e["type"] for e in events}
    assert "start" in types
    assert "skill_selected" in types
    assert "deliverable" in types
    assert "done" in types
