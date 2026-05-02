"""I agent 可用的工具。

让"图"能力 agent 不只是"出图"，还能"看图、测尺寸、提色板"。
对应用户原话：agent2 = 理解图、生成图、改图。

V1 提供 3 个工具：
    - image_inspect      : Anthropic vision 看图描述（理解）
    - image_resize       : 复用 adapters/tools/image_processor 改尺寸（改）
    - palette_extract    : Pillow 抽前 N 个主色（设计辅助）

工具失败永不抛异常，返回带 error 字段的 dict 让 LLM 自己读到再决策。
"""
from __future__ import annotations

import base64
import os
from collections import Counter
from pathlib import Path
from typing import Any

from app.config import settings
from app.logging_config import logger


TOOL_DEFS: list[dict[str, Any]] = [
    {
        "name": "image_inspect",
        "description": (
            "用 vision 模型看一张图，返回 200 字以内的描述（主体 / 风格 / "
            "色调 / 构图 / 是否含文字）。适用：理解上游图、为改图作前置分析。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string",
                               "description": "本地图像路径（uploads/ artifacts/ 下）"},
                "question": {"type": "string",
                              "description": "想问图什么；不填则默认通用描述",
                              "default": ""},
            },
            "required": ["file_path"],
        },
    },
    {
        "name": "image_resize",
        "description": (
            "改图尺寸 / 格式标准化。常用：电商主图必须 1024x1024 白底；"
            "公众号头图横版 2.35:1。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string"},
                "target": {
                    "type": "string",
                    "description": "目标尺寸，如 '1024x1024' / '1080x608'",
                },
            },
            "required": ["file_path", "target"],
        },
    },
    {
        "name": "palette_extract",
        "description": (
            "从图里抽前 N 个主色（HEX）。给 brand 一致性检查 / 配色参考用。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string"},
                "n": {"type": "integer", "default": 5,
                       "description": "返回几个主色，1-10"},
            },
            "required": ["file_path"],
        },
    },
]


# ============================ 工具实现 ============================


def _validate_path(file_path: str) -> tuple[str | None, dict | None]:
    """路径白名单 + 文件存在校验。返回 (abs_path, error_dict)。"""
    abs_path = os.path.abspath(file_path)
    allowed_roots = [
        os.path.abspath(settings.UPLOAD_DIR),
        os.path.abspath(settings.ARTIFACT_DIR),
    ]
    if not any(abs_path.startswith(r) for r in allowed_roots):
        return None, {"error": "path_not_allowed", "file_path": file_path,
                       "hint": "只允许读取 uploads/ 或 artifacts/ 下的文件"}
    if not os.path.isfile(abs_path):
        return None, {"error": "file_not_found", "file_path": file_path}
    return abs_path, None


async def image_inspect(file_path: str, question: str = "") -> dict:
    """vision 看图。"""
    abs_path, err = _validate_path(file_path)
    if err:
        return err

    from app.adapters.model_router import pick_chat
    choice = pick_chat(purpose="capability_I_describe", prefer_provider="anthropic")
    if not choice.available:
        return {"error": "no_vision_model", "hint": "需要配置 ANTHROPIC_API_KEY"}

    try:
        with open(abs_path, "rb") as f:
            img_bytes = f.read()
        b64 = base64.standard_b64encode(img_bytes).decode("ascii")
    except OSError as e:
        return {"error": "read_failed", "reason": str(e)}

    ext = Path(abs_path).suffix.lower().lstrip(".") or "jpeg"
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "webp": "image/webp", "gif": "image/gif"}.get(ext, "image/jpeg")

    prompt_q = question.strip() or (
        "请用 ≤200 字描述这张图：1) 主体 2) 风格调性 3) 主色调 "
        "4) 构图（居中/对称/三分等）5) 是否含文字。中文回答。"
    )

    try:
        import anthropic  # noqa: WPS433
        client = anthropic.AsyncAnthropic(api_key=choice.api_key, base_url=choice.api_base or None)
        resp = await client.messages.create(
            model=choice.model,
            max_tokens=choice.max_tokens,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image",
                     "source": {"type": "base64", "media_type": mime, "data": b64}},
                    {"type": "text", "text": prompt_q},
                ],
            }],
        )
        desc = resp.content[0].text if resp.content else ""
    except Exception as e:  # noqa: BLE001
        logger.warning("image_inspect_failed", path=file_path, error=str(e))
        return {"error": "vision_call_failed", "reason": str(e)}

    return {"file_path": file_path, "description": desc[:1500]}


async def image_resize(file_path: str, target: str) -> dict:
    """复用 image_processor.resize_image 做尺寸标准化。"""
    abs_path, err = _validate_path(file_path)
    if err:
        return err
    if "x" not in target.lower():
        return {"error": "bad_target_format", "hint": "target 形如 '1024x1024'"}

    try:
        w_str, h_str = target.lower().split("x", 1)
        w, h = int(w_str), int(h_str)
    except ValueError:
        return {"error": "bad_target_format", "target": target}

    if not (32 <= w <= 4096 and 32 <= h <= 4096):
        return {"error": "size_out_of_range", "hint": "32-4096"}

    try:
        from PIL import Image
        save_dir = os.path.dirname(abs_path)
        out_name = f"resized_{w}x{h}_{Path(abs_path).name}"
        out_path = os.path.join(save_dir, out_name)
        with Image.open(abs_path) as im:
            im_resized = im.convert("RGB").resize((w, h), Image.LANCZOS)
            im_resized.save(out_path, format="JPEG", quality=92)
    except Exception as e:  # noqa: BLE001
        return {"error": "resize_failed", "reason": str(e)}

    return {"file_path": out_path, "width": w, "height": h}


async def palette_extract(file_path: str, n: int = 5) -> dict:
    """Pillow 抽主色（quantize 到 n 色，按出现频次降序返回 HEX）。"""
    n = max(1, min(int(n or 5), 10))
    abs_path, err = _validate_path(file_path)
    if err:
        return err

    try:
        from PIL import Image
        with Image.open(abs_path) as im:
            small = im.convert("RGB").resize((128, 128))
            quant = small.quantize(colors=n)
            palette = quant.getpalette()[:n * 3]
            counts = Counter(quant.getdata())
        top_idx = [idx for idx, _ in counts.most_common(n)]
        hex_colors: list[str] = []
        for idx in top_idx:
            r, g, b = palette[idx * 3], palette[idx * 3 + 1], palette[idx * 3 + 2]
            hex_colors.append(f"#{r:02x}{g:02x}{b:02x}")
    except Exception as e:  # noqa: BLE001
        return {"error": "palette_failed", "reason": str(e)}

    return {"file_path": file_path, "n": n, "colors": hex_colors}


# ============================ Dispatch ============================


_TOOL_DISPATCH = {
    "image_inspect": image_inspect,
    "image_resize": image_resize,
    "palette_extract": palette_extract,
}


async def call_tool(name: str, tool_input: dict) -> dict:
    fn = _TOOL_DISPATCH.get(name)
    if fn is None:
        return {"error": "unknown_tool", "name": name}
    try:
        return await fn(**(tool_input or {}))
    except TypeError as e:
        return {"error": "bad_arguments", "name": name, "reason": str(e)}
    except Exception as e:  # noqa: BLE001
        logger.warning("image_tool_call_failed", name=name, error=str(e))
        return {"error": "tool_failed", "name": name, "reason": str(e)}


__all__ = ["TOOL_DEFS", "call_tool"]
