"""TDD: ModelGateway fallback tests."""
import pytest
import pytest_asyncio
from app.config import settings
from app.adapters.model_gateway import ModelGateway
from app.schemas.news import NewsItem


@pytest_asyncio.fixture
async def gateway():
    gw = ModelGateway(settings)
    try:
        yield gw
    finally:
        await gw.close()


async def test_text_fallback_returns_valid_script(gateway):
    """Text fallback produces a valid script dict."""
    result = await gateway.text("text.script.zh", {"news_items": []})
    assert "hook" in result
    assert "body" in result
    assert "closing" in result
    assert "estimated_duration_seconds" in result
    assert isinstance(result["body"], list)


async def test_text_fallback_uses_news_data(gateway):
    """Text fallback incorporates actual news titles and amounts."""
    items = [
        NewsItem(idx=1, title="Test fraud case", summary="s", amount="500万"),
        NewsItem(idx=2, title="Another scam", summary="s", amount="200万"),
    ]
    result = await gateway.text("text.script.zh", {"news_items": items})
    assert len(result["body"]) == 2
    assert "500万" in result["body"][0] or "Test fraud" in result["body"][0]
    assert len(result["evidence"]) >= 1


async def test_text_fallback_with_10_items(gateway):
    """Text fallback handles 10 news items (standard case)."""
    items = [
        NewsItem(idx=i, title=f"Fraud case {i}", summary="s", amount=f"{i*100}万")
        for i in range(1, 11)
    ]
    result = await gateway.text("text.script.zh", {"news_items": items})
    assert len(result["body"]) == 10
    assert len(result["evidence"]) == 10


async def test_text_fallback_accepts_dict_items(gateway):
    """Fallback should treat dict items the same as NewsItem (no silent empty body)."""
    items = [
        {"idx": 1, "title": "Dict-shaped item", "amount": "100万", "summary": "s"},
        {"idx": 2, "title": "Another dict", "amount": "", "summary": ""},
    ]
    result = await gateway.text("text.script.zh", {"news_items": items})
    # 第一条带 amount，应进入 evidence；第二条无 amount，仅写 body
    assert len(result["body"]) == 2
    assert any("Dict-shaped" in s for s in result["body"])


async def test_image_returns_none_without_key(gateway):
    """Image generation returns None when no API key."""
    result = await gateway.image("image.generate", {"prompt": "test"})
    assert result is None


async def test_tts_returns_none_without_key(gateway):
    """TTS returns None when no API key."""
    result = await gateway.tts("voice.tts.zh", {"text": "test"})
    assert result is None


async def test_music_always_returns_none(gateway):
    """Music generation always returns None in V0."""
    result = await gateway.music("music.generate", {})
    assert result is None


async def test_template_script_validates(gateway):
    """Template script passes ScriptValidator."""
    from app.adapters.tools.script_validator import validate_script
    result = await gateway.text("text.script.zh", {"news_items": []})
    validated = validate_script(result)
    assert validated["hook"] == result["hook"]
    assert validated["body"] == result["body"]
