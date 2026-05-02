"""持久化存储层 — 把 V0 的进程内 dict + JSON 文件落盘升级成 SQLite。

模块：
- chat_store: 群聊 / 单聊历史（取代 ./data/history/*.json）

设计：保留旧 in-memory dict 作 cache，写时同步 sqlite；启动时一次性从
sqlite 加载到 cache，并 import 旧 JSON 文件（如有）做平滑迁移。
"""
