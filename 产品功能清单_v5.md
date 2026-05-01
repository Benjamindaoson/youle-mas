# 「有了 / Youle」产品功能清单 v5

> 版本：v5.0 | 日期：2026-04-30
> 配套文档：开发者提示词.md v5 Final
> 用途：产品 / PM / 老板对照检查；工程开发对齐 scope

---

## 总览

| 优先级 | 数量 | 含义 |
|---|---|---|
| **V0** | 41 | 本地 1 天反诈短视频 demo 必做 |
| **V1** | 75 | 完整版必做（V0 跑通后第 2-8 周）|
| **V1.5** | 18 | 第一次迭代（V1 上线 1-2 月内）|
| **V2** | 22 | 下一大版本（≥ 6 月）|
| **永不做** | 8 | 产品红线 / 不在范围 |
| **合计** | **164** | |

优先级图例：
- 🟢 **V0** = 本地 1 天 MVP 必做
- 🔵 **V1** = 完整版必做
- 🟡 **V1.5** = 第一次迭代
- 🟣 **V2** = 下一大版本
- ⛔ **永不做** = 产品红线

---

## 一、UI 与整体布局

### 1.1 主框架

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 1 | 仿微信三栏布局 | 🔵 V1 | V0 接现有前端，V1 完整重做 |
| 2 | 第一栏功能栏（用户头像 / 成果库 / 知识库 / 配额）| 🔵 V1 | 48px 超薄 |
| 3 | 第二栏对话列表 | 🔵 V1 | 260px |
| 4 | 主区聊天界面 | 🟢 V0 | 自适应宽度 |
| 5 | 右侧抽屉工作状态板（员工 / 任务 / 成果 / 配额）| 🔵 V1 | 320px 可折叠 |
| 6 | 顶部群信息条 | 🟢 V0 | 群名 + 成员头像 |
| 7 | 底部输入框（自适应高度）| 🟢 V0 | |
| 8 | 移动端响应式适配 | 🟣 V2 | 桌面优先 |
| 9 | 深色 / 浅色主题切换 | 🟡 V1.5 | |
| 10 | 国际化 i18n | 🟣 V2 | V1 仅中文 |

### 1.2 第一栏（功能入口）

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 11 | 用户头像入口 | 🔵 V1 | 个人资料 / 设置 |
| 12 | 成果库入口 | 🔵 V1 | |
| 13 | 知识库入口 | 🔵 V1 | |
| 14 | 配额面板入口 | 🔵 V1 | 显示今日剩余 |

### 1.3 第二栏（对话列表）

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 15 | 顶部搜索框 | 🟡 V1.5 | 搜群 / 员工 / 历史消息 |
| 16 | 顶部 + 按钮（新建群 / 加单聊员工）| 🔵 V1 | |
| 17 | 特别助理 🎯 置顶第 1（不可删 / 不可静音）| 🔵 V1 | 拉群入口 |
| 18 | HR Agent 👔 置顶第 2 | 🔵 V1 | 招聘入口 |
| 19 | 群聊条目（头像 / 名称 / 末条消息 / 末次响应时间 / 未读数）| 🔵 V1 | |
| 20 | 单聊员工条目 | 🔵 V1 | 用户绕过群直接聊的 agent |
| 21 | 折叠置顶聊天 | 🟡 V1.5 | 仿微信 |
| 22 | 群归档 / 群删除 | 🔵 V1 | |

---

## 二、对话与协作交互

### 2.1 工作台 / 群外特别助理

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 23 | 工作台主页面（默认进入）| 🔵 V1 | V0 直接进群 |
| 24 | 群外特别助理对话（拉群专用）| 🔵 V1 | 独立 thread |
| 25 | 意图理解 + 自动建群 + 退场 | 🔵 V1 | V0 无群外特助 |
| 26 | 新用户首次接待引导 | 🟡 V1.5 | 弹气泡说明 |
| 27 | "按你判断做"快捷键 | 🔵 V1 | 跳过澄清 |

### 2.2 群内核心交互

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 28 | 文本消息（用户右 / agent 左，仿微信）| 🟢 V0 | |
| 29 | 流式 chunk 逐字显示 | 🟢 V0 | SSE chunk 事件 |
| 30 | 思考状态提示（"正在分析…""正在写稿…"）| 🟢 V0 | agent_start 事件 |
| 31 | 5 态徽章（待命/思考中/待你审/卡住/刚交付）| 🔵 V1 | V0 仅 3 态 |
| 32 | 接力可见（"选题官把选题交给了种草达人"半冒泡）| 🟢 V0 | handoff 事件 |
| 33 | 派活计划卡（dispatch-plan artifact）| 🟢 V0 | V0 唯一 interrupt 点 |
| 34 | 派活计划审批（通过 / 修改 / 拒绝）| 🟢 V0 | V0 仅"通过/拒绝" |
| 35 | Artifact 卡片嵌入对话流（19 种渲染器）| 🔵 V1 | V0 5 种（脚本/图/音/视/汇总）|
| 36 | 系统消息（半冒泡，关键节点提示）| 🟢 V0 | |
| 37 | 决策卡（agent 主动求助 + 选项 + 自定义输入）| 🔵 V1 | |
| 38 | 进度卡 | 🔵 V1 | |
| 39 | 成果卡（Artifact 的特定形式）| 🔵 V1 | |

### 2.3 用户与 Agent 互动

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 40 | @ 提及某 agent 直接对话 | 🔵 V1 | |
| 41 | 引用某条消息说"这里改一下" | 🔵 V1 | |
| 42 | 一键选中消息或 artifact → 操作菜单 | 🔵 V1 | 追问/修改/重做/出变体 |
| 43 | 选中后输入修改意见 | 🔵 V1 | |
| 44 | 选中后追加问题 | 🔵 V1 | |
| 45 | 选中后让 agent 重做 | 🔵 V1 | |
| 46 | 选中后让 agent 出变体 | 🔵 V1 | |
| 47 | 输入框引用栏（显示当前引用，可关闭）| 🔵 V1 | |
| 48 | 打断正在进行的任务 | 🔵 V1 | LangGraph interrupt |
| 49 | 切到单聊（一对一私聊，仍在群上下文）| 🔵 V1 | |
| 50 | 长按消息沉淀到成果库 | 🔵 V1 | |
| 51 | 鼠标悬停 agent 头像 → 浮卡（角色 / 履历 / 当前职责）| 🔵 V1 | |
| 52 | 流程图鼠标悬停数据节点 → "改动此数据 / 提出意见" | 🟡 V1.5 | |

### 2.4 输入框

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 53 | 自适应高度 | 🟢 V0 | |
| 54 | 文字输入 | 🟢 V0 | |
| 55 | 发送按钮 | 🟢 V0 | |
| 56 | @ 提及群内某 agent | 🔵 V1 | |
| 57 | 引用按钮（引用成果库 / 知识库内容）| 🔵 V1 | |
| 58 | 上传本地文件（图 / 文档 / 视频 / 文本）| 🟢 V0 | V0 仅 Excel/CSV |
| 59 | 截图工具 | 🟡 V1.5 | |

---

## 三、Agent 系统（核心）

### 3.1 Agent 角色

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 60 | Orchestrator（主编排）每群 1 个 | 🟢 V0 | claude-opus-4-7 |
| 61 | Text Agent（文字）| 🟢 V0 | deepseek-v4-pro |
| 62 | Image Agent（图片）| 🟢 V0 | FLUX / 即梦 / Ideogram |
| 63 | Audio Agent（音频）独立 | 🟢 V0 | MiniMax TTS |
| 64 | Video Agent（视频）| 🟢 V0 | FFmpeg + (V1) Kling |
| 65 | PPT Agent | 🔵 V1 | python-pptx |
| 66 | Excel Agent | 🔵 V1 | pandas |
| 67 | HR Agent（招聘 / 解聘）| 🔵 V1 | 独立入口 agent |
| 68 | 群外特别助理（拉群配置师）| 🔵 V1 | 独立 thread |

### 3.2 Agent 实例化

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 69 | 名字动态生成（按任务场景）| 🔵 V1 | 选题官 / 笔杆子 / 图美 |
| 70 | 头像动态生成 | 🔵 V1 | |
| 71 | 人设按能力域生成（履历 + 能力描述）| 🔵 V1 | |
| 72 | 能力合并（> 5 个时合并到同一 agent）| 🔵 V1 | |
| 73 | 同一底层 agent 在不同群里独立实例 | 🔵 V1 | thread_id 隔离 |
| 74 | 私有员工库（V1 上限 5 个）| 🔵 V1 | |

### 3.3 Agent 编排

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 75 | LangGraph supervisor pattern | 🟢 V0 | StateGraph |
| 76 | Command(goto, update) 派活 | 🟢 V0 | |
| 77 | Conditional Edges（next_agent 路由）| 🟢 V0 | |
| 78 | thread_id 必传（group_id 隔离）| 🟢 V0 | 红线 |
| 79 | recursion_limit = 50 | 🟢 V0 | |
| 80 | AsyncSqliteSaver checkpoint | 🟢 V0 | V1 切 PostgresSaver |
| 81 | Custom stream（emit SessionEvent）| 🟢 V0 | |
| 82 | Send fan-out 并行 | 🔵 V1 | V0 用 asyncio.gather |
| 83 | Subgraph（讨论模式 / 复杂子流程）| 🟡 V1.5 | |
| 84 | Time Travel（重做这一步）| 🔵 V1 | |
| 85 | Store（跨 thread 长期记忆）| 🔵 V1 | pgvector |

### 3.4 防循环 / 安全约束

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 86 | specialist 不能直接派 specialist | 🟢 V0 | 红线 |
| 87 | specialist 完事必回 orchestrator | 🟢 V0 | 红线 |
| 88 | 同 specialist 单 turn 最多被派 2 次 | 🟢 V0 | 防 ping-pong |
| 89 | 单 turn 总派活 ≤ 8 次 | 🟢 V0 | |
| 90 | 派活链路深度 ≥ 4 强制收尾 | 🟢 V0 | |
| 91 | orchestrator 不写文案 / 不画图 / 不剪视频 | 🟢 V0 | 只调度 |
| 92 | FFmpeg / Shell 命令必须模板化 | 🟢 V0 | 防注入 |

---

## 四、HITL（人在回路）

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 93 | L0 每步都问（新员工默认）| 🔵 V1 | |
| 94 | **L1 单次授权（dispatch_plan 审批）** | 🟢 V0 | V0 唯一 interrupt 点 |
| 95 | L2 长期默认（用户主动升档）| 🔵 V1 | |
| 96 | L3 永不自动（付款 / 发布 / 删除不可逆）| 🔵 V1 | 红线 |
| 97 | LangGraph interrupt() + Command(resume) | 🟢 V0 | |
| 98 | "按你判断做"快捷键（仅 L0/L1 生效，L3 不跳过）| 🔵 V1 | |
| 99 | 决策卡超时处理（V1）| 🟡 V1.5 | 切"卡住"+ 系统提示 |

---

## 五、Capability 能力（按交付物分类）

### 5.1 文字能力

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 100 | 视频脚本生成（≤ 60s 反诈口播）| 🟢 V0 | hook + body + closing |
| 101 | 短文案 / 标题 | 🔵 V1 | 永远 3 版（保守 / 正常 / 大胆）|
| 102 | 长文 / 公众号 | 🔵 V1 | 1500-3000 字 |
| 103 | 选题列表（topic-list）| 🔵 V1 | 5 个方向 + 推荐分 |
| 104 | 标题 A/B（title-ab）| 🔵 V1 | 多个标题 + 预测点击率 |
| 105 | 翻译 | 🔵 V1 | |
| 106 | 决策建议 | 🔵 V1 | |
| 107 | 联网调研（web_search）| 🔵 V1 | Exa / Serper |
| 108 | Excel 数据抽取与规范化 | 🟢 V0 | json.extract.zh |
| 109 | 脚本结构 Pydantic 校验 | 🟢 V0 | ScriptValidator |
| 110 | 不编造数字（evidence 字段强制）| 🟢 V0 | 红线 |

### 5.2 图片能力

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 111 | 文生图（创意 / 写实 / 海报）| 🟢 V0 | FLUX / 即梦 / Ideogram |
| 112 | 4 级图片 fallback（image_url → og:image → AI 生成 → Pillow 占位）| 🟢 V0 | 核心鲁棒性 |
| 113 | og:image 自动抽取 | 🟢 V0 | BeautifulSoup4 |
| 114 | 图改图 / 局部编辑 | 🔵 V1 | FLUX Kontext |
| 115 | 看图理解 / OCR | 🔵 V1 | Claude Vision |
| 116 | 自拍分析（脸型 / 肤色）| 🟣 V2 | 美学 demo |
| 117 | 单品识别 | 🔵 V1 | 穿搭 / 购物 |
| 118 | 警示风格图（无人脸 prompt 模板）| 🟢 V0 | 反诈专用 |
| 119 | 图片自动命名（"诈骗_案件{idx}_{amount}.jpg"）| 🟢 V0 | |
| 120 | SSRF 防御（禁内网 IP / 限大小 / 校验 MIME）| 🟢 V0 | 安全 |

### 5.3 音频能力

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 121 | TTS 配音（中文男主播）| 🟢 V0 | MiniMax |
| 122 | TTS 多音色 | 🔵 V1 | |
| 123 | 长文本切片 + 拼接 | 🔵 V1 | > 500 字 |
| 124 | BGM 选择（V0 写死，V1 库 + 选）| 🟢 V0 | local_bgm |
| 125 | 静音音轨兜底（TTS 失败）| 🟢 V0 | silent_audio |
| 126 | 音频标准化（采样率 / 通道）| 🟢 V0 | audio_normalizer |
| 127 | AI 配乐生成 | 🟣 V2 | Suno / MiniMax music |

### 5.4 视频能力

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 128 | FFmpeg 模板化合成（图 + 音 + BGM + 字幕）| 🟢 V0 | compose_news_video |
| 129 | 字幕生成（脚本 → .srt）| 🟢 V0 | subtitle_maker |
| 130 | 缩略图（ffprobe 抽帧）| 🟢 V0 | thumbnail_maker |
| 131 | 视频校验（ffprobe 时长 / 编码）| 🟢 V0 | video_probe |
| 132 | 浏览器播放兼容（H.264 + AAC + faststart）| 🟢 V0 | |
| 133 | 图生视频 / 动图（≤ 10s）| 🔵 V1 | Kling / Seedance |
| 134 | 一键派生（图 → 动图 / 短视频 / 局部编辑）| 🔵 V1 | |
| 135 | 长视频生成 | 🟣 V2 | V1 限 10s |
| 136 | 真人出镜替换 / deepfake | ⛔ 永不做 | 产品红线 |

### 5.5 PPT 能力（V1 加）

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 137 | 大纲生成 | 🔵 V1 | claude-opus-4-7 |
| 138 | 内容填充 | 🔵 V1 | |
| 139 | 自动排版（10+ 内置模板）| 🔵 V1 | |
| 140 | 配图（调 image agent）| 🔵 V1 | |
| 141 | .pptx 导出 | 🔵 V1 | python-pptx |
| 142 | 商务深度 PPT（10+ 页）| 🟡 V1.5 | |

### 5.6 Excel 能力（V1 加）

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 143 | 读 Excel / CSV | 🟢 V0 | pandas（Text Agent 用）|
| 144 | 数据清洗 | 🔵 V1 | |
| 145 | 关键指标提取 | 🔵 V1 | |
| 146 | 图表生成（折线 / 柱 / 饼 / 散点等 7 种）| 🔵 V1 | matplotlib / plotly |
| 147 | 热力图 / 预测卡 | 🔵 V1 | |
| 148 | .xlsx 导出 | 🔵 V1 | openpyxl |
| 149 | 数据预测（带置信度）| 🔵 V1 | |

### 5.7 生活美学能力（V1.5 加）

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 150 | 穿搭推理 / 搭配建议 | 🟡 V1.5 | |
| 151 | 化妆建议 / 美妆顾问 | 🟡 V1.5 | |
| 152 | 购物方向建议 + 链接（不替用户下单）| 🟡 V1.5 | 红线：永不替你付款 |

---

## 六、Artifact 产出物（19 种）

| # | type | 优先级 | 备注 |
|---|---|---|---|
| 153 | dispatch-plan | 🟢 V0 | 派活计划卡 |
| 154 | video-script | 🟢 V0 | 脚本 |
| 155 | image-asset | 🟢 V0 | 单张图（一键派生）|
| 156 | voice-asset | 🟢 V0 | TTS 音频 |
| 157 | bgm-asset | 🟢 V0 | BGM |
| 158 | subtitle-asset | 🟢 V0 | .srt |
| 159 | video-asset | 🟢 V0 | .mp4（核心交付）|
| 160 | thumbnail | 🟢 V0 | 视频缩略图 |
| 161 | summary | 🟢 V0 | 任务汇总 |
| 162 | fallback | 🟢 V0 | 降级 artifact |
| 163 | text / summary（通用文本类）| 🔵 V1 | |
| 164 | table / chart / heatmap / prediction | 🔵 V1 | 数据类 |
| 165 | topic-list / title-ab / persona-card | 🔵 V1 | 内容创作类 |
| 166 | storyboard（分镜板）| 🔵 V1 | |
| 167 | slide / presentation-deck | 🔵 V1 | 演示类 |
| 168 | diagram（流程图 / 思维导图）| 🟡 V1.5 | |
| 169 | publish-plan（发布排期）| 🟡 V1.5 | |
| 170 | 3d-model-asset（.glb）| 🟣 V2 | |

### Artifact 通用功能

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 171 | 落盘到 data/artifacts/{group_id}/{artifact_id}/ | 🟢 V0 | 必须 |
| 172 | 通过 Artifact API 可下载 | 🟢 V0 | 必须 |
| 173 | 跨群引用（在新任务中引用其它群的 artifact）| 🔵 V1 | |
| 174 | 版本化（v1 / v2 修订）| 🔵 V1 | |
| 175 | 归档 | 🔵 V1 | |
| 176 | 导出（zip 打包）| 🔵 V1 | |
| 177 | 一键发布到平台 | 🟣 V2 | 抖音 / 视频号 / 小红书 |
| 178 | 一键派生（图 → 动图 / 短视频 / 局部编辑）| 🔵 V1 | |

---

## 七、工作流模板

| # | 模板 | 优先级 | 团队（agent slot）|
|---|---|---|---|
| 179 | **反诈短视频** | 🟢 V0 | orchestrator + text + image + audio + video |
| 180 | 小红书冷启动 | 🔵 V1 | orchestrator + text + image |
| 181 | 短视频制作（通用）| 🔵 V1 | orchestrator + text + image + video |
| 182 | 公众号文章 | 🔵 V1 | orchestrator + text + image |
| 183 | 路演 PPT（5 人满编）| 🔵 V1 | orchestrator + excel + text + image + ppt |
| 184 | 数据报告（5 人满编）| 🔵 V1 | orchestrator + excel + text + image + ppt |
| 185 | 穿搭顾问 | 🟡 V1.5 | orchestrator + image + text |
| 186 | 个人美学 | 🟡 V1.5 | orchestrator + image + text |
| 187 | 购物决策 | 🟡 V1.5 | orchestrator + text |

---

## 八、数据 / 文件管理

### 8.1 输入

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 188 | 文件上传（POST /api/v1/groups/{id}/runs multipart）| 🟢 V0 | Uppy + tus（V1）|
| 189 | Excel / CSV 读取（模糊列名匹配）| 🟢 V0 | |
| 190 | 上传文件大小限制 | 🟢 V0 | < 50MB |
| 191 | 上传文件 MIME 校验 | 🟢 V0 | 安全 |
| 192 | 文件名清洗（不直接用原始名作路径）| 🟢 V0 | 安全 |
| 193 | 断点续传 | 🔵 V1 | tus 协议 |

### 8.2 知识库

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 194 | 上传文件（图 / 文档 / 视频 / 文本）| 🔵 V1 | |
| 195 | 上传链接（URL 自动抓标题缩略图）| 🔵 V1 | |
| 196 | 简单分文件夹组织 | 🔵 V1 | |
| 197 | 查看 / 下载 / 删除 | 🔵 V1 | |
| 198 | 引用到群对话 | 🔵 V1 | |
| 199 | Agent 派活时自动调取 | 🔵 V1 | |
| 200 | RAG（向量检索）| 🟡 V1.5 | pgvector |

### 8.3 成果库

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 201 | 集中查看所有 artifact | 🔵 V1 | 跨群汇总 |
| 202 | 按群筛选 | 🔵 V1 | |
| 203 | 按时间排序 | 🔵 V1 | |
| 204 | 按文件类型筛选 | 🔵 V1 | |
| 205 | 查看 artifact 详情 | 🔵 V1 | |
| 206 | 下载 / 复制 / 引用 | 🔵 V1 | |
| 207 | 跳转回来源群 | 🔵 V1 | |
| 208 | 群内成果时间线（每群独立）| 🔵 V1 | |

### 8.4 数据存储

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 209 | SQLite + AsyncSqliteSaver（V0）| 🟢 V0 | |
| 210 | PostgreSQL 16 + pgvector | 🔵 V1 | 切换 |
| 211 | Redis 7 | 🔵 V1 | 限流 / 锁 / 缓存 / ARQ |
| 212 | 阿里云 OSS / Cloudflare R2 | 🔵 V1 | artifact 文件 |
| 213 | 阿里云 KMS（CMK 加密敏感字段）| 🔵 V1 | |
| 214 | 本地磁盘存储（V0）| 🟢 V0 | data/artifacts/ |

---

## 九、API 与协议

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 215 | GET /health | 🟢 V0 | |
| 216 | POST /api/v1/groups（创建群）| 🟢 V0 | |
| 217 | POST /api/v1/groups/{id}/runs（SSE）| 🟢 V0 | |
| 218 | POST /api/v1/groups/{id}/approve（HITL resume）| 🟢 V0 | |
| 219 | GET /api/v1/groups/{id}/artifacts（列表）| 🟢 V0 | |
| 220 | GET /api/v1/artifacts/{id}/download | 🟢 V0 | |
| 221 | OpenAPI 3.0 自动 Swagger | 🟢 V0 | FastAPI 内置 |
| 222 | 统一响应格式 `{code, message, data, request_id}` | 🟢 V0 | |
| 223 | 错误码体系（BIZ-* / CAP-* / ORC-* / DRV-*）| 🔵 V1 | V0 简化 |
| 224 | SSE 长连接 + 13 种 SessionEvent | 🟢 V0 | event_id / type / data |
| 225 | Last-Event-ID 续传 | 🟡 V1.5 | |
| 226 | CORS 配置 | 🟢 V0 | allow_origins |
| 227 | JWT 鉴权（httpOnly cookie）| 🔵 V1 | FastAPI-Users |
| 228 | OAuth 第三方登录 | 🟣 V2 | |

---

## 十、信任与限额

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 229 | 每日 30 次 agent 调用 | 🔵 V1 | slowapi + Redis |
| 230 | 每月 5 个群创建 | 🔵 V1 | |
| 231 | 单群 30 条消息 | 🔵 V1 | |
| 232 | 图生视频每日 3 次（成本 5-10 倍单独限）| 🔵 V1 | |
| 233 | 触达上限提示 + 加白名单入口 | 🔵 V1 | 429 |
| 234 | 私有员工库上限 5 个 agent | 🔵 V1 | |
| 235 | V1 不上金币计费 | 🔵 V1 | 接口预留 cost_usd 上报 |
| 236 | 付费订阅系统 | 🟣 V2 | |
| 237 | 充值 / 退款 | 🟣 V2 | |

---

## 十一、HR + 人才市场（V1）

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 238 | HR Agent 单一职责（招聘 / 解聘）| 🔵 V1 | 不参与拉群 |
| 239 | 人才市场页面 | 🔵 V1 | BOSS 直聘风格 |
| 240 | 5 个官方 agent 卡片（5 槽位 default）| 🔵 V1 | |
| 241 | Agent 卡片元素（头像 / 名字 / 能力 / 履历 / 标签）| 🔵 V1 | |
| 242 | 招聘动作（加入私有库）| 🔵 V1 | |
| 243 | 解聘动作 | 🔵 V1 | |
| 244 | 招聘后自动生成单聊条目 | 🔵 V1 | |
| 245 | HR 主动推荐路径 | 🔵 V1 | 访谈用户需求后推荐 |
| 246 | HR 用户自浏览路径 | 🔵 V1 | 给入口让用户逛 |
| 247 | 第三方 agent 上架 | 🟣 V2 | |
| 248 | Agent 交易（付费购买 / 订阅）| 🟣 V2 | |

---

## 十二、安全 / 合规 / 审计

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 249 | API key 启动 assert 校验 | 🟢 V0 | |
| 250 | 启动检查 ffmpeg 二进制 | 🟢 V0 | shutil.which |
| 251 | Prompt injection 检测（关键词 + 模式）| 🔵 V1 | |
| 252 | PII 脱敏（手机 / 身份证 / 银行卡 / 邮箱 / 地址）| 🔵 V1 | Langfuse 上传前必 redact |
| 253 | 中国合规过滤（政治敏感 / 黄赌毒 / 涉密）| 🔵 V1 | 第三方关键词库 |
| 254 | SSRF 防御（图片下载禁内网 IP）| 🟢 V0 | |
| 255 | 上传文件不执行 | 🟢 V0 | |
| 256 | LLM 不直接生成 shell 命令 | 🟢 V0 | 红线 |
| 257 | 群间消息严格隔离（thread_id）| 🟢 V0 | |
| 258 | events 表 append-only（审计）| 🔵 V1 | guardrail / HITL / 派活全留痕 |
| 259 | KMS 加密敏感字段 | 🔵 V1 | |
| 260 | 日志不写 API key | 🟢 V0 | |
| 261 | 渗透测试 | 🔵 V1 | 上线前一次 |

---

## 十三、可观测 / 监控 / 测试

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 262 | print 日志（V0）| 🟢 V0 | structlog |
| 263 | Langfuse trace（V1）| 🔵 V1 | 自部署 |
| 264 | Prometheus 指标（QPS / 延迟 / 错误率）| 🔵 V1 | |
| 265 | Grafana dashboard | 🔵 V1 | |
| 266 | 成本告警（日 > 日均 3x → 电话）| 🔵 V1 | P0 |
| 267 | 单用户限流（1h > 5x 自动限）| 🔵 V1 | |
| 268 | events 表（业务事件 append-only）| 🔵 V1 | |
| 269 | TokenLedger（每次 driver 调用上报 cost）| 🔵 V1 | |
| 270 | pytest 单元测试 | 🟢 V0 | |
| 271 | smoke_test.py 端到端 | 🟢 V0 | 8 步验证 |
| 272 | Eval 集（4 类：capability / tool / agent / group）| 🔵 V1 | |
| 273 | A/B 测试框架 | 🔵 V1 | 灰度推进 |
| 274 | 升级前必跑 eval（分数掉 > 2% 阻断）| 🔵 V1 | 红线 |
| 275 | Sentry 前端异常上报 | 🔵 V1 | |

---

## 十四、Fallback 矩阵（鲁棒性）

| # | 失败场景 | Fallback | 优先级 |
|---|---|---|---|
| 276 | 文本模型失败 | DeepSeek-V4-Pro → V4-Flash → claude-opus-4-7 → 模板脚本 | 🟢 V0 |
| 277 | 图片下载失败 | og:image → AI 生成 → Pillow 占位图 | 🟢 V0 |
| 278 | 图片生成失败 | 即梦 → DALL-E → Pillow 占位图 | 🟢 V0 |
| 279 | TTS 失败 | 火山引擎 → 静音音轨 | 🟢 V0 |
| 280 | BGM 不存在 | 静音 BGM | 🟢 V0 |
| 281 | FFmpeg 合成失败 | fallback artifact（图集 + 字幕）| 🟢 V0 |
| 282 | 字幕生成失败 | 跳过字幕（仍能合成）| 🟢 V0 |
| 283 | 缩略图失败 | 用第 1 张图代替 | 🟢 V0 |
| 284 | API key 缺失 | lifespan raise 退出 | 🟢 V0 |
| 285 | FFmpeg 二进制缺失 | lifespan raise 退出 | 🟢 V0 |
| 286 | 单 specialist 失败 | retry 1 次 → fallback artifact + 继续主链路 | 🟢 V0 |

---

## 十五、运维 / 部署

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 287 | 本地直接 uv run（V0）| 🟢 V0 | 单机 |
| 288 | Docker Compose（V1 单机部署）| 🔵 V1 | |
| 289 | Kubernetes（V2 多副本）| 🟣 V2 | |
| 290 | Helm Chart（V2）| 🟣 V2 | |
| 291 | GitHub Actions CI | 🔵 V1 | |
| 292 | 滚动更新 / 灰度发布 | 🟣 V2 | |
| 293 | Docker 沙箱（FFmpeg / pandas 隔离）| 🔵 V1 | |
| 294 | Alembic 数据库迁移 | 🔵 V1 | |
| 295 | importlinter（CI 强制 Hexagonal）| 🔵 V1 | |
| 296 | 故障复盘机制 | 🔵 V1 | |
| 297 | 灾备演练 | 🟣 V2 | 每季 |

---

## 十六、未来功能（V2+）

| # | 功能 | 优先级 | 备注 |
|---|---|---|---|
| 298 | 一键发布到抖音 / 视频号 / 小红书 / B站 / 公众号 / 知乎 | 🟣 V2 | PlatformPort 抽象 |
| 299 | 跨平台数据同步（统一 Artifact id + published_to）| 🟣 V2 | |
| 300 | 海外平台（YouTube / X / Instagram / TikTok）| 🟣 V2 | 独立 service |
| 301 | 群聊根据小红书 / 视频号 / 公众号 评论数据**迭代交付**（交付不再是终点）| 🟣 V2 | |
| 302 | AI 自动整理用户记忆 | 🟣 V2 | |
| 303 | LLM 凭空生成新 agent 团队 | 🟣 V2 | |
| 304 | 3D 生成 / AI 头像 | 🟣 V2 | |
| 305 | MCP / A2A 协议 | 🟣 V2 | |

---

## 十七、永远不做（产品红线）

| # | 不做项 | 原因 |
|---|---|---|
| 306 | 替用户下单 / 自动付款 | 产品红线（信任档位 L3 也不许）|
| 307 | 替用户发布到外部平台（必须用户明确确认）| L3 永不自动 |
| 308 | 真人出镜替换 / deepfake | 法律 / 伦理风险 |
| 309 | 账号代运营 | 不在产品范围 |
| 310 | 抓新闻原图（V0/V1 一律 AI 生成 + og:image）| 版权 + 反爬 |
| 311 | Midjourney 接入 | 无公开 API |
| 312 | LangSmith（用 Langfuse 替代）| 数据出境合规 |
| 313 | agno / AgentOS（已淘汰）| 已评估淘汰 |

---

## 附录：V0 必做功能极简表（41 项）

> Claude Code vibe coding 时只看这一张表就够。

| # | 功能 | 文件 / 模块 |
|---|---|---|
| 1 | uv 项目骨架 + pyproject.toml | pyproject.toml |
| 2 | .env + lifespan 校验所有 API key | app/main.py + app/config.py |
| 3 | FFmpeg 二进制启动检查 | app/main.py |
| 4 | GET /health | app/main.py |
| 5 | POST /api/v1/groups | app/api/routes.py |
| 6 | POST /api/v1/groups/{id}/runs (SSE) | app/api/routes.py |
| 7 | POST /api/v1/groups/{id}/approve | app/api/routes.py |
| 8 | GET /api/v1/groups/{id}/artifacts | app/api/routes.py |
| 9 | GET /api/v1/artifacts/{id}/download | app/api/routes.py |
| 10 | CORS 配置 | app/main.py |
| 11 | GroupState (TypedDict + 24 字段) | app/schemas/state.py |
| 12 | 自定义 reducers (append_list / merge_dict / sum_float) | app/graph/reducers.py |
| 13 | DispatchPlan / Artifact / SessionEvent / NewsItem (Pydantic) | app/schemas/*.py |
| 14 | LangGraph build_graph (5 nodes + 5 edges + 1 conditional) | app/graph/builder.py |
| 15 | thread_id 必传 + recursion_limit=50 | app/graph/runtime.py |
| 16 | AsyncSqliteSaver checkpoint | app/graph/builder.py |
| 17 | Custom stream + SessionEvent emit | app/sse.py |
| 18 | orchestrator_node（写死决策 + 1 interrupt 点）| app/graph/nodes/orchestrator.py |
| 19 | text_agent_node（DeepSeek-V4-Pro 写脚本）| app/graph/nodes/text_agent.py |
| 20 | image_agent_node（4 级 fallback）| app/graph/nodes/image_agent.py |
| 21 | audio_agent_node（TTS + 静音兜底）| app/graph/nodes/audio_agent.py |
| 22 | video_agent_node（FFmpeg 合成）| app/graph/nodes/video_agent.py |
| 23 | excel_reader 工具 | app/adapters/tools/excel_reader.py |
| 24 | image_downloader 工具（含 SSRF 防御）| app/adapters/tools/image_downloader.py |
| 25 | og_image_extractor 工具 | app/adapters/tools/og_image_extractor.py |
| 26 | placeholder_image 工具（Pillow）| app/adapters/tools/placeholder_image.py |
| 27 | tts_client 工具（MiniMax）| app/adapters/tools/tts_client.py |
| 28 | local_bgm 工具（V0 写死）| app/adapters/tools/local_bgm.py |
| 29 | silent_audio 工具（ffmpeg 生成静音）| app/adapters/tools/silent_audio.py |
| 30 | subtitle_maker 工具 | app/adapters/tools/subtitle_maker.py |
| 31 | ffmpeg_composer 工具（模板化）| app/adapters/tools/ffmpeg_composer.py |
| 32 | video_probe 工具 | app/adapters/tools/video_probe.py |
| 33 | thumbnail_maker 工具 | app/adapters/tools/thumbnail_maker.py |
| 34 | ModelGateway 抽象（anthropic SDK + httpx）| app/adapters/model_gateway.py |
| 35 | ArtifactStore（落盘 + 下载）| app/adapters/storage/artifact_store.py |
| 36 | Persona prompts（3 段）| app/prompts.py |
| 37 | 错误码 + 异常类 | app/errors.py |
| 38 | sample Excel 生成脚本 | scripts/make_sample_input.py |
| 39 | smoke_test.py（8 步端到端）| scripts/smoke_test.py |
| 40 | pytest 单元测试（≥ 6 文件）| tests/ |
| 41 | README（13 项必含）| README.md |

**EOD 验收**：上述 41 项全部完成 + smoke_test.py 通过 + 拿到能播放的 .mp4 = V0 成功。

---

## 维护说明

- 本清单跟「开发者提示词.md」v5 Final 配套。
- 编号 1-313 是产品功能；编号 1-41（附录）是 V0 必做的工程交付物。
- 每次 V0 → V1 → V1.5 → V2 升级前，刷一遍本清单确认 scope。
- 如果新增功能不在本清单，先加进来再做（避免范围蔓延）。
