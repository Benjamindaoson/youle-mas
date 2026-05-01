"""V1 Phase 4.5 — LLM-driven clarify + 召回阈值/否决词 + 候选重排测试。

DEMO 模式（无 ANTHROPIC_API_KEY）覆盖纯逻辑路径；
LLM 路径用 monkeypatch 把 anthropic 调用打桩，避免真实 API 依赖。
"""
from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.conductor.clarify import (
    ClarifyQuestion,
    _generate_template,
    generate_questions,
    needs_clarification,
)
from app.conductor.intent import Intent
from app.skills.registry import SkillSpec, SkillStep, _REGISTRY, load_all, match


# =================== 1. 召回阈值 + 否决词 ===================


@pytest.fixture
def isolated_registry():
    """每个测试单独注册，避免与生产 yaml 干扰。"""
    snapshot = dict(_REGISTRY)
    _REGISTRY.clear()
    yield _REGISTRY
    _REGISTRY.clear()
    _REGISTRY.update(snapshot)


def _spec(
    sid: str,
    keywords: list[str],
    *,
    negative: list[str] | None = None,
    min_score: int = 1,
) -> SkillSpec:
    return SkillSpec(
        id=sid, name=sid,
        intent_keywords=keywords,
        negative_keywords=negative or [],
        min_match_score=min_score,
        steps=[SkillStep(agent="T", task="x")],
    )


def test_match_respects_min_match_score(isolated_registry):
    """min_match_score=2 时单关键词不触发；命中 2 个才召回。"""
    isolated_registry["xhs"] = _spec(
        "xhs", ["小红书", "标题", "爆款"], min_score=2)

    # 单"小红书"命中数=1 < 2 → 不召回
    assert match("写一份小红书周报") is None
    # "小红书" + "标题" → 命中=2 → 召回
    got = match("帮我给面膜写小红书标题")
    assert got is not None and got.id == "xhs"


def test_match_respects_negative_keywords(isolated_registry):
    """negative_keywords 命中即否决，即便关键词命中数已达阈值。"""
    isolated_registry["xhs"] = _spec(
        "xhs", ["小红书", "标题"],
        negative=["方案", "策略", "复盘"],
        min_score=2,
    )
    # "小红书" + "标题" → 关键词都命中,但"方案"否决 → None
    assert match("做一份小红书内容方案，含标题方向") is None
    # 没有否决词 → 正常召回
    got = match("帮我给面膜写小红书标题")
    assert got is not None


def test_match_picks_higher_score_among_ties(isolated_registry):
    """同时多 skill 命中,取关键词命中数最高的。"""
    isolated_registry["a"] = _spec("a", ["小红书"], min_score=1)
    isolated_registry["b"] = _spec("b", ["小红书", "标题", "爆款"], min_score=1)
    got = match("帮我给面膜写小红书爆款标题")
    assert got is not None and got.id == "b"


def test_match_returns_none_when_nothing_hits(isolated_registry):
    isolated_registry["xhs"] = _spec("xhs", ["小红书"], min_score=1)
    assert match("帮我做一份月度复盘 PPT") is None


# =================== 2. clarify 模板兜底 ===================


def test_clarify_template_covers_all_missing_slots():
    intent = Intent(
        raw_user_text="x",
        confidence=0.0,
        missing_slots=["vertical", "deliverable_type", "subject"],
    )
    qs = _generate_template(intent)
    slots = {q.slot for q in qs}
    assert {"vertical", "deliverable_type", "subject"}.issubset(slots)


def test_clarify_template_subject_is_free_form():
    intent = Intent(missing_slots=["subject"])
    qs = _generate_template(intent)
    assert qs and qs[0].free_form is True


# =================== 3. clarify LLM 路径(mock) ===================


class _FakeStream:
    def __init__(self, payload: str):
        self._payload = payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False


class _FakeMessages:
    def __init__(self, payload: str):
        self._payload = payload

    async def create(self, **_kwargs):
        return SimpleNamespace(
            content=[SimpleNamespace(text=self._payload)],
        )


class _FakeAnthropicClient:
    def __init__(self, payload: str):
        self.messages = _FakeMessages(payload)


async def test_clarify_uses_llm_when_key_set(monkeypatch):
    """has_anthropic=True → 调 LLM，返回的 JSON 数组被解析成 ClarifyQuestion 列表。"""
    payload = """[
      {"slot":"deliverable_type","question":"做成图、视频、还是文字？",
       "options":["图片","视频","文字"],"free_form":false},
      {"slot":"subject","question":"主题是什么？","options":[],"free_form":true}
    ]"""

    # 桩 anthropic.AsyncAnthropic
    import app.conductor.clarify as clarify_mod
    # has_anthropic 是 property（看 ANTHROPIC_API_KEY 是否非空）；
    # 直接设 key 即可让 has_anthropic 为 True。
    monkeypatch.setattr(
        clarify_mod.settings, "ANTHROPIC_API_KEY", "sk-fake-test-key", raising=False,
    )
    monkeypatch.setattr(
        clarify_mod.settings, "ANTHROPIC_MODEL", "claude-test", raising=False,
    )

    import anthropic  # noqa: WPS433

    class _StubAsyncAnthropic:
        def __init__(self, **_kw):
            pass

        @property
        def messages(self):
            return _FakeMessages(payload)

    monkeypatch.setattr(anthropic, "AsyncAnthropic", _StubAsyncAnthropic)

    intent = Intent(
        raw_user_text="帮我做点小红书的东西",
        missing_slots=["deliverable_type", "subject"],
    )
    qs = await generate_questions(intent)
    assert len(qs) == 2
    # 顺序保留;options/free_form 字段透传
    by_slot = {q.slot: q for q in qs}
    assert "图片" in by_slot["deliverable_type"].options
    assert by_slot["subject"].free_form is True


async def test_clarify_falls_back_to_template_on_llm_failure(monkeypatch):
    """LLM 抛异常时,降级到模板,不应崩溃。"""
    import app.conductor.clarify as clarify_mod
    monkeypatch.setattr(
        clarify_mod.settings, "ANTHROPIC_API_KEY", "sk-fake-key", raising=False,
    )

    import anthropic  # noqa: WPS433

    class _Boom:
        def __init__(self, **_kw):
            pass

        @property
        def messages(self):
            class _M:
                async def create(self, **_):
                    raise RuntimeError("simulated network failure")
            return _M()

    monkeypatch.setattr(anthropic, "AsyncAnthropic", _Boom)

    intent = Intent(missing_slots=["vertical"])
    qs = await generate_questions(intent)
    assert qs and any(q.slot == "vertical" for q in qs)
    # 模板的 vertical 反问应该有 5 个 option
    v = next(q for q in qs if q.slot == "vertical")
    assert v.options and "电商" in v.options


# =================== 4. needs_clarification 边界 ===================


def test_needs_clarification_high_confidence_no_missing():
    intent = Intent(confidence=0.95, missing_slots=[])
    assert needs_clarification(intent) is False


def test_needs_clarification_low_confidence():
    intent = Intent(confidence=0.5, missing_slots=[])
    assert needs_clarification(intent) is True


def test_needs_clarification_high_confidence_but_missing_slots():
    """confidence 高但仍有 missing_slots 也要澄清。"""
    intent = Intent(confidence=0.95, missing_slots=["subject"])
    assert needs_clarification(intent) is True


# =================== 5. yaml skill 实战 ===================


def test_real_xiaohongshu_skill_blocks_phrasing_with_negatives():
    """真实加载的 xiaohongshu_hook_title.yaml 现在含 negative_keywords。
    确认"做小红书冷启动方案"这种含'方案'的会被否决,不再误命中。"""
    load_all()
    bad = match("做一份小红书冷启动方案")
    # 注意:此处不应命中 xiaohongshu_hook_title。允许命中其他不冲突的 skill,
    # 也允许 None;关键是不能是 xiaohongshu_hook_title。
    assert bad is None or bad.id != "xiaohongshu_hook_title"


def test_real_xiaohongshu_skill_still_matches_clean_phrase():
    load_all()
    got = match("帮我给面膜写小红书爆款标题")
    assert got is not None and got.id == "xiaohongshu_hook_title"
