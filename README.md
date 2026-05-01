# Youle / 有了

「有了」AI Agent 多智能体系统 · V0 反诈短视频 demo。

## 仓库结构

```
youle_mas/
├── backend/      FastAPI + LangGraph 多智能体后端（端口 8001）
├── frontend/    Next.js 14 前端 UI（端口 3000）
└── docs/        产品需求 / 开发提示词 / 母版 prompt
```

| 子项目 | 技术栈 | 默认端口 | 启动方式 |
|---|---|---|---|
| `backend/` | Python 3.12 · FastAPI · LangGraph 1.x · uv | **8001** | `cd backend && uv sync --extra dev && uv run uvicorn app.main:app --reload --port 8001` |
| `frontend/` | Node 20+ · Next.js 14 · pnpm · TailwindCSS | **3000** | `cd frontend && pnpm install && pnpm dev` |

## 前后端如何关联

`frontend/.env.local` 把 `NEXT_PUBLIC_AGENT_SERVER_URL` 指向 `http://localhost:8001`，前端 `lib/api.ts` 据此把 `/chat`、`/chat/team`、`/agents`、`/artifacts*`、`/auth/*`、`/upload` 等请求发到 backend。Backend 的 CORS 已放通本地任意端口。

> 想看接口契约对齐细节，参见 `backend/app/api/routes.py` 与 `frontend/lib/api.ts` 顶部注释。

## 快速开始

```bash
# 终端 1 ── 后端
cd backend
cp .env.example .env          # 不填 key 默认走 DEMO_MODE 占位
uv sync --extra dev
uv run uvicorn app.main:app --reload --port 8001

# 终端 2 ── 前端
cd frontend
pnpm install
pnpm dev                      # 浏览器打开 http://localhost:3000
```

切换真实 AI 模型：把 `backend/.env` 里 `DEMO_MODE=false`，然后填入 `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY` / `SILICONFLOW_API_KEY` / `MINIMAX_API_KEY`。

## 文档

- `docs/developer-prompt-v4.md` — 给 AI 编码 agent 用的开发提示词（v4 final）
- `docs/product-feature-list-v5.md` — 产品功能清单 v5
- `docs/master-prompt.md` — 母版 prompt（生成提示词）
