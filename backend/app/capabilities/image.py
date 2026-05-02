"""I agent — 图能力。

理解 / 生成 / 改图。Phase 3 实现：

- 4 级 fallback（沿用 V0 image_agent 已经稳定的策略）：
  1. upstream 给出 reference_image / image_url → 直接下载
  2. T agent 给出图生 prompt → 调 ModelGateway.image() 生成
  3. SiliconFlow 等 AI 模型 → 通过 model_gateway
  4. PIL 占位图（永远成功）
- 每张图都过 image_processor.resize_image() 做尺寸/格式标准化
- 真正的"理解 / 改图"在 Phase 3.5（需要 vision API）暂留接口

详见 docs/v1-architecture.md §4.3。
"""
from __future__ import annotations

import json
import os
import re
import uuid
from collections.abc import AsyncIterator
from typing import Any, TYPE_CHECKING

from app.adapters.model_gateway import ModelGateway
from app.adapters.tools.image_downloader import download_image
from app.adapters.tools.image_processor import InvalidImageError, resize_image
from app.adapters.tools.placeholder_image import create_placeholder
from app.config import settings

from app.logging_config import logger
from app.skills.registry import SkillStep



if TYPE_CHECKING:
    from app.conductor.intent import Intent

def _safe(sid: str) -> str:
    """Windows 路径不能含 `:`、`/`、`\\` 等；统一替换为下划线。"""
    s = re.sub(r"[^\w\-]", "_", sid or "")
    return re.sub(r"_+", "_", s).strip("_") or "default"


def _save_dir(session_id: str) -> str:
    base = os.path.join(settings.ARTIFACT_DIR, _safe(session_id), "images")
    os.makedirs(base, exist_ok=True)
    return base


def _extract_prompts_from_upstream(upstream: list[Any]) -> list[str]:
    """T agent 上一步的产出可能是 markdown 含 JSON 数组 / 也可能是纯文本。

    优先解析 'prompts' 数组；fallback 把每个 artifact 的内容当一条 prompt。
    """
    prompts: list[str] = []
    for entry in upstream or []:
        for art in (entry.get("artifacts") or []):
            text = art.get("content_inline") or ""
            # 尝试解析 {"prompts": [...]}
            try:
                # 容忍 markdown 代码块包裹
                stripped = text.strip()
                if "{" in stripped and "}" in stripped:
                    s = stripped[stripped.index("{"): stripped.rindex("}") + 1]
                    obj = json.loads(s)
                    if isinstance(obj, dict) and isinstance(obj.get("prompts"), list):
                        prompts.extend(str(p) for p in obj["prompts"])
                        continue
            except (json.JSONDecodeError, ValueError):
                pass
            if text:
                prompts.append(text[:400])
    return prompts


def _build_prompt_from_intent(intent: Intent, task: SkillStep) -> str:
    """没有上游 prompt 时，从 intent / task 拼一个最小 prompt。"""
    base = (task.prompt_template or task.task or "").strip()
    if base:
        return (base
                .replace("{subject}", intent.subject or "")
                .replace("{vertical}", intent.vertical or ""))
    return f"{intent.subject or 'subject'}, {intent.vertical} style, hyper-realistic, 4k"


async def _try_generate(prompt: str, save_dir: str) -> str | None:
    """单条 prompt 走 model_gateway.image() → download → resize 链路。"""
    if not settings.has_siliconflow:
        return None
    async with ModelGateway(settings) as gw:
        gen_url = await gw.image("image.generate", {"prompt": prompt})
    if not gen_url:
        return None
    path = await download_image(gen_url, save_dir)
    if not path:
        return None
    try:
        return await resize_image(path)
    except InvalidImageError as e:
        logger.warning("i_agent_resize_rejected", error=str(e), path=path)
        return None


async def _placeholder(intent: Intent, save_dir: str) -> str:
    """L4 兜底：永远成功的 PIL 占位图。"""
    text = intent.subject or intent.raw_user_text or "image"
    return await create_placeholder(text[:30], save_dir)


_REACT_KEYWORDS = (
    # HEAD: 看图 / 改图相关
    "看图", "理解", "改图", "调色", "测色", "审核", "review", "inspect",
    # 并入 master 的 vision 关键词，覆盖更广（feat(I-agent) ReAct 也能做单次理解）
    "分析", "审稿", "评估", "rate", "understand", "analyze", "describe",
)


def _should_use_react(task: SkillStep, upstream: list[Any]) -> bool:
    """判断是否走 ReAct（理解/改图）路径而非生成路径。

    条件：has_anthropic + task.task 含理解类关键词 + upstream 已经有图。
    """
    if not settings.has_anthropic:
        return False
    text = (task.task or "").lower()
    if not any(kw in text for kw in _REACT_KEYWORDS):
        return False
    # 找一张上游图
    for entry in upstream or []:
        for art in (entry.get("artifacts") or []):
            if (art.get("artifact_type") or "").startswith("image"):
                return True
    return False


def _is_vision_task(task: SkillStep) -> bool:
    """纯关键词分类器：task.task / outputs 含理解类词 → True。

    向后兼容 PR #9 的测试（test_v1_phase5_vision_skills_onepass.py）；
    实际路由在 run() 里走 _should_use_react（额外要求 upstream 有图）。
    """
    blob = (task.task or "") + " " + " ".join(task.outputs or [])
    blob = blob.lower()
    return any(kw in blob for kw in _REACT_KEYWORDS)


async def run(
    task: SkillStep,
    intent: Intent,
    upstream: list[Any],
    session_id: str,
) -> AsyncIterator[dict]:
    """执行一步图能力任务。

    两条路径：
    - **ReAct 理解/改图**：上游有图 + task 含"看/改/调色/分析/审稿"等关键词 → 走 vision tool_use
    - **生成**（默认）：无上游图或 task 是生成类 → 4 级 fallback 出图
    """

    save_dir = _save_dir(session_id)

    if _should_use_react(task, upstream):
        try:
            async for ev in _react_loop(task=task, upstream=upstream,
                                         session_id=session_id):
                yield ev
            return
        except Exception as e:  # noqa: BLE001
            logger.warning("i_agent_react_failed_fallback_generate", error=str(e))
            # 失败回退到生成路径

    # Step 1: 取上游 T agent 给的 prompt 数组（电商主图 skill 模式）
    prompts = _extract_prompts_from_upstream(upstream)
    if not prompts:
        prompts = [_build_prompt_from_intent(intent, task)]

    yield {"type": "chunk", "capability": "I",
           "text": f"为 {len(prompts)} 条 prompt 准备图片..."}

    produced_paths: list[str] = []
    for i, prompt in enumerate(prompts):
        # L1 直接 URL（reference_image）：upstream 没塞，先跳过；MVP 不在这里支持
        # L2 og:image：图能力一般无 url 输入，跳过
        # L3 AI 生成
        path: str | None = None
        if settings.has_siliconflow:
            path = await _try_generate(prompt, save_dir)

        # L4 占位图永远兜底
        if path is None:
            try:
                path = await _placeholder(intent, save_dir)
                logger.info("i_agent_used_placeholder",
                            session_id=session_id, idx=i)
            except Exception as e:  # noqa: BLE001
                logger.warning("i_agent_placeholder_failed", error=str(e))
                continue

        produced_paths.append(path)
        yield {
            "type": "artifact",
            "capability": "I",
            "artifact_type": "image",
            "title": f"{task.task or '配图'} #{i + 1}",
            "file_path": path,
            "mime_type": "image/jpeg",
            "session_id": session_id,
        }

    yield {
        "type": "chunk", "capability": "I",
        "text": f"完成：{len(produced_paths)} 张图保存在 {save_dir}",
    }


# ============================ ReAct 路径（理解/改图）============================


_MAX_TOOL_TURNS = 4


async def _react_loop(*, task: SkillStep, upstream: list[Any],
                       session_id: str) -> AsyncIterator[dict]:
    """vision tool_use 循环：让 I agent 自主选 inspect / resize / palette。"""
    import anthropic  # noqa: WPS433
    from app.adapters.model_router import pick_chat
    from app.capabilities.image_tools import TOOL_DEFS, call_tool

    choice = pick_chat(purpose="capability_I_describe", prefer_provider="anthropic")
    if not choice.available:
        raise RuntimeError("anthropic not available for I ReAct")

    # 给 LLM 一份上游已有图片的清单（便于它决定调哪个工具）
    img_paths = []
    for entry in upstream or []:
        for art in (entry.get("artifacts") or []):
            if (art.get("artifact_type") or "").startswith("image"):
                fp = art.get("file_path")
                if fp:
                    img_paths.append(fp)

    prompt = (
        f"任务：{task.task}\n\n"
        f"上游已有 {len(img_paths)} 张图，路径：\n"
        + "\n".join(f"  - {p}" for p in img_paths[:5])
        + "\n\n你可以用 image_inspect 看图、image_resize 改尺寸、palette_extract "
          "抽主色。完成后给一段中文总结（≤200 字）。"
    )

    client = anthropic.AsyncAnthropic(api_key=choice.api_key, base_url=choice.api_base or None)
    messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]

    yield {"type": "chunk", "capability": "I", "text": "[I ReAct] 启动 vision 分析..."}

    summary_text = ""
    for turn in range(_MAX_TOOL_TURNS + 1):
        tools_arg = TOOL_DEFS if turn < _MAX_TOOL_TURNS else None
        kwargs: dict[str, Any] = {
            "model": choice.model,
            "max_tokens": choice.max_tokens,
            "messages": messages,
        }
        if tools_arg:
            kwargs["tools"] = tools_arg

        resp = await client.messages.create(**kwargs)
        tool_uses: list[dict[str, Any]] = []
        round_text = ""
        for block in resp.content:
            if block.type == "text":
                round_text += block.text
            elif block.type == "tool_use":
                tool_uses.append({"id": block.id, "name": block.name,
                                   "input": dict(block.input or {})})

        if round_text:
            summary_text += round_text
            yield {"type": "chunk", "capability": "I", "text": round_text}

        if not tool_uses:
            break

        messages.append({"role": "assistant", "content": resp.content})

        tool_results: list[dict[str, Any]] = []
        for tu in tool_uses:
            yield {"type": "tool_call", "capability": "I",
                   "tool": tu["name"], "input": tu["input"], "turn": turn + 1}
            result = await call_tool(tu["name"], tu["input"])
            yield {"type": "tool_result", "capability": "I",
                   "tool": tu["name"], "result": result, "turn": turn + 1}
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tu["id"],
                "content": _serialize_tool_result(result),
            })
        messages.append({"role": "user", "content": tool_results})

    # ReAct 结束 → 把总结作为 markdown artifact 落盘
    yield {
        "type": "artifact",
        "capability": "I",
        "artifact_type": "markdown",
        "title": task.task or "I 看图分析",
        "content_inline": summary_text or "（无文本输出）",
        "session_id": session_id,
    }


def _serialize_tool_result(result: Any) -> str:
    """tool_result content 必须是字符串。"""
    import json
    try:
        return json.dumps(result, ensure_ascii=False)[:8000]
    except (TypeError, ValueError):
        return str(result)[:8000]
