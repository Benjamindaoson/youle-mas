"""T agent 可用的工具（让 T 不只是"写"，还能"查 / 读 / 算"）。

设计：
- 每个 tool 是一个独立 async 函数 + 一份 Anthropic tool 定义（JSONSchema）
- DEMO 模式下走占位返回，让 ReAct 循环跑通；配 key 后接真服务
- 工具失败永不抛异常，永远返回 dict（让 LLM 自己读到错误信息再决策）

用户原话定义 agent1 = "文字 + 思考 + 推理 + 数据收集 + 分析"。
本文件是"数据收集 / 分析"的入口。

V1 阶段实现这 3 个最高 ROI 工具：
    - web_search : 查公开信息 / 竞品 / 榜单
    - read_url   : 读 url（HTML 抽正文）
    - read_excel : 读上传的 .xlsx / .csv 出表格摘要
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from app.config import settings
from app.logging_config import logger


# Anthropic tool definitions（JSONSchema 格式，喂给 messages.create 的 tools 参数）
TOOL_DEFS: list[dict[str, Any]] = [
    {
        "name": "web_search",
        "description": (
            "搜索公开网络获取信息。适用：找竞品、查近期新闻、看行业数据、"
            "确认事实。返回前 N 条结果（标题 + url + 摘要）。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "检索词，中文或英文"},
                "top_k": {"type": "integer", "description": "返回条数 1-10",
                          "default": 5},
            },
            "required": ["query"],
        },
    },
    {
        "name": "read_url",
        "description": (
            "抓取指定 URL 的页面正文。适用：读取竞品文章、官网信息、新闻全文。"
            "只能读公开页面，会拒绝内网 / 本地地址。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "完整 https URL"},
                "max_chars": {"type": "integer",
                               "description": "正文截断长度，默认 4000",
                               "default": 4000},
            },
            "required": ["url"],
        },
    },
    {
        "name": "read_excel",
        "description": (
            "读取已上传的 Excel/CSV 文件，返回前 N 行 + 列名 + 行数。适用：用户提供"
            "数据表格让你做分析时调用。文件路径来自上下文 input_file_path 字段。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "本地路径（绝对路径）"},
                "max_rows": {"type": "integer",
                              "description": "采样行数，默认 20",
                              "default": 20},
            },
            "required": ["file_path"],
        },
    },
]


# ============================ 工具实现 ============================


async def web_search(query: str, top_k: int = 5) -> dict:
    """搜索引擎查询。

    V1 占位：DEMO 返回 fixture 结果；接 Tavily / SerpAPI key 后真查。
    """
    top_k = max(1, min(int(top_k or 5), 10))
    api_key = os.getenv("TAVILY_API_KEY", "")
    if api_key:
        try:
            return await _web_search_tavily(query, top_k, api_key)
        except Exception as e:  # noqa: BLE001
            logger.warning("web_search_tavily_failed", error=str(e))

    # DEMO 占位：返回有结构的假结果，让 LLM 还能基于此推理
    return {
        "query": query,
        "demo": True,
        "results": [
            {
                "title": f"[DEMO] 关于「{query}」的近期讨论 #{i+1}",
                "url": f"https://example.com/demo-{i+1}",
                "snippet": (
                    f"DEMO 占位返回（配 TAVILY_API_KEY 后切换为真搜索）。"
                    f"模拟一条与「{query}」相关的摘要片段 #{i+1}"
                ),
            }
            for i in range(top_k)
        ],
    }


async def _web_search_tavily(query: str, top_k: int, api_key: str) -> dict:
    """Tavily Search API 真实现。"""
    import httpx
    async with httpx.AsyncClient(timeout=15.0) as c:
        resp = await c.post(
            "https://api.tavily.com/search",
            json={
                "api_key": api_key,
                "query": query,
                "max_results": top_k,
                "search_depth": "basic",
            },
        )
        resp.raise_for_status()
        data = resp.json()
    return {
        "query": query,
        "demo": False,
        "results": [
            {"title": r.get("title", ""), "url": r.get("url", ""),
             "snippet": r.get("content", "")[:300]}
            for r in (data.get("results") or [])[:top_k]
        ],
    }


async def read_url(url: str, max_chars: int = 4000) -> dict:
    """抓取 URL 正文。

    用 httpx + bs4 抽 <article> / <main> / <body>。
    SSRF 防护：拒绝 localhost / 内网。
    """
    import httpx
    from urllib.parse import urlparse

    from app.utils import is_private_or_loopback

    max_chars = max(500, min(int(max_chars or 4000), 20000))
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return {"error": "invalid_scheme", "url": url}
    if not parsed.hostname or is_private_or_loopback(parsed.hostname):
        return {"error": "blocked_host", "url": url}

    try:
        async with httpx.AsyncClient(timeout=10.0,
                                      follow_redirects=True,
                                      headers={"User-Agent": "Youle/0.1"}) as c:
            resp = await c.get(url)
            resp.raise_for_status()
            html = resp.text
    except Exception as e:  # noqa: BLE001
        return {"error": "fetch_failed", "url": url, "reason": str(e)}

    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "aside"]):
            tag.decompose()
        body = (soup.find("article") or soup.find("main") or soup.body or soup)
        text = body.get_text("\n", strip=True) if body else ""
        title = soup.title.string.strip() if soup.title and soup.title.string else ""
    except Exception as e:  # noqa: BLE001
        return {"error": "parse_failed", "url": url, "reason": str(e)}

    return {
        "url": url,
        "title": title[:200],
        "content": text[:max_chars],
        "truncated": len(text) > max_chars,
    }


async def read_excel(file_path: str, max_rows: int = 20) -> dict:
    """读 Excel/CSV 出列名 + 前 N 行 + 总行数。

    限制：只允许读 settings.UPLOAD_DIR 或 ARTIFACT_DIR 下的文件，防越权。
    """
    max_rows = max(1, min(int(max_rows or 20), 200))

    # 路径白名单：必须在 UPLOAD_DIR / ARTIFACT_DIR 下
    abs_path = os.path.abspath(file_path)
    allowed_roots = [
        os.path.abspath(settings.UPLOAD_DIR),
        os.path.abspath(settings.ARTIFACT_DIR),
    ]
    if not any(abs_path.startswith(r) for r in allowed_roots):
        return {"error": "path_not_allowed", "file_path": file_path,
                "hint": "只允许读取 uploads/ 或 artifacts/ 下的文件"}
    if not os.path.isfile(abs_path):
        return {"error": "file_not_found", "file_path": file_path}

    try:
        import pandas as pd
        ext = Path(abs_path).suffix.lower()
        if ext in (".xlsx", ".xls"):
            df = pd.read_excel(abs_path, nrows=max_rows + 1)
        elif ext == ".csv":
            df = pd.read_csv(abs_path, nrows=max_rows + 1)
        else:
            return {"error": "unsupported_extension", "ext": ext}
    except Exception as e:  # noqa: BLE001
        return {"error": "read_failed", "reason": str(e)}

    head = df.head(max_rows)
    return {
        "file_path": file_path,
        "columns": [str(c) for c in head.columns],
        "row_count": int(df.shape[0]),
        "rows": head.to_dict(orient="records"),
    }


# ============================ Dispatch ============================


_TOOL_DISPATCH = {
    "web_search": web_search,
    "read_url": read_url,
    "read_excel": read_excel,
}


async def call_tool(name: str, tool_input: dict) -> dict:
    """根据 tool_use_block.name 调对应函数；未知工具返回 error。"""
    fn = _TOOL_DISPATCH.get(name)
    if fn is None:
        return {"error": "unknown_tool", "name": name}
    try:
        return await fn(**(tool_input or {}))
    except TypeError as e:
        # 参数不匹配（LLM 给错字段）
        return {"error": "bad_arguments", "name": name, "reason": str(e)}
    except Exception as e:  # noqa: BLE001
        logger.warning("tool_call_failed", name=name, error=str(e))
        return {"error": "tool_failed", "name": name, "reason": str(e)}


__all__ = ["TOOL_DEFS", "call_tool"]
