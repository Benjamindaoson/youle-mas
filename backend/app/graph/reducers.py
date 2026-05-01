"""自定义 Reducer — LangGraph state 字段的合并策略。

核心原则：agent 只返增量，reducer 负责合并。
例如 artifacts 字段，agent 返回 [new_art]，reducer 自动拼接到已有列表。
"""


def append_list(left: list | None, right: list | None) -> list:
    """列表追加合并（用于 artifacts / events / errors）。"""
    return (left or []) + (right or [])


def merge_dict(left: dict | None, right: dict | None) -> dict:
    """字典浅合并（用于 agent_status）。"""
    merged = dict(left or {})
    merged.update(right or {})
    return merged


def sum_float(left: float | None, right: float | None) -> float:
    """浮点数累加（用于 cost_usd）。"""
    return float(left or 0.0) + float(right or 0.0)
