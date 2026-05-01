"""D agent — 办公文档能力（PDF / Excel / PPT / Word）。

V0 完全没有这个 agent。V1 新增。
内容/营销场景大量产出周报 PPT、复盘 Excel、品牌 PDF。

详见 docs/v1-architecture.md §4.5。
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from app.conductor.intent import Intent
from app.skills.registry import SkillStep


async def run(
    task: SkillStep,
    intent: Intent,
    upstream: list[Any],
    session_id: str,
) -> AsyncIterator[dict]:
    """[STUB] V1 实现策略：

    依赖（pyproject.toml 待加）：
    - python-pptx       PPT 生成
    - python-docx       Word 生成
    - openpyxl          Excel 读写（V0 已用，作为输入工具）
    - pypdf             PDF 解析
    - reportlab         PDF 生成（备选）

    skill 模板里 task.outputs 指明文件类型，本 agent 按类型走不同分支。
    """
    yield {
        "type": "chunk",
        "text": f"[D agent stub] task={task.task!r}",
        "capability": "D",
    }
    yield {
        "type": "artifact",
        "capability": "D",
        "artifact_type": "doc",
        "title": task.task or "D 产出",
        "content_inline": "<doc placeholder>",
    }
