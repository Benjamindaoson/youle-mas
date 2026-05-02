"""T agent — 文字/语言能力。

用户原话定义 agent1 = "文字 + 思考 + 推理 + 数据收集 + 分析"。

Phase 2 → 2026-05-01 升级：
- prompt 渲染（{subject} {vertical} {raw} 占位 + vertical_prompts 叠加）
- has_anthropic → **Anthropic ReAct tool_use 循环**：T 可自主决定调
  web_search / read_url / read_excel（见 text_tools.py），实现"思考+查+写"
- has_deepseek（且无 Anthropic）→ **DeepSeek Chat** 单次补全（含出图 prompt 的 JSON）
- 全无 → 模板 fallback（仅用于开发占位）

ReAct 安全护栏：MAX_TOOL_TURNS=4，避免 LLM 无限套娃；
每次工具调用都流式 yield "tool_call" / "tool_result" 事件给前端做透明性。

详见 docs/v1-architecture.md §4.2。
"""
from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from typing import Any

import yaml

from typing import TYPE_CHECKING

from app.config import settings
from app.skills.registry import SkillStep
from app.logging_config import logger

if TYPE_CHECKING:
    from app.conductor.intent import Intent


# 行业垂直 prompt 增量缓存
_VERTICAL_DIR = Path(__file__).resolve().parents[2] / "vertical_prompts"
_VERTICAL_CACHE: dict[str, dict] = {}


def _load_vertical(vertical: str) -> dict:
    if vertical in _VERTICAL_CACHE:
        return _VERTICAL_CACHE[vertical]
    f = _VERTICAL_DIR / f"{vertical}.yaml"
    if not f.is_file():
        f = _VERTICAL_DIR / "default.yaml"
    if not f.is_file():
        return {}
    try:
        data = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
    except Exception as e:  # noqa: BLE001
        logger.warning("vertical_prompt_load_failed", vertical=vertical, error=str(e))
        data = {}
    _VERTICAL_CACHE[vertical] = data
    return data


def _render_prompt(task: SkillStep, intent: Intent, upstream: list[Any]) -> str:
    """skill.prompt_template + vertical 叠加 + slot 替换。"""
    vertical_cfg = _load_vertical(intent.vertical or "default")
    t_cfg = (vertical_cfg.get("T") or {})
    prefix = (t_cfg.get("prefix") or "").strip()
    suffix = (t_cfg.get("suffix") or "").strip()

    body = (task.prompt_template or task.task or "").strip()
    body = (body
            .replace("{subject}", intent.subject or "")
            .replace("{vertical}", intent.vertical or "other")
            .replace("{raw}", intent.raw_user_text or ""))

    parts = [p for p in (prefix, body, suffix) if p]
    return "\n\n".join(parts)


MAX_TOOL_TURNS = 4   # ReAct 套娃硬上限，避免 LLM 无限循环


def _chunk_for_stream(full_text: str) -> Iterator[str]:
    """把整段正文切成若干 chunk，前端流式显示更顺滑。"""
    if not full_text:
        return
    step = max(40, min(160, len(full_text) // 12 or 48))
    for i in range(0, len(full_text), step):
        yield full_text[i : i + step]


def _deepseek_system_hint(task: SkillStep) -> str:
    """无 Anthropic 时走 DeepSeek：对「出图 prompt」强制 JSON，其余走中文正文。"""
    td = (task.task or "").lower()
    if "prompt" in td or "图" in td or "image" in td or "主图" in td:
        return (
            "你是电商视觉与静物摄影指导。"
            "只输出合法 JSON 字符串，格式为 {\"prompts\": [\"提示1\", \"提示2\"]}，恰好两个条目。"
            "提示需适合文生图模型，可到中英文混合。禁止 markdown 围栏，禁止前后解释。"
        )
    return (
        "你是营销与文案助手。按要求用简体中文作答，条理清晰。"
        "勿编造法律法规或不实数据。"
    )


async def _deepseek_text_complete(task: SkillStep, user_prompt: str) -> str:
    """OpenAI-compat Chat Completions，模型默认走 DEEPSEEK_MODEL_FLASH（一般为 deepseek-chat）。"""
    import httpx

    system = _deepseek_system_hint(task)
    model = (settings.DEEPSEEK_MODEL_FLASH or "deepseek-chat").strip()
    url = f"{settings.DEEPSEEK_API_BASE.rstrip('/')}/chat/completions"
    messages: list[dict[str, str]] = []
    if system.strip():
        messages.append({"role": "system", "content": system.strip()})
    messages.append({"role": "user", "content": user_prompt})

    max_out = getattr(settings, "DEEPSEEK_MAX_OUTPUT_TOKENS", 8192)
    body: dict[str, object] = {
        "model": model,
        "messages": messages,
        "max_tokens": max(512, min(8192, int(max_out))),
        "temperature": 0.55,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}"},
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()

    msg = (data.get("choices") or [{}])[0].get("message") or {}
    content = msg.get("content")
    return content.strip() if isinstance(content, str) and content.strip() else ""


async def run(
    task: SkillStep,
    intent: Intent,
    upstream: list[Any],
    session_id: str,
) -> AsyncIterator[dict]:
    prompt = _render_prompt(task, intent, upstream)

    full_text = ""
    if settings.has_anthropic:
        try:
            async for ev in _react_loop(prompt, task=task):
                if ev["type"] == "chunk":
                    full_text += ev["text"]
                yield ev
        except Exception as e:  # noqa: BLE001
            logger.warning("text_capability_react_failed_fallback", error=str(e))
            if settings.has_deepseek:
                full_text = await _deepseek_text_complete(task, prompt)
            else:
                full_text = _template_fallback(task, intent)
            if full_text:
                for piece in _chunk_for_stream(full_text):
                    yield {"type": "chunk", "text": piece, "capability": "T"}
            else:
                full_text = _template_fallback(task, intent)
                yield {"type": "chunk", "text": full_text, "capability": "T"}
    elif settings.has_deepseek:
        try:
            full_text = await _deepseek_text_complete(task, prompt)
        except Exception as e:  # noqa: BLE001
            logger.warning("text_deepseek_failed_template", error=str(e))
            full_text = ""
        if not full_text.strip():
            full_text = _template_fallback(task, intent)
        for piece in _chunk_for_stream(full_text):
            yield {"type": "chunk", "text": piece, "capability": "T"}
    else:
        full_text = _template_fallback(task, intent)
        yield {"type": "chunk", "text": full_text, "capability": "T"}

    yield {
        "type": "artifact",
        "capability": "T",
        "artifact_type": "markdown",
        "title": task.task or "T 产出",
        "content_inline": full_text,
        "session_id": session_id,
    }


async def _react_loop(
    prompt: str,
    *,
    task: SkillStep,
) -> AsyncIterator[dict]:
    """Anthropic tool_use ReAct 循环。

    一轮 = 模型可能选 1) 直接回答；2) 调一个或多个工具。
    工具结果回喂模型，下一轮模型再决定。最多 MAX_TOOL_TURNS 轮硬中断。
    """
    import anthropic  # noqa: WPS433
    from app.capabilities.text_tools import TOOL_DEFS, call_tool

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]

    for turn in range(MAX_TOOL_TURNS + 1):
        # 最后一轮强制不再给 tools，逼模型给最终答案
        tools_arg = TOOL_DEFS if turn < MAX_TOOL_TURNS else None
        kwargs: dict[str, Any] = {
            "model": settings.anthropic_model_capability_text,
            "max_tokens": settings.ANTHROPIC_MAX_OUTPUT_TOKENS_CAPABILITY_TEXT,
            "messages": messages,
        }
        if tools_arg:
            kwargs["tools"] = tools_arg

        # 这一轮 stream（用 stream API 拿增量）
        text_blocks: list[str] = []
        tool_uses: list[dict[str, Any]] = []
        async with client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                text_blocks.append(text)
                yield {"type": "chunk", "text": text, "capability": "T"}
            final = await stream.get_final_message()

        # 收集本轮 tool_use blocks
        for block in final.content:
            if block.type == "tool_use":
                tool_uses.append({
                    "id": block.id,
                    "name": block.name,
                    "input": dict(block.input or {}),
                })

        # 没有 tool_use → 模型已经给最终答案，结束
        if not tool_uses:
            return

        # 把 assistant 的 content 原样追加（包括 tool_use blocks）
        messages.append({"role": "assistant", "content": final.content})

        # 调每个工具，把结果作为 user 的 tool_result 回写
        tool_results: list[dict[str, Any]] = []
        for tu in tool_uses:
            yield {
                "type": "tool_call",
                "capability": "T",
                "tool": tu["name"],
                "input": tu["input"],
                "turn": turn + 1,
            }
            result = await call_tool(tu["name"], tu["input"])
            yield {
                "type": "tool_result",
                "capability": "T",
                "tool": tu["name"],
                "result": result,
                "turn": turn + 1,
            }
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tu["id"],
                "content": _serialize_tool_result(result),
            })
        messages.append({"role": "user", "content": tool_results})

    # 上限了还没收敛 → 警告但不 raise
    logger.warning("text_react_max_turns_reached", task=task.task)


def _serialize_tool_result(result: Any) -> str:
    """tool_result content 必须是字符串（Anthropic 规定）。"""
    import json
    try:
        return json.dumps(result, ensure_ascii=False)[:8000]
    except (TypeError, ValueError):
        return str(result)[:8000]


def _template_fallback(task: SkillStep, intent: Intent) -> str:
    """无 LLM 时根据 task / intent 生成一份"够看"的模板产出。

    不假装是 AI 输出 — 明确标注为 [DEMO 模板]，让用户知道接 key 后会有真内容。"""
    subj = intent.subject or "目标对象"
    task_desc = (task.task or "").lower()

    if "标题" in task_desc:
        # 小红书 / 公众号标题
        titles = [
            f"{subj} 的 3 个秘密，第 2 个我没敢告诉闺蜜 ✨",
            f"7 天做完 {subj}，我妈说像换了个人 😯",
            f"我用 100 块搞定了 {subj}，附详细清单",
            f"为什么人人都在做 {subj}？亲测 30 天有变化 💡",
            f"关于 {subj}，可能 90% 的人都搞错了",
        ]
        return "[DEMO 模板·配 ANTHROPIC_API_KEY 后切换为真 LLM]\n\n" + \
               "\n".join(f"- {t}" for t in titles)

    if "prompt" in task_desc or "图" in task_desc:
        # 图片生成 prompt
        return ("[DEMO 模板·配 LLM key 后切换为真生成 prompt]\n\n"
                f'{{"prompts": [\n'
                f'  "{subj}, white background, studio lighting, '
                f'product photography, hyper-realistic, 8k",\n'
                f'  "{subj}, lifestyle scene, soft natural light, '
                f'minimalist composition, photography 4k"\n'
                f"]}}")

    if "alt" in task_desc or "caption" in task_desc:
        return ("[DEMO 模板·配 LLM key 后切换为真文案]\n\n"
                f"alt：精选 {subj} · 实拍图 · 高清细节\n"
                f"详情副标题：用心选材，每个细节都为你考虑。"
                f"今天为你带来 {subj}，看看是否合心意。")

    # 通用兜底
    return ("[DEMO 模板·配 ANTHROPIC_API_KEY 后切换为真 LLM]\n\n"
            f"针对你的需求「{intent.raw_user_text}」，"
            f"以下是初版思路：\n"
            f"1. 主题：{subj}\n"
            f"2. 行业：{intent.vertical}\n"
            f"3. 形式：{intent.deliverable_type}\n\n"
            f"配置 LLM key 后此处会替换为按 prompt 模板真实生成的内容。")
