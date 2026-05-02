"""意图澄清 — 当 Intent 信心不足时反问用户。

V1 实现：根据 missing_slots 生成 1-3 个反问，附带选项。
最多 2 轮，超时给"最佳猜测"。

2026-05-01 升级：
- has_anthropic → LLM 出针对用户原话的自然反问（"看起来你要发小红书，
  这次想要笔记封面图、笔记正文、还是 30 秒短视频？"）
- 无 key → 回退到固定模板（保留原行为）
"""
from __future__ import annotations

import json
import re

from pydantic import BaseModel, Field

from app.config import settings
from app.conductor.intent import Intent
from app.logging_config import logger


MAX_CLARIFY_ROUNDS = 2


class ClarifyQuestion(BaseModel):
    slot: str
    question: str
    options: list[str] = Field(default_factory=list)
    free_form: bool = False  # True = 用户自由输入，False = 在 options 里选


def needs_clarification(intent: Intent) -> bool:
    return intent.confidence < 0.7 or bool(intent.missing_slots)


async def generate_questions(intent: Intent) -> list[ClarifyQuestion]:
    """根据 missing_slots 出反问。

    优先用 LLM 出自然话术；无 key 或 LLM 失败 → 固定模板兜底。
    """
    if settings.has_anthropic and intent.missing_slots:
        try:
            return await _generate_with_llm(intent)
        except Exception as e:  # noqa: BLE001
            logger.warning("clarify_llm_failed_fallback_template", error=str(e))
    return _generate_template(intent)


# ============================ 模板兜底 ============================

def _generate_template(intent: Intent) -> list[ClarifyQuestion]:
    """固定话术。不依赖 LLM，永远成功。"""
    questions: list[ClarifyQuestion] = []
    if "deliverable_type" in intent.missing_slots:
        questions.append(ClarifyQuestion(
            slot="deliverable_type",
            question="你想要什么形式的成品？",
            options=["图片", "视频", "文档（PPT/Excel/PDF）", "文字"],
        ))
    if "vertical" in intent.missing_slots:
        questions.append(ClarifyQuestion(
            slot="vertical",
            question="这是哪类业务？",
            options=["电商", "内容创作", "品牌营销", "金融/反诈", "其他"],
        ))
    if "subject" in intent.missing_slots:
        questions.append(ClarifyQuestion(
            slot="subject",
            question="主题/对象是？",
            free_form=True,
        ))
    return questions[:3]


# ============================ LLM 自然话术 ============================

_CLARIFY_SYSTEM = """你是友善的需求澄清助手。给定用户原话和缺失槽位，
为每个缺失槽位生成 1 个**自然的反问**（不要机械重复槽位名）。

输出严格 JSON 数组：
[
  {
    "slot": "vertical | deliverable_type | subject",
    "question": "<≤25 字 中文 自然反问>",
    "options": ["<≤8 字>", ...],
    "free_form": false
  }
]

规则：
- vertical / deliverable_type 必须给 3-5 个 options 让用户选；free_form=false
- subject 没有合理 options → free_form=true，options=[]
- question 用第二人称、口语化、贴用户原话语境（不要"请告知您的需求"）
- 数组长度 = 缺失槽位数；保持顺序：vertical → deliverable_type → subject
- 只输出 JSON，不要解释。"""


async def _generate_with_llm(intent: Intent) -> list[ClarifyQuestion]:
    import anthropic  # noqa: WPS433

    user_msg = (
        f"用户原话：{intent.raw_user_text!r}\n"
        f"已识别：vertical={intent.vertical}, "
        f"deliverable={intent.deliverable_type}, subject={intent.subject!r}\n"
        f"缺失槽位：{intent.missing_slots}\n"
        f"为每个缺失槽位写 1 个自然反问。"
    )

    from app.adapters.model_router import pick_chat
    choice = pick_chat(purpose="conductor_clarify", prefer_provider="anthropic")
    client = anthropic.AsyncAnthropic(api_key=choice.api_key)
    resp = await client.messages.create(
        model=choice.model,
        max_tokens=choice.max_tokens,
        system=_CLARIFY_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    text = resp.content[0].text if resp.content else ""
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if not m:
        raise ValueError(f"no JSON array in clarify reply: {text[:200]!r}")
    data = json.loads(m.group(0))

    out: list[ClarifyQuestion] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        slot = item.get("slot", "")
        if slot not in ("vertical", "deliverable_type", "subject"):
            continue
        out.append(ClarifyQuestion(
            slot=slot,
            question=str(item.get("question", ""))[:80],
            options=[str(o)[:20] for o in (item.get("options") or [])][:5],
            free_form=bool(item.get("free_form", False)),
        ))
    return out[:3] if out else _generate_template(intent)


def merge_answers(intent: Intent, answers: dict[str, str]) -> Intent:
    """把用户的澄清回答合并回 intent。"""
    updated = intent.model_copy(deep=True)
    for slot, value in answers.items():
        if slot == "vertical":
            updated.vertical = _vertical_from_label(value)
        elif slot == "deliverable_type":
            updated.deliverable_type = _deliverable_from_label(value)
        elif slot == "subject":
            updated.subject = value
        else:
            updated.constraints[slot] = value
        if slot in updated.missing_slots:
            updated.missing_slots.remove(slot)
    if not updated.missing_slots:
        updated.confidence = max(updated.confidence, 0.8)
    return updated


def _vertical_from_label(label: str) -> str:
    table = {"电商": "ecommerce", "内容创作": "content",
             "品牌营销": "marketing", "金融/反诈": "finance"}
    return table.get(label, "other")


def _deliverable_from_label(label: str) -> str:
    table = {"图片": "image", "视频": "video",
             "文档（PPT/Excel/PDF）": "doc", "文字": "text"}
    return table.get(label, "text")
