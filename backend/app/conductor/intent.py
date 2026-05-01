"""意图理解 — 把用户原话解析成结构化 Intent。

V1 Phase 2 实现：
- 有 ANTHROPIC_API_KEY → LLM 结构化抽取 (tool_use / json mode)
- 无 key                → 启发式兜底（关键词 → vertical / deliverable_type，
                          subject 取除关键词外的剩余词）

启发式兜底**故意做"够用"**：能让 80% 的清晰提问跳过 clarify 进入 skill 检索；
模糊或缺槽位的话则保留 missing_slots，触发 Clarify 循环。

详见 docs/v1-architecture.md §3。
"""
from __future__ import annotations

import json
import re
from typing import Literal

from pydantic import BaseModel, Field

from app.config import settings
from app.logging_config import logger


VerticalId = Literal["ecommerce", "content", "marketing", "finance", "other"]
DeliverableType = Literal["image", "video", "doc", "text", "bundle"]


class Intent(BaseModel):
    """用户意图的结构化表示。"""
    vertical: VerticalId = "other"
    deliverable_type: DeliverableType = "text"
    subject: str = ""
    constraints: dict = Field(default_factory=dict)
    raw_user_text: str = ""
    confidence: float = 0.0
    missing_slots: list[str] = Field(default_factory=list)


# ============================ 启发式词典 ============================

_VERTICAL_KEYWORDS: dict[VerticalId, list[str]] = {
    "ecommerce": ["电商", "淘宝", "京东", "拼多多", "主图", "详情页", "sku", "店铺", "上架"],
    "content":   ["小红书", "公众号", "抖音", "视频号", "知乎", "b站", "bilibili",
                  "笔记", "种草", "爆款", "推文", "标题", "文案"],
    "marketing": ["品牌", "营销", "传播", "投放", "广告", "海报", "kol", "种草",
                  "新品", "发布", "campaign"],
    "finance":   ["反诈", "防诈", "金融", "理财", "贷款", "保险"],
}

_DELIVERABLE_KEYWORDS: dict[DeliverableType, list[str]] = {
    "image":  ["图", "海报", "封面", "插画", "主图", "banner", "壁纸"],
    "video":  ["视频", "短片", "vlog", "口播", "短视频", "tvc"],
    "doc":    ["ppt", "pptx", "excel", "xlsx", "pdf", "word", "docx", "报告",
               "周报", "月报", "复盘", "演示", "幻灯片"],
    "text":   ["文案", "标题", "脚本", "prompt", "邮件", "推文", "口播稿",
               "笔记", "公告", "话术"],
}


def _score_keywords(text: str, kw_dict: dict) -> tuple[str, int]:
    """返回 (best_key, hit_count)；无命中时返回 ("", 0)。"""
    lowered = text.lower()
    best_key = ""
    best_hits = 0
    for key, kws in kw_dict.items():
        hits = sum(1 for kw in kws if kw.lower() in lowered)
        if hits > best_hits:
            best_hits = hits
            best_key = key
    return best_key, best_hits


def _extract_subject(text: str) -> str:
    """启发式抽 subject：
    - 拆 ' / 帮我 / 给 / 写 / 做 / 一个 / 一份' 等口语前缀
    - 去掉所有命中的关键词
    - 剩下的连起来作为 subject"""
    cleaned = text
    for prefix in ["帮我", "请", "我想", "我要", "麻烦", "可以", "请你"]:
        cleaned = cleaned.replace(prefix, "")
    # 删去 deliverable / vertical 关键词本身
    for kws in (*_DELIVERABLE_KEYWORDS.values(), *_VERTICAL_KEYWORDS.values()):
        for kw in kws:
            cleaned = re.sub(rf"\b{re.escape(kw)}\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"[，。！？!?,.\s]+", " ", cleaned).strip()
    # 再去掉常见动词/虚词残留
    for word in ["写", "做", "生成", "给", "为", "一个", "一份", "几个", "的"]:
        cleaned = cleaned.replace(word, " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:60]  # subject 不需要太长


# ============================ 主入口 ============================

async def parse_intent(user_text: str, history: list[dict] | None = None) -> Intent:
    """优先 LLM 抽取；失败/无 key 走启发式。"""
    if settings.has_anthropic:
        try:
            return await _parse_with_anthropic(user_text, history or [])
        except Exception as e:  # noqa: BLE001
            logger.warning("intent_anthropic_failed_fallback_heuristic", error=str(e))
    return _heuristic_parse(user_text)


def _heuristic_parse(user_text: str) -> Intent:
    """无 LLM 时的启发式抽取。"""
    text = (user_text or "").strip()

    vertical, v_hits = _score_keywords(text, _VERTICAL_KEYWORDS)
    deliverable, d_hits = _score_keywords(text, _DELIVERABLE_KEYWORDS)
    subject = _extract_subject(text)

    missing: list[str] = []
    confidence = 0.0

    if v_hits == 0:
        missing.append("vertical")
        vertical = "other"
    else:
        confidence += 0.35

    if d_hits == 0:
        missing.append("deliverable_type")
        deliverable = "text"
    else:
        confidence += 0.4

    if not subject or len(subject) < 2:
        missing.append("subject")
    else:
        confidence += 0.25

    return Intent(
        vertical=vertical or "other",
        deliverable_type=deliverable or "text",
        subject=subject,
        raw_user_text=text,
        confidence=round(min(confidence, 1.0), 2),
        missing_slots=missing,
    )


# ============================ LLM 抽取 ============================

_INTENT_SYSTEM = """你是意图解析器。把用户的话解析成结构化 JSON：
{
  "vertical": "ecommerce | content | marketing | finance | other",
  "deliverable_type": "image | video | doc | text | bundle",
  "subject": "<对象/主题简明描述，10-30 字>",
  "constraints": {"platform": "...", "tone": "...", "deadline": "..."},
  "confidence": 0.0~1.0,
  "missing_slots": ["vertical"|"deliverable_type"|"subject", ...]
}

规则：
- subject 必须实指（不要"一个东西/某产品"这种空话）。subject 模糊或缺失 → missing_slots 加 "subject"。
- deliverable_type 不明 → missing_slots 加 "deliverable_type"，type 默认 "text"。
- vertical 不明 → missing_slots 加 "vertical"，类目默认 "other"。
- confidence：3 个槽位都填上 ≥ 0.85；缺 1 个 0.5-0.7；缺 ≥ 2 个 < 0.5。
- 只输出 JSON，不要额外解释。"""


async def _parse_with_anthropic(user_text: str, history: list[dict]) -> Intent:
    import anthropic  # noqa: WPS433

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    messages = []
    # 把最近 4 条历史塞进去帮助消歧
    for h in history[-4:]:
        if h.get("role") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_text})

    resp = await client.messages.create(
        model=settings.anthropic_model_conductor,
        max_tokens=512,
        system=_INTENT_SYSTEM,
        messages=messages,
    )
    text = resp.content[0].text if resp.content else ""
    # 截取 JSON（防止模型加 markdown 围栏）
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise ValueError(f"no json in LLM intent reply: {text[:200]!r}")
    data = json.loads(m.group(0))
    intent = Intent(**{**data, "raw_user_text": user_text})
    return intent


# ============================ Phase 5+：一次过 intent + clarify ============================

_INTENT_PLUS_CLARIFY_SYSTEM = """你是 V1 主编排前置层 — 既做意图解析又顺手把澄清问题拟好。

输出严格 JSON:
{
  "intent": {
    "vertical": "ecommerce | content | marketing | finance | other",
    "deliverable_type": "image | video | doc | text | bundle",
    "subject": "<对象/主题简明描述,10-30 字>",
    "constraints": {"platform": "...", "tone": "...", "deadline": "..."},
    "confidence": 0.0~1.0,
    "missing_slots": ["vertical"|"deliverable_type"|"subject", ...]
  },
  "clarify_questions": [
    {
      "slot": "vertical | deliverable_type | subject",
      "question": "<≤25 字 中文 自然反问>",
      "options": ["<≤8 字>", ...],
      "free_form": false
    }
  ]
}

规则:
- intent 部分规则同前(subject 必须实指、confidence 三槽全 ≥0.85 / 缺一 0.5-0.7 / 缺二+ <0.5)。
- 当 missing_slots 非空时,在 clarify_questions 里**对每个 missing_slot 给出 1 个**自然反问。
  - vertical / deliverable_type → 必给 3-5 个 options,free_form=false
  - subject → free_form=true,options=[]
- 当 missing_slots 为空时,clarify_questions 必须是 [] (空数组)。
- question 用第二人称、口语化、贴用户原话语境(不要"请告知您的需求")。
- 只输出 JSON,不要额外解释。
"""


async def parse_intent_with_clarify(
    user_text: str, history: list[dict] | None = None,
) -> tuple[Intent, list[dict]]:
    """一次 LLM 调用同时拿到 Intent 和 ClarifyQuestion 列表。

    Returns:
        (intent, clarify_questions_dicts)
        clarify_questions 已经是 dict 形式（{slot,question,options,free_form}）,
        调用方可直接用 ClarifyQuestion(**d) 实例化。

    无 ANTHROPIC_API_KEY → 走启发式 intent + 模板 clarify(等同两次单独调用,
    但只走一次同步逻辑)。

    LLM 路径若 JSON 解析失败,降级为只用启发式 intent + 让 caller 后续单独
    调 generate_questions(节省一次 LLM 但 clarify 走不到 LLM)。
    """
    if not settings.has_anthropic:
        intent = _heuristic_parse(user_text)
        return intent, []  # 让上层走 generate_questions 模板路径

    try:
        intent, clarify = await _parse_intent_with_clarify_llm(user_text, history or [])
        return intent, clarify
    except Exception as e:  # noqa: BLE001
        logger.warning("intent_with_clarify_llm_failed_fallback", error=str(e))
        try:
            intent = await _parse_with_anthropic(user_text, history or [])
        except Exception as e2:  # noqa: BLE001
            logger.warning("intent_anthropic_also_failed_using_heuristic", error=str(e2))
            intent = _heuristic_parse(user_text)
        return intent, []


async def _parse_intent_with_clarify_llm(
    user_text: str, history: list[dict],
) -> tuple[Intent, list[dict]]:
    import anthropic  # noqa: WPS433

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    messages = []
    for h in history[-4:]:
        if h.get("role") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_text})

    resp = await client.messages.create(
        model=settings.anthropic_model_conductor,
        max_tokens=1024,
        system=_INTENT_PLUS_CLARIFY_SYSTEM,
        messages=messages,
    )
    text = resp.content[0].text if resp.content else ""
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise ValueError(f"no JSON in intent+clarify reply: {text[:200]!r}")
    data = json.loads(m.group(0))

    intent_raw = data.get("intent") or {}
    if not isinstance(intent_raw, dict):
        raise ValueError("intent field missing or wrong type")
    intent = Intent(**{**intent_raw, "raw_user_text": user_text})

    clarify_raw = data.get("clarify_questions") or []
    if not isinstance(clarify_raw, list):
        clarify_raw = []
    # 只保留有效条目
    clarify_clean: list[dict] = []
    for q in clarify_raw:
        if not isinstance(q, dict):
            continue
        slot = q.get("slot", "")
        if slot not in ("vertical", "deliverable_type", "subject"):
            continue
        clarify_clean.append({
            "slot": slot,
            "question": str(q.get("question", ""))[:80],
            "options": [str(o)[:20] for o in (q.get("options") or [])][:5],
            "free_form": bool(q.get("free_form", False)),
        })
    return intent, clarify_clean[:3]
