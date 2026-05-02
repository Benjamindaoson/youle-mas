"""验证 `backend/.env` 里的 DeepSeek 配置可真实连通（不向仓库写入任何密钥）。"""
from __future__ import annotations

import asyncio

import httpx

from app.config import settings


async def _once(model: str, content: str) -> None:
    mt = 512 if model != settings.DEEPSEEK_MODEL_PRO else max(
        256, settings.DEEPSEEK_MAX_OUTPUT_TOKENS // 8
    )
    body = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": mt,
        "temperature": 0,
    }
    async with httpx.AsyncClient(timeout=120.0) as c:
        r = await c.post(
            f"{settings.DEEPSEEK_API_BASE.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}"},
            json=body,
        )
        text = ""
        try:
            data = r.json()
            text = (
                data.get("choices", [{}])[0].get("message", {}).get("content", "") or ""
            ).strip()
        except Exception:
            data = {}
        print(f"[{model}] HTTP {r.status_code} -> {text or data}")


async def main() -> None:
    if not settings.has_deepseek:
        raise SystemExit("settings.has_deepseek 为 False（检查 DEEPSEEK_API_KEY）")
    await _once("deepseek-chat", "只回复两个字：就绪")
    await _once(settings.DEEPSEEK_MODEL_PRO, "用一句话说你是什么模型即可。")


if __name__ == "__main__":
    asyncio.run(main())
