"""群聊动态派活 — 取代 routes.py 里写死的反诈视频流水线。

输入：用户消息 + 可选的 members 名单（来自前端"群成员"）
输出：DispatchPlan = { plan: str, steps: [{to, task}] }

实现：
- 先按关键词命中给每个候选 agent 打分
- 取得分最高的 1-3 个
- members 显式给定时只在交集中选
- 没有任何命中时降级到 chief 直接答（steps=[]）
"""
from __future__ import annotations

from dataclasses import dataclass

from app.agents.role_chat import ROLE_CONFIGS, role_meta


# 角色 → 关键词权重
_KEYWORDS: dict[str, list[str]] = {
    "analyst": [
        "数据", "分析", "口径", "对比", "趋势", "竞品", "对标", "拆解",
        "为什么", "why", "原因", "归因", "复盘",
    ],
    "planner": [
        "策划", "方案", "计划", "路径", "策略", "选题", "框架",
        "如何", "怎么做", "做什么", "规划", "路线图", "roadmap",
    ],
    "writer": [
        "写", "文案", "稿子", "脚本", "标题", "笔记", "公众号", "小红书",
        "推文", "文章", "内容", "改稿", "润色", "起标题",
    ],
    "distributor": [
        "发布", "投放", "分发", "排期", "渠道", "平台", "hashtag",
        "话题", "传播", "上线", "曝光",
    ],
    "monitor": [
        "监测", "舆情", "舆论", "数据看板", "报警", "预警", "热度",
        "口碑", "情感", "趋势监控", "热搜",
    ],
    "coder": [
        "代码", "脚本", "python", "node", "后端", "api", "接口",
        "爬虫", "抓取", "数据库", "sql", "脚手架", "服务",
    ],
    "frontend": [
        "前端", "组件", "ui", "ux", "页面", "react", "next", "tsx",
        "样式", "tailwind", "响应式", "移动端", "界面",
    ],
    "tester": [
        "测试", "用例", "qa", "回归", "覆盖率", "happy path", "边界",
        "异常", "压测", "自动化测试", "bug",
    ],
}


@dataclass
class DispatchStep:
    to: str
    task: str

    def to_dict(self) -> dict[str, str]:
        return {"to": self.to, "task": self.task}


@dataclass
class DispatchPlan:
    plan: str
    steps: list[DispatchStep]

    def to_dict(self) -> dict:
        return {"plan": self.plan, "steps": [s.to_dict() for s in self.steps]}


def _score(role_id: str, message: str) -> int:
    text = message.lower()
    return sum(1 for kw in _KEYWORDS.get(role_id, []) if kw.lower() in text)


def _candidate_pool(members: list[str] | None) -> list[str]:
    """返回可派活的 agent 池，永远剔除 chief。"""
    all_roles = [r for r in ROLE_CONFIGS.keys() if r != "chief"]
    if not members:
        return all_roles
    allowed = {m for m in members if m != "chief"}
    return [r for r in all_roles if r in allowed]


def plan_dispatch(message: str, members: list[str] | None = None) -> DispatchPlan:
    """根据用户消息和群成员，决定派给谁、各做什么。

    无关键词命中时返回 steps=[] —— 调用方应让 chief 直接答。
    """
    pool = _candidate_pool(members)
    if not pool:
        return DispatchPlan(plan="这事我直接答。", steps=[])

    scored = sorted(
        ((r, _score(r, message)) for r in pool),
        key=lambda x: x[1],
        reverse=True,
    )
    top = [(r, s) for r, s in scored if s > 0][:3]

    if not top:
        # 没命中关键词，降级：默认让 analyst + writer 跑一轮（最通用的产出对子）
        defaults = [r for r in ("analyst", "writer", "planner") if r in pool][:2]
        if not defaults:
            return DispatchPlan(plan="这事我直接答。", steps=[])
        steps = [
            DispatchStep(
                to=r,
                task=f"针对「{_clip(message)}」做你专长的那部分。",
            )
            for r in defaults
        ]
        names = " / ".join(role_meta(r)["name"] for r in defaults)
        plan_text = f"这事我先拉 {names}，让你看到不同视角的产出，再由我汇总。"
        return DispatchPlan(plan=plan_text, steps=steps)

    picks = [r for r, _ in top]
    steps = [
        DispatchStep(
            to=r,
            task=f"针对「{_clip(message)}」做你专长的那部分。",
        )
        for r in picks
    ]
    names = " / ".join(role_meta(r)["name"] for r in picks)
    plan_text = f"这件事我会找 {names} 一起，先各自跑一段，再由我汇总。"
    return DispatchPlan(plan=plan_text, steps=steps)


def _clip(s: str, n: int = 24) -> str:
    return (s[:n] + "…") if len(s) > n else s


# ---------- 关键词触发反诈视频流水线 ----------

# 命中这些词时，/chat/team 会走原 LangGraph 5 节点流水线（反诈视频）
ANTISCAM_KEYWORDS = ("反诈视频", "反诈短视频", "防诈视频", "anti-scam", "anti scam", "antiscam")


def is_antiscam_video_request(message: str) -> bool:
    text = message.lower()
    return any(kw.lower() in text for kw in ANTISCAM_KEYWORDS)


__all__ = [
    "DispatchPlan",
    "DispatchStep",
    "plan_dispatch",
    "is_antiscam_video_request",
]
