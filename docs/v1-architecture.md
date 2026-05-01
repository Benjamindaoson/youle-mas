# Youle V1 架构契约

> 状态:**草案 v0.1** · 2026-05-01
> 范围:V1 产品形态 + 后端实现契约 + 与 V0 的 diff
> 受众:决定后续 4-6 周开发的所有人

---

## 0. TL;DR

**Youle = 主编排 agent + 4 能力 agent + skill 市场,聚焦"内容 + 营销"场景。**

护城河在主编排:把模糊问题变成结构化需求,从 skill 市场调对应 workflow,精准甚至超预期地交付。其他都是体力活。

---

## 1. 产品定位(锚)

- **场景**:内容创作 + 营销分发(电商图、小红书图文、短视频、新品发布物料、复盘报告 …)
- **用户**:不会写 prompt 的内容/营销 owner
- **承诺**:你给一句模糊的话,我给一份成品交付物
- **差异化**:不是工作流编辑器(用户不配 skill);**主编排自动选 skill 调能力 agent**

---

## 2. 系统两层

```
┌─────────────────────────────────────────────────────────────┐
│  不变层 (multi-agent system)                                │
│                                                             │
│   ┌──────────────────────────┐                             │
│   │   主编排 agent (Conductor) │  ← 核心竞争力              │
│   │   · 意图理解 (intent)      │                            │
│   │   · 意图澄清 (clarify)     │                            │
│   │   · skill 检索 (retrieve)  │                            │
│   │   · 任务编排 (dispatch)    │                            │
│   │   · 验收 (review)          │                            │
│   └─────────────┬────────────┘                             │
│                 │                                          │
│       ┌─────────┼─────────┬─────────┬─────────┐            │
│       ▼         ▼         ▼         ▼         ▼            │
│   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐                   │
│   │ T   │   │ I   │   │ V   │   │ D   │                   │
│   │文字 │   │ 图  │   │视频 │   │文档 │                   │
│   └─────┘   └─────┘   └─────┘   └─────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                  ↑                  ↑
                  │                  │
┌─────────────────┴──────────────────┴────────────────────────┐
│  可变层                                                      │
│                                                             │
│   ┌────────────────┐    ┌──────────────────────────────┐   │
│   │ Prompt 配置    │    │ Skill 市场                    │   │
│   │ (按垂直领域)    │    │ (workflow 注册表)             │   │
│   │                │    │                              │   │
│   │ - 美妆电商      │    │ - 生成精美电商图              │   │
│   │ - 食品餐饮      │    │ - 小红书爆款图文              │   │
│   │ - 知识付费      │    │ - 60 秒短视频脚本+合成        │   │
│   │ - 反诈宣传      │    │ - 月度数据复盘 PPT            │   │
│   └────────────────┘    └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 主编排 agent (Conductor)

### 3.1 职责

| 阶段 | 输入 | 输出 |
|---|---|---|
| **Intent** | 用户原话 | 结构化 intent JSON |
| **Clarify** | intent (置信度低 / 缺关键槽位) | 1-3 个澄清问题 ← 反馈 ← intent 更新 |
| **Retrieve** | 完整 intent | 候选 skill 列表(top-3) |
| **Plan** | 选定的 skill | 任务图(DAG):每步派给哪个能力 agent |
| **Dispatch** | 任务图 + skill prompt | 流式调用各能力 agent |
| **Review** | 各 agent 产出 | 校验是否满足 intent;不满足 → 重派 |
| **Deliver** | 通过校验的 artifact 集合 | 交付包(给用户) |

### 3.2 实现策略

- **LLM 驱动**:Conductor 本身是 LLM 调用,不是 if/else。Prompt 给 4 个能力 agent + skill 库的描述,让 LLM 选。
- **Tool-use 模式**:把 4 能力 agent + skill 检索器都当 tool 暴露给 LLM,让它发 tool_call。
- **Checkpoint**:每个阶段(intent/plan/dispatch/...)落 LangGraph 检查点,中断/恢复友好。
- **Streaming**:思考过程 + 澄清问 + 各 agent 工作流式回前端。

### 3.3 Intent JSON Schema(草案)

```json
{
  "vertical": "ecommerce | content | marketing | finance | other",
  "deliverable_type": "image | video | doc | text | bundle",
  "subject": "<对象的简明描述>",
  "constraints": {
    "platform": ["小红书", "抖音", ...],
    "tone": "...",
    "length": "...",
    "deadline": "..."
  },
  "raw_user_text": "<原话>",
  "confidence": 0.0,
  "missing_slots": ["platform", "tone", ...]
}
```

`confidence < 0.7` 或 `missing_slots` 非空 → 触发 Clarify。

---

## 4. 4 个能力 Agent

### 4.1 通用契约

每个能力 agent 暴露同一个接口:

```python
async def run(
    task: Task,           # Conductor 分配的子任务
    skill: SkillSpec,     # Conductor 选好的 skill (含 prompt 模板)
    context: dict,        # 上游 agent 的产出
) -> AsyncIterator[Event]:
    yield Event("start")
    yield Event("chunk", text=...)
    yield Event("artifact", path=..., type=...)
    yield Event("done")
```

### 4.2 agent1 — 文字/语言 (T)

| 子能力 | 实现 |
|---|---|
| 写作 | Anthropic / DeepSeek |
| 推理 / 思考 | Claude (extended thinking) |
| 数据收集 | + 工具调用(浏览/搜索 API) |
| 数据分析 | + Python REPL 沙盒(可选 V1.5) |

**Prompt 维度**:行业 × 平台 × 风格(可在 vertical_prompts/ 下叠加)。

### 4.3 agent2 — 图 (I)

| 子能力 | 实现 |
|---|---|
| 理解 | Claude vision / Gemini vision |
| 生成 | SiliconFlow / OpenAI DALL·E / 即梦 |
| 改图 | inpaint API |

V0 的 image_agent 直接合并进来;4 级 fallback 链保留。

### 4.4 agent3 — 视频 (V)

| 子能力 | 实现 |
|---|---|
| 理解 | (V1.5+) |
| 生成 | 当前用 FFmpeg slideshow + TTS;V1.5 接可灵/Sora |
| 改 | (V1.5+) |
| **音频(组成部分)** | TTS (MiniMax / 11Labs) + BGM 库 |

V0 的 audio_agent + video_agent **合并为单一 V agent**。音频是 V agent 的内部步骤,不单独对外。

### 4.5 agent4 — 办公文档 (D)

| 子能力 | 实现 |
|---|---|
| PDF 理解 | pypdf + Claude vision |
| Excel 理解/生成 | pandas + openpyxl |
| PPT 生成 | python-pptx + 模板 |
| Word 生成 | python-docx |

**V0 完全没有这个 agent**。V1 必须加,因为内容/营销场景大量产出 PPT/Excel/PDF 报告。

---

## 5. Skill 市场

### 5.1 SkillSpec Schema

```yaml
# skills/ecommerce_main_image.yaml
id: ecommerce_main_image
name: 电商主图生成
version: 1.0
description: |
  生成符合电商平台主图规范的产品图(白底/场景双版本)。
  适用于淘宝/京东/小红书电商。
intent_keywords:    # 用于 Conductor 召回
  - 主图
  - 电商图
  - 产品图
required_slots:
  - product_name
  - target_platform
  - style_keywords
optional_slots:
  - reference_image
  - color_scheme
steps:
  - agent: T
    task: 撰写图片 prompt(产品文案 + 视觉描述)
    prompt_template: |
      你是电商图视觉策划。基于以下信息写 SD/Flux 风格的英文 prompt:
      产品: {product_name}
      平台: {target_platform}
      风格: {style_keywords}
      ...
  - agent: I
    task: 按 prompt 生成主图(白底版 + 场景版)
    inputs:
      prompts: ${steps[0].output.prompts}
    outputs:
      - image-asset (white_bg)
      - image-asset (scene)
  - agent: T
    task: 写图片描述/alt 文案
    inputs:
      images: ${steps[1].outputs}
deliverable:
  type: bundle
  contains: [image-asset, image-asset, alt-text]
```

### 5.2 Skill 检索

- **MVP**:关键词 + LLM 选择(Conductor 把 intent + 候选 skill 列表喂 LLM,LLM 返回 top-1)
- **V1.5**:embedding 召回 + LLM 重排
- **V2+**:用户使用反馈学习

### 5.3 Skill 注册

后端起一个 `app/skills/registry.py`,启动时扫描 `skills/*.yaml` 加载到内存。
后续可加 admin API 上传新 skill。

---

## 6. Prompt 配置(可变层)

```
backend/
└── vertical_prompts/
    ├── ecommerce.yaml      # 电商垂直的 system prompt 增量
    ├── beauty.yaml         # 美妆
    ├── food.yaml           # 食品餐饮
    └── default.yaml
```

加载顺序:`base_prompt` (能力 agent 自带) → `vertical_prompts/{vertical}.yaml` 叠加 → `skill.prompt_template` 替换。

---

## 7. 与 V0 的 diff

| 方向 | V0 现状 | V1 目标 | 改造工作量 |
|---|---|---|---|
| Agent 维度 | 9 角色(chief 等) | 1 主编排 + 4 能力 | 中 |
| 主编排 | if/else 关键词派活 | LLM tool-use + 意图理解 | **大(护城河)** |
| 意图澄清 | 无 | Clarify 循环 | 大 |
| Skill 库 | 无 | YAML 注册 + 检索 | 中 |
| 反诈视频流水线 | 写死的 LangGraph 5 节点 | 一个 skill | 小(直接转译) |
| 办公文档 agent | 无 | 新增 | 中 |
| 音视频拆分 | audio_agent + video_agent | 合并为 V agent | 小 |
| 前端 9 头像 | sidebar 9 个角色 demo | 1 主编排 + 4 能力 + skill 市场入口 | 中 |
| Prompt 来源 | 硬编码在代码 | yaml + 行业叠加 | 小 |

**保留(40% 复用)**:LangGraph + checkpointer、SSE 事件契约、artifact 落盘、role_chat 的 LLM/template fallback、23 项安全加固。

---

## 8. 实施顺序

### Phase 0:冻结 V0(已完成)
- V0 master 干净、能 demo、PR #5 收尾

### Phase 1:V1 骨架(本周)
- [ ] 新分支 `v1-capability-agents`
- [ ] `backend/app/conductor/` 主编排骨架(LLM tool-use 框架,先返 stub)
- [ ] `backend/app/capabilities/{text,image,video,doc}/` 4 能力 agent 占位
- [ ] `backend/skills/` 目录 + YAML 注册器(空注册表)
- [ ] 1 个 demo skill(`ecommerce_main_image.yaml`)写到 yaml 但不实现
- [ ] 单元测试:主编排能选中 demo skill、能下发到能力 agent

### Phase 2:文字能力 + 1 skill 跑通(下周)
- [ ] T agent 接 Anthropic/DeepSeek(复用 role_chat 的 fallback 模式)
- [ ] 1 个 text-only skill(如"小红书爆款标题")端到端
- [ ] Conductor 完整循环:意图 → 澄清(可选)→ 选 skill → 派 T → 验收 → 交付
- [ ] 端到端 e2e 测试

### Phase 3:图 + 视频 + 文档(2-3 周)
- [ ] I agent(直接搬 V0 image_agent + 4 级 fallback)
- [ ] V agent(合并 V0 audio + video,反诈视频流水线变成一个 skill)
- [ ] D agent(全新,先支持 PPT 生成 + Excel 读)
- [ ] 各 agent 接入 skill 市场

### Phase 4:前端切换(1 周)
- [ ] 9 头像 → 1 主编排 + 4 能力 头像
- [ ] 加 skill 市场展示页(只读;但展示真实 yaml 注册的 skill)
- [ ] 加意图澄清对话 UI(Conductor 反问 → 用户选项答)
- [ ] 砍掉旧 group-chat 9 角色 demo 路径

### Phase 5:V1 切 master(下个月)
- [ ] V1 分支 PR 合 master
- [ ] V0 归档到 `legacy-v0` 分支保留
- [ ] README/产品文档全面更新

---

## 9. 不在 V1 范围(V2+ 推迟)

- 多用户 / 鉴权 / SSO
- 计费 / 金币
- 知识库(RAG)
- skill 用户上传
- 视频真 AI 生成(可灵/Sora 接入)
- 多 worker / Redis 化
- 公开 API / SDK

---

## 10. 验收标准(V1 出门考)

1. 用户输入"帮我做一张面膜的小红书主图,要日系简约"→ 系统自动召回 skill → T 生成图 prompt → I 生成 2 张图 → T 生成文案 → 一次交付。**全程零额外提问**(intent 完整时)。
2. 用户输入"帮我做点东西"→ Conductor 反问 2 次澄清(deliverable_type / vertical),用户选完 → 走 1 的流程。
3. 切换垂直(电商 → 知识付费),仅改 vertical_prompts,无需改代码。
4. 添加新 skill 仅需丢 yaml 进 `skills/`,重启即生效。
5. 任意 LLM/服务挂了走 fallback,链路不崩(继承 V0 的 fallback 哲学)。

---

## 11. 决策栏(Open Questions)

| 议题 | 当前倾向 | 待定 |
|---|---|---|
| Conductor 用什么模型 | Claude Opus 4(thinking 模式) | 看 cost |
| skill 检索召回:LLM-only / embed-then-rerank | MVP 先 LLM-only | 量大再加 embedding |
| 同时支持 OpenAI/Claude/DeepSeek | gateway 已有,各能力 agent 自选 | LLM 池策略 |
| 澄清最多几轮 | 默认 ≤2,超时直接给"最佳猜测" | 数据后调 |
| 每个 skill 是否带成本预估 | 是,YAML 里写 expected_cost_usd | 实时还是估算 |

---

## 附录 A:Glossary

- **Conductor**:主编排 agent,系统大脑
- **Capability agent (T/I/V/D)**:4 个能力 agent
- **Skill**:可装载的 workflow,YAML 描述 + LLM 实例化执行
- **Vertical prompt**:行业垂直定制 prompt 增量
- **Intent**:用户意图的结构化表示
- **Slot**:意图中的关键槽位(平台、风格、目标 …)
- **Clarify**:槽位不全时的反问环节

---

## 附录 B:为什么这样切而不是别的切法

- **为什么不按"职业角色"(V0 的 9 员工)切?**
  人话听起来好,但代码上每个角色都是 LLM 包不同 prompt,没本质能力差异 → 9 个 agent 实际是 1 个能力(文字)。**4 能力切法贴近实现真相**。

- **为什么把音频合并进视频?**
  音频是视频的组成,工作流上音频几乎只在视频上下文出现;独立成 agent 制造没必要的协调开销。

- **为什么 skill 不让用户配?**
  这是产品差异化。让用户配 = n8n / Dify 的赛道,体验复杂。**让 LLM 自动选 skill = 产品魔法所在**。

- **为什么需要单独的"主编排"?**
  没有它,系统就是 4 个独立调用的 LLM。"理解 + 澄清 + 编排"是把 4 个能力凑成产品的胶水。
