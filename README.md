# Youle / 有了

「有了」AI Agent 多智能体系统。聚焦**内容 + 营销**场景。

## 产品形态

```
┌────────────────────────────────────────────────────────┐
│  不变层 (multi-agent system)                           │
│                                                        │
│   ┌────────────────────────┐                          │
│   │  主编排 (Conductor)     │  ← 核心竞争力           │
│   │  · 意图理解             │                          │
│   │  · 意图澄清             │                          │
│   │  · skill 检索 + 调度    │                          │
│   └────────────┬───────────┘                          │
│                │                                       │
│       ┌────────┼────────┬────────┬────────┐           │
│       ▼        ▼        ▼        ▼        ▼           │
│     T 文字   I 图    V 视频   D 文档                    │
│     语言    生成/    含音频   PDF/Excel                 │
│     推理    改图     合成     PPT                       │
└────────────────────────────────────────────────────────┘
                  ↑                ↑
                  │                │
                  prompt           skill
                  (按行业)         (workflow 市场)
```

详细架构契约见 [docs/v1-architecture.md](docs/v1-architecture.md)。

## 仓库结构

```
youle_mas/
├── backend/         FastAPI + LangGraph 多智能体后端（端口 8001）
│   ├── app/
│   │   ├── conductor/        主编排（intent/clarify/retrieve/dispatch）
│   │   ├── capabilities/     4 能力 agent: text / image / video / doc
│   │   ├── skills/           Skill 注册表 + builtin runner
│   │   ├── api/routes.py     SSE 端点 (/v1/conduct, /v1/skills + V0 兼容)
│   │   └── observability/    本地 SQLite trace store
│   ├── skills/               Skill YAML 定义（注册表扫描这里）
│   └── vertical_prompts/     按行业的 prompt 增量
├── frontend/        Next.js 16 前端 UI（端口 3000）
│   ├── app/
│   │   ├── page.tsx          ← V1 主编排工作台（默认入口）
│   │   ├── v1/page.tsx       ← V1 别名（同样的工作台 + V1 PREVIEW 标识）
│   │   ├── legacy/page.tsx   ← V0 9 头像 demo（保留参考）
│   │   ├── skills/page.tsx   ← Skill 市场（拉真后端注册表）
│   │   ├── artifacts/        ← 真后端产出库
│   │   └── ...
│   ├── components/
│   │   ├── v1-workbench.tsx  ← V1 工作台主组件
│   │   ├── group-chat.tsx    ← V0 9 角色群聊（legacy 用）
│   │   └── employee-chat.tsx ← V0 单聊（legacy 用）
│   └── lib/api.ts            ← V1 + V0 客户端
└── docs/                     架构 / 产品文档
```

| 子项目 | 技术栈 | 默认端口 | 启动方式 |
|---|---|---|---|
| `backend/` | Python 3.12 · FastAPI · LangGraph 1.x · uv | **8001** | `cd backend && uv sync --extra dev && uv run uvicorn app.main:app --port 8001` |
| `frontend/` | Node 20+ · Next.js 16 · pnpm · TailwindCSS | **3000** | `cd frontend && pnpm install && pnpm dev` |

## 前后端如何关联

`frontend/.env.local` 把 `NEXT_PUBLIC_AGENT_SERVER_URL` 指向 `http://localhost:8001`,前端 `lib/api.ts` 据此把请求发到 backend:

| 前端 | 后端端点 | 用途 |
|---|---|---|
| `streamV1Conduct()` | `POST /v1/conduct` (SSE) | **V1 主编排**:意图 → 澄清 → 选 skill → 派工 → 交付 |
| `listV1Skills()` | `GET /v1/skills` | Skill 注册表(/skills 页面 + 工作台空态) |
| `streamChat()` / `streamTeamChat()` | `POST /chat` / `/chat/team` (SSE) | V0 单聊 / 群聊(legacy 用) |
| `listAllArtifacts()` 等 | `/artifacts*` | 跨 V0/V1 产出库 |

Backend 的 CORS 已放通本地任意端口。详细字段对齐见 `backend/app/api/routes.py` 与 `frontend/lib/api.ts` 顶部注释。

## 快速开始

```bash
# 终端 1 ── 后端
cd backend
cp .env.example .env          # 不填 key 默认走 DEMO_MODE 占位
uv sync --extra dev
uv run uvicorn app.main:app --port 8001

# 终端 2 ── 前端
cd frontend
pnpm install
pnpm dev                      # 浏览器打开 http://localhost:3000
```

打开浏览器后:
- **`/`** = V1 主编排工作台。直接在输入框告诉它"做一份 8 月复盘 PPT" / "给面膜写小红书标题",主编排自动选 skill + 派工。
- **`/skills`** = 看后端注册的所有 skill(declarative DAG 或 runner-based)。
- **`/artifacts`** = 真实产出物历史。
- **`/legacy`** = V0 9 角色群聊 demo,保留作为视觉参考。

切真实模型:`backend/.env` 设 `DEMO_MODE=false` + 填 `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY` / `SILICONFLOW_API_KEY` / `MINIMAX_API_KEY`。无 key 时全部走模板 fallback,链路不崩。

## V0 → V1 演进

| 维度 | V0(在 `/legacy` 保留) | V1(默认 `/`) |
|---|---|---|
| Agent 切分 | 9 角色(chief / analyst / writer / ...) | 4 能力(T / I / V / D) |
| 派工 | chief 关键词匹配 | 主编排 LLM 意图理解 + skill 召回 |
| 反诈视频 | 写死 LangGraph 5 节点 | 一个 skill `anti_scam_video.yaml`,主编排按意图召唤 |
| 添加新能力 | 改 dispatcher 代码 | 写一份 skill YAML 即可 |
| Prompt 配置 | 硬编码 | `vertical_prompts/{行业}.yaml` 叠加 |

V0 不会被立刻删除,等 V1 实测稳定再考虑归档到 `legacy-v0` 分支。

## 文档

- [`docs/v1-architecture.md`](docs/v1-architecture.md) — V1 架构契约(主编排 + 4 能力 + skill 市场)
- [`docs/developer-prompt-v4.md`](docs/developer-prompt-v4.md) — V0 时期的开发提示词(v4 final)
- [`docs/product-feature-list-v5.md`](docs/product-feature-list-v5.md) — 产品功能清单 v5
- [`docs/master-prompt.md`](docs/master-prompt.md) — 母版 prompt(生成提示词)
