"""脚本 JSON 校验工具，使用 Pydantic 模型验证脚本结构和字段约束。"""

from __future__ import annotations

import json
from pydantic import BaseModel, Field
from app.errors import ScriptValidationError


class ScriptSchema(BaseModel):
    """脚本结构定义，包含开头、正文、结尾等字段及其长度/范围约束。"""
    hook: str = Field(min_length=2, max_length=100)
    body: list[str] = Field(min_length=1)
    closing: str = Field(min_length=2, max_length=200)
    estimated_duration_seconds: int = Field(ge=10, le=300)
    evidence: list[dict] = Field(default_factory=list)


def validate_script(raw: str | dict) -> dict:
    """校验脚本数据，接受 JSON 字符串或字典，返回校验通过后的标准字典。"""
    try:
        if isinstance(raw, str):
            raw = json.loads(raw)
        schema = ScriptSchema(**raw)
        return schema.model_dump()
    except Exception as e:
        raise ScriptValidationError(f"脚本校验失败: {e}") from e
