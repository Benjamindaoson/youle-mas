"""Settings：各 agent 可单独指定 Anthropic 模型，未指定时回落到 ANTHROPIC_MODEL。"""

from app.config import Settings


def test_anthropic_conductor_falls_back_to_main_model():
    s = Settings(
        ANTHROPIC_MODEL="claude-opus-4-7",
        ANTHROPIC_MODEL_CONDUCTOR="",
    )
    assert s.anthropic_model_conductor == "claude-opus-4-7"


def test_anthropic_conductor_override():
    s = Settings(
        ANTHROPIC_MODEL="claude-opus-4-7",
        ANTHROPIC_MODEL_CONDUCTOR="claude-sonnet-4-5-20250929",
    )
    assert s.anthropic_model_conductor == "claude-sonnet-4-5-20250929"


def test_capability_text_and_role_chat_fallback():
    s = Settings(
        ANTHROPIC_MODEL="main-id",
        ANTHROPIC_MODEL_CAPABILITY_TEXT="",
        ANTHROPIC_MODEL_ROLE_CHAT="",
    )
    assert s.anthropic_model_capability_text == "main-id"
    assert s.anthropic_model_role_chat == "main-id"
