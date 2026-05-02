"""DeepSeek 反诈脚本生成冒烟工具。

切换 DEEPSEEK_API_KEY 或 DEEPSEEK_MODEL_PRO 后用这个脚本快速验证：
  - .env 是否被 Settings 正确读取
  - DeepSeek API Key 是否可联通
  - 模型输出能否通过 ScriptSchema 校验

用法（在 backend/ 目录下）：
  uv run python scripts/verify_deepseek.py
  # 或
  .venv/Scripts/python.exe scripts/verify_deepseek.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def main() -> None:
    from app.config import Settings
    from app.adapters.model_gateway import ModelGateway
    from app.adapters.tools.script_validator import validate_script
    from scripts.make_sample_input import SAMPLE_NEWS

    settings = Settings()
    print(f"DEEPSEEK_MODEL_PRO = {settings.DEEPSEEK_MODEL_PRO!r}")
    if not settings.has_deepseek:
        print("DEEPSEEK_API_KEY 未配置，无法验证。")
        sys.exit(2)

    news_items = [{"idx": i + 1, **n} for i, n in enumerate(SAMPLE_NEWS[:3])]

    async with ModelGateway(settings) as gw:
        raw = await gw.text("text.script.zh", {"news_items": news_items})

    print("---raw model output---")
    print(raw)
    print("---validate---")
    script = validate_script(raw)
    print(
        "OK duration={}s closing={!r}".format(
            script["estimated_duration_seconds"], script["closing"][:40],
        ),
    )


if __name__ == "__main__":
    asyncio.run(main())
