# Youle MVP - AI Agent Anti-Fraud Video Demo

One-sentence: Local-runnable multi-agent system that turns Excel news data into anti-fraud short videos.

## V0 Scope

**Does**: 5-agent LangGraph pipeline (orchestrator + text + image + audio + video), SSE streaming, artifact storage, full fallback chain.

**Does not**: auth, billing, multi-tenant, K8s, PostgreSQL, Redis, knowledge base, cross-group references, one-click publish.

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

# 4. Start server
uv run uvicorn app.main:app --reload --port 8000

# 5. Verify
curl http://localhost:8000/health
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

### Create group
```bash
curl -X POST http://localhost:8000/api/v1/groups \
  -H "Content-Type: application/json" \
  -d '{"goal": "make anti-fraud video"}'
```

### Run pipeline (SSE)
```bash
curl -X POST http://localhost:8000/api/v1/groups/{group_id}/runs \
  -F "goal=make anti-fraud video" \
  -F "auto_approve=true" \
  -F "file=@data/uploads/sample_news.xlsx"
```

### List artifacts
```bash
curl http://localhost:8000/api/v1/groups/{group_id}/artifacts
```

### Download artifact
```bash
curl -O http://localhost:8000/api/v1/artifacts/{artifact_id}/download
```

## SSE Event Types

```javascript
const es = new EventSource(`/api/v1/groups/${groupId}/runs`);
// Events: graph_start, group_created, agent_joined, dispatch_plan,
//         approval_required, agent_start, chunk, handoff, artifact,
//         agent_done, cost_update, error, done
es.addEventListener('artifact', (e) => {
  const data = JSON.parse(e.data);
  console.log(`New artifact: ${data.data.type}`);
});
es.addEventListener('done', () => es.close());
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
- **Port in use**: Change `--port 8000` to another port
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
