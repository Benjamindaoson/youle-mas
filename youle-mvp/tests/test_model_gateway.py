"""TDD: ModelGateway fallback tests."""
import pytest
from app.config import settings
from app.adapters.model_gateway import ModelGateway
from app.schemas.news import NewsItem


@pytest.fixture
def gateway():
    return ModelGateway(settings)


async def test_text_fallback_returns_valid_script(gateway):
    """Text fallback produces a valid script dict."""
    result = await gateway.text("text.script.zh", {"news_items": []})
    assert "hook" in result
    assert "body" in result
    assert "closing" in result
    assert "estimated_duration_seconds" in result
    assert isinstance(result["body"], list)
    await gateway.close()


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
    await gateway.close()


async def test_text_fallback_with_10_items(gateway):
    """Text fallback handles 10 news items (standard case)."""
    items = [
        NewsItem(idx=i, title=f"Fraud case {i}", summary="s", amount=f"{i*100}万")
        for i in range(1, 11)
    ]
    result = await gateway.text("text.script.zh", {"news_items": items})
    assert len(result["body"]) == 10
    assert len(result["evidence"]) == 10
    await gateway.close()


async def test_image_returns_none_without_key(gateway):
    """Image generation returns None when no API key."""
    result = await gateway.image("image.generate", {"prompt": "test"})
    assert result is None
    await gateway.close()


async def test_tts_returns_none_without_key(gateway):
    """TTS returns None when no API key."""
    result = await gateway.tts("voice.tts.zh", {"text": "test"})
    assert result is None
    await gateway.close()


async def test_music_always_returns_none(gateway):
    """Music generation always returns None in V0."""
    result = await gateway.music("music.generate", {})
    assert result is None
    await gateway.close()


async def test_template_script_validates():
    """Template script passes ScriptValidator."""
    from app.adapters.tools.script_validator import validate_script
    gw = ModelGateway(settings)
    result = await gw.text("text.script.zh", {"news_items": []})
    validated = validate_script(result)
    assert validated["hook"] == result["hook"]
    assert validated["body"] == result["body"]
    await gw.close()
