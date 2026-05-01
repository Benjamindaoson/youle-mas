# V1 实测真 LLM Key 检查清单

V1 在 DEMO 模式下完整跑得通(模板 fallback)。要切到真模型,把以下钩子打开后做端到端 smoke。

---

## 1. 配置 key

`backend/.env`(从 `.env.example` 拷贝):

```ini
DEMO_MODE=false
# 至少配置 ANTHROPIC_API_KEY 即可激活 V1 主路径(意图理解 + 澄清 + skill rerank)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-7

# 可选:激活更多能力
DEEPSEEK_API_KEY=sk-...        # 更便宜的中文文字 capability
SILICONFLOW_API_KEY=sk-...     # I agent 真实 AI 出图(否则 placeholder)
MINIMAX_API_KEY=...            # V agent TTS(否则静音 wav)
MINIMAX_GROUP_ID=...
```

---

## 2. 启动并验证 key 已生效

```bash
cd backend
uv run uvicorn app.main:app --port 8001
# 启动日志应该没有 "ANTHROPIC_API_KEY 未设置" 的 warning
curl http://localhost:8001/health  # demo_mode 应是 false
```

---

## 3. 关键路径手测(顺序很重要)

### 3.1 Conductor 意图理解(LLM)

```bash
curl -N -X POST http://localhost:8001/v1/conduct \
  -H "Content-Type: application/json" \
  -d '{"message":"帮我给抗老精华做一张电商主图","session_id":"smoke:llm-1"}'
```

期望 SSE 流:
- `intent_parsed` → `intent.confidence` 应是 LLM 给的 0.85+;`subject` 包含"抗老精华";`vertical` 是 `ecommerce`(LLM 抽取,不是启发式)
- `skill_selected` → `ecommerce_main_image`,`reason` 是 LLM 给的自然中文(不是 "MVP: 取检索 top-1")
- `agent_start capability=T` → chunk 内容**不**含 `[DEMO 模板·配 LLM key 后切换为真生成]` 前缀
- 整套流程跑完不应出现 `error` 事件

### 3.2 LLM 澄清话术

```bash
curl -N -X POST http://localhost:8001/v1/conduct \
  -H "Content-Type: application/json" \
  -d '{"message":"帮我做点东西","session_id":"smoke:llm-2"}'
```

期望:
- `clarify_required.questions` 的 `question` 字段是 LLM 写的自然反问(如"想做图、视频还是文档?"),**不是**模板里的"你想要什么形式的成品?"
- 每条仍有合规的 `slot` / `options` / `free_form` 结构

### 3.3 候选 skill rerank

```bash
curl -N -X POST http://localhost:8001/v1/conduct \
  -H "Content-Type: application/json" \
  -d '{"message":"帮我策划一份小红书新品上架","session_id":"smoke:llm-3"}'
```

这条话**含"小红书"**,用启发式可能落到 `xiaohongshu_hook_title`,但实际意图是策划方案。期望:
- `skill_selected.reason` 是 LLM 解释为什么选(或不选)某 skill 的中文一句话
- 否决词机制 + LLM rerank 联合作用,不应误命中标题 skill

### 3.4 I/V/D 真 capability(可选)

只在配置了对应 key 后做:
- I:`ecommerce_main_image` skill 跑一遍,artifact 应是真 SiliconFlow 出图,不是 PIL 占位图
- V:有 ffmpeg + Minimax key 时,反诈视频 skill 跑出真 mp4
- D:无需 key,本地 python-pptx 直接生成,DEMO 模式下也是真文件

---

## 4. 自动化测试

```bash
cd backend
uv run pytest -v
# 全量 (V0 + V1 phases) 应保持 145/145
# 关键文件:
#   tests/test_v1_skeleton.py         (4)
#   tests/test_v1_phase2_e2e.py       (7)
#   tests/test_v1_phase3_e2e.py       (5)
#   tests/test_v1_phase4_5_llm.py     (13)
```

测试不依赖真 key — `test_clarify_uses_llm_when_key_set` 等通过 `monkeypatch` 桩 `anthropic.AsyncAnthropic`,模拟 LLM 响应。

---

## 5. 出问题时怎么排查

| 现象 | 位置 |
|---|---|
| 意图全部走启发式不上 LLM | `settings.has_anthropic` (属性,看 `ANTHROPIC_API_KEY` 是否非空+非占位串)。check `app/config.py` 里 dummy 检测列表 |
| 澄清话术还是模板 | `app/conductor/clarify.py` `_generate_with_llm` 的异常被吞 → 看 `logger.warning("clarify_llm_failed_fallback_template")` |
| skill rerank 总取 top-1 | `app/conductor/dispatcher.py` `_rerank_with_llm` |
| LLM 返回非 JSON 解析失败 | 看相关 `logger.warning` 含 "no json" / "no JSON array" / "rerank_id_not_in_candidates" |

---

## 6. 不在本检查清单内

- 真实成本统计(每条请求 token 消耗)
- 速率限制(rate limit)
- LLM 响应延迟基线测量
- 多 vertical prompt yaml 切换实测
- 视频生成成本(SiliconFlow / Minimax 计费需关注)

这些是 V1.5 / V2 的事。
