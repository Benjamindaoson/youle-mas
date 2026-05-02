# V1 Go-Live 接 Key 验证清单

把 DEMO 模式切换到真实 LLM 时按本文档逐项过。**全部 PASS 即代表 V1 100% 可用**。

## 第 0 步：准备 keys

| 服务 | 用途 | 拿 key 入口 |
|---|---|---|
| Anthropic | T agent ReAct / Conductor / Vision (I/V) | https://console.anthropic.com/ |
| DeepSeek | 中文写作主力 + Anthropic 兜底 | https://platform.deepseek.com/ |
| SiliconFlow | I 出图（FLUX.2-pro 默认） | https://siliconflow.cn/ |
| MiniMax | V agent TTS 配音 | https://www.minimaxi.com/ |
| Tavily（可选） | T agent web_search 工具真搜 | https://tavily.com/ |

至少**必填 Anthropic + DeepSeek**，其余有 fallback 链。

## 第 1 步：填 backend/.env

复制 `.env.example` 到 `.env`，**`DEMO_MODE=false`**，填入 4 条主 key：

```bash
cd backend && cp .env.example .env
# 编辑 .env：
#   DEMO_MODE=false
#   ANTHROPIC_API_KEY=<your real>
#   DEEPSEEK_API_KEY=<your real>
#   SILICONFLOW_API_KEY=<your real>
#   MINIMAX_API_KEY=<your real>
```

可选（推荐）：per-purpose 模型 — 让不同 capability 走不同 LLM：

```ini
ANTHROPIC_MODEL_CONDUCTOR=claude-sonnet-4-6      # 编排/澄清/重排，强且便宜
ANTHROPIC_MODEL_INTENT=claude-haiku-4-5-20251001 # 意图分类，快
ANTHROPIC_MODEL_T=claude-opus-4-7                # T 写作，质量优先
ANTHROPIC_MODEL_VISION=claude-opus-4-7           # I/V 看图，需要 vision 能力
```

## 第 2 步：启动后端

```bash
cd backend
uv sync --python 3.12 --extra dev
uv run uvicorn app.main:app --port 8001
```

启动日志应见：
- `chat_store_initialized` ← SQLite 持久化就绪
- `skills_loaded count=N` ← skill 注册表加载
- `youle-backend 已启动 demo_mode=False port=8001` ← 不在 DEMO

## 第 3 步：跑 eval 套件

```bash
cd backend
uv run python scripts/run_evals.py
```

期望：**30/30 PASS（100%）**。失败说明：
- skill_* fail → 关键词召回 / 否决词 / 阈值有 regression
- intent_* fail → LLM intent 抽取或启发式 fallback 行为变了
- conduct_* fail → SSE 事件流 contract 被改

## 第 4 步：单项验证脚本

| 脚本 | 验证 |
|---|---|
| `uv run python scripts/verify_deepseek.py` | DeepSeek 联通 + ScriptSchema |
| `uv run python scripts/make_sample_input.py` | sample_news.xlsx 生成 |
| `uv run pytest backend/tests` | 全部单测（含 V1 phase 4.5 + 5+） |

## 第 5 步：端到端 SSE 烟测

```bash
# A. /v1/conduct 主链路（V1 默认）
curl -N -X POST http://localhost:8001/v1/conduct \
  -H "Content-Type: application/json" \
  -d '{"message": "做一份小红书冷启动方案"}'

# 期望事件流：
#   start → intent_parsed → skill_selected (or clarify_required)
#   → agent_start (T) → chunk* → agent_done → deliverable → done

# B. /chat/team 反诈 LangGraph HITL（V0 优化版仍可用）
curl -N -X POST http://localhost:8001/chat/team \
  -H "Content-Type: application/json" \
  -d '{"message": "做一支反诈短视频"}'

# C. 4 个 capability ReAct 触发（task 含理解关键词 + 上游有产物）
# I: 上游有图 + task="看图调色"
# V: 上游有视频 + task="字幕提取"
# D: 上游有 .pdf/.xlsx + task="抽取关键数据"
```

## 第 6 步：前端连通性

```bash
cd frontend
cp .env.example .env.local
# 默认就指向 http://localhost:8001，无需改
pnpm install && pnpm dev
```

打开浏览器访问：

- `/legacy` — V0 9 员工群聊 UI（保留作 demo）
- `/v1` — V1 主编排工作台（**产品默认**）
- `/skills` — skill 市场列表
- `/artifacts` — 真实产出物历史

## 第 7 步：观测

启动后看 `http://localhost:8001/observability` —— 内嵌 trace dashboard。
所有 LLM 调用 / tool call / artifact 都会落到 `./data/observability/traces.db`。

要接 Langfuse / Helicone 第三方追踪：
1. `pip install langfuse`
2. 在 `app/observability/callback.py` 补一个 `LangfuseCallback` 转发
3. `app/main.py` lifespan 启用

## 失败兜底

| 现象 | 说明 |
|---|---|
| `chat_store_legacy_imported count=N` | 旧 JSON 一次性迁移到 SQLite，N 条 session 入库 |
| `skill_match()` 召回错误 | yaml 加 `negative_keywords` + `min_match_score` |
| T agent 不调工具 | confirm has_anthropic + ANTHROPIC_MODEL_T 不为空 |
| I agent 一直走生成不走 vision | task.task 没含"看 / 改 / 调色"关键词；或上游没图 |

## V1 完成度自检

- [x] 6 项产品要求全部对齐（见 `docs/v1-vs-v0.md`）
- [x] 30 条 golden case 100% PASS
- [x] 4 capability agent 全部 ReAct + tool use
- [x] ModelRouter 5 purpose 各自配模型
- [x] 持久化 SQLite + 平滑迁移旧 JSON
- [x] V0 9 员工降级 deprecated（保留兼容）
- [x] 4 vertical prompt 包齐全
- [x] /capabilities 端点暴露 V1 能力清单
