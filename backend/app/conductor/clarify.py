"""意图澄清 — 当 Intent 信心不足时反问用户。

V1 实现：根据 missing_slots 生成 1-3 个反问，附带选项。
最多 2 轮，超时给"最佳猜测"。详见 docs/v1-architecture.md §3.1。
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.conductor.intent import Intent


MAX_CLARIFY_ROUNDS = 2


class ClarifyQuestion(BaseModel):
    slot: str
    question: str
    options: list[str] = Field(default_factory=list)
    free_form: bool = False  # True = 用户自由输入，False = 在 options 里选


def needs_clarification(intent: Intent) -> bool:
    return intent.confidence < 0.7 or bool(intent.missing_slots)


async def generate_questions(intent: Intent) -> list[ClarifyQuestion]:
    """[STUB] 根据 missing_slots 出反问。V1 由 LLM 生成更自然的话术。"""
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
