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


async def run(
    task: SkillStep,
    intent: Intent,
    upstream: list[Any],
    session_id: str,
) -> AsyncIterator[dict]:
    """执行一步图能力任务，按 4 级 fallback 出图。"""
    save_dir = _save_dir(session_id)

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
