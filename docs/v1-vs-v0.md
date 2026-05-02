# V1 vs V0 端点对照

**产品愿景：** V1 是默认架构（4 capability agent + Conductor + skill 市场）。
V0 9 员工拟人化是早期 demo，仅作 legacy 保留。

## 路由对照

| 用途 | V1 端点（推荐） | V0 端点（legacy） |
|---|---|---|
| 主编排（意图→澄清→skill→执行） | `POST /v1/conduct` | `POST /chat/team` |
| 单轮对话 | （V1 由 conductor 自然处理） | `POST /chat` |
| Agent / Capability 列表 | `GET /capabilities` | `GET /agents` |
| Skill 列表 | `GET /v1/skills` 或 `GET /skills` | — |
| Skill 详情 | `GET /skills/{id}` | — |
| Skill 召回调试 | `POST /skills/match` | — |
| 产物 | `GET /artifacts*` | 同 V1 共用 |
| 上传 | `POST /upload` | 同 V1 共用 |

## V0 端点为什么保留

1. 前端 `/legacy` 页面（九宫格 9 员工 UI）仍在使用，不强制砍掉
2. 老客户端 / 集成方可能直连 `/chat`、`/agents`，破坏会引起客诉
3. 测试覆盖（`tests/test_api.py`）依赖这些端点

V0 端点都加了 OpenAPI `deprecated=true` 标记；新代码不要再扩展。

## 何时下线 V0

不主动下线，但满足以下条件后可移除：

- [ ] 前端 `/legacy` 不再是 `/` 默认（默认入口是 `/v1`）
- [ ] 30 天无客户端使用 V0 端点（看 trace）
- [ ] 测试套件全部迁到 V1 端点

## V1 完成度（2026-05-02 100%）

| 要求 | 实现 |
|---|---|
| 内容+营销定位 | 4 vertical（content / marketing / finance / ecommerce）+ 默认 default |
| 4 能力 agent + 多 LLM | T/I/V/D 全部 ReAct + tool use；ModelRouter 5 purpose 各自配模型 |
| agent1 = 写+思+查+析 | T agent: web_search / read_url / read_excel 工具 |
| 意图理解+澄清+编排 | LLM-driven intent / clarify / rerank / confirm 四道闸 |
| 不变 vs 可变分层 | capabilities/* 不变层；vertical_prompts/* + skills/*.yaml 可变层 |
| skill 自动选用 | 关键词 + 否决词 + LLM 重排 + LLM 二次确认 |

## 反诈视频（特殊 skill）

`skills/anti_scam_video.yaml` 是 V0 LangGraph 流水线封装的 runner-based skill。
当用户消息命中"反诈视频"关键词且 skill 守门员通过时，由 conductor 调用该 runner
（保留 V0 真实流式 + HITL 能力，不退化）。

## 持久化

V1 完成度（2026-05-02）把 CHAT_HISTORY 从 `./data/history/*.json` 单文件方案
迁到 SQLite（`./data/chat_history.db`）。启动时自动 import 旧 JSON。
