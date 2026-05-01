'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_COLORS, type RoleId } from '@/lib/types';
import { toast } from 'sonner';
import { listAllArtifacts, type ArtifactManifest } from '@/lib/api';

// 后端 agent_id / artifact_type → 页面卡片视觉的统一映射
type CardKind =
  | '文案' | '图片' | '视频' | '配音' | '报告' | '方案' | '发布包' | '预警' | '整理';

interface CardArtifact {
  id: string;
  kind: CardKind;
  emoji: string;
  cover: string;
  title: string;
  preview: string;
  by: RoleId;
  date: string;
}

const KIND_FILTERS: (CardKind | '全部')[] = [
  '全部', '文案', '图片', '视频', '配音', '报告', '方案', '发布包',
];
const ROLE_FILTERS: { id: RoleId | 'all'; label: string }[] = [
  { id: 'all', label: '全员' },
  { id: 'analyst', label: '分析员' },
  { id: 'planner', label: '策划员' },
  { id: 'writer', label: '创作员' },
  { id: 'distributor', label: '传播员' },
  { id: 'monitor', label: '监测员' },
  { id: 'chief', label: '首席' },
];

const COVER_COLORS: Record<string, string> = {
  text: 'from-amber-50 to-amber-100',
  report: 'from-slate-100 to-slate-200',
  image: 'from-emerald-50 to-emerald-100',
  video: 'from-pink-50 to-pink-100',
  ppt: 'from-cyan-50 to-cyan-100',
  pack: 'from-orange-50 to-orange-100',
};

// 后端 agent_id 不一定与前端 RoleId 完全一致，做一次显式映射
function agentToRole(agentId: string): RoleId {
  switch (agentId) {
    case 'chief':
    case 'orchestrator':
      return 'chief';
    case 'analyst': return 'analyst';
    case 'planner': return 'planner';
    case 'writer':
    case 'text_agent':
    case 'image_agent':
      return 'writer';
    case 'distributor':
    case 'audio_agent':
    case 'video_agent':
      return 'distributor';
    case 'monitor': return 'monitor';
    case 'coder': return 'coder';
    case 'frontend': return 'frontend';
    case 'tester': return 'tester';
    default: return 'writer';
  }
}

// 把后端 manifest 转成卡片需要的形状
function toCard(a: ArtifactManifest & { session_id?: string }): CardArtifact {
  const agent = a.agent_id;
  const type = a.artifact_type ?? 'markdown';

  // 先按 artifact_type 匹配，再按 agent_id 兜底
  let kind: CardKind = '文案';
  let emoji = '✍️';
  let cover = 'text';

  if (type === 'image' || agent === 'image_agent') {
    kind = '图片'; emoji = '🎨'; cover = 'image';
  } else if (agent === 'video_agent') {
    kind = '视频'; emoji = '🎬'; cover = 'video';
  } else if (agent === 'audio_agent') {
    kind = '配音'; emoji = '🎤'; cover = 'video';
  } else if (agent === 'orchestrator' && /plan/i.test(a.title || '')) {
    kind = '方案'; emoji = '📋'; cover = 'report';
  } else if (agent === 'orchestrator') {
    kind = '报告'; emoji = '📊'; cover = 'report';
  } else if (agent === 'analyst') {
    kind = '报告'; emoji = '📊'; cover = 'report';
  } else if (agent === 'planner') {
    kind = '方案'; emoji = '📋'; cover = 'report';
  } else if (agent === 'monitor') {
    kind = '预警'; emoji = '🚨'; cover = 'report';
  } else if (agent === 'distributor') {
    kind = '发布包'; emoji = '📦'; cover = 'pack';
  } else {
    kind = '文案'; emoji = '✍️'; cover = 'text';
  }

  return {
    id: a.id,
    kind, emoji, cover,
    title: a.title || '未命名产出',
    preview: a.summary || '',
    by: agentToRole(agent),
    date: formatDate(a.created_at),
  };
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return '今天';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days < 7) return `${days} 天前`;
  return d.toISOString().slice(0, 10);
}

export default function ArtifactsPage() {
  const [items, setItems] = useState<CardArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<CardKind | '全部'>('全部');
  const [roleFilter, setRoleFilter] = useState<RoleId | 'all'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listAllArtifacts(200);
        if (cancelled) return;
        setItems(list.map(toCard));
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const hasFilter = kindFilter !== '全部' || roleFilter !== 'all';

  const filtered = useMemo(() => items.filter(a => {
    const kindMatch = kindFilter === '全部' || a.kind === kindFilter;
    const roleMatch = roleFilter === 'all' || a.by === roleFilter;
    return kindMatch && roleMatch;
  }), [items, kindFilter, roleFilter]);

  // 计算每个角色的产出数量，用于筛选条上的 (N) 标签
  const roleCounts = useMemo(() => {
    const m = new Map<RoleId, number>();
    for (const a of items) m.set(a.by, (m.get(a.by) || 0) + 1);
    return m;
  }, [items]);

  // 大致 "天数" 统计 — 取所有 artifact 的去重日期数
  const stats = useMemo(() => {
    const days = new Set<string>();
    const agents = new Set<RoleId>();
    for (const a of items) { days.add(a.date); agents.add(a.by); }
    return { count: items.length, agents: agents.size, days: days.size };
  }, [items]);

  const handleCardClick = () => {
    toast('回到源对话', {
      description: '点击后将跳转到工作群里的原消息',
    });
  };

  const clearFilters = () => {
    setKindFilter('全部');
    setRoleFilter('all');
  };

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-bg border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-bg-hover rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-ink-3" />
          </Link>
          <div>
            <h1 className="font-serif text-xl font-semibold text-ink">成果库</h1>
            <p className="text-sm text-ink-3">你和团队一起做过的事</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-gradient-to-br from-bg-sunken to-bg-hover rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-ink mb-2">
                团队的工作成果
              </h2>
              <p className="font-serif italic text-ink-2 text-sm">
                每一份产出都值得被记录
              </p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <span className="font-serif text-2xl font-semibold text-ink">{stats.count}</span>
                <p className="text-xs text-ink-3 mt-0.5">份产出</p>
              </div>
              <div className="text-center">
                <span className="font-serif text-2xl font-semibold text-ink">{stats.agents}</span>
                <p className="text-xs text-ink-3 mt-0.5">位员工</p>
              </div>
              <div className="text-center">
                <span className="font-serif text-2xl font-semibold text-ink">{stats.days}</span>
                <p className="text-xs text-ink-3 mt-0.5">天积累</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-4 w-16">按类型</span>
            <div className="flex gap-2 flex-wrap">
              {KIND_FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setKindFilter(filter)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-full transition-colors',
                    kindFilter === filter
                      ? 'bg-ink text-white'
                      : 'bg-bg-sunken text-ink-2 hover:bg-bg-hover'
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-4 w-16">按员工</span>
            <div className="flex gap-2 flex-wrap">
              {ROLE_FILTERS.map((filter) => {
                const c = filter.id === 'all' ? items.length : roleCounts.get(filter.id) || 0;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setRoleFilter(filter.id)}
                    className={cn(
                      'px-3 py-1 text-xs rounded-full transition-colors',
                      roleFilter === filter.id
                        ? 'bg-ink text-white'
                        : 'bg-bg-sunken text-ink-2 hover:bg-bg-hover'
                    )}
                  >
                    {filter.label}
                    {c > 0 && <span className="ml-1 opacity-60">({c})</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-ink-2">{filtered.length} 份结果</span>
          {hasFilter && (
            <button
              onClick={clearFilters}
              className="text-xs text-ink-3 hover:text-ink flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" />
              清除筛选
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-ink-3 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">读取产出库…</span>
          </div>
        ) : error ? (
          <div className="text-center py-20 text-ink-3 text-sm">
            <p>读取失败：{error}</p>
            <p className="mt-2 text-ink-4">请确认后端服务在 .env.local 指定的地址上运行。</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-serif text-ink-2 text-base mb-2">
              {items.length === 0 ? '还没有团队产出' : '没有符合筛选的结果'}
            </p>
            <p className="text-sm text-ink-3">
              {items.length === 0
                ? '去工作群里跑一次任务，产出会自动出现在这里。'
                : '试试清除筛选或换一个分类。'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {filtered.map((artifact) => (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                onClick={handleCardClick}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ArtifactCard({
  artifact,
  onClick,
}: {
  artifact: CardArtifact;
  onClick: () => void;
}) {
  const role = ROLES[artifact.by];
  const colorConfig = ROLE_COLORS[artifact.by];
  const coverColor = COVER_COLORS[artifact.cover] || 'from-gray-50 to-gray-100';

  return (
    <div
      onClick={onClick}
      className="bg-bg-panel border border-line rounded-xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
    >
      <div className={cn('h-[130px] relative bg-gradient-to-br', coverColor)}>
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl opacity-70 grayscale-[0.3]">
          {artifact.emoji}
        </span>
        {artifact.preview ? (
          <div className="absolute bottom-0 left-0 right-0 bg-black/10 backdrop-blur-sm px-3 py-1.5">
            <p className="font-serif italic text-[9px] text-ink-2 truncate">{artifact.preview}</p>
          </div>
        ) : null}
      </div>

      <div className="p-3">
        <span className="px-1.5 py-0.5 bg-bg-sunken text-ink-3 text-[10px] font-mono rounded">
          {artifact.kind}
        </span>

        <h3 className="font-serif font-medium text-ink text-[13px] mt-2 line-clamp-2 min-h-[36px]">
          {artifact.title}
        </h3>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5">
            <div className={cn(
              'w-[14px] h-[14px] rounded flex items-center justify-center text-[8px] font-medium',
              colorConfig.main
            )}>
              {role.initial}
            </div>
            <span className="text-[10px] text-ink-3">{role.name}</span>
          </div>
          <span className="text-[10px] text-ink-4 font-mono">{artifact.date}</span>
        </div>
      </div>
    </div>
  );
}
