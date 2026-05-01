"""反诈短视频 skill — 内置示例 skill。

历史：V0 时这是写死在 /chat/team 里的 LangGraph 流水线。
Phase 0（2026-05-01）封成 skill，由 skill registry 召回与调用。

结构：
- runner.py: SkillSpec.runner 指向的入口，包装 LangGraph 调用
- persistence.py: 把 LangGraph 产出的 artifact 落盘到 manifest.json
"""
