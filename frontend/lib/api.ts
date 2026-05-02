/**
 * Agent Server 客户端 —— **纯前端 Mock 版（用于 Vercel 静态 Demo）**
 *
 * 在没有真实后端的前提下，模拟 server/main.py 暴露的所有接口：
 *   - SSE /chat、/chat/team
 *   - /artifacts、/artifacts/by-agent、/artifacts/{sid}/{file}
 *   - /auth/{sid}、/chat/archive/{sid}
 *   - /agents
 *
 * 函数签名与真实后端版严格一致，上层组件（employee-chat / group-chat /
 * dossier / artifact-picker / group-dashboard）无需任何改动。
 *
 * 若在 `frontend/.env.local` 配置了 `NEXT_PUBLIC_AGENT_SERVER_URL` 则使用该值；
 * **`pnpm dev` 且未配置时默认 `http://127.0.0.1:8001`**（可设 `NEXT_PUBLIC_AGENT_MOCK_ONLY=1` 关闭以继续纯 mock）。
 */

import {
  getAgentApiBase,
  USE_REAL_AGENT_BACKEND as USE_REAL_BACKEND,
} from './agent-server-base';

/** 配置了有效后端 Base（env 或非生产 mock）。 */
export { IS_REAL_AGENT_SERVER_BACKEND } from './agent-server-base';

/** 跨域/未启动后端时浏览器的典型报错，附排查句。 */
function formatBackendFetchError(message: string): string {
  const tip =
    '请先启动后端：`cd backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8001`。从本环回域名打开前端时，请求会先走同源 `/api/youle-backend`（Next rewrite）；若仍 Failed to fetch，多为后端未监听或 **`YOULE_BACKEND_INTERNAL_URL`/端口** 与本机后端不一致；要浏览器直连可设 `NEXT_PUBLIC_AGENT_SERVER_PROXY=false`。';
  if (/Failed to fetch|NetworkError|Load failed|fetch failed|networkerror/i.test(message)) {
    return `${message} ${tip}`;
  }
  return message;
}

/** 后端 agent 上线状态（mock 默认全员可对话）。 */
export const AVAILABLE_AGENTS = new Set<string>([
  'chief',
  'analyst',
  'planner',
  'writer',
  'distributor',
  'monitor',
  'coder',
  'frontend',
  'tester',
]);

export type SSEEvent =
  | { type: 'start'; agent_id: string; agent_name: string; route_reason?: string | null }
  | { type: 'progress'; stage: string; detail?: string }
  | { type: 'chunk'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type ArtifactTypeId =
  | 'markdown'
  | 'document'
  | 'spreadsheet'
  | 'csv'
  | 'json'
  | 'html'
  | 'code'
  | 'image'
  | 'pdf'
  | 'other';

export interface ArtifactManifest {
  id: string;
  step_idx: number;
  agent_id: string;
  agent_name: string;
  title: string;
  summary: string;
  file: string;
  size: number;
  created_at: string;
  artifact_type?: ArtifactTypeId;
  session_id?: string;
}

export type TeamSSEEvent =
  | {
      type: 'start';
      mode: 'team' | 'team-resume';
      session_id?: string | null;
      thread_id?: string;
      approved?: boolean;
      snapshot_next?: string[];
    }
  | {
      type: 'dispatch';
      plan: string;
      steps: { to: string; task: string }[];
      raw?: string;
    }
  | {
      type: 'discussion';
      flow_type?: 'discuss' | 'broadcast' | 'direct';
      topic: string;
      question: string;
      scope_in?: string[];
      scope_out?: string[];
      deadline_turns?: number;
      participants: string[];
      raw?: string;
    }
  | {
      type: 'handoff';
      from: string;
      to: string;
      task: string;
      step_idx: number;
      step_total: number;
    }
  | {
      type: 'agent_start';
      agent_id: string;
      agent_name: string;
      phase: 'dispatch' | 'execute' | 'summary' | 'direct' | 'discuss' | 'discuss-summary';
    }
  | { type: 'chunk'; text: string; agent_id: string }
  | { type: 'agent_done'; agent_id: string }
  | { type: 'artifact_saved'; manifest: ArtifactManifest }
  /** LangGraph interrupt：需 POST /chat/team/resume 继续 */
  | {
      type: 'approval_required';
      thread_id: string;
      interrupts?: unknown[];
    }
  /** 后端 graph streaming 自定义进度（emit） */
  | {
      type: 'progress';
      agent_id?: string;
      stage?: string;
      detail?: string;
      current?: number;
      total?: number;
      [key: string]: unknown;
    }
  | { type: 'rejected'; reason?: string }
  | {
      type: 'pass';
      agent_id: string;
      agent_name: string;
      reason: string;
      turn: number;
    }
  | {
      type: 'mention';
      from: string;
      to: string;
      turn: number;
    }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  available: boolean;
}

export type AuthLevel = 'L0' | 'L1' | 'L2';

export const BINARY_ARTIFACT_TYPES: ReadonlySet<ArtifactTypeId> = new Set<ArtifactTypeId>([
  'image', 'spreadsheet', 'pdf', 'document', 'other',
]);

export function isBinaryArtifact(type: ArtifactTypeId | undefined): boolean {
  return type !== undefined && BINARY_ARTIFACT_TYPES.has(type);
}

export interface ArchiveSnapshot {
  archived_at: string;
  turn_count: number;
  artifact_count: number;
  participants: string[];
}

/* ============================ Mock 内核 ============================ */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 中文角色名 → RoleId 复用 AGENT_CONFIGS。 */
function agentName(id: string): string {
  const cfg = (AGENT_CONFIGS as Record<string, { name?: string }>)[id];
  return cfg?.name ?? id;
}

/** Promise 化的 abort：只要 signal aborted 立刻 reject。 */
function awaitAbort(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (!signal) return;
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    signal.addEventListener(
      'abort',
      () => reject(new DOMException('Aborted', 'AbortError')),
      { once: true },
    );
  });
}

/** 等 ms 毫秒，但响应 abort。 */
async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return sleep(ms);
  await Promise.race([sleep(ms), awaitAbort(signal)]);
}

/** 把一段长文本切成 8~15 字的 chunk 流，模拟流式吐字。 */
function chunkText(text: string, size = 12): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

/* ============================ Mock 内存仓库 ============================ */

interface StoredArtifact extends ArtifactManifest {
  session_id: string;
  content: string;
}

const ARTIFACTS_BY_SESSION = new Map<string, StoredArtifact[]>();
const AUTH_BY_SESSION = new Map<string, AuthLevel>();
const ARCHIVE_BY_SESSION = new Map<string, ArchiveSnapshot>();

/** 默认产出：让 dossier OutputsTab / artifact-picker 一打开就有内容。 */
const DEFAULT_ARTIFACTS: StoredArtifact[] = [
  {
    id: 'seed-analyst-1',
    session_id: 'group:xhs',
    step_idx: 1,
    agent_id: 'analyst',
    agent_name: '析',
    title: '小红书母婴赛道竞品速览',
    summary: '抓取头部 20 个账号近 30 天爆款，归纳出 3 类共性选题与 2 个机会缺口。',
    file: 'analyst-xhs-competitive.md',
    size: 4823,
    created_at: '2026-04-22T09:14:00.000Z',
    artifact_type: 'markdown',
    content: `# 小红书母婴赛道竞品速览

## 头部账号画像
- **粉量集中度**：Top 20 账号合计约占品类阅读 38%，腰部仍有显著上升空间。
- **更新频率**：周更 3-5 篇为主流，过低或过高都不是优解。

## 三类共性爆款
1. **痛点提问 + 真实场景**：标题挂"为什么"+ 评论区抛日常 → 高互动。
2. **横向测评 + 价格对照**：信息量密 + 收藏率高。
3. **新手 SOP + 防踩坑**：保存率最高，长尾流量稳定。

## 两个机会缺口
- **3 岁以上育儿陪伴**：用户提问多、优质供给少。
- **爸爸视角**：内容稀缺，用户对差异化人设容忍度高。

## 建议
- 切入点优先选「3 岁以上 + 爸爸视角」，标题模板套"痛点提问"。
`,
  },
  {
    id: 'seed-writer-1',
    session_id: 'group:xhs',
    step_idx: 2,
    agent_id: 'writer',
    agent_name: '创',
    title: '冷启动 5 篇笔记初稿',
    summary: '按析提供的选题缺口，写 5 篇 300 字内的笔记初稿，含标题 A/B 与 hashtag。',
    file: 'writer-xhs-5notes.md',
    size: 6210,
    created_at: '2026-04-22T11:02:00.000Z',
    artifact_type: 'markdown',
    content: `# 小红书冷启动 · 5 篇笔记初稿

## #1 标题 A：3 岁后这件事我后悔做晚了
**正文**：上周娃突然冒出一句"妈妈我能自己吗"… (省略 280 字)
**标签**：#3岁育儿 #成长记录 #真实分享

## #2 标题 A：当爸第三年我才搞懂的 3 件事
…

## #3-#5
…
`,
  },
  {
    id: 'seed-coder-1',
    session_id: 'solo:coder',
    step_idx: 1,
    agent_id: 'coder',
    agent_name: '码',
    title: '后端日报抓取脚本',
    summary: '基于 requests + bs4 抓取每日榜单，结构化成 JSON，附 cron 调度示例。',
    file: 'coder-daily-scraper.py',
    size: 1842,
    created_at: '2026-04-23T16:40:00.000Z',
    artifact_type: 'code',
    content: `"""每日榜单抓取脚本（demo 占位）"""
import requests, json, datetime
from bs4 import BeautifulSoup

def fetch_top(url: str) -> list[dict]:
    resp = requests.get(url, timeout=10)
    soup = BeautifulSoup(resp.text, "html.parser")
    items = []
    for li in soup.select(".rank-item"):
        items.append({
            "title": li.select_one(".title").get_text(strip=True),
            "score": int(li.select_one(".score").get_text(strip=True)),
        })
    return items

if __name__ == "__main__":
    data = fetch_top("https://example.com/rank")
    out = {
        "date": datetime.date.today().isoformat(),
        "items": data,
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))
`,
  },
  {
    id: 'seed-planner-1',
    session_id: 'group:bp',
    step_idx: 1,
    agent_id: 'planner',
    agent_name: '策',
    title: '融资 BP 框架（v0.3）',
    summary: '15 页骨架：问题 → 方案 → 数据 → 商业模式 → 团队 → 融资计划，附每页要点。',
    file: 'planner-bp-outline.md',
    size: 3056,
    created_at: '2026-04-24T10:30:00.000Z',
    artifact_type: 'markdown',
    content: `# 融资 BP 框架（v0.3）

1. **封面 / Tagline**：一句话讲清你是谁、解决什么。
2. **问题**：用户场景 + 当前替代品的痛点（数据支撑）。
3. **方案**：核心产品截图 + 与替代品的关键差异。
4. **市场**：TAM / SAM / SOM 三层数据。
5. **商业模式**：付费意愿来源 + 单位经济学。
6. **当前进展**：MAU、留存、付费率、关键里程碑。
7. **竞争格局**：2x2 象限 + 你的独有壁垒。
8. **团队**：3-5 个核心成员的过往战绩。
9. **路线图**：12 个月内 3 个里程碑。
10. **融资计划**：金额 / 用途 / 估值锚点。
`,
  },
  {
    id: 'seed-monitor-1',
    session_id: 'solo:monitor',
    step_idx: 1,
    agent_id: 'monitor',
    agent_name: '观',
    title: '每周舆情速报',
    summary: '本周品类下负面提及上升 12%，集中在「客服响应慢」，建议 24h 内复盘。',
    file: 'monitor-weekly-pulse.md',
    size: 1420,
    created_at: '2026-04-25T08:00:00.000Z',
    artifact_type: 'markdown',
    content: `# 每周舆情速报（4/19 - 4/25）

- **总提及量**：12,480（环比 +6%）
- **正面比例**：61%（环比 -3%）
- **负面焦点**：客服响应慢（占负面 47%，环比 +12%）

> 建议本周内由 chief 牵头开 30 分钟复盘，重点在排班与首响时长。
`,
  },
  {
    id: 'seed-frontend-1',
    session_id: 'group:youle-website-dev',
    step_idx: 1,
    agent_id: 'frontend',
    agent_name: '端',
    title: '官网首屏组件树',
    summary: 'Hero / FeatureGrid / Pricing / FAQ 四块结构 + 响应式断点说明。',
    file: 'frontend-home-tree.md',
    size: 1640,
    created_at: '2026-04-25T15:20:00.000Z',
    artifact_type: 'markdown',
    content: `# 官网首屏组件树

\`\`\`
<Home>
├── <Hero>
│   ├── <Headline />
│   ├── <Subheadline />
│   └── <CTAGroup primary secondary />
├── <FeatureGrid columns={3} />
├── <PricingTable plans={3} />
└── <FAQ items={6} />
\`\`\`

**响应式**：≥1024 三列；≥640 二列；<640 单列。
`,
  },
];

/** 把默认产出 seed 进 session 桶（只在首次访问 session 时按需 append）。 */
function seedDefaultArtifacts() {
  if (ARTIFACTS_BY_SESSION.size > 0) return;
  for (const a of DEFAULT_ARTIFACTS) {
    const list = ARTIFACTS_BY_SESSION.get(a.session_id) ?? [];
    list.push(a);
    ARTIFACTS_BY_SESSION.set(a.session_id, list);
  }
}
seedDefaultArtifacts();

/* ============================ Mock 回复语料 ============================ */

/** 单聊降级回复：根据 agentId 与用户消息组合一段不太机械的 demo 回复。 */
function mockSoloReply(agentId: string, userText: string): string {
  const role = AGENT_CONFIGS[agentId as RoleId];
  const opener = role
    ? `我是${role.name}（${role.role}）。`
    : '我在这。';
  const echo =
    userText.length > 30
      ? `你说的"${userText.slice(0, 28)}…"`
      : `你说的"${userText}"`;
  const body: Record<string, string> = {
    chief:
      `${opener}${echo}我先帮你拆一下：这事更像「需要协调多人」还是「我直接答」？\n\n` +
      `如果只要一段答复，我就直接给；如果要产出物，我会拉相关同事进群一起做。你点哪个：\n` +
      '- **直接答**：我现在给\n- **拉群一起做**：我开个新群把人叫齐\n\n' +
      '（这是 Demo 模式：没有真实后端，回复是预设的，但 UI 行为完全保留。）',
    analyst:
      `${opener}${echo}我会先确认数据口径再下结论。这次 demo 我给你看一段示意推理：\n\n` +
      '1. **目标**：把问题翻译成可量化的指标。\n' +
      '2. **数据源**：明确从哪几张表/接口拿。\n' +
      '3. **结论**：用一句话回到你的原始问题。\n\n' +
      '真实后端接通后，我会输出含图表的归档卡片。',
    planner:
      `${opener}${echo}让我先搭个框架：\n\n` +
      '- **目标**：要解决什么\n- **约束**：时间/资源/品牌边界\n- **路径**：3 个候选 + 推荐\n\n' +
      'Demo 阶段我先给你这块骨架，真实后端会让我把每一项填实。',
    writer:
      `${opener}${echo}我给你一段 demo 文案的开头：\n\n` +
      '> 你以为自己只是在做产品。直到有一天，用户说："这是我用过最像样的工具。"\n\n' +
      '正式跑起来之后我能给你三种 tone 的版本和 A/B 标题。',
    distributor:
      `${opener}${echo}发布这事我有清单：\n\n` +
      '1. 平台适配（小红书/抖音/微信各自的格式）\n2. 排期（黄金时段 + 错峰备份）\n3. hashtag 与 cover\n\n' +
      'Demo 阶段先示意，真实接入后会出可执行的发布计划。',
    monitor:
      `${opener}${echo}我先给你一个 demo 监测视图：\n\n` +
      '- 关键词命中：12 条 / 24h\n- 负面占比：8%（健康线 ≤ 10%）\n- 异常预警：暂无\n\n' +
      '真实后端接通后我会按你设的关键词每小时刷一次。',
    coder:
      `${opener}${echo}我先勾一个最小骨架：\n\n` +
      '```ts\n// demo: 用 fetch 拿数据 + 简易缓存\nasync function getOnce(url: string) {\n' +
      '  const cache = (globalThis as any).__c ||= new Map();\n  if (cache.has(url)) return cache.get(url);\n' +
      '  const r = await fetch(url).then((x) => x.json());\n  cache.set(url, r); return r;\n}\n```\n\n' +
      '后端接上后我能直接产出可跑的脚本归档。',
    frontend:
      `${opener}${echo}我给你 demo 一段组件结构：\n\n` +
      '```tsx\n<Hero>\n  <Headline />\n  <CTA primary />\n</Hero>\n```\n\n' +
      '正式跑起来后我会按你的设计稿出像素级实现。',
    tester:
      `${opener}${echo}我先列一组 demo 用例：\n\n` +
      '- happy path：标准输入\n- 边界：空 / 极长 / 特殊字符\n- 异常：网络断 / 超时 / 401\n\n' +
      '后端接通后我会把这些跑成自动化脚本。',
  };
  return body[agentId] ?? `${opener}${echo}（Demo 模式：这是占位回复，等接入真实后端就能拿到正式产出。）`;
}

/** 群聊 dispatch 文案：选 1-2 个员工。 */
function mockDispatchPlan(text: string, members?: string[]): {
  plan: string;
  steps: { to: string; task: string }[];
} {
  const pool: RoleId[] =
    members && members.length > 0
      ? (members.filter((m) => m !== 'chief') as RoleId[])
      : (['analyst', 'writer', 'planner', 'coder'] as RoleId[]);
  const picks = pool.slice(0, Math.min(2, pool.length));
  const steps = picks.map((to) => ({
    to,
    task: `针对「${text.slice(0, 24)}${text.length > 24 ? '…' : ''}」做你专长的那部分。`,
  }));
  const plan =
    picks.length === 0
      ? '这事我直接答。'
      : `这件事我会找 ${picks.map(agentName).join(' / ')} 一起，先各自跑一段，再由我汇总。`;
  return { plan, steps };
}

/** 群聊员工 execute 阶段产出文本（不展示，仅计字数）。 */
function mockExecuteOutput(agentId: string, task: string): string {
  return (
    `# ${agentName(agentId)} · 任务产出\n\n**任务**：${task}\n\n` +
    Array.from({ length: 6 })
      .map((_, i) => `${i + 1}. 这是 demo 阶段的占位段落，真实后端接入后会替换为正式产出。`)
      .join('\n') +
    '\n'
  );
}

/** 群聊 chief 汇总文本。 */
function mockSummary(text: string, picks: string[]): string {
  if (picks.length === 0) {
    return (
      `这事不用拉人，${text.slice(0, 20)}${text.length > 20 ? '…' : ''}的核心我直接给你：\n\n` +
      '- **要点 1**：先明确目标\n- **要点 2**：再排优先级\n- **要点 3**：能并行的并行\n\n' +
      '（Demo 模式：等接入真实后端我会给出真实判断与归档。）'
    );
  }
  return (
    `${picks.map(agentName).join(' 和 ')}各自跑完了，我把要点收一下：\n\n` +
    picks.map((p) => `- **${agentName(p)}**：交付了一份归档（见下方卡片），可点开看明细。`).join('\n') +
    '\n\n下一步要不要我把这些拼成一份总结发给你？'
  );
}

/** 把一份产出落到 mock 仓库，并返回 manifest（用于 artifact_saved 事件）。 */
function commitArtifact(
  sessionId: string,
  agentId: string,
  step: number,
  task: string,
): ArtifactManifest {
  const id = `mock-${sessionId}-${agentId}-${step}-${Date.now()}`;
  const content = mockExecuteOutput(agentId, task);
  const stored: StoredArtifact = {
    id,
    session_id: sessionId,
    step_idx: step,
    agent_id: agentId,
    agent_name: agentName(agentId),
    title: `${agentName(agentId)}的产出 #${step}`,
    summary: `针对「${task.slice(0, 28)}${task.length > 28 ? '…' : ''}」的 demo 产出。`,
    file: `${agentId}-step${step}-${Date.now()}.md`,
    size: content.length,
    created_at: new Date().toISOString(),
    artifact_type: 'markdown',
    content,
  };
  const list = ARTIFACTS_BY_SESSION.get(sessionId) ?? [];
  list.push(stored);
  ARTIFACTS_BY_SESSION.set(sessionId, list);
  // manifest 不带 content（contract 与真实后端一致）
  const { content: _omit, ...manifest } = stored;
  void _omit;
  return manifest;
}

/* ============================ 真实后端透传（保留逃生口） ============================ */

async function realStreamChat(
  params: { message: string; agentId: string; sessionId?: string; autoRoute?: boolean },
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let resp: Response;
  try {
    resp = await fetch(`${getAgentApiBase()}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: params.message,
        agent_id: params.agentId,
        session_id: params.sessionId ?? null,
        auto_route: params.autoRoute ?? false,
      }),
      signal,
    });
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    const msg = formatBackendFetchError(e instanceof Error ? e.message : String(e));
    onEvent({ type: 'error', message: `连不上后端（${getAgentApiBase()}）：${msg}` });
    return;
  }
  if (!resp.ok) {
    onEvent({ type: 'error', message: resp.statusText });
    return;
  }
  if (!resp.body) return;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const raw of parts) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const json = line.slice(5).trim();
        if (!json) continue;
        try { onEvent(JSON.parse(json) as SSEEvent); } catch {}
      }
    }
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    throw e;
  }
}

/** 解析 /chat/team 与 /chat/team/resume 的 SSE 帧 */
async function readTeamSSEBody(
  resp: Response,
  onEvent: (event: TeamSSEEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!resp.body) return;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() ?? '';
      for (const raw of parts) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const json = line.slice(5).trim();
        if (!json) continue;
        try {
          onEvent(JSON.parse(json) as TeamSSEEvent);
        } catch {
          /* 非 JSON 帧忽略 */
        }
      }
    }
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    throw e;
  }
}

/* ============================ 公开 API ============================ */

export async function streamChat(
  params: {
    message: string;
    agentId: string;
    sessionId?: string;
    autoRoute?: boolean;
  },
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (USE_REAL_BACKEND) return realStreamChat(params, onEvent, signal);

  const { message, agentId } = params;
  try {
    onEvent({
      type: 'start',
      agent_id: agentId,
      agent_name: agentName(agentId),
    });

    // 模拟 thinking 阶段
    onEvent({ type: 'progress', stage: 'thinking', detail: '正在理解…' });
    await delay(420, signal);

    const reply = mockSoloReply(agentId, message);
    const chunks = chunkText(reply, 14);
    for (const c of chunks) {
      await delay(45, signal);
      onEvent({ type: 'chunk', text: c });
    }
    await delay(120, signal);
    onEvent({ type: 'done' });
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    const msg = e instanceof Error ? e.message : String(e);
    onEvent({ type: 'error', message: msg });
  }
}

export async function streamTeamChat(
  params: {
    message: string;
    sessionId?: string;
    mode?: 'dispatch' | 'discuss';
    members?: string[];
    /** 仅反诈流水线等场景：触发后端 LangGraph interrupt（POST resume 接续） */
    requireApproval?: boolean;
  },
  onEvent: (event: TeamSSEEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (USE_REAL_BACKEND) {
    let resp: Response;
    try {
      resp = await fetch(`${getAgentApiBase()}/chat/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: params.message,
          session_id: params.sessionId ?? null,
          mode: params.mode ?? 'dispatch',
          members: params.members ?? null,
          require_approval: params.requireApproval ?? false,
        }),
        signal,
      });
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      const msg = formatBackendFetchError(e instanceof Error ? e.message : String(e));
      onEvent({ type: 'error', message: `连不上后端（${getAgentApiBase()}）：${msg}` });
      return;
    }
    if (!resp.ok || !resp.body) {
      onEvent({ type: 'error', message: resp.statusText || '空响应' });
      return;
    }
    await readTeamSSEBody(resp, onEvent, signal);
    return;
  }

  // ===== Mock 编排 =====
  const sessionId = params.sessionId ?? `group:mock-${Date.now()}`;
  const mode = params.mode ?? 'dispatch';

  try {
    onEvent({ type: 'start', mode: 'team', session_id: sessionId });
    await delay(200, signal);

    if (mode === 'discuss') {
      // 讨论模式：chief 出个议题，2-3 个员工各发一条
      const pool: RoleId[] =
        params.members && params.members.length > 0
          ? (params.members.filter((m) => m !== 'chief') as RoleId[])
          : (['analyst', 'planner', 'writer'] as RoleId[]);
      const participants = pool.slice(0, Math.min(3, pool.length));
      onEvent({
        type: 'discussion',
        flow_type: 'discuss',
        topic: `围绕「${params.message.slice(0, 20)}${params.message.length > 20 ? '…' : ''}」的快速讨论`,
        question: '各位先按自己专业角度说一段，最后我来收拢。',
        scope_in: ['关键判断', '分歧点'],
        scope_out: ['执行细节'],
        deadline_turns: 2,
        participants,
      });
      await delay(280, signal);

      for (const aid of participants) {
        onEvent({
          type: 'agent_start',
          agent_id: aid,
          agent_name: agentName(aid),
          phase: 'discuss',
        });
        const remark = `从${AGENT_CONFIGS[aid].role}的视角看，关键不在于做什么，而在于先把"${params.message.slice(0, 12)}"的边界定清楚。Demo 模式下我先给一句示意。`;
        for (const c of chunkText(remark, 14)) {
          await delay(40, signal);
          onEvent({ type: 'chunk', text: c, agent_id: aid });
        }
        await delay(80, signal);
        onEvent({ type: 'agent_done', agent_id: aid });
      }

      // chief 收束
      onEvent({
        type: 'agent_start',
        agent_id: 'chief',
        agent_name: '理',
        phase: 'discuss-summary',
      });
      const closing = `我把刚才${participants.map(agentName).join(' / ')}的发言收一下：核心分歧不大，下一步建议先做一个最小动作验证。Demo 模式占位。`;
      for (const c of chunkText(closing, 14)) {
        await delay(40, signal);
        onEvent({ type: 'chunk', text: c, agent_id: 'chief' });
      }
      onEvent({ type: 'agent_done', agent_id: 'chief' });
      onEvent({ type: 'done' });
      return;
    }

    // dispatch 模式
    const { plan, steps } = mockDispatchPlan(params.message, params.members);

    if (steps.length === 0) {
      // 降级：chief 直接答
      onEvent({ type: 'dispatch', plan: '这事我直接答。', steps: [] });
      await delay(150, signal);
      onEvent({
        type: 'agent_start',
        agent_id: 'chief',
        agent_name: '理',
        phase: 'direct',
      });
      const reply = mockSoloReply('chief', params.message);
      for (const c of chunkText(reply, 14)) {
        await delay(45, signal);
        onEvent({ type: 'chunk', text: c, agent_id: 'chief' });
      }
      onEvent({ type: 'agent_done', agent_id: 'chief' });
      onEvent({ type: 'done' });
      return;
    }

    onEvent({ type: 'dispatch', plan, steps });
    await delay(280, signal);

    // 串行 handoff → execute → artifact_saved
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      onEvent({
        type: 'handoff',
        from: 'chief',
        to: step.to,
        task: step.task,
        step_idx: i + 1,
        step_total: steps.length,
      });
      await delay(180, signal);

      onEvent({
        type: 'agent_start',
        agent_id: step.to,
        agent_name: agentName(step.to),
        phase: 'execute',
      });

      // execute 期间吐若干 chunk（前端只计字数不显示）
      const fakeOutput = mockExecuteOutput(step.to, step.task);
      for (const c of chunkText(fakeOutput, 18)) {
        await delay(35, signal);
        onEvent({ type: 'chunk', text: c, agent_id: step.to });
      }

      onEvent({ type: 'agent_done', agent_id: step.to });

      // 归档
      const manifest = commitArtifact(sessionId, step.to, i + 1, step.task);
      manifest.session_id = sessionId;
      onEvent({ type: 'artifact_saved', manifest });
      await delay(120, signal);
    }

    // chief 汇总
    onEvent({
      type: 'agent_start',
      agent_id: 'chief',
      agent_name: '理',
      phase: 'summary',
    });
    const sum = mockSummary(params.message, steps.map((s) => s.to));
    for (const c of chunkText(sum, 14)) {
      await delay(40, signal);
      onEvent({ type: 'chunk', text: c, agent_id: 'chief' });
    }
    onEvent({ type: 'agent_done', agent_id: 'chief' });
    onEvent({ type: 'done' });
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    const msg = e instanceof Error ? e.message : String(e);
    onEvent({ type: 'error', message: msg });
  }
}

/**
 * LangGraph HITL resume：审批通过/驳回后接续同一 thread 的 SSE 流。
 */
export async function streamTeamResume(
  params: { threadId: string; approved: boolean; reason?: string },
  onEvent: (event: TeamSSEEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!USE_REAL_BACKEND) {
    onEvent({
      type: 'error',
      message: 'Mock 模式无 resume，请在 .env.local 设置 NEXT_PUBLIC_AGENT_SERVER_URL。',
    });
    return;
  }
  const tid = encodeURIComponent(params.threadId);
  let resp: Response;
  try {
    resp = await fetch(`${getAgentApiBase()}/chat/team/resume/${tid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approved: params.approved,
        reason: params.reason ?? '',
      }),
      signal,
    });
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    const msg = formatBackendFetchError(e instanceof Error ? e.message : String(e));
    onEvent({ type: 'error', message: `resume 请求失败：${msg}` });
    return;
  }
  if (!resp.ok || !resp.body) {
    onEvent({
      type: 'error',
      message: resp.statusText || `resume HTTP ${resp.status}`,
    });
    return;
  }
  await readTeamSSEBody(resp, onEvent, signal);
}

/* ============================ Artifacts ============================ */

export async function listArtifacts(
  sessionId: string,
): Promise<{ session_id: string; created_at: string; artifacts: ArtifactManifest[] }> {
  if (USE_REAL_BACKEND) {
    const resp = await fetch(`${getAgentApiBase()}/artifacts/${encodeURIComponent(sessionId)}`);
    if (!resp.ok) return { session_id: sessionId, created_at: '', artifacts: [] };
    return resp.json();
  }
  const list = ARTIFACTS_BY_SESSION.get(sessionId) ?? [];
  return {
    session_id: sessionId,
    created_at: list[0]?.created_at ?? '',
    artifacts: list.map(({ content: _c, ...m }) => {
      void _c;
      return m;
    }),
  };
}

export async function listAllArtifacts(
  limit = 200,
): Promise<Array<ArtifactManifest & { session_id: string }>> {
  if (USE_REAL_BACKEND) {
    const resp = await fetch(`${getAgentApiBase()}/artifacts?limit=${limit}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.items ?? [];
  }
  const all: Array<ArtifactManifest & { session_id: string }> = [];
  for (const [sid, list] of ARTIFACTS_BY_SESSION.entries()) {
    for (const a of list) {
      const { content: _c, ...rest } = a;
      void _c;
      all.push({ ...rest, session_id: sid });
    }
  }
  all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return all.slice(0, limit);
}

/** 列出某 agent 的所有产出（跨 session）。dossier OutputsTab 用。 */
export async function listArtifactsByAgent(
  agentId: string,
  limit = 30,
): Promise<{ items: Array<ArtifactManifest & { session_id: string }> }> {
  if (USE_REAL_BACKEND) {
    const resp = await fetch(
      `${getAgentApiBase()}/artifacts/by-agent/${encodeURIComponent(agentId)}?limit=${limit}`,
    );
    if (!resp.ok) return { items: [] };
    return resp.json();
  }
  const all = await listAllArtifacts(500);
  const items = all.filter((a) => a.agent_id === agentId).slice(0, limit);
  return { items };
}

export async function fetchArtifact(
  sessionId: string,
  filename: string,
): Promise<string | null> {
  if (USE_REAL_BACKEND) {
    const resp = await fetch(
      `${getAgentApiBase()}/artifacts/${encodeURIComponent(sessionId)}/${encodeURIComponent(filename)}`,
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.content ?? null;
  }
  const list = ARTIFACTS_BY_SESSION.get(sessionId) ?? [];
  const hit = list.find((a) => a.file === filename);
  return hit?.content ?? null;
}

export function artifactDownloadUrl(sessionId: string, filename: string): string {
  if (USE_REAL_BACKEND) {
    return `${getAgentApiBase()}/artifacts/${encodeURIComponent(sessionId)}/${encodeURIComponent(filename)}/download`;
  }
  // mock 模式：用 data: URL 直接吐文本内容（适合 markdown/code/json）
  const list = ARTIFACTS_BY_SESSION.get(sessionId) ?? [];
  const hit = list.find((a) => a.file === filename);
  if (!hit) return '#';
  const blob = encodeURIComponent(hit.content);
  return `data:text/plain;charset=utf-8,${blob}`;
}

/* ============================ Agents / Auth / Archive ============================ */

export async function getArchiveStatus(
  sessionId: string,
): Promise<{ archived: boolean; snapshot?: ArchiveSnapshot }> {
  if (USE_REAL_BACKEND) {
    try {
      const resp = await fetch(
        `${getAgentApiBase()}/chat/archive/${encodeURIComponent(sessionId)}`,
      );
      if (!resp.ok) return { archived: false };
      const data = await resp.json();
      return { archived: !!data.archived, snapshot: data.snapshot };
    } catch {
      return { archived: false };
    }
  }
  const snap = ARCHIVE_BY_SESSION.get(sessionId);
  return snap ? { archived: true, snapshot: snap } : { archived: false };
}

export async function archiveSession(
  sessionId: string,
): Promise<ArchiveSnapshot | null> {
  if (USE_REAL_BACKEND) {
    const resp = await fetch(
      `${getAgentApiBase()}/chat/archive/${encodeURIComponent(sessionId)}`,
      { method: 'POST' },
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.archived as ArchiveSnapshot;
  }
  const list = ARTIFACTS_BY_SESSION.get(sessionId) ?? [];
  const participants = Array.from(new Set(list.map((a) => a.agent_id)));
  const snap: ArchiveSnapshot = {
    archived_at: new Date().toISOString(),
    turn_count: list.length * 2,
    artifact_count: list.length,
    participants,
  };
  ARCHIVE_BY_SESSION.set(sessionId, snap);
  return snap;
}

export async function unarchiveSession(sessionId: string): Promise<void> {
  if (USE_REAL_BACKEND) {
    await fetch(`${getAgentApiBase()}/chat/archive/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
    return;
  }
  ARCHIVE_BY_SESSION.delete(sessionId);
}

export async function listAgents(): Promise<AgentInfo[]> {
  if (USE_REAL_BACKEND) {
    const resp = await fetch(`${getAgentApiBase()}/agents`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.agents ?? [];
  }
  return (Object.keys(AGENT_CONFIGS) as RoleId[]).map((id) => ({
    id,
    name: AGENT_CONFIGS[id].name,
    role: AGENT_CONFIGS[id].role,
    available: AVAILABLE_AGENTS.has(id),
  }));
}

export async function getAuth(sessionId: string): Promise<AuthLevel> {
  if (USE_REAL_BACKEND) {
    const resp = await fetch(`${getAgentApiBase()}/auth/${encodeURIComponent(sessionId)}`);
    if (!resp.ok) return 'L0';
    const data = await resp.json();
    return (data.level as AuthLevel) ?? 'L0';
  }
  return AUTH_BY_SESSION.get(sessionId) ?? 'L0';
}

export async function setAuth(sessionId: string, level: AuthLevel): Promise<AuthLevel> {
  if (USE_REAL_BACKEND) {
    const resp = await fetch(`${getAgentApiBase()}/auth/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level }),
    });
    if (!resp.ok) return 'L0';
    const data = await resp.json();
    return (data.level as AuthLevel) ?? 'L0';
  }
  AUTH_BY_SESSION.set(sessionId, level);
  return level;
}


// ============================================================================
// V1 — 主编排 + 4 能力 agent + skill 市场
// 后端契约见 docs/v1-architecture.md。仅在 USE_REAL_BACKEND 时调用真后端。
// ============================================================================

export type V1CapabilityKey = 'T' | 'I' | 'V' | 'D';

export interface V1SkillStep {
  agent: V1CapabilityKey;
  task: string;
  prompt_template?: string;
  inputs?: Record<string, unknown>;
  outputs?: string[];
}

export interface V1Skill {
  id: string;
  name: string;
  version: string;
  description: string;
  deliverable_type: string;
  intent_keywords: string[];
  required_slots: string[];
  optional_slots: string[];
  steps: V1SkillStep[];
  runner?: string | null;
  expected_cost_usd: number;
}

export interface V1ClarifyQuestion {
  slot: string;
  question: string;
  options?: string[];
  free_form?: boolean;
}

export type V1ConductEvent =
  | { type: 'start'; session_id: string }
  | { type: 'intent_parsed'; intent: Record<string, unknown> }
  | { type: 'clarify_required'; questions: V1ClarifyQuestion[] }
  | { type: 'skill_selected'; skill_id: string; name: string; reason?: string }
  | {
      type: 'agent_start';
      capability: V1CapabilityKey;
      task?: string;
      step_idx?: number;
    }
  | { type: 'chunk'; text: string; capability?: V1CapabilityKey }
  | {
      type: 'artifact';
      capability?: V1CapabilityKey;
      artifact_type?: string;
      title?: string;
      file_path?: string;
      mime_type?: string;
      content_inline?: string;
      session_id?: string;
    }
  | { type: 'agent_done'; capability?: V1CapabilityKey; step_idx?: number }
  | { type: 'deliverable'; skill_id: string; artifacts: unknown[] }
  | { type: 'done' }
  | { type: 'error'; message: string };

/** 列出后端注册的所有 skill。Mock 模式下返回 demo 条目以便 UI 渲染。 */
export async function listV1Skills(): Promise<V1Skill[]> {
  if (USE_REAL_BACKEND) {
    let resp: Response;
    try {
      resp = await fetch(`${getAgentApiBase()}/v1/skills`);
    } catch (e: unknown) {
      const msg = formatBackendFetchError(e instanceof Error ? e.message : String(e));
      throw new Error(`无法加载 /v1/skills：${msg}`);
    }
    if (!resp.ok) {
      throw new Error(`GET /v1/skills HTTP ${resp.status}`);
    }
    const data = await resp.json();
    return (data.items ?? []) as V1Skill[];
  }
  return [
    {
      id: 'xiaohongshu_hook_title',
      name: '小红书爆款标题生成',
      version: '1.0',
      description: '根据主题生成 5 个小红书爆款风格的标题',
      deliverable_type: 'text',
      intent_keywords: ['小红书', '标题', '爆款'],
      required_slots: ['subject'],
      optional_slots: [],
      steps: [
        { agent: 'T', task: '生成 5 个小红书爆款标题', outputs: ['text-asset'] },
      ],
      expected_cost_usd: 0.01,
    },
    {
      id: 'ecommerce_main_image',
      name: '电商主图生成',
      version: '1.0',
      description: '生成符合电商平台规范的主图（白底 + 场景）',
      deliverable_type: 'image',
      intent_keywords: ['主图', '电商图', '产品图'],
      required_slots: ['product_name', 'target_platform'],
      optional_slots: ['reference_image', 'color_scheme'],
      steps: [
        { agent: 'T', task: '撰写图片生成 prompt', outputs: ['prompts'] },
        { agent: 'I', task: '生成白底+场景主图', outputs: ['image-asset'] },
        { agent: 'T', task: '写 alt 文案', outputs: ['text-asset'] },
      ],
      expected_cost_usd: 0.05,
    },
  ];
}

/** 调 V1 Conductor 的 SSE。clarifyAnswers 为反问回答（routes 层会拼回 message）。 */
export async function streamV1Conduct(
  params: {
    message: string;
    sessionId?: string;
    clarifyAnswers?: Record<string, string>;
  },
  onEvent: (ev: V1ConductEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!USE_REAL_BACKEND) {
    onEvent({
      type: 'error',
      message:
        '当前为前端 mock 模式（未设 NEXT_PUBLIC_AGENT_SERVER_URL），无法调用 V1 Conductor。',
    });
    return;
  }

  try {
    const resp = await fetch(`${getAgentApiBase()}/v1/conduct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: params.message,
        session_id: params.sessionId,
        clarify_answers: params.clarifyAnswers,
      }),
      signal,
    });

    if (!resp.ok || !resp.body) {
      onEvent({
        type: 'error',
        message: `连不上 V1 Conductor（${getAgentApiBase()}/v1/conduct）：HTTP ${resp.status}`,
      });
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const line = frame.trim();
        if (!line.startsWith('data: ')) continue;
        try {
          const ev = JSON.parse(line.slice(6)) as V1ConductEvent;
          onEvent(ev);
        } catch {
          // 忽略无法解析的帧
        }
      }
    }
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    const msg = formatBackendFetchError(e instanceof Error ? e.message : String(e));
    onEvent({
      type: 'error',
      message: `V1 Conductor 请求失败（${getAgentApiBase()}）：${msg}`,
    });
  }
}
