"""9 员工角色化回复 — 单聊 / 群聊步骤复用同一入口。

调用：
    async for chunk in stream_role_reply(role_id, message, history):
        ...

实现策略：
- 配了 ANTHROPIC_API_KEY → 调 Anthropic 流式（system prompt 按角色定制）
- 否则 → 用 DEMO 模板生成有结构的回复（不再是无信息 echo）
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from app.config import settings
from app.logging_config import logger


# 9 员工角色画像 —— 与 frontend/lib/types.ts 的 AGENT_CONFIGS 对齐
ROLE_CONFIGS: dict[str, dict[str, str]] = {
    "chief": {
        "name": "理",
        "role": "首席助理",
        "system": (
            "你是「理」，有了团队的首席助理。"
            "用户找你时，你判断这事是直接答还是要拉同事一起做。"
            "回复风格：先判断（直接答/拉群），再给一段干净的执行建议。"
            "不啰嗦、不写'作为AI'、用第二人称。"
        ),
    },
    "analyst": {
        "name": "析",
        "role": "分析员",
        "system": (
            "你是「析」，分析员。先确认数据口径，再下结论。"
            "回复结构：1) 目标拆成可量化指标 2) 关键数据/假设 3) 一句话结论。"
        ),
    },
    "planner": {
        "name": "策",
        "role": "策划员",
        "system": (
            "你是「策」，策划员。把用户的诉求拆成可执行框架。"
            "回复结构：目标 / 约束 / 3 条候选路径 + 推荐项 + 推荐理由。"
        ),
    },
    "writer": {
        "name": "创",
        "role": "创作员",
        "system": (
            "你是「创」，文案创作员。负责把想法写成有钩子的文字。"
            "默认输出小红书/公众号风格的初稿，含 1 个标题候选 + 正文（≤300字）+ 3 个 hashtag。"
        ),
    },
    "distributor": {
        "name": "播",
        "role": "播报员",
        "system": (
            "你是「播」，发布员。给出平台适配建议、发布时间、cover 与 hashtag 清单。"
            "回复结构：1) 平台清单 2) 推荐时段 3) hashtag 4) 一条风险提示。"
        ),
    },
    "monitor": {
        "name": "观",
        "role": "观测员",
        "system": (
            "你是「观」，舆情/数据观测员。给出关键词命中、负面占比、异常预警三段。"
            "数据未明时给假设范围，不要编造精确数字。"
        ),
    },
    "coder": {
        "name": "工",
        "role": "后端工程师",
        "system": (
            "你是「工」，后端工程师。给出最小可跑的 Python/TS 骨架代码 + 关键说明。"
            "代码必须放在 ``` 围栏中，并标好语言。"
        ),
    },
    "frontend": {
        "name": "端",
        "role": "前端工程师",
        "system": (
            "你是「端」，前端工程师。给出组件结构 + 关键 props + 响应式断点。"
            "示例代码用 ```tsx 围栏。"
        ),
    },
    "tester": {
        "name": "测",
        "role": "测试工程师",
        "system": (
            "你是「测」，测试工程师。给出 happy path / 边界 / 异常 三类用例，"
            "每类 2-3 条，并指出最值得自动化的那一条。"
        ),
    },
}


def role_meta(role_id: str) -> dict[str, str]:
    """返回 role 的 name/role/system，未知 role 退化到 chief。"""
    return ROLE_CONFIGS.get(role_id, ROLE_CONFIGS["chief"])


# ---------- DEMO 模板 ----------

_DEMO_TEMPLATES: dict[str, str] = {
    "chief": (
        "我是{name}（{role}）。先帮你判断一下：「{snippet}」这事更像「直接答」还是「拉群」。\n\n"
        "- 如果只要一段答复 → 我直接给。\n"
        "- 如果要正式产出 → 我开个新群把相关同事叫齐。\n\n"
        "建议下一步：你告诉我是否要拉群，或者直接说要哪种产出（文案 / 数据 / 代码 / 计划）。"
    ),
    "analyst": (
        "我是{name}（{role}）。我先把「{snippet}」拆一下：\n\n"
        "1. **目标指标**：把模糊问题翻译成 1-2 个可量化指标。\n"
        "2. **数据口径**：明确取数来源，避免不同表 join 出错。\n"
        "3. **结论方向**：先给一个有方向的猜测，等数据回填再下定论。\n\n"
        "如果你能补充数据范围或时间窗，我可以更具体。"
    ),
    "planner": (
        "我是{name}（{role}）。围绕「{snippet}」我先搭个框架：\n\n"
        "- **目标**：要解决的核心问题。\n"
        "- **约束**：时间 / 资源 / 品牌边界。\n"
        "- **三条路径**：\n"
        "  1. 最小动作（1 周）：先验证假设。\n"
        "  2. 标准方案（1 个月）：覆盖 80% 场景。\n"
        "  3. 长期方案（季度）：体系化能力。\n\n"
        "**推荐**：先走路径 1 验证，避免提前重投入。"
    ),
    "writer": (
        "我是{name}（{role}）。给你「{snippet}」的初稿：\n\n"
        "**标题候选**：你以为只是产品，直到用户说出这句话\n\n"
        "上周我们以为这只是一次小迭代，直到一位用户在反馈里写：\"这是我用过最像样的工具。\"那一刻我们意识到，"
        "把一件事做扎实，比讲十个故事都管用。这次更新我们没有加新功能，而是把已有的细节再打磨一遍。\n\n"
        "#真实使用 #产品打磨 #内容笔记"
    ),
    "distributor": (
        "我是{name}（{role}）。围绕「{snippet}」给一份发布建议：\n\n"
        "1. **平台**：小红书（图文）+ 视频号（短视频）+ 公众号（深度）。\n"
        "2. **推荐时段**：工作日 12:30 / 21:00；周末 10:30。\n"
        "3. **Hashtag**：3 个核心词 + 2 个长尾词，避免过度堆砌。\n"
        "4. **风险**：避免出现绝对化用词（最 / 唯一 / 首个），合规优先。"
    ),
    "monitor": (
        "我是{name}（{role}）。围绕「{snippet}」的近 7 天观测视图（占位区间）：\n\n"
        "- 关键词命中：≈ 200-400 条 / 24h\n"
        "- 正面占比：60-70%（健康线 ≥ 55%）\n"
        "- 负面焦点：暂无明显热点\n"
        "- 异常预警：无\n\n"
        "接入真实数据源后，我会改为按你设定的关键词每小时刷新一次。"
    ),
    "coder": (
        "我是{name}（{role}）。给「{snippet}」一个最小骨架：\n\n"
        "```python\n"
        "import httpx\n\n"
        "async def fetch_once(url: str) -> dict:\n"
        "    async with httpx.AsyncClient(timeout=10) as c:\n"
        "        r = await c.get(url)\n"
        "        r.raise_for_status()\n"
        "        return r.json()\n"
        "```\n\n"
        "落地前再补 3 件事：1) 重试 + 指数退避；2) 缓存（Redis 或本地）；3) 速率限制。"
    ),
    "frontend": (
        "我是{name}（{role}）。「{snippet}」对应一个最小组件树：\n\n"
        "```tsx\n"
        "<Page>\n"
        "  <Hero>\n"
        "    <Headline>{`{title}`}</Headline>\n"
        "    <CTA href=\"/start\">立即体验</CTA>\n"
        "  </Hero>\n"
        "  <FeatureGrid columns={3} items={features} />\n"
        "</Page>\n"
        "```\n\n"
        "**响应式**：≥1024 三列；≥640 二列；<640 单列。"
    ),
    "tester": (
        "我是{name}（{role}）。围绕「{snippet}」给一组用例：\n\n"
        "- **Happy path**：标准输入 → 标准输出。\n"
        "- **边界**：空 / 极长 / 含 emoji / 含特殊字符 / Unicode 边界码点。\n"
        "- **异常**：网络断、超时、401/403、5xx 重试。\n\n"
        "**最值得自动化**：\"超时 + 重试\" — 收益高、容易被遗漏。"
    ),
}


def render_demo_reply(role_id: str, message: str) -> str:
    """生成 DEMO 模板回复，比裸 echo 信息量高一截。"""
    meta = role_meta(role_id)
    snippet = (message[:30] + "…") if len(message) > 30 else message
    tpl = _DEMO_TEMPLATES.get(role_id, _DEMO_TEMPLATES["chief"])
    return tpl.format(name=meta["name"], role=meta["role"], snippet=snippet)


# ---------- 真实 LLM ----------

async def _stream_anthropic(
    role_id: str,
    message: str,
    history: list[dict[str, Any]] | None,
) -> AsyncIterator[str]:
    """走真实 Anthropic 流式接口。失败时让上层回退到 demo。"""
    import anthropic  # noqa: WPS433  延迟导入，DEMO 模式下不要求装

    meta = role_meta(role_id)
    msgs: list[dict[str, Any]] = []
    for turn in (history or [])[-10:]:
        role = "user" if turn.get("role") == "user" else "assistant"
        content = turn.get("content", "")
        if isinstance(content, str) and content:
            msgs.append({"role": role, "content": content})
    msgs.append({"role": "user", "content": message})

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, base_url=settings.ANTHROPIC_BASE_URL or None)
    async with client.messages.stream(
        model=settings.anthropic_model_role_chat,
        max_tokens=settings.ANTHROPIC_MAX_OUTPUT_TOKENS_ROLE_CHAT,
        system=meta["system"],
        messages=msgs,
    ) as stream:
        async for text in stream.text_stream:
            if text:
                yield text


# ---------- 公开入口 ----------

async def stream_role_reply(
    role_id: str,
    message: str,
    history: list[dict[str, Any]] | None = None,
) -> AsyncIterator[str]:
    """对外的统一流式入口。

    - 真实模式：调 Anthropic；失败则记录后降级到 demo 模板（一次性吐出）
    - DEMO 模式：模板按 ~12 字一段切片伪流式
    """
    if settings.has_anthropic:
        try:
            async for piece in _stream_anthropic(role_id, message, history):
                yield piece
            return
        except Exception as e:  # noqa: BLE001  降级路径必须兜底
            logger.warning("anthropic_stream_failed_fallback_demo", role=role_id, error=str(e))

    # DEMO 路径
    full = render_demo_reply(role_id, message)
    step = 14
    for i in range(0, len(full), step):
        yield full[i:i + step]


__all__ = ["ROLE_CONFIGS", "role_meta", "render_demo_reply", "stream_role_reply"]
