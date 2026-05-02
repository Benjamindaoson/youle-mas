"""Anthropic 中转/官方 key 联通性冒烟工具。

切 ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL 后用这个脚本快速验证：
  - .env 是否被 Settings 正确读取
  - SDK 是否成功路由到指定 base_url
  - 模型能正常返回

用法（在 backend/ 目录下）：
  uv run python scripts/verify_anthropic.py
  # 或
  .venv/Scripts/python.exe scripts/verify_anthropic.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def main() -> None:
    import anthropic

    from app.config import Settings

    settings = Settings()
    print(f"ANTHROPIC_API_KEY    = {(settings.ANTHROPIC_API_KEY or '')[:14]}…")
    print(f"ANTHROPIC_BASE_URL   = {settings.ANTHROPIC_BASE_URL!r}")
    print(f"ANTHROPIC_MODEL      = {settings.ANTHROPIC_MODEL!r}")
    print(f"has_anthropic        = {settings.has_anthropic}")
    if not settings.has_anthropic:
        print("ANTHROPIC_API_KEY 未配置，无法验证。")
        sys.exit(2)

    client = anthropic.AsyncAnthropic(
        api_key=settings.ANTHROPIC_API_KEY,
        base_url=settings.ANTHROPIC_BASE_URL or None,
    )

    print("\n---发起一次最小 messages.create---")
    resp = await client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=64,
        messages=[{"role": "user", "content": "回三个字：你好啊"}],
    )
    text = resp.content[0].text if resp.content else ""
    print(f"OK model={resp.model!r}")
    print(f"   stop_reason={resp.stop_reason!r}")
    print(f"   usage={resp.usage}")
    print(f"   reply={text!r}")


if __name__ == "__main__":
    asyncio.run(main())
