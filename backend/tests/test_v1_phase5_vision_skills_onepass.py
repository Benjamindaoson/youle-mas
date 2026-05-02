"""V1 Phase 5+ — 三个新增能力的测试:
1. ModelGateway.vision() 接口契约 + I agent vision 路由
2. 6 个新 skill yaml 注册成功 + schema 合法
3. parse_intent_with_clarify 一次过 LLM 路径(含 fallback)
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.adapters.model_gateway import ModelGateway
from app.capabilities.image import _is_vision_task
from app.conductor.intent import Intent, parse_intent_with_clarify
from app.skills.registry import SkillStep, get_skill, list_skills, load_all


@pytest.fixture(autouse=True, scope="module")
def _bootstrap():
    load_all()
    yield


# ============== 1. Vision API ==============


async def test_vision_returns_none_without_key(monkeypatch):
    """无 ANTHROPIC_API_KEY → vision() 立即返回 None,不会抛异常。"""
    from app.config import settings as global_settings
    monkeypatch.setattr(global_settings, "ANTHROPIC_API_KEY", None, raising=False)
    async with ModelGateway(global_settings) as gw:
        out = await gw.vision("image.understand",
                               {"image_path": "/tmp/missing.jpg",
                                "instruction": "describe"})
    assert out is None


async def test_vision_returns_none_when_image_missing(monkeypatch):
    """有 key 但 image_path 不存在 → 返回 None,记录 warning。"""
    from app.config import settings as global_settings
    monkeypatch.setattr(global_settings, "ANTHROPIC_API_KEY", "sk-fake", raising=False)
    async with ModelGateway(global_settings) as gw:
        out = await gw.vision("x", {"image_path": "/definitely/not/here.jpg",
                                      "instruction": "describe"})
    assert out is None


async def test_vision_returns_none_for_non_image_file(monkeypatch, tmp_path):
    """文件扩展名/MIME 非 image → 返回 None。"""
    from app.config import settings as global_settings
    monkeypatch.setattr(global_settings, "ANTHROPIC_API_KEY", "sk-fake", raising=False)
    bad = tmp_path / "fake.txt"
    bad.write_text("not an image")
    async with ModelGateway(global_settings) as gw:
        out = await gw.vision("x", {"image_path": str(bad), "instruction": "ok"})
    assert out is None


# ============== 2. I agent vision routing ==============


def test_is_vision_task_keyword_routing():
    """task.task / outputs 含"理解 / 分析 / 审稿 / understand / analyze /
    review"等 → 走 vision 路径。"""
    cases_yes = [
        SkillStep(agent="I", task="分析这张图"),
        SkillStep(agent="I", task="image review"),
        SkillStep(agent="I", task="给图片审稿"),
        SkillStep(agent="I", task="understand the layout"),
        SkillStep(agent="I", task="analyze main subject"),
        SkillStep(agent="I", task="describe what you see"),
    ]
    for c in cases_yes:
        assert _is_vision_task(c), f"应识别为 vision: {c.task!r}"

    cases_no = [
        SkillStep(agent="I", task="生成主图"),
        SkillStep(agent="I", task="produce hero image"),
        SkillStep(agent="I", task="write image prompts"),
    ]
    for c in cases_no:
        assert not _is_vision_task(c), f"不应识别为 vision: {c.task!r}"


# ============== 3. 新 skill yaml 注册 ==============


REQUIRED_NEW_SKILLS = {
    "brand_story",
    "product_launch_bundle",
    "kol_brief",
    "product_detail_copy",
    "douyin_kouban_script",
    "image_review",
    "weekly_marketing_report",
}


def test_new_skills_all_loaded():
    """6+ 个新 skill 必须全部加载到 registry。"""
    ids = {s.id for s in list_skills()}
    missing = REQUIRED_NEW_SKILLS - ids
    assert not missing, f"未加载的 skill: {missing}"


def test_new_skills_have_required_fields():
    """每个新 skill 必须有 name / description / steps / intent_keywords。"""
    for sid in REQUIRED_NEW_SKILLS:
        sk = get_skill(sid)
        assert sk is not None, f"{sid} 未注册"
        assert sk.name and sk.description
        assert sk.intent_keywords, f"{sid} 缺 intent_keywords"
        assert sk.steps, f"{sid} 没有 steps"


def test_image_review_uses_vision_routing():
    """image_review skill 的步骤 task 必须能命中 _is_vision_task。"""
    sk = get_skill("image_review")
    assert sk is not None
    # 至少第一步是 I agent 且会被 vision 路由识别
    first = sk.steps[0]
    assert first.agent == "I"
    assert _is_vision_task(first)


def test_product_launch_bundle_is_multi_capability():
    """新品发布物料包必须跨 capability(T+I 至少)。"""
    sk = get_skill("product_launch_bundle")
    assert sk is not None
    capabilities = {s.agent for s in sk.steps}
    assert "T" in capabilities and "I" in capabilities


def test_weekly_marketing_report_uses_doc_capability():
    """营销周报必须以 D agent 收尾出 PPT。"""
    sk = get_skill("weekly_marketing_report")
    assert sk is not None
    last = sk.steps[-1]
    assert last.agent == "D"


# ============== 4. parse_intent_with_clarify 一次过 ==============


async def test_parse_intent_with_clarify_no_key_returns_empty_clarify(monkeypatch):
    """无 ANTHROPIC_API_KEY → intent 用启发式,clarify 返回 [] 让上层走模板。"""
    import app.conductor.intent as intent_mod
    monkeypatch.setattr(intent_mod.settings, "ANTHROPIC_API_KEY", None, raising=False)

    intent, clarify = await parse_intent_with_clarify("帮我做点东西")
    assert isinstance(intent, Intent)
    assert clarify == []  # 让 dispatcher 走 generate_questions 模板路径
    assert intent.missing_slots  # 模糊话应有 missing_slots


async def test_parse_intent_with_clarify_llm_path(monkeypatch):
    """有 key + LLM 返 JSON → 一次同时拿 intent 和 clarify。"""
    import app.conductor.intent as intent_mod

    # anthropic_model_conductor 是 property,只 patch 底层 ANTHROPIC_API_KEY
    monkeypatch.setattr(
        intent_mod.settings, "ANTHROPIC_API_KEY", "sk-fake", raising=False,
    )

    fake_payload = """{
      "intent": {
        "vertical": "content",
        "deliverable_type": "text",
        "subject": "面膜小红书标题",
        "constraints": {},
        "confidence": 0.92,
        "missing_slots": []
      },
      "clarify_questions": []
    }"""

    class _FakeMessages:
        async def create(self, **_):
            return SimpleNamespace(content=[SimpleNamespace(text=fake_payload)])

    class _FakeClient:
        def __init__(self, **_):
            pass

        @property
        def messages(self):
            return _FakeMessages()

    import anthropic  # noqa: WPS433
    monkeypatch.setattr(anthropic, "AsyncAnthropic", _FakeClient)

    intent, clarify = await parse_intent_with_clarify(
        "帮我给面膜写小红书标题")
    assert intent.vertical == "content"
    assert intent.confidence >= 0.9
    assert clarify == []  # 高置信度无需澄清


async def test_parse_intent_with_clarify_llm_returns_questions_when_vague(
    monkeypatch,
):
    """模糊提问 → LLM 应在同次返回 missing_slots + clarify_questions。"""
    import app.conductor.intent as intent_mod

    monkeypatch.setattr(
        intent_mod.settings, "ANTHROPIC_API_KEY", "sk-fake", raising=False,
    )

    fake_payload = """{
      "intent": {
        "vertical": "other",
        "deliverable_type": "text",
        "subject": "",
        "constraints": {},
        "confidence": 0.3,
        "missing_slots": ["subject", "deliverable_type"]
      },
      "clarify_questions": [
        {"slot":"deliverable_type","question":"做成图、视频、还是文字?",
         "options":["图片","视频","文字"],"free_form":false},
        {"slot":"subject","question":"主题是?","options":[],"free_form":true}
      ]
    }"""

    class _FakeMessages:
        async def create(self, **_):
            return SimpleNamespace(content=[SimpleNamespace(text=fake_payload)])

    class _FakeClient:
        def __init__(self, **_):
            pass

        @property
        def messages(self):
            return _FakeMessages()

    import anthropic  # noqa: WPS433
    monkeypatch.setattr(anthropic, "AsyncAnthropic", _FakeClient)

    intent, clarify = await parse_intent_with_clarify("帮我做点东西")
    assert "subject" in intent.missing_slots
    assert len(clarify) == 2
    slots = {q["slot"] for q in clarify}
    assert "deliverable_type" in slots
    assert "subject" in slots


async def test_parse_intent_with_clarify_falls_back_on_llm_failure(monkeypatch):
    """LLM 抛错 → 不应崩溃,降级到启发式 + 空 clarify。"""
    import app.conductor.intent as intent_mod

    monkeypatch.setattr(
        intent_mod.settings, "ANTHROPIC_API_KEY", "sk-fake", raising=False,
    )

    class _Boom:
        def __init__(self, **_):
            pass

        @property
        def messages(self):
            class _M:
                async def create(self, **_):
                    raise RuntimeError("network down")
            return _M()

    import anthropic  # noqa: WPS433
    monkeypatch.setattr(anthropic, "AsyncAnthropic", _Boom)

    intent, clarify = await parse_intent_with_clarify("帮我给面膜写小红书标题")
    assert isinstance(intent, Intent)
    # LLM 失败,clarify 应该为 []
    assert clarify == []
