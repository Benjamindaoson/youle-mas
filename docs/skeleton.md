# Youle 工程骨架契约（Skeleton）

> 状态：**契约 v1.0** · 2026-05-02
> 范围：**工程视角**的代码骨架与开发约定。**与 [`v1-architecture.md`](./v1-architecture.md)（产品视角）配对，约束相互不冲突。**
> 受众：今天和未来六个月（含 AI Coding Agent）改这个仓库的所有人。
> 一句话：**任何升级——加 prompt、加 skill、加能力、换大模型——都只动有限几个文件，且不破坏原有系统。**

---

## 0. TL;DR — 三条铁律

1. **解耦：分层 + 注册表 + 契约**。代码分为「内核（不变）/ 注册表（声明）/ 配置（叠加）」三层；新增功能走注册表，不动内核。
2. **契约不破坏**。SSE 事件、Skill YAML、Capability `run()`、Intent JSON 是双端合约，**版本化扩展，绝不静默改字段**。
3. **模型可换、配方不动**。所有 LLM 调用经 `adapters/model_router.py` 的 `purpose` 路由，模型 ID 走 `.env`；升级模型 = 改一行环境变量。

---

## 1. 解耦原则

### 1.1 三层抽象边界

```
┌─────────────────────────────────────────────────────────┐
│ ⚙️  内核层 (kernel) — 升级要审慎，破坏即灾难             │
│    backend/app/                                          │
│      conductor/      Conductor 4 阶段（intent/clarify/  │
│                      retrieve/dispatch）                 │
│      capabilities/   T/I/V/D 四能力 agent 框架           │
│      adapters/       model_gateway / model_router       │
│      api/            FastAPI 路由 + SSE                  │
│      skills/registry.py  YAML 加载与查询                 │
│    frontend/                                             │
│      lib/api.ts      SSE 客户端 + 类型契约               │
│      components/v1-workbench.tsx  事件渲染主框架         │
├─────────────────────────────────────────────────────────┤
│ 📦 注册表层 (registry) — 加东西的地方，机械修改          │
│    backend/skills/*.yaml          11+ 个 skill 声明      │
│    backend/app/skills/builtin/<id>/  少数有 runner 的    │
│    backend/app/capabilities/<x>_tools.py  工具暴露        │
├─────────────────────────────────────────────────────────┤
│ 🎨 配置层 (config) — 改字面值即可，无需 review            │
│    backend/vertical_prompts/*.yaml  行业 prompt 增量     │
│    backend/.env                  模型 ID / API key       │
└─────────────────────────────────────────────────────────┘
```

**任何跨层依赖必须单向向下**：内核不知道注册表里有什么，注册表不知道配置叠加什么。
违反这条 = 改 prompt 时要改内核 = 解耦失败。

### 1.2 单向依赖图（不可成环）

```
frontend ──[SSE 事件契约]──▶ backend/api
                                    │
                                    ▼
                            backend/app/conductor
                                    │
                                    ▼
                            backend/app/capabilities (T/I/V/D)
                                    │
                                    ▼
                            backend/app/adapters (model_router / gateway / tools)
                                    │
                                    ▼
                            外部 LLM / 工具
```

- 上层可以 import 下层，反之严禁。
- 同层之间不互相 import（capability `T` 不能 import capability `I`，要协作就经 conductor 串接）。
- `lint` 加规则：`from app.conductor import ...` 不允许出现在 `app/capabilities/` 下。

### 1.3 四个核心契约（合约即代码）

每个契约**单点定义、双端引用**。改契约 = 不兼容变更，必须开新版本。

| 契约 | 定义位置 | 引用位置 | 版本化方式 |
|---|---|---|---|
| **SSE 事件类型** | `backend/app/schemas/events.py` (V0) `frontend/lib/api.ts` `V1ConductEvent` (V1) | 后端各 yield 点；前端 v1-workbench / messenger | 加新 type 是兼容；改 type 字段是 breaking |
| **Skill YAML schema** | `backend/app/skills/registry.py` `SkillSpec` pydantic model | 所有 `backend/skills/*.yaml`；前端 `V1Skill` 类型 | 加 optional 字段是兼容；改必填字段是 breaking |
| **Capability `run()` 接口** | `backend/app/capabilities/<x>.py` 顶部 docstring | conductor/dispatcher.py 调用方 | 改函数签名是 breaking |
| **Intent JSON** | `backend/app/conductor/intent.py` `Intent` dataclass | conductor 内部 + frontend 渲染 | 加字段是兼容；改 enum 值是 breaking |

**铁律**：合约里看到 `# breaking change` 注释 = 必须 bump API 路径（`/v1` → `/v2`），并且 v1 共存至少 30 天。

### 1.4 「加东西」的标准操作（OPS 表）

> AI Coding Agent 修改本仓库时**对照下表**，越界即拒绝合并。

| 想加什么 | 只动这些文件 | 不许动这些 | 测试 |
|---|---|---|---|
| **新行业 prompt** | `backend/vertical_prompts/<行业>.yaml` | `capabilities/`、`conductor/` | 无（YAML 文本） |
| **新 skill（声明式）** | `backend/skills/<id>.yaml` | `app/` 任何 .py | conductor 应自动召回；写 1 条 golden case |
| **新 skill（带 runner）** | 上一行 + `backend/app/skills/builtin/<id>/runner.py` | `conductor/`、其它 capability | runner 单测 + 1 条 golden case |
| **新工具（给已有能力 agent）** | `backend/app/capabilities/<x>_tools.py` 加 `TOOL_DEFS` 一项 + 实现函数 | 其它 capability | 工具单测；ReAct 集成测 |
| **新能力 agent（5th capability）** | `backend/app/capabilities/<new>.py` + `<new>_tools.py` + 在 `dispatcher.py` 的 capability registry 注册一行；前端 `CAPABILITIES` 数组加一项 | conductor 主流程逻辑 | e2e + 前端类型补 `V1CapabilityKey` |
| **新 LLM 供应商** | `backend/app/adapters/model_router.py` 加 provider 分支 + `model_gateway.py` 加 client；`.env.example` 加 key | `capabilities/`、`conductor/` | model_gateway 单测 + smoke |
| **升级现有 LLM 模型** | `backend/.env` 一行 | 任何 .py | smoke 跑一遍 `/v1/conduct` |
| **新 SSE 事件类型** | `backend/app/schemas/events.py`（或 `routes.py` 文档处）+ `frontend/lib/api.ts` `V1ConductEvent` + `frontend/components/v1-workbench.tsx` switch 分支 | conductor/capability 业务逻辑 | sse_schema 测试加一条 |

**OPS 表是硬约定**。任何 PR 涉及表外文件 = 描述里必须解释为什么。

### 1.5 AI Coding 七条军规

> 给 Cursor / Claude Code / Codex 等 AI 助手贴在 `.cursorrules` / `CLAUDE.md` 里的版本，照抄即可。

1. **改 1 处 = 看 3 处**。看上游谁调你、看下游你调谁、看测试覆盖到哪。
2. **不准跨层耦合**。前端不准懂 LLM provider；capability 不准懂 conductor 路由；conductor 不准懂 ffmpeg。
3. **不准动契约字段**。要扩展 → 加 optional 字段，不许改语义。
4. **不准吞 fallback 不告诉用户**。任何降级（mock 出图、静音音轨、模板回退）必须 yield `{type:"warning"}`。
5. **不准过度工程化**。MVP 优先。有 in-memory dict 能解决就别上 Redis。三段相似代码强于一个错的抽象。
6. **不准写注释解释 WHAT**。代码自身说明做了什么；注释只解释 WHY（约束、bug 规避、反直觉行为）。
7. **不准跳过测试**。改 capability → 跑 `tests/test_v1_phase*.py`；改 conductor → 跑全套 `pytest`。

### 1.6 「禁止做」清单（守住简单度）

- ❌ 在 capability 里直接 `import anthropic`（必须经 `model_router.pick_chat()`）
- ❌ 在 conductor 里 hardcode skill id（必须经 `skills.registry`）
- ❌ 在前端拼 SSE 事件类型为字符串（必须用 `V1ConductEvent` discriminated union）
- ❌ 在 prompt 里 hardcode 行业关键词（必须放 `vertical_prompts/<x>.yaml`）
- ❌ 在 routes.py 里塞超过 50 行业务逻辑（必须下沉到 conductor / capability）
- ❌ 引入新依赖前不评估是否能用 stdlib / 已有依赖（pyproject.toml 是审计目标）

---

## 2. 技术选型 — 与 LangGraph 适配

### 2.1 为什么选 LangGraph

| 需求 | LangGraph 能力 | 替代方案 | 我们用 LangGraph 的理由 |
|---|---|---|---|
| 多步骤工作流（intent → clarify → dispatch → ...） | `StateGraph` + 节点 | 手写状态机 | LangGraph 的状态合并 + 流式更成熟 |
| 中断 / 等用户回答 | `interrupt()` + `Command(resume=...)` | 自己存 `pending_input` 字典 | LangGraph 的 checkpointer 自动持久化 |
| 子流程复用（反诈视频流水线） | 子图 `subgraph` | 函数封装 | 子图自带 streaming + checkpoint，函数没有 |
| 持久化 / 中断恢复 | `AsyncSqliteSaver` checkpointer | 自己写 SQLite | 已经在 V0 用，零额外成本 |
| 流式输出（token 级） | `astream(stream_mode="messages")` | SSE 手写 | 我们已有 SSE 包装层（`app/sse.py`），混用 |

### 2.2 已用的 LangGraph 组件（保留）

| 组件 | 用在哪 | 文件 |
|---|---|---|
| `StateGraph` | V0 反诈视频流水线 | `backend/app/graph/builder.py` |
| `AsyncSqliteSaver` (checkpointer) | V0 graph 的中断/恢复 | 同上 |
| `interrupt()` (HITL approval) | V0 orchestrator 审批节点 | `backend/app/graph/nodes/orchestrator.py` |
| `Command(goto=..., update=...)` | V0 specialist 节点动态路由 | `backend/app/graph/nodes/*.py` |

### 2.3 推荐迁入 LangGraph 的部分（V1.5 改造，不阻塞 MVP）

| 当前实现 | 痛点 | 迁入后 |
|---|---|---|
| `conductor/dispatcher.py` 手写 for-loop 顺序执行 skill steps | 不支持 fan-out / 并行 | `StateGraph` + `Send` API 实现并行 step（如 I 出 3 张图同时跑） |
| 主编排 4 阶段串行 + 自实现 SSE | 重启会丢中间状态 | `StateGraph` 4 节点 + `AsyncSqliteSaver`，用户刷新可续 |
| Capability ReAct 循环手写（`for turn in range(...)`） | 工具数量增多后难维护 | 用 `langgraph.prebuilt.create_react_agent` 替换 |
| 澄清问答的 pending state | 用 query string 传 `clarify_answers` | 用 `interrupt()`，状态由 checkpointer 持久化 |

**迁移原则**：**只在收益清晰时改**。MVP 阶段当前实现已能跑；迁移要等真有「并行 step」或「中断恢复」需求时再做，不许借口"用上 LangGraph"重写无收益代码。

### 2.4 不用 LangGraph 的部分（保持自实现）

| 模块 | 为什么不上 LangGraph |
|---|---|
| **Skill YAML registry** | 是声明数据，不是 graph；用 pydantic + 文件扫描足够 |
| **SSE 事件层** (`app/sse.py`) | LangGraph 的 stream API 不直接出 SSE；薄一层包装比双重抽象清晰 |
| **artifact 落盘 + manifest** | 文件 IO，LangGraph 不关心 |
| **vertical prompt 叠加** | 字符串模板，不需要 graph |
| **前端事件渲染** | LangGraph 是后端框架 |

### 2.5 周边技术栈（绑定）

| 维度 | 选型 | 原因 / 红线 |
|---|---|---|
| 后端语言 | **Python 3.12** | LangGraph 生态、async 成熟；不上 Python 3.13 直到生态稳定 |
| 后端框架 | **FastAPI** | SSE / WebSocket 一等支持；pydantic 双向用 |
| 包管理 | **uv** | 装包比 pip 快 10x；锁文件单一 |
| 持久化 | **SQLite** (chat_store / artifact / observability) | 单机 MVP 用 SQLite；红线：扛不住再上 Postgres，**别先建好 Postgres** |
| 前端语言 | **TypeScript** + **Next.js 16** + **Tailwind** | 现有栈；红线：不引入第二种 UI 框架 |
| 前端状态 | **React state + zustand**（已用） | 不上 Redux；不上 Recoil |
| 包管理（前端） | **pnpm** | 锁文件友好 |
| 测试 | **pytest** + **pytest-asyncio** + **respx**（HTTP mock） | 后端；前端只跑 tsc 类型检查，单元测试 V1.5 再补 |
| 评测 | **自家 `scripts/run_evals.py` + `evals/golden_cases.yaml`** | 30 条 golden case + LLM-as-judge；不上 RAGAS / DeepEval |

### 2.6 工具（adapters/tools）哲学

每个工具 = 一个文件，**纯函数**优先，副作用（IO）显式。
- `download_image(url, save_dir) -> path | None`
- `script_to_srt(script, duration, save_dir) -> path`
- `compose_news_video(images, voice, bgm, ...) -> path`

工具被 capability 调用，**不许调 LLM**（要调 LLM 就上升为 sub-capability）。
工具失败必须返回 `None` 或抛指定异常类（`InvalidImageError` / `FFmpegError`），由 capability 决定降级策略。

---

## 3. 大模型选型 — 先进性 × 成本平衡

### 3.1 调用占比评估（一次完整交付的 token 估算）

> 假设：用户输入"帮我做一份咖啡店 8 月复盘 PPT"，触发 `monthly_report_pptx` skill，全链路 4 步。

| 阶段 | 调用次数 | 单次 token（in/out） | 占总 token | 关键性 |
|---|---:|---:|---:|---|
| Conductor · Intent 解析 | 1 | 800 in / 200 out | ~3% | ⭐⭐⭐⭐⭐ 错则全错 |
| Conductor · Clarify（如触发） | 0~1 | 400 in / 150 out | ~1% | ⭐⭐⭐⭐ 影响体验 |
| Conductor · Skill rerank（候选 3 个） | 1 | 1200 in / 100 out | ~2% | ⭐⭐⭐⭐ 选错则交付错 |
| Conductor · Skill confirm（守门） | 1 | 600 in / 50 out | ~1% | ⭐⭐⭐ 防误命中 |
| Capability T · 写报告正文 | 1~3 | 1500 in / 4000 out | **~50%** | ⭐⭐⭐⭐ 决定成品质量 |
| Capability T · ReAct（读 Excel + 总结） | 2~4 turns | 2000 in / 600 out | ~25% | ⭐⭐⭐ |
| Capability D · PPT 生成 | 0（无 LLM，本地 python-pptx） | — | 0% | — |
| Capability I · 出图（按张计费）| 0~3 张 | $0.01~0.05 / 张 | 单独计 | ⭐⭐⭐⭐ |
| Capability V · TTS（按字符计费） | 0~500 字符 | $0.001 / 1k 字符 | 单独计 | ⭐⭐⭐ |

**结论**：
- **Conductor 部分（~7%）** —— token 少但**决定一切**：上旗舰
- **Capability T 生成（~75%）** —— token 多：上次旗舰，能省一半钱
- **Capability T 工具调用 / ReAct** —— 中等：能省的省（DeepSeek）
- **图/视频/语音** —— 按张/秒/字符计费，与 token 无关：选画质/音质合适的模型

### 3.2 三档分级（按 purpose 路由，已实现）

| 档位 | 用在 | 当前默认 | 升级路径 | 月成本估算（500 用户/天） |
|---|---|---|---|---|
| **🥇 旗舰**（贵但精准） | Conductor 全部 4 道 LLM；Capability vision 理解 | `claude-opus-4-7` | `claude-opus-4-X`（出新版直接换） | ~$200~400 |
| **🥈 主力**（性价比） | Capability T 写作 / 推理 / ReAct（含工具）；V0 9 角色单聊 | `claude-opus-4-7`（或 `deepseek-chat` 兜底） | 改 `.env` `ANTHROPIC_MODEL_T=claude-sonnet-4-X` 一行字降本 | ~$150~300 |
| **🥉 经济**（高频低难） | DeepSeek 兜底链路；脚本模板生成；JSON 抽取 | `deepseek-chat` / `deepseek-reasoner` | 看 DeepSeek 后续模型；或换 Qwen / GLM | ~$30~80 |

> **该省的省**：写公众号正文这种"长输出 + 中难度"任务，Sonnet 比 Opus 省 80%，质量差 5%。
> **不该省的**：意图理解错了，整个交付就错；Conductor 永远上最强。

### 3.3 ModelRouter 架构（已落地）

`backend/app/adapters/model_router.py` 已实现按 `purpose` 路由：

```python
choice = pick_chat(purpose="conductor_intent", prefer_provider="anthropic")
# choice.model = "claude-opus-4-7"  (从 .env ANTHROPIC_MODEL_INTENT 读)
# choice.api_key, choice.max_tokens, choice.temperature 全到位
```

**8 个已注册的 purpose**：

| purpose | 用途 | 当前 ANTHROPIC 默认 | 当前 DEEPSEEK 兜底 |
|---|---|---|---|
| `conductor_intent` | 意图解析 | `ANTHROPIC_MODEL_INTENT` → `MODEL_CONDUCTOR` → `MODEL` | `MODEL_REASONER` |
| `conductor_clarify` | 澄清反问 | `ANTHROPIC_MODEL_CONDUCTOR` | `MODEL_REASONER` |
| `conductor_rerank` | skill 重排 | `ANTHROPIC_MODEL_CONDUCTOR` | `MODEL_REASONER` |
| `conductor_confirm` | skill 守门员 | `ANTHROPIC_MODEL_CONDUCTOR` | `MODEL_REASONER` |
| `capability_T` | T 写作/ReAct | `ANTHROPIC_MODEL_T` | `MODEL_PRO` |
| `capability_I_describe` | I 看图 | `ANTHROPIC_MODEL_VISION` | （DeepSeek 无 vision，跳过） |
| `capability_V_describe` | V 看视频 | `ANTHROPIC_MODEL_VISION` | （同上） |
| `capability_D_extract` | D 文档抽取 | `ANTHROPIC_MODEL_T` | `MODEL_PRO` |

**升级模型只改 `.env`，不动代码**。这是核心解耦。

### 3.4 媒体类模型（按调用计费，独立维度）

| 能力 | 现默认 | 备选 | 选型逻辑 |
|---|---|---|---|
| **图像生成** | SiliconFlow `black-forest-labs/FLUX.2-pro` | `FLUX.1-schnell`（省 5x）| 画质优先；用户对图敏感于文字 |
| **TTS** | MiniMax `speech-2.8-hd` | `speech-2.8-turbo`（省 3x）| 实时性不敏感场景上 hd |
| **文生视频** | **暂不接**（用图 slideshow + TTS + ffmpeg 合成） | 可灵 / Runway / Sora | 真 T2V 单次成本 $0.5+，MVP 阶段不值 |

### 3.5 成本守门员（V1.5 加，MVP 先不做）

- 在 `model_gateway` 层加每日 token 配额（`MAX_DAILY_TOKEN`）超出转 fallback
- 在 `observability/` 加成本面板（每个 purpose 累计 token）
- 在 SkillSpec 里写 `expected_cost_usd`，用户开跑前看预算

**MVP 不做**：上面 3 条都是 V2 议题，单机自用阶段超不出预算。

---

## 4. 演进路径（与 v1-architecture §8 配套）

| 时间窗 | 主题 | 内容 |
|---|---|---|
| **现在（V1.0）** | 单机 MVP | 已完成；不再加新模块 |
| **V1.5（1~2 月内）** | 把 conductor 迁 LangGraph StateGraph + interrupt | 收益：刷新可续、并行 step、ReAct 用 prebuilt |
| **V1.6** | skill DAG 解释器 | 11 个 yaml-only skill 真正可执行；接入新 skill 不用写 runner |
| **V1.7** | 成本面板 + token 配额 | observability 里加，前端工作台展示 |
| **V2.0**（用户量上来才考虑） | 多租户 / Postgres / Redis / 队列 | 不为可能性建设，等真有用户 |

---

## 5. 附录：常见操作快查

### 5.1 加一个新 prompt（例：宠物用品行业）
```bash
# 一步：建文件
cat > backend/vertical_prompts/pet.yaml <<EOF
system_addendum: |
  你是宠物用品营销专家，熟悉撸猫党、铲屎官圈层黑话...
EOF
# 完。重启后端。Conductor 检测到 vertical=pet 自动叠加。
```

### 5.2 加一个新 skill（例：抖音 60s 短视频脚本）
```bash
cat > backend/skills/douyin_60s_script.yaml <<EOF
id: douyin_60s_script
name: 抖音 60s 短视频脚本
version: 1.0
description: 给定主题，输出 hook+body+closing 三段脚本
intent_keywords: [抖音, 短视频, 脚本, 口播]
required_slots: [subject]
deliverable_type: text
steps:
  - agent: T
    task: 写 60 秒抖音脚本（hook 黄金 3 秒）
    outputs: [text-asset]
EOF
# 完。重启后端，Conductor 自动召回。
```

### 5.3 升级 Conductor 用的 LLM（例：Opus 4.7 → Opus 5.0）
```bash
# 改一行
sed -i 's/claude-opus-4-7/claude-opus-5-0/' backend/.env
# 完。重启后端，全部 conductor purpose 自动用新模型。
```

### 5.4 加一个新 SSE 事件类型（例：`cost_update`）
```typescript
// frontend/lib/api.ts — 加一行联合类型
| { type: 'cost_update'; tokens_used: number; cost_usd: number }

// frontend/components/v1-workbench.tsx — 加 WorkbenchCard kind + CardView 分支
// backend/app/api/routes.py / capabilities — 在合适位置 yield
// backend/tests/test_sse_schema.py — 加一条断言
```
四处改全 = 契约更新完成。漏一处 = 前端崩 / 后端事件被丢。

### 5.5 切到完全离线 demo 模式（无 API key）
```ini
# backend/.env
DEMO_MODE=true
```
所有 LLM / 出图 / TTS 走 fallback；不会崩，不会假装真出，**会 yield warning**（PR #14 引入）。

---

## 6. 红线清单（PR review 必查）

- [ ] 新文件位置符合 §1.1 三层
- [ ] 新文件依赖方向符合 §1.2 单向图
- [ ] 改契约？查 §1.3 是否需要版本 bump
- [ ] 加东西？查 §1.4 OPS 表，越界要解释
- [ ] 没违反 §1.5 七条军规
- [ ] 没踩 §1.6 禁止做清单
- [ ] 加 LLM 调用？经 `model_router.pick_chat(purpose=...)`，不许 raw client
- [ ] 加 fallback？yield `{type:"warning"}` 告诉前端
- [ ] 全套 pytest 过

---

> 本文档每次破坏式变更要 **bump v 号 + 改顶部日期**，且必须在 PR 描述里 link 本文。
