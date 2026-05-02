"""ModelRouter — 按 purpose 选 LLM provider + model + 默认参数。

存在的理由：用户原话"agent 按能力划分，背后接入不同的 LLM 作为通用能力"。
V0 / V1 早期所有 LLM 调用都直接 hardcode `settings.ANTHROPIC_MODEL`，
这违反了"通用能力"原则。本模块统一所有调用方的入口。

Purpose 列表（V1）：
    role_chat              — 9 员工拟人化对话
    conductor_intent       — 意图解析（结构化 JSON 输出，需要快/便宜）
    conductor_rerank       — 候选 skill 重排（短输入 + 短输出）
    conductor_clarify      — 自然反问话术（短输入 + 短输出）
    conductor_confirm      — skill 守门员二次确认（短输入 + 短输出）
    capability_T           — T agent ReAct 主体（中长输出）
    capability_I_describe  — I agent 看图（vision）
    capability_V_describe  — V agent 看视频帧（vision）
    capability_D_extract   — D agent 文档抽取（中长输出）

调用：
    from app.adapters.model_router import pick_chat
    choice = pick_chat(purpose="capability_T", vertical="content")
    if choice.provider == "anthropic":
        client = anthropic.AsyncAnthropic(api_key=choice.api_key)
        await client.messages.create(model=choice.model, ...)
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.config import settings


Provider = Literal["anthropic", "deepseek", "none"]


@dataclass(frozen=True)
class ModelChoice:
    """一次 LLM 调用要用的参数集合。"""
    provider: Provider
    model: str
    api_key: str
    api_base: str = ""
    max_tokens: int = 1024
    temperature: float = 0.7
    # purpose 透出给上层做 logging / trace
    purpose: str = ""

    @property
    def available(self) -> bool:
        return self.provider != "none" and bool(self.api_key)


# Purpose → 默认 (provider 优先级 / max_tokens / temperature)
# Provider 优先级是 list：依次检查 has_anthropic / has_deepseek
_PURPOSE_DEFAULTS: dict[str, dict] = {
    "role_chat": {
        "providers": ["anthropic", "deepseek"],
        "max_tokens": 1024,
        "temperature": 0.7,
    },
    "conductor_intent": {
        "providers": ["anthropic", "deepseek"],
        "max_tokens": 512,
        "temperature": 0.3,
    },
    "conductor_rerank": {
        "providers": ["anthropic", "deepseek"],
        "max_tokens": 256,
        "temperature": 0.2,
    },
    "conductor_clarify": {
        "providers": ["anthropic", "deepseek"],
        "max_tokens": 512,
        "temperature": 0.4,
    },
    "conductor_confirm": {
        "providers": ["anthropic", "deepseek"],
        "max_tokens": 256,
        "temperature": 0.2,
    },
    "capability_T": {
        "providers": ["anthropic", "deepseek"],
        "max_tokens": 2048,
        "temperature": 0.7,
    },
    "capability_I_describe": {
        "providers": ["anthropic"],   # vision 只走 Anthropic
        "max_tokens": 1024,
        "temperature": 0.3,
    },
    "capability_V_describe": {
        "providers": ["anthropic"],
        "max_tokens": 1024,
        "temperature": 0.3,
    },
    "capability_D_extract": {
        "providers": ["anthropic", "deepseek"],
        "max_tokens": 2048,
        "temperature": 0.5,
    },
}


def _anthropic_model_for(purpose: str) -> str:
    """按 purpose 选 Anthropic 模型；空字符串 → 兜底 ANTHROPIC_MODEL。"""
    overrides = {
        "role_chat":              settings.ANTHROPIC_MODEL,  # 沿用现状（与既有 commit 兼容）
        "conductor_intent":       settings.ANTHROPIC_MODEL_INTENT or settings.ANTHROPIC_MODEL_CONDUCTOR,
        "conductor_rerank":       settings.ANTHROPIC_MODEL_CONDUCTOR,
        "conductor_clarify":      settings.ANTHROPIC_MODEL_CONDUCTOR,
        "conductor_confirm":      settings.ANTHROPIC_MODEL_CONDUCTOR,
        "capability_T":           settings.ANTHROPIC_MODEL_T,
        "capability_I_describe":  settings.ANTHROPIC_MODEL_VISION,
        "capability_V_describe":  settings.ANTHROPIC_MODEL_VISION,
        "capability_D_extract":   settings.ANTHROPIC_MODEL_T,
    }
    return overrides.get(purpose, "") or settings.ANTHROPIC_MODEL


def _deepseek_model_for(purpose: str) -> str:
    """按 purpose 选 DeepSeek 模型。短/快走 FLASH，写作走 PRO，编排走 reasoner（如配置）。"""
    if purpose in ("conductor_intent", "conductor_rerank",
                    "conductor_clarify", "conductor_confirm"):
        return settings.DEEPSEEK_MODEL_REASONER or settings.DEEPSEEK_MODEL_FLASH
    if purpose in ("capability_T", "role_chat", "capability_D_extract"):
        return settings.DEEPSEEK_MODEL_PRO
    return settings.DEEPSEEK_MODEL_FLASH


def pick_chat(
    *,
    purpose: str,
    vertical: str | None = None,                # 当前未用，预留给"按 vertical 切 model"
    prefer_provider: Provider | None = None,    # 上层可强制要求 anthropic / deepseek
) -> ModelChoice:
    """选一个 chat-completion 模型。

    优先级：
        1. prefer_provider 显式指定且该 provider 可用 → 用它
        2. _PURPOSE_DEFAULTS[purpose].providers 按顺序找第一个可用的
        3. 都没有 → ModelChoice(provider="none")，调用方走模板 fallback
    """
    spec = _PURPOSE_DEFAULTS.get(purpose, _PURPOSE_DEFAULTS["capability_T"])
    candidates: list[Provider] = (
        [prefer_provider] if prefer_provider else list(spec["providers"])
    )

    for prov in candidates:
        if prov == "anthropic" and settings.has_anthropic:
            return ModelChoice(
                provider="anthropic",
                model=_anthropic_model_for(purpose),
                api_key=settings.ANTHROPIC_API_KEY or "",
                api_base=settings.ANTHROPIC_BASE_URL or "",
                max_tokens=spec["max_tokens"],
                temperature=spec["temperature"],
                purpose=purpose,
            )
        if prov == "deepseek" and settings.has_deepseek:
            return ModelChoice(
                provider="deepseek",
                model=_deepseek_model_for(purpose),
                api_key=settings.DEEPSEEK_API_KEY or "",
                api_base=settings.DEEPSEEK_API_BASE,
                max_tokens=spec["max_tokens"],
                temperature=spec["temperature"],
                purpose=purpose,
            )

    return ModelChoice(provider="none", model="", api_key="",
                        max_tokens=spec["max_tokens"],
                        temperature=spec["temperature"],
                        purpose=purpose)


__all__ = ["ModelChoice", "Provider", "pick_chat"]
