"""通用员工 agent 模块（不同于 graph/ 下的反诈视频流水线节点）。

- role_chat: 9 员工的单轮回复（流式），DEMO 走模板，配 key 走 Anthropic
- dispatcher: 群聊动态派活（启发式或 LLM 选 1-3 个员工）
"""
