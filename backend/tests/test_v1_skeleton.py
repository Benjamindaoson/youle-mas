"""V1 骨架烟测 — 跑通 skill 注册 + Conductor 占位流。

不验证业务正确性（V1 还在写），只验证：
1. YAML 注册器能加载 backend/skills/*.yaml 不报错
2. 每个 skill 能被 list_skills() 拿到
3. Conductor 在 DEMO 模式下能从 user_text 流式 yield 事件直到 done 或 clarify_required
"""
from __future__ import annotations

import pytest

from app.skills.registry import list_skills, load_all
from app.conductor import conduct


@pytest.fixture(autouse=True)
def _load_skills():
    n = load_all()
    assert n >= 1, "至少要有一个 demo skill 注册成功"
    yield


def test_skills_registered():
    skills = list_skills()
    ids = {s.id for s in skills}
    # 两个 demo skill 必须存在
    assert "ecommerce_main_image" in ids
    assert "xiaohongshu_hook_title" in ids


def test_skill_schema_valid():
    skills = list_skills()
    for sk in skills:
        assert sk.id and sk.name
        assert sk.steps, f"{sk.id} 至少要有一个 step"
        for step in sk.steps:
            assert step.agent in ("T", "I", "V", "D")


async def test_conductor_clarify_when_intent_vague():
    """模糊话进 → 当前 stub intent 一律低置信度 → 应触发 clarify_required。"""
    events = []
    async for ev in conduct("帮我做点东西", session_id="test:vague"):
        events.append(ev)
        if ev["type"] == "clarify_required":
            break

    types = [e["type"] for e in events]
    assert "start" in types
    assert "intent_parsed" in types
    assert "clarify_required" in types
    # clarify 中应该至少包含 deliverable_type 和 vertical 的反问
    last = events[-1]
    slots = {q["slot"] for q in last["questions"]}
    assert "deliverable_type" in slots or "vertical" in slots


async def test_conductor_event_contract():
    """所有 yield 出来的事件都是 dict，且都带 type 字段。"""
    async for ev in conduct("hi", session_id="test:contract"):
        assert isinstance(ev, dict)
        assert "type" in ev
        if ev["type"] == "clarify_required":
            break
