# Youle Backend — Conductor + 4 Capability Agents + Skill Marketplace

FastAPI backend for `frontend/`. The default model is **V1**: a Conductor LLM that
parses user intent, picks a matching skill from the YAML registry, and dispatches
work to the four capability agents (T / I / V / D). The V0 9-role chat layer is
kept for reference under `/legacy` on the frontend, but is no longer the default.

Architecture contract: see [`../docs/v1-architecture.md`](../docs/v1-architecture.md).

## V1 Endpoints (current)

- `POST /v1/conduct` — main Conductor SSE stream (intent → clarify? → skill → dispatch → deliver)
- `GET  /v1/skills`  — registered skills (YAML scanned from `backend/skills/`)
- `GET  /skills`     — same payload, alias for V0-compat tooling
- Capability agents at `app/capabilities/{text,image,video,doc}.py` share a single
  `run(task, intent, upstream, session_id)` async-generator interface

## V0 Endpoints (kept for `/legacy` and gradual migration)

- `POST /chat`       — single-role streaming, 9 employees
- `POST /chat/team`  — group dispatch + anti-fraud pipeline (now routed through skill registry)
- `POST /chat/team/resume/{thread_id}` — HITL resume after `clarify_required`
- `/agents`, `/artifacts*`, `/auth*`, `/chat/archive*`, `/history*`, `/upload`, `/health`

## Scope (V1 baseline)

**Does**:
- Conductor with structured-output intent parsing (Anthropic when `ANTHROPIC_API_KEY` set, heuristic fallback otherwise) + clarify loop + skill retriever
- 4 capability agents with full fallback chains (no key → templates / placeholder media)
- Skill registry: declarative DAG (`steps`) and Python `runner` skills both supported
- Per-vertical prompt layering via `backend/vertical_prompts/{vertical}.yaml`
- Anti-fraud pipeline kept available, but now as `skills/anti_scam_video.yaml` (runner-based) — keyword routing replaced by registry-driven matching
- SSE streaming, artifact persistence with concurrency-safe manifest writes, file upload, archive, history, observability trace store

**Does not (V1 out of scope, deferred to V2+)**: real auth / SSO, billing, multi-tenant, K8s, PostgreSQL, Redis, RAG knowledge base, cross-session memory, one-click publishing.

## Requirements

- Python 3.12
- FFmpeg (optional - system uses fallback without it)
- uv (package manager)

## Setup

```bash
# 1. Install dependencies
uv sync --python 3.12 --extra dev

# 2. Configure environment
cp .env.example .env
# Edit .env - set DEMO_MODE=true if no API keys

# 3. Generate sample data
uv run python scripts/make_sample_input.py

# 4. Start server (frontend's .env.local expects port 8001)
uv run uvicorn app.main:app --reload --port 8001

# 5. Verify
curl http://localhost:8001/health
```

## .env Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| DEMO_MODE | No | `true` = skip API key checks, use fallbacks |
| ANTHROPIC_API_KEY | DEMO=false | Claude API key |
| DEEPSEEK_API_KEY | DEMO=false | DeepSeek for Chinese text |
| SILICONFLOW_API_KEY | DEMO=false | Image generation |
| MINIMAX_API_KEY | DEMO=false | TTS voice |

## Testing

```bash
uv run pytest                          # Unit tests (23 tests)
uv run python scripts/smoke_test.py    # End-to-end smoke test
```

## API Examples

### List 9 employees
```bash
curl http://localhost:8001/agents
```

### Single chat (SSE)
```bash
curl -N -X POST http://localhost:8001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "帮我写一段小红书文案", "agent_id": "writer"}'
```

### Team chat — generic dynamic dispatch (SSE)
```bash
curl -N -X POST http://localhost:8001/chat/team \
  -H "Content-Type: application/json" \
  -d '{"message": "做一份小红书冷启动方案", "mode": "dispatch", "members": ["chief","analyst","writer","planner"]}'
```

### Team chat — anti-fraud video pipeline (keyword "反诈视频" triggers LangGraph)
```bash
curl -N -X POST http://localhost:8001/chat/team \
  -H "Content-Type: application/json" \
  -d '{"message": "做一支反诈短视频"}'
```

### Artifacts
```bash
curl http://localhost:8001/artifacts
curl http://localhost:8001/artifacts/by-agent/writer
curl http://localhost:8001/artifacts/{session_id}
```

## SSE Event Types

Single chat (`/chat`):
- `start` → `progress` → `chunk*` → `done` (or `error`)

Team chat (`/chat/team`):
- `start` → `dispatch` (or `discussion`) → `handoff` → `agent_start` → `chunk*` → `agent_done` → `artifact_saved` → `agent_start(summary)` → `chunk*` → `agent_done` → `done`

```javascript
const es = await fetch('/chat/team', { method: 'POST', body: JSON.stringify({...}) });
// parse `data: {...}\n\n` per line
```

## ModelGateway

Business code calls `capability_id`, not SDK directly:

| capability_id | Purpose | Fallback |
|---------------|---------|----------|
| text.script.zh | Chinese script | Template script |
| image.generate | Warning images | Pillow placeholder |
| voice.tts.zh | TTS voice | Silent WAV |
| music.generate | BGM | Local file / silent |

To switch providers: edit `app/adapters/model_gateway.py` and update `.env`.

## FAQ

- **API key missing**: Set `DEMO_MODE=true` in `.env`, all calls use fallback
- **FFmpeg missing**: Video agent creates fallback artifact (JSON manifest + all assets)
- **TTS fails**: Silent WAV audio track generated automatically
- **Upload format error**: Supports .xlsx and .csv with fuzzy column matching
- **Port in use**: Change `--port 8001` to another port (and update `frontend/.env.local` accordingly)
- **Image download fails**: 4-level fallback: download -> og:image -> AI generate -> Pillow

## V1 Roadmap

1. PostgreSQL checkpoint
2. Redis event bus
3. LiteLLM Router
4. Langfuse tracing
5. Full HITL 4-tier approval
6. Artifact versioning
7. Knowledge base / RAG
8. Cross-group references
9. Agent marketplace
10. Production auth + quotas
