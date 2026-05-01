'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ChevronRight,
  Calendar,
  Flag,
  Target,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Sparkles,
  MessageCircle,
  Briefcase,
  Archive,
  Lock,
  ArrowLeft,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ROLES,
  ROLE_COLORS,
  AGENT_MARKET_PROFILES,
  type RoleId,
  type PipelineStage,
  type Message,
} from '@/lib/types';
import { useAppStore } from '@/lib/store';
import {
  useChatStore,
  groupSessionId,
  type ChatMessage,
} from '@/lib/chat-store';
import {
  listArtifacts,
  fetchArtifact,
  artifactDownloadUrl,
  isBinaryArtifact,
  getArchiveStatus,
  type ArtifactManifest,
  type ArchiveSnapshot,
} from '@/lib/api';
import { ArtifactRenderer } from '@/components/artifact-renderer';

interface GroupDashboardProps {
  groupId: string;
  onClose: () => void;
}

/* ---------------------------- 侧栏可拉伸 hook ---------------------------- */
/**
 * 右侧边栏宽度：拖动左缘调整，持久化到 localStorage（所有使用者共享宽度）。
 * 返回 `handle` 是一条贴在 aside 左缘的 1px 手柄，hover 高亮。
 */
const ASIDE_WIDTH_KEY = 'youle-aside-width';
const ASIDE_MIN = 280;
const ASIDE_MAX = 900;
const ASIDE_DEFAULT = 360;

function useAsideResize(): { width: number; handle: React.ReactNode } {
  // SSR 和客户端首帧都从默认值起步，避免 hydration mismatch
  const [width, setWidth] = useState<number>(ASIDE_DEFAULT);
  const [dragging, setDragging] = useState(false);
  // 用 ref 而非 state：避免它进入 effect 的 deps 数组（HMR 不会因此 deps 变长报错）
  const hydratedRef = useRef(false);

  // 水合完成后再读 localStorage 覆盖（只跑一次）
  useEffect(() => {
    const saved = parseInt(localStorage.getItem(ASIDE_WIDTH_KEY) ?? '', 10);
    if (Number.isFinite(saved) && saved >= ASIDE_MIN && saved <= ASIDE_MAX) {
      setWidth(saved);
    }
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      // aside 固定在右，拖左缘 → 宽度 = 视口宽 - 鼠标 x
      const next = Math.max(ASIDE_MIN, Math.min(ASIDE_MAX, window.innerWidth - e.clientX));
      setWidth(next);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging]);

  useEffect(() => {
    // hydrate 完成前不回写，免得用默认 360 覆盖 localStorage 里原来的值
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(ASIDE_WIDTH_KEY, String(width));
    } catch {
      /* ignore quota */
    }
  }, [width]);

  const handle = (
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDoubleClick={() => setWidth(ASIDE_DEFAULT)}
      className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-active/40 active:bg-active/60 transition-colors z-20"
      title="拖动调整宽度（双击重置）"
    />
  );

  return { width, handle };
}

type GroupMeta = {
  subtitle: string;
  deadline: string;
  deadlineDays: number;
  overallProgress: number;
  workload: Record<RoleId, number>;
  kpis: { label: string; value: string; delta?: string; positive?: boolean }[];
  alert?: { level: 'info' | 'warn'; text: string };
};

const GROUP_META: Record<string, GroupMeta> = {
  xhs: {
    subtitle: '小红书冷启动 · 第一阶段',
    deadline: '5 月 15 日',
    deadlineDays: 12,
    overallProgress: 42,
    workload: { analyst: 8, planner: 5, writer: 14, distributor: 9, monitor: 11, coder: 0, frontend: 0, tester: 0, chief: 4 },
    kpis: [
      { label: '已采纳产出', value: '9', delta: '+3 本周', positive: true },
      { label: '待反馈', value: '2' },
      { label: '粉丝净增', value: '+1,284', delta: '+18%', positive: true },
      { label: '互动率', value: '6.8%', delta: '-0.4pt', positive: false },
    ],
    alert: {
      level: 'info',
      text: '「早八急救包」24h 涨粉 412，建议 48h 内跟进同主题。',
    },
  },
  bp: {
    subtitle: '融资 BP · 冲刺期',
    deadline: '4 月 30 日',
    deadlineDays: 6,
    overallProgress: 68,
    workload: { analyst: 12, planner: 16, writer: 7, distributor: 0, monitor: 3, coder: 0, frontend: 0, tester: 0, chief: 4 },
    kpis: [
      { label: '已采纳产出', value: '14', delta: '+5 本周', positive: true },
      { label: '待反馈', value: '3' },
      { label: '已对接 VC', value: '6' },
      { label: 'Deck 页数', value: '18 → 12', positive: true },
    ],
    alert: {
      level: 'warn',
      text: '周五前需交 v2，市场章节 @策划员 还在压缩。',
    },
  },
  launch: {
    subtitle: '5 月新品上市',
    deadline: '5 月 20 日',
    deadlineDays: 26,
    overallProgress: 15,
    workload: { analyst: 6, planner: 9, writer: 3, distributor: 2, monitor: 4, coder: 11, frontend: 8, tester: 6, chief: 5 },
    kpis: [
      { label: '已采纳产出', value: '4' },
      { label: '待反馈', value: '1' },
      { label: '预热渠道', value: '7' },
      { label: '预计首周曝光', value: '28 万', positive: true },
    ],
  },
  'antiscam-video': {
    subtitle: '反诈视频制作 · AI 全自动流水线',
    deadline: '持续产出',
    deadlineDays: 0,
    overallProgress: 75,
    workload: { analyst: 5, planner: 0, writer: 8, distributor: 6, monitor: 0, coder: 7, frontend: 0, tester: 0, chief: 3 },
    kpis: [
      { label: '已产出视频', value: '1', delta: '+1 今日', positive: true },
      { label: '脚本完成', value: '1/1', positive: true },
      { label: '素材就绪', value: '5 组', positive: true },
      { label: '流水线步骤', value: '4/4', positive: true },
    ],
    alert: {
      level: 'info',
      text: '「网络刷单篇」已完成，可继续投喂新主题批量生产。',
    },
  },
};

const FALLBACK_META: GroupMeta = {
  subtitle: '项目动态',
  deadline: '未设定',
  deadlineDays: 0,
  overallProgress: 0,
  workload: { analyst: 0, planner: 0, writer: 0, distributor: 0, monitor: 0, coder: 0, frontend: 0, tester: 0, chief: 0 },
  kpis: [
    { label: '已采纳产出', value: '0' },
    { label: '待反馈', value: '0' },
    { label: '今日动态', value: '0' },
    { label: '成员', value: '5' },
  ],
};

export function GroupDashboard({ groupId, onClose }: GroupDashboardProps) {
  const { groups } = useAppStore();
  const group = groups.find((g) => g.id === groupId) || groups[0];

  // 分派：mock 群（xhs / bp / launch）走静态模板；新建群走动态聚合
  // 哲学 #7：看板由理编排 → 新群用真实消息 + 归档事件驱动，不再是 mock 数据
  const isDynamic = !GROUP_META[groupId];

  if (isDynamic) {
    return (
      <DynamicGroupDashboard
        groupId={groupId}
        group={group}
        onClose={onClose}
      />
    );
  }

  return <StaticGroupDashboard groupId={groupId} group={group} onClose={onClose} />;
}

function StaticGroupDashboard({
  groupId,
  group,
  onClose,
}: {
  groupId: string;
  group: { id: string; name: string; emoji: string };
  onClose: () => void;
}) {
  const { width, handle } = useAsideResize();
  const { pipelineByGroup, messagesByGroup, activeAgents } = useAppStore();
  const pipeline = pipelineByGroup[groupId] || [];
  const messages = messagesByGroup[groupId] || [];
  const meta = GROUP_META[groupId] || FALLBACK_META;

  const recentArtifacts = messages
    .filter((m) => m.type === 'artifact' && m.artifact)
    .slice(-3)
    .reverse();

  const doneStages = pipeline.filter((s) => s.status === 'done').length;
  const activeStage = pipeline.find((s) => s.status === 'active');

  return (
    <aside
      className="h-screen bg-bg-sunken border-l border-line flex flex-col overflow-hidden slide-in-right relative"
      style={{ width }}
    >
      {handle}
      {/* 头部 - 项目卡 */}
      <div className="p-4 bg-gradient-to-br from-bg-panel to-bg-sunken border-b border-line">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-bg-panel border border-line flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">
            {group.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-serif font-semibold text-ink text-base truncate">
              {group.name}
            </h2>
            <p className="text-xs text-ink-3 mt-0.5">{meta.subtitle}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-ink-4 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                截止 {meta.deadline}
              </span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded font-medium',
                  meta.deadlineDays <= 7
                    ? 'bg-alert/10 text-alert'
                    : meta.deadlineDays <= 14
                    ? 'bg-busy/10 text-busy'
                    : 'bg-active/10 text-active'
                )}
              >
                剩 {meta.deadlineDays} 天
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded-md transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-ink-3" />
          </button>
        </div>

        {/* 整体进度 */}
        <div className="mt-4 pt-3 border-t border-line/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-ink-3">整体进度</span>
            <span className="text-sm font-mono font-semibold text-ink">
              {meta.overallProgress}%
            </span>
          </div>
          <div className="h-1.5 bg-bg-sunken rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-active to-planner rounded-full transition-all"
              style={{ width: `${meta.overallProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-ink-4">
              {doneStages}/{pipeline.length} 阶段完成
            </span>
            {activeStage && (
              <span className="text-[10px] text-busy flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-busy pulse-dot" />
                进行中：{activeStage.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 预警条 */}
        {meta.alert && (
          <div
            className={cn(
              'rounded-xl border p-3 flex items-start gap-2',
              meta.alert.level === 'warn'
                ? 'bg-alert/5 border-alert/30'
                : 'bg-monitor-light border-monitor/20'
            )}
          >
            <AlertCircle
              className={cn(
                'w-4 h-4 flex-shrink-0 mt-0.5',
                meta.alert.level === 'warn' ? 'text-alert' : 'text-monitor'
              )}
            />
            <p className="text-xs text-ink-2 leading-relaxed">{meta.alert.text}</p>
          </div>
        )}

        {/* KPI */}
        <Section title="本期 KPI" icon={<TrendingUp className="w-4 h-4 text-active" />}>
          <div className="grid grid-cols-2 gap-2">
            {meta.kpis.map((kpi, i) => (
              <div
                key={i}
                className="bg-bg-panel rounded-xl border border-line p-3"
              >
                <div className="text-[10px] text-ink-4">{kpi.label}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-lg font-mono font-bold text-ink">
                    {kpi.value}
                  </span>
                  {kpi.delta && (
                    <span
                      className={cn(
                        'text-[10px] font-medium',
                        kpi.positive === false
                          ? 'text-alert'
                          : 'text-active'
                      )}
                    >
                      {kpi.delta}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 里程碑时间线 */}
        <Section title="里程碑" icon={<Flag className="w-4 h-4 text-planner" />}>
          <Timeline stages={pipeline} />
        </Section>

        {/* 成员工作量 */}
        <Section title="本期成员工作量" icon={<Users className="w-4 h-4 text-writer" />}>
          <WorkloadList workload={meta.workload} activeAgents={activeAgents.map(a => a.roleId)} />
        </Section>

        {/* 最近产出 */}
        <Section title="最近产出" icon={<FileText className="w-4 h-4 text-distributor" />}>
          {recentArtifacts.length > 0 ? (
            <div className="space-y-2">
              {recentArtifacts.map((m) => (
                <ArtifactPreview key={m.id} message={m} />
              ))}
            </div>
          ) : (
            <div className="bg-bg-panel rounded-xl border border-line border-dashed p-4 text-center">
              <p className="text-xs text-ink-4">暂无产出，Ta 们还在忙...</p>
            </div>
          )}
        </Section>
      </div>
    </aside>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        {icon}
        <h3 className="text-sm font-medium text-ink">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Timeline({ stages }: { stages: PipelineStage[] }) {
  if (stages.length === 0) {
    return (
      <div className="bg-bg-panel rounded-xl border border-line border-dashed p-4 text-center">
        <p className="text-xs text-ink-4">暂无里程碑</p>
      </div>
    );
  }
  return (
    <div className="bg-bg-panel rounded-xl border border-line overflow-hidden">
      {stages.map((stage, i) => {
        const isLast = i === stages.length - 1;
        return (
          <div
            key={stage.id}
            className={cn(
              'flex items-start gap-3 px-3 py-2.5 relative',
              !isLast && 'border-b border-line'
            )}
          >
            {/* 节点图标 */}
            <div className="flex-shrink-0 mt-0.5">
              {stage.status === 'done' ? (
                <CheckCircle2 className="w-4 h-4 text-active" />
              ) : stage.status === 'active' ? (
                <div className="w-4 h-4 rounded-full border-2 border-busy flex items-center justify-center">
                  <span className="w-1.5 h-1.5 bg-busy rounded-full pulse-dot" />
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-dashed border-ink-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-sm',
                    stage.status === 'done' && 'text-ink-3 line-through',
                    stage.status === 'active' && 'text-ink font-medium',
                    stage.status === 'pending' && 'text-ink-3'
                  )}
                >
                  {stage.name}
                </span>
                {stage.chip && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-bg-sunken rounded text-ink-4">
                    {stage.chip}
                  </span>
                )}
              </div>
              {stage.summary && (
                <p className="text-[11px] text-ink-4 mt-0.5 truncate">
                  {stage.summary}
                </p>
              )}
            </div>
            {stage.assignee && (
              <AssigneeAvatar roleId={stage.assignee} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AssigneeAvatar({ roleId }: { roleId: RoleId }) {
  const role = ROLES[roleId];
  const profile = AGENT_MARKET_PROFILES[roleId];
  return (
    <div
      className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0"
      title={role.name}
    >
      <Image
        src={profile.avatar}
        alt={role.name}
        width={24}
        height={24}
        className="object-cover w-full h-full"
      />
    </div>
  );
}

function WorkloadList({
  workload,
  activeAgents,
}: {
  workload: Record<RoleId, number>;
  activeAgents: RoleId[];
}) {
  const entries = Object.entries(workload) as [RoleId, number][];
  const maxValue = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="bg-bg-panel rounded-xl border border-line p-3 space-y-2.5">
      {entries.map(([id, value]) => {
        const role = ROLES[id];
        const profile = AGENT_MARKET_PROFILES[id];
        const colorConfig = ROLE_COLORS[id];
        const isActive = activeAgents.includes(id);
        const pct = (value / maxValue) * 100;
        return (
          <div key={id} className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md overflow-hidden flex-shrink-0 relative">
              <Image
                src={profile.avatar}
                alt={role.name}
                width={28}
                height={28}
                className="object-cover w-full h-full"
              />
              {isActive && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-busy rounded-full pulse-dot" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink">{role.name}</span>
                <span className="text-[10px] font-mono text-ink-3">
                  {value} 项
                </span>
              </div>
              <div className="h-1.5 bg-bg-sunken rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', colorConfig.main)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ArtifactPreview({ message }: { message: Message }) {
  const artifact = message.artifact;
  if (!artifact) return null;
  const role = ROLES[artifact.by];
  const profile = AGENT_MARKET_PROFILES[artifact.by];
  return (
    <div className="bg-bg-panel rounded-xl border border-line p-3 hover:border-ink-4 transition-colors cursor-pointer">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="px-1.5 py-0.5 bg-bg-sunken text-ink-3 text-[10px] font-mono rounded">
          {artifact.kind}
        </span>
        <span className="font-serif font-medium text-sm text-ink flex-1 truncate">
          {artifact.title}
        </span>
      </div>
      <p className="text-[11px] text-ink-3 leading-relaxed line-clamp-2 mb-2">
        {artifact.summary}
      </p>
      <div className="flex items-center justify-between pt-2 border-t border-line">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded overflow-hidden">
            <Image
              src={profile.avatar}
              alt={role.name}
              width={16}
              height={16}
              className="object-cover w-full h-full"
            />
          </div>
          <span className="text-[10px] text-ink-4">by {role.name}</span>
        </div>
        <span className="text-[10px] text-ink-4 font-mono flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {message.timestamp}
        </span>
      </div>
    </div>
  );
}

/* ================================================================
 * 动态看板 · 新建群专用（哲学 #7：由"理"编排的真实数据看板）
 *
 * 数据源三支：
 *   1. chat-store 消息列表 → 轮次 / 决策次数 / 派活次数 / 讨论次数
 *   2. /artifacts/<sid> manifest → 产出数 / 参与员工分布 / 最近产出
 *   3. /chat/archive/<sid> → 归档状态
 *
 * 不做：
 *   - 不造假 deadline / overallProgress / mock alert
 *   - 不接入 mock 的 pipelineByGroup / messagesByGroup
 * ================================================================ */

function DynamicGroupDashboard({
  groupId,
  group,
  onClose,
}: {
  groupId: string;
  group: { id: string; name: string; emoji: string };
  onClose: () => void;
}) {
  const { width, handle } = useAsideResize();
  const sid = groupSessionId(groupId);
  const messages =
    useChatStore((s) => s.sessions[sid]) ?? (EMPTY_MSG_LIST as ChatMessage[]);
  const memberRoles = useAppStore((s) => s.groups.find((g) => g.id === groupId)?.memberRoles);

  const [artifacts, setArtifacts] = useState<ArtifactManifest[]>([]);
  const [archive, setArchive] = useState<ArchiveSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<ArtifactManifest | null>(null);

  // 拉 manifest 和 归档状态。messages.length 变化时也重拉（artifact_saved 事件后）
  useEffect(() => {
    let cancelled = false;
    Promise.all([listArtifacts(sid), getArchiveStatus(sid)]).then(
      ([man, arch]) => {
        if (cancelled) return;
        setArtifacts(man.artifacts ?? []);
        setArchive(arch.archived && arch.snapshot ? arch.snapshot : null);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [sid, messages.length]);

  // —— 聚合数据 ——
  const turnCount = messages.filter((m) => m.sender === 'user').length;
  const decisionCount = messages.filter((m) => m.kind === 'decision').length;
  const pendingDecisions = messages.filter(
    (m) => m.kind === 'decision' && !m.decisionAnswered,
  ).length;
  const dispatchCount = messages.filter((m) => m.kind === 'dispatch').length;
  const discussionCount = messages.filter((m) => m.kind === 'discussion').length;

  // 员工工作量：artifact 数 + 发言数（讨论/执行气泡）
  const workload: Record<string, number> = {};
  for (const a of artifacts) {
    workload[a.agent_id] = (workload[a.agent_id] ?? 0) + 1;
  }
  for (const m of messages) {
    if (
      typeof m.sender === 'string' &&
      m.sender !== 'user' &&
      m.sender !== 'system' &&
      (m.phase === 'discuss' || m.phase === 'summary' || m.phase === 'direct' ||
        m.phase === 'discuss-summary')
    ) {
      workload[m.sender] = (workload[m.sender] ?? 0) + 1;
    }
  }
  // 若群设置了 memberRoles，按 memberRoles 顺序展示（∩ 实际有贡献的）；
  // 否则按工作量倒序
  const participants = memberRoles && memberRoles.length > 0
    ? (memberRoles as string[]).filter((r) => (workload[r] ?? 0) > 0)
    : Object.keys(workload).sort((a, b) => (workload[b] ?? 0) - (workload[a] ?? 0));

  // 最近产出：取 manifest 倒序前 3
  const recent = [...artifacts]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3);

  // 详情模式：整个 aside 切换成 artifact 详情视图（铺满）
  if (viewing) {
    return (
      <AsideArtifactView
        sessionId={sid}
        manifest={viewing}
        onBack={() => setViewing(null)}
        onClose={onClose}
      />
    );
  }

  return (
    <aside
      className="h-screen bg-bg-sunken border-l border-line flex flex-col overflow-hidden slide-in-right relative"
      style={{ width }}
    >
      {handle}
      {/* 头部 */}
      <div className="p-4 bg-gradient-to-br from-bg-panel to-bg-sunken border-b border-line">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-bg-panel border border-line flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">
            {group.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-serif font-semibold text-ink text-base truncate">
              {group.name}
            </h2>
            <p className="text-xs text-ink-3 mt-0.5 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-active" />
              理编排 · 实时看板
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {archive ? (
                <span className="text-[10px] px-1.5 py-0.5 bg-chief-light text-chief rounded font-medium inline-flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" />
                  已归档
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 bg-active/10 text-active rounded font-medium inline-flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-active pulse-dot" />
                  进行中
                </span>
              )}
              {pendingDecisions > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-busy/10 text-busy rounded font-medium">
                  {pendingDecisions} 个决策待拍板
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded-md transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-ink-3" />
          </button>
        </div>

        {/* 归档快照横幅 */}
        {archive && (
          <div className="mt-3 pt-3 border-t border-line/50 text-[11px] text-ink-3 leading-relaxed">
            归档于 {archive.archived_at.replace('T', ' ')}
            <br />
            对话 {archive.turn_count} 轮 · 产出 {archive.artifact_count} 份
            {archive.participants.length > 0 && (
              <> · 参与 {archive.participants.map((p) => ROLES[p as RoleId]?.name ?? p).join(' / ')}</>
            )}
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <p className="text-sm text-ink-3 text-center py-8">加载中…</p>
        ) : messages.length === 0 ? (
          <EmptyDynamicState />
        ) : (
          <>
            {/* KPI · 4 项真实数据 */}
            <Section title="实时 KPI" icon={<TrendingUp className="w-4 h-4 text-active" />}>
              <div className="grid grid-cols-2 gap-2">
                <DynKpi
                  icon={<FileText className="w-3 h-3" />}
                  label="已归档产出"
                  value={artifacts.length}
                />
                <DynKpi
                  icon={<MessageCircle className="w-3 h-3" />}
                  label="对话轮次"
                  value={turnCount}
                />
                <DynKpi
                  icon={<Briefcase className="w-3 h-3" />}
                  label="派活 / 讨论"
                  value={`${dispatchCount} / ${discussionCount}`}
                />
                <DynKpi
                  icon={<CheckCircle2 className="w-3 h-3" />}
                  label="决策（待 / 总）"
                  value={`${pendingDecisions} / ${decisionCount}`}
                  alert={pendingDecisions > 0}
                />
              </div>
            </Section>

            {/* 成员工作量：按产出数 + 发言数 */}
            <Section title="成员贡献" icon={<Users className="w-4 h-4 text-writer" />}>
              {participants.length > 0 ? (
                <div className="bg-bg-panel rounded-xl border border-line overflow-hidden">
                  {participants.map((pid) => (
                    <DynWorkloadRow
                      key={pid}
                      roleId={pid as RoleId}
                      count={workload[pid] ?? 0}
                      max={Math.max(...Object.values(workload), 1)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyHint text="还没人发言。" />
              )}
            </Section>

            {/* 最近产出 */}
            <Section title="最近产出" icon={<FileText className="w-4 h-4 text-distributor" />}>
              {recent.length > 0 ? (
                <div className="space-y-2">
                  {recent.map((a) => (
                    <DynArtifactRow
                      key={`${a.id}`}
                      manifest={a}
                      onOpen={() => setViewing(a)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyHint text="还没有归档的产出（派活模式下员工完成一步就会自动归档）。" />
              )}
            </Section>
          </>
        )}
      </div>

    </aside>
  );
}

/* ---------------------------- 右侧栏内嵌 · Artifact 详情视图 ---------------------------- */

function AsideArtifactView({
  sessionId,
  manifest,
  onBack,
  onClose,
}: {
  sessionId: string;
  manifest: ArtifactManifest;
  onBack: () => void;
  onClose: () => void;
}) {
  const { width, handle } = useAsideResize();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const role = ROLES[manifest.agent_id as RoleId];

  const isBinary = isBinaryArtifact(manifest.artifact_type);
  const downloadUrl = artifactDownloadUrl(sessionId, manifest.file);

  useEffect(() => {
    // 二进制不读文本，交给 renderer 自己用 downloadUrl 拉
    if (isBinary) {
      setContent('');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchArtifact(sessionId, manifest.file).then((c) => {
      if (!cancelled) {
        setContent(c);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, manifest.file, isBinary]);

  const createdAt = manifest.created_at.slice(0, 16).replace('T', ' ');

  return (
    <aside
      className="h-screen bg-bg-sunken border-l border-line flex flex-col overflow-hidden slide-in-right relative"
      style={{ width }}
    >
      {handle}
      {/* 详情头 · 返回 + 标题 + 关闭 */}
      <div className="px-3 py-3 bg-bg-panel border-b border-line flex items-center gap-1">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md hover:bg-bg-hover transition-colors flex-shrink-0"
          title="返回看板"
        >
          <ArrowLeft className="w-4 h-4 text-ink-3" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono px-1 py-0.5 bg-bg-sunken text-ink-3 rounded flex-shrink-0">
              第 {manifest.step_idx} 步
            </span>
            <h3 className="text-sm font-medium text-ink truncate">
              {manifest.title}
            </h3>
          </div>
          <p className="text-[10px] text-ink-4 mt-0.5 truncate">
            by {role?.name ?? manifest.agent_name} · {createdAt} · {(manifest.size / 1024).toFixed(1)} KB
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-bg-hover transition-colors flex-shrink-0"
          title="关闭看板"
        >
          <X className="w-4 h-4 text-ink-3" />
        </button>
      </div>

      {/* 详情正文 · 铺满可滚动 */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-sm text-ink-3">加载中…</p>
        ) : content === null ? (
          <p className="text-sm text-ink-3">（读取失败）</p>
        ) : (
          <ArtifactRenderer
            content={content}
            artifactType={manifest.artifact_type}
            filename={manifest.file}
            downloadUrl={downloadUrl}
            size={manifest.size}
          />
        )}
      </div>
    </aside>
  );
}

const EMPTY_MSG_LIST: ChatMessage[] = [];

function EmptyDynamicState() {
  return (
    <div className="text-center py-8 px-4">
      <Sparkles className="w-8 h-8 text-ink-4 mx-auto mb-2" />
      <p className="text-sm text-ink-3 mb-1">这个新群还是空白</p>
      <p className="text-[11px] text-ink-4 leading-relaxed">
        在聊天 tab 给理抛个需求，理会分派或组织讨论。<br />
        每一步的产出、决策、讨论会自动汇总到这里。
      </p>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="bg-bg-panel rounded-xl border border-line border-dashed p-3 text-center">
      <p className="text-[11px] text-ink-4 leading-relaxed">{text}</p>
    </div>
  );
}

function DynKpi({
  icon,
  label,
  value,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-bg-panel rounded-xl border p-3',
        alert ? 'border-busy/40' : 'border-line',
      )}
    >
      <div className="text-[10px] text-ink-4 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          'mt-1 text-lg font-mono font-bold',
          alert ? 'text-busy' : 'text-ink',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function DynWorkloadRow({
  roleId,
  count,
  max,
}: {
  roleId: RoleId;
  count: number;
  max: number;
}) {
  const role = ROLES[roleId];
  const profile = AGENT_MARKET_PROFILES[roleId];
  if (!role || !profile) return null;
  const pct = max > 0 ? (count / max) * 100 : 0;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 border-b border-line last:border-0">
      <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0">
        <Image
          src={profile.avatar}
          alt={role.name}
          width={24}
          height={24}
          className="object-cover w-full h-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs font-medium text-ink">{role.name}</span>
          <span className="text-[10px] font-mono text-ink-3">{count}</span>
        </div>
        <div className="h-1 bg-bg-sunken rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', `bg-${roleId}`)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function DynArtifactRow({
  manifest,
  onOpen,
}: {
  manifest: ArtifactManifest;
  onOpen: () => void;
}) {
  const role = ROLES[manifest.agent_id as RoleId];
  // 完整创建时间 "YYYY-MM-DD HH:MM"（去掉秒和微秒，T 换成空格）
  const createdAt = manifest.created_at.slice(0, 16).replace('T', ' ');
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left bg-bg-panel rounded-xl border border-line p-3 hover:border-ink-4 hover:shadow-sm transition-all"
      title="查看产出原文"
    >
      <div className="flex items-start gap-2">
        <FileText className="w-3.5 h-3.5 text-ink-3 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-mono px-1 py-0.5 bg-bg-sunken text-ink-3 rounded">
              第 {manifest.step_idx} 步
            </span>
            <span className="text-sm font-medium text-ink truncate">
              {manifest.title}
            </span>
          </div>
          <p className="text-[11px] text-ink-3 leading-relaxed line-clamp-2 mb-1">
            {manifest.summary}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-ink-4">
              by {role?.name ?? manifest.agent_name}
            </span>
            <span className="text-[10px] text-ink-4 font-mono flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {createdAt}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
