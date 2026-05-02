"""一次性验证：reload Settings 后用 deepseek-chat 跑反诈脚本，断言 ScriptSchema 通过。"""
import asyncio

from app.config import Settings
from app.adapters.model_gateway import ModelGateway
from app.adapters.tools.script_validator import validate_script
from scripts.make_sample_input import SAMPLE_NEWS


async def main() -> None:
    settings = Settings()
    print(f"DEEPSEEK_MODEL_PRO = {settings.DEEPSEEK_MODEL_PRO!r}")
    news_items = [{"idx": i + 1, **n} for i, n in enumerate(SAMPLE_NEWS[:3])]

    async with ModelGateway(settings) as gw:
        raw = await gw.text("text.script.zh", {"news_items": news_items})

    print("---raw model output---")
    print(raw)
    print("---validate---")
    script = validate_script(raw)
    print("OK duration={}s closing={!r}".format(
        script["estimated_duration_seconds"], script["closing"][:40]))


if __name__ == "__main__":
    asyncio.run(main())
