"""用 DeepSeek Pro（.env）跑一条 ModelGateway 反诈脚本 JSON（需网络）。"""
from __future__ import annotations

import asyncio

from app.adapters.model_gateway import ModelGateway
from app.config import settings


async def main() -> None:
    items = [
        dict(title="假投资APP刷单", amount="约80万", summary="谎称稳赚诱骗转账"),
        dict(title="冒充公安冻结账户", amount="—", summary="诱导屏幕共享窃取密码"),
    ]
    async with ModelGateway(settings) as gw:
        out = await gw.text("smoke.gateway", {"news_items": items})
    print("hook:", str(out.get("hook", ""))[:120])
    print("body_lines:", len(out.get("body", []) or []))
    print("keys:", sorted(out.keys()))


if __name__ == "__main__":
    asyncio.run(main())
