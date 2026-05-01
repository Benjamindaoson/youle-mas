'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronRight, Sparkles, Brain, Lightbulb, Check, X, TrendingUp, Award, Zap, Target, Users, Clock, Star, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_COLORS, AGENT_LEVELS, AGENT_RESUMES, AGENT_CONFIGS, AGENT_MARKET_PROFILES, MODEL_PROVIDER_NAMES, type RoleId } from '@/lib/types';
import {
  getAuth,
  setAuth,
  listArtifactsByAgent,
  fetchArtifact,
  type ArtifactManifest,
} from '@/lib/api';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';

interface DossierProps {
  employeeId: RoleId | null;
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'overview' | 'skills' | 'pact' | 'outputs';

// Agent 能力维度数据
const CAPABILITY_DIMENSIONS: Record<RoleId, { dimension: string; value: number; fullMark: number }[]> = {
  chief: [
    { dimension: '需求理解', value: 94, fullMark: 100 },
    { dimension: '判断力', value: 92, fullMark: 100 },
    { dimension: '任务派发', value: 96, fullMark: 100 },
    { dimension: '沟通协调', value: 95, fullMark: 100 },
    { dimension: '偏好记忆', value: 90, fullMark: 100 },
    { dimension: '专业深度', value: 70, fullMark: 100 },
  ],
  analyst: [
    { dimension: '数据分析', value: 95, fullMark: 100 },
    { dimension: '逻辑推理', value: 92, fullMark: 100 },
    { dimension: '趋势洞察', value: 88, fullMark: 100 },
    { dimension: '报告撰写', value: 85, fullMark: 100 },
    { dimension: '可视化', value: 82, fullMark: 100 },
    { dimension: '速度效率', value: 78, fullMark: 100 },
  ],
  planner: [
    { dimension: '战略规划', value: 96, fullMark: 100 },
    { dimension: '结构思维', value: 94, fullMark: 100 },
    { dimension: '方案设计', value: 92, fullMark: 100 },
    { dimension: '资源整合', value: 88, fullMark: 100 },
    { dimension: '风险评估', value: 85, fullMark: 100 },
    { dimension: '执行落地', value: 80, fullMark: 100 },
  ],
  writer: [
    { dimension: '文案创作', value: 98, fullMark: 100 },
    { dimension: '风格把控', value: 95, fullMark: 100 },
    { dimension: '情感共鸣', value: 93, fullMark: 100 },
    { dimension: '多平台适配', value: 88, fullMark: 100 },
    { dimension: '视觉审美', value: 85, fullMark: 100 },
    { dimension: '产出速度', value: 90, fullMark: 100 },
  ],
  distributor: [
    { dimension: '平台精通', value: 96, fullMark: 100 },
    { dimension: '格式转换', value: 94, fullMark: 100 },
    { dimension: '发布效率', value: 98, fullMark: 100 },
    { dimension: '时间把控', value: 92, fullMark: 100 },
    { dimension: '规则理解', value: 90, fullMark: 100 },
    { dimension: '数据追踪', value: 75, fullMark: 100 },
  ],
  monitor: [
    { dimension: '实时监测', value: 95, fullMark: 100 },
    { dimension: '异常发现', value: 92, fullMark: 100 },
    { dimension: '预警及时', value: 90, fullMark: 100 },
    { dimension: '报告清晰', value: 85, fullMark: 100 },
    { dimension: '持续追踪', value: 88, fullMark: 100 },
    { dimension: '深度分析', value: 72, fullMark: 100 },
  ],
  coder: [
    { dimension: '架构设计', value: 94, fullMark: 100 },
    { dimension: '代码质量', value: 96, fullMark: 100 },
    { dimension: '重构能力', value: 92, fullMark: 100 },
    { dimension: '技术选型', value: 90, fullMark: 100 },
    { dimension: '工程效率', value: 88, fullMark: 100 },
    { dimension: '跨栈广度', value: 85, fullMark: 100 },
  ],
  frontend: [
    { dimension: 'UI 实现', value: 96, fullMark: 100 },
    { dimension: '组件抽象', value: 92, fullMark: 100 },
    { dimension: '交互打磨', value: 94, fullMark: 100 },
    { dimension: '性能优化', value: 88, fullMark: 100 },
    { dimension: '审美把控', value: 90, fullMark: 100 },
    { dimension: '跨端兼容', value: 86, fullMark: 100 },
  ],
  tester: [
    { dimension: '用例覆盖', value: 94, fullMark: 100 },
    { dimension: '缺陷复现', value: 92, fullMark: 100 },
    { dimension: '自动化', value: 88, fullMark: 100 },
    { dimension: '边界嗅觉', value: 95, fullMark: 100 },
    { dimension: '回归把控', value: 90, fullMark: 100 },
    { dimension: '性能测试', value: 75, fullMark: 100 },
  ],
};

// 工作趋势数据（近7天）
const WORK_TREND: Record<RoleId, { day: string; tasks: number; quality: number }[]> = {
  chief: [
    { day: '周一', tasks: 42, quality: 95 },
    { day: '周二', tasks: 38, quality: 96 },
    { day: '周三', tasks: 45, quality: 94 },
    { day: '周四', tasks: 51, quality: 97 },
    { day: '周五', tasks: 48, quality: 95 },
    { day: '周六', tasks: 22, quality: 98 },
    { day: '周日', tasks: 18, quality: 97 },
  ],
  analyst: [
    { day: '周一', tasks: 12, quality: 92 },
    { day: '周二', tasks: 15, quality: 94 },
    { day: '周三', tasks: 8, quality: 96 },
    { day: '周四', tasks: 18, quality: 91 },
    { day: '周五', tasks: 22, quality: 93 },
    { day: '周六', tasks: 6, quality: 95 },
    { day: '周日', tasks: 4, quality: 97 },
  ],
  planner: [
    { day: '周一', tasks: 8, quality: 95 },
    { day: '周二', tasks: 10, quality: 96 },
    { day: '周三', tasks: 12, quality: 94 },
    { day: '周四', tasks: 9, quality: 97 },
    { day: '周五', tasks: 15, quality: 95 },
    { day: '周六', tasks: 3, quality: 98 },
    { day: '周日', tasks: 2, quality: 96 },
  ],
  writer: [
    { day: '周一', tasks: 18, quality: 94 },
    { day: '周二', tasks: 22, quality: 93 },
    { day: '周三', tasks: 25, quality: 95 },
    { day: '周四', tasks: 20, quality: 92 },
    { day: '周五', tasks: 28, quality: 94 },
    { day: '周六', tasks: 10, quality: 96 },
    { day: '周日', tasks: 8, quality: 95 },
  ],
  distributor: [
    { day: '周一', tasks: 15, quality: 99 },
    { day: '周二', tasks: 18, quality: 99 },
    { day: '周三', tasks: 12, quality: 100 },
    { day: '周四', tasks: 20, quality: 99 },
    { day: '周五', tasks: 25, quality: 98 },
    { day: '周六', tasks: 8, quality: 100 },
    { day: '周日', tasks: 5, quality: 99 },
  ],
  monitor: [
    { day: '周一', tasks: 45, quality: 91 },
    { day: '周二', tasks: 52, quality: 92 },
    { day: '周三', tasks: 48, quality: 90 },
    { day: '周四', tasks: 55, quality: 93 },
    { day: '周五', tasks: 60, quality: 91 },
    { day: '周六', tasks: 42, quality: 94 },
    { day: '周日', tasks: 38, quality: 92 },
  ],
  coder: [
    { day: '周一', tasks: 14, quality: 93 },
    { day: '周二', tasks: 18, quality: 94 },
    { day: '周三', tasks: 22, quality: 92 },
    { day: '周四', tasks: 16, quality: 96 },
    { day: '周五', tasks: 25, quality: 94 },
    { day: '周六', tasks: 6, quality: 95 },
    { day: '周日', tasks: 4, quality: 97 },
  ],
  frontend: [
    { day: '周一', tasks: 12, quality: 94 },
    { day: '周二', tasks: 16, quality: 93 },
    { day: '周三', tasks: 18, quality: 95 },
    { day: '周四', tasks: 14, quality: 94 },
    { day: '周五', tasks: 20, quality: 95 },
    { day: '周六', tasks: 5, quality: 96 },
    { day: '周日', tasks: 3, quality: 95 },
  ],
  tester: [
    { day: '周一', tasks: 22, quality: 92 },
    { day: '周二', tasks: 28, quality: 93 },
    { day: '周三', tasks: 18, quality: 94 },
    { day: '周四', tasks: 26, quality: 91 },
    { day: '周五', tasks: 32, quality: 93 },
    { day: '周六', tasks: 8, quality: 95 },
    { day: '周日', tasks: 4, quality: 96 },
  ],
};

// 技能熟练度
const SKILL_PROFICIENCY: Record<RoleId, { name: string; level: number; uses: number }[]> = {
  chief: [
    { name: '需求诊断', level: 96, uses: 1284 },
    { name: '任务派发', level: 94, uses: 892 },
    { name: '日常问答', level: 92, uses: 2134 },
    { name: '偏好记忆', level: 90, uses: 567 },
  ],
  analyst: [
    { name: '竞品分析', level: 95, uses: 234 },
    { name: '数据报告', level: 92, uses: 189 },
    { name: '趋势预测', level: 88, uses: 156 },
    { name: '可视化图表', level: 85, uses: 123 },
  ],
  planner: [
    { name: 'OKR制定', level: 96, uses: 178 },
    { name: '方案框架', level: 94, uses: 156 },
    { name: 'BP撰写', level: 90, uses: 89 },
    { name: '思维导图', level: 88, uses: 112 },
  ],
  writer: [
    { name: '小红书文案', level: 98, uses: 456 },
    { name: '长文写作', level: 95, uses: 234 },
    { name: '视频脚本', level: 92, uses: 178 },
    { name: '标题优化', level: 90, uses: 567 },
  ],
  distributor: [
    { name: '多平台适配', level: 98, uses: 345 },
    { name: '发布排期', level: 96, uses: 234 },
    { name: '格式转换', level: 94, uses: 189 },
    { name: '热力分析', level: 85, uses: 78 },
  ],
  monitor: [
    { name: '关键词监测', level: 95, uses: 890 },
    { name: '舆情追踪', level: 92, uses: 234 },
    { name: '数据预警', level: 90, uses: 156 },
    { name: '定时报告', level: 88, uses: 89 },
  ],
  coder: [
    { name: '架构设计', level: 94, uses: 189 },
    { name: '代码重构', level: 96, uses: 312 },
    { name: 'API 设计', level: 92, uses: 234 },
    { name: '技术评审', level: 90, uses: 156 },
  ],
  frontend: [
    { name: '组件开发', level: 96, uses: 401 },
    { name: '交互动效', level: 92, uses: 234 },
    { name: '响应式布局', level: 94, uses: 278 },
    { name: '性能优化', level: 88, uses: 123 },
  ],
  tester: [
    { name: '用例设计', level: 94, uses: 267 },
    { name: '自动化脚本', level: 90, uses: 345 },
    { name: '回归测试', level: 92, uses: 412 },
    { name: '缺陷追踪', level: 88, uses: 189 },
  ],
};

// 协议数据
const PACT_DATA: Record<RoleId, { tone: string; length: string; objection: string; initiative: string; persona: string }> = {
  chief: {
    tone: '友好',
    length: '适中',
    objection: '委婉提示',
    initiative: '主动提醒',
    persona: '你说事，我来安排。专业深度我交给同事们，统筹和周到交给我。',
  },
  analyst: {
    tone: '克制',
    length: '适中',
    objection: '直接指出',
    initiative: '主动预警',
    persona: '数据不会说谎，但会说故事。我帮你读懂数据背后的意义。',
  },
  planner: {
    tone: '友好',
    length: '详细',
    objection: '委婉提示',
    initiative: '主动建议',
    persona: '好的方案不是拍脑袋，是把复杂问题拆成可执行的步骤。',
  },
  writer: {
    tone: '克制',
    length: '精简',
    objection: '直接指出',
    initiative: '被动响应',
    persona: '文字是有温度的。我追求的是恰到好处，不多不少。',
  },
  distributor: {
    tone: '友好',
    length: '精简',
    objection: '委婉提示',
    initiative: '主动提醒',
    persona: '内容再好，没人看到也是零。我帮你把好内容送到对的人面前。',
  },
  monitor: {
    tone: '克制',
    length: '精简',
    objection: '直接指出',
    initiative: '主动预警',
    persona: '市场瞬息万变。我帮你盯着，有风吹草动第一时间告诉你。',
  },
  coder: {
    tone: '克制',
    length: '适中',
    objection: '直接指出',
    initiative: '主动建议',
    persona: '代码是写给人读的，顺便让机器执行。我先把系统骨架搭稳，再谈优雅。',
  },
  frontend: {
    tone: '友好',
    length: '精简',
    objection: '委婉提示',
    initiative: '主动提醒',
    persona: '像素不是讲究，是对用户的尊重。界面的克制，是为了让内容发声。',
  },
  tester: {
    tone: '克制',
    length: '精简',
    objection: '直接指出',
    initiative: '主动预警',
    persona: '我怀疑，所以我存在。替你把关，也替你多想一步。',
  },
};

export function Dossier({ employeeId, isOpen, onClose }: DossierProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  if (!employeeId || !isOpen) return null;

  const employee = ROLES[employeeId];
  const colorConfig = ROLE_COLORS[employeeId];
  const resume = AGENT_RESUMES[employeeId];
  const levelInfo = AGENT_LEVELS[resume.level];
  const profile = AGENT_MARKET_PROFILES[employeeId];

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: '能力画像' },
    { id: 'outputs', label: '近期产出' },
    { id: 'skills', label: '技能档案' },
    { id: 'pact', label: '协作协议' },
  ];

  return (
    <aside className="w-[360px] h-screen bg-bg-sunken border-l border-line flex flex-col overflow-hidden slide-in-right">
      {/* 头部 - 卡片式设计 */}
      <div className="p-4 bg-gradient-to-br from-bg-panel to-bg-sunken border-b border-line">
        <div className="flex items-start gap-3">
          {/* 头像 */}
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg ring-2 ring-white/10">
              <Image
                src={profile.avatar}
                alt={profile.fullName}
                width={56}
                height={56}
                className="object-cover"
              />
            </div>
            {/* 在线状态 */}
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-active rounded-full border-2 border-bg-panel" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-ink text-lg">{profile.fullName}</h2>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('px-2 py-0.5 text-[10px] rounded-full font-medium', levelInfo.color)}>
                {levelInfo.name}
              </span>
              <span className="text-xs text-ink-3">{profile.title}</span>
            </div>
            <p className="text-xs text-ink-4 mt-1 italic">&ldquo;{resume.signature}&rdquo;</p>
          </div>
          
          {/* 折叠按钮 */}
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded-md transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-ink-3" />
          </button>
        </div>

        {/* 快速数据条 */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-line/50">
          <QuickStat icon={<Zap className="w-3.5 h-3.5" />} value={resume.collaborationStats.totalTasks} label="总任务" />
          <QuickStat icon={<Target className="w-3.5 h-3.5" />} value={`${resume.collaborationStats.adoptionRate}%`} label="采纳率" />
          <QuickStat icon={<Star className="w-3.5 h-3.5" />} value={resume.collaborationStats.avgRating.toFixed(1)} label="评分" />
          <QuickStat icon={<Clock className="w-3.5 h-3.5" />} value={profile.stats.responseTime} label="响应" />
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b border-line bg-bg-panel">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors relative',
              activeTab === tab.id 
                ? 'text-ink' 
                : 'text-ink-3 hover:text-ink-2'
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-active rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && <OverviewTab employeeId={employeeId} colorConfig={colorConfig} />}
        {activeTab === 'outputs' && <OutputsTab employeeId={employeeId} />}
        {activeTab === 'skills' && <SkillsTab employeeId={employeeId} colorConfig={colorConfig} />}
        {activeTab === 'pact' && <PactTab employeeId={employeeId} />}
      </div>
    </aside>
  );
}

/* ---------------------------- 理的权限设置面板 ---------------------------- */

type AuthLevel = 'L0' | 'L1' | 'L2';

const LEVEL_META: Record<AuthLevel, { name: string; short: string; desc: string; color: string }> = {
  L0: {
    name: 'L0 未授权',
    short: '建议',
    desc: '只给建议，不直接调度专家；不能自主建群；涉及派活时会问你',
    color: 'text-ink-3 border-line',
  },
  L1: {
    name: 'L1 单次授权',
    short: '临时',
    desc: '当前任务可直接安排；可自主建群一次；单次生效，完成即撤回',
    color: 'text-planner border-planner/40',
  },
  L2: {
    name: 'L2 长期授权',
    short: '常驻',
    desc: '默认直接安排、建群、代决策；仅"真实对外发布 / 付费 / 删除"仍需你点确认',
    color: 'text-active border-active/40',
  },
};

function ChiefPermissionPanel() {
  const [level, setLevel] = useState<AuthLevel>('L0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAuth('chief')
      .then((lv) => {
        if (!cancelled) {
          setLevel(lv);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = async (next: AuthLevel) => {
    if (next === level || saving) return;
    setSaving(true);
    const prev = level;
    setLevel(next); // 乐观更新
    try {
      const got = await setAuth('chief', next);
      setLevel(got);
    } catch {
      setLevel(prev);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-bg-panel rounded-xl border border-line p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-ink flex items-center gap-2">
          <Award className="w-4 h-4 text-chief" />
          你给理的授权
        </h3>
        <span className="text-[10px] text-ink-4 font-mono">
          {loading ? '加载中' : level}
        </span>
      </div>
      <p className="text-[11px] text-ink-4 leading-relaxed mb-3">
        决定理可以替你自主做多少事。档位越高，打扰你越少；
        但涉及"真实发布 / 付费 / 删除"永远要你点确认。
      </p>
      <div className="space-y-1.5">
        {(['L0', 'L1', 'L2'] as AuthLevel[]).map((lv) => {
          const meta = LEVEL_META[lv];
          const isActive = level === lv;
          return (
            <button
              key={lv}
              onClick={() => handleSelect(lv)}
              disabled={loading || saving}
              className={cn(
                'w-full text-left p-2.5 rounded-lg border transition-all',
                isActive
                  ? cn('bg-bg-sunken ring-1 ring-offset-0', meta.color)
                  : 'border-line hover:border-ink-4',
                (loading || saving) && 'opacity-60 cursor-wait',
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                    isActive ? 'border-ink' : 'border-line-2',
                  )}
                >
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-ink" />
                  )}
                </span>
                <span className="text-sm font-medium text-ink">
                  {meta.name}
                </span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded ml-auto',
                    isActive
                      ? 'bg-ink text-white'
                      : 'bg-bg-sunken text-ink-4',
                  )}
                >
                  {meta.short}
                </span>
              </div>
              <p className="text-[11px] text-ink-3 leading-relaxed pl-6">
                {meta.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------- 近期产出 Tab ---------------------------- */

function OutputsTab({ employeeId }: { employeeId: RoleId }) {
  type ArtifactWithSession = ArtifactManifest & { session_id?: string };
  const [items, setItems] = useState<ArtifactWithSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ArtifactWithSession | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 加载列表
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelected(null);
    listArtifactsByAgent(employeeId, 30)
      .then((data) => {
        if (!cancelled) {
          setItems(data.items ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  // 加载详情
  useEffect(() => {
    if (!selected || !selected.session_id) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);
    fetchArtifact(selected.session_id, selected.file)
      .then((content) => {
        if (!cancelled) {
          setDetail(content);
          setDetailLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null);
          setDetailLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (loading) {
    return <div className="p-4 text-sm text-ink-3">加载中…</div>;
  }

  // 详情视图
  if (selected) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-line flex items-start gap-2">
          <button
            onClick={() => setSelected(null)}
            className="p-1 rounded hover:bg-bg-hover transition-colors flex-shrink-0 mt-0.5"
            title="返回列表"
          >
            <ChevronRight className="w-4 h-4 text-ink-3 rotate-180" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-bg-sunken text-ink-3 rounded">
                第 {selected.step_idx} 步
              </span>
              <span className="text-[10px] text-ink-4 font-mono truncate">
                {selected.file}
              </span>
            </div>
            <h3 className="text-sm font-serif font-semibold text-ink truncate">
              {selected.title}
            </h3>
            <p className="text-[10px] text-ink-4 mt-0.5">
              {selected.created_at} · {(selected.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {detailLoading ? (
            <p className="text-sm text-ink-3">读取中…</p>
          ) : detail ? (
            <pre className="text-xs text-ink leading-relaxed whitespace-pre-wrap font-sans">
              {detail}
            </pre>
          ) : (
            <p className="text-sm text-ink-3">（读取失败）</p>
          )}
        </div>
      </div>
    );
  }

  // 列表视图
  if (items.length === 0) {
    return (
      <div className="p-6 text-center">
        <FileText className="w-8 h-8 text-ink-4 mx-auto mb-2" />
        <p className="text-sm text-ink-3">还没有归档的产出</p>
        <p className="text-[11px] text-ink-4 mt-1">
          在群聊里"派活"让 Ta 完成一次任务后，这里会自动出现。
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {items.map((it) => (
        <button
          key={`${it.session_id}:${it.file}`}
          onClick={() => setSelected(it)}
          className="w-full text-left bg-bg-panel border border-line rounded-lg px-3 py-2 hover:border-ink-4 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <FileText className="w-3.5 h-3.5 text-ink-3 flex-shrink-0" />
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-bg-sunken text-ink-3 rounded">
              第 {it.step_idx} 步
            </span>
            <span className="text-sm font-medium text-ink truncate flex-1">
              {it.title}
            </span>
          </div>
          <p className="text-[11px] text-ink-3 line-clamp-2 leading-relaxed">
            {it.summary}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-ink-4 font-mono truncate">
              {it.session_id}
            </span>
            <span className="text-[10px] text-ink-4 ml-auto flex-shrink-0">
              {it.created_at.split('T')[0]} · {(it.size / 1024).toFixed(1)} KB
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function QuickStat({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1 text-ink">
        {icon}
        <span className="font-semibold text-sm">{value}</span>
      </div>
      <span className="text-[10px] text-ink-4">{label}</span>
    </div>
  );
}

function OverviewTab({ employeeId, colorConfig }: { employeeId: RoleId; colorConfig: { main: string; accent: string; hex: string } }) {
  const dimensions = CAPABILITY_DIMENSIONS[employeeId];
  const trend = WORK_TREND[employeeId];
  const resume = AGENT_RESUMES[employeeId];
  const profile = AGENT_MARKET_PROFILES[employeeId];

  // 计算综合能力得分
  const avgScore = Math.round(dimensions.reduce((sum, d) => sum + d.value, 0) / dimensions.length);

  return (
    <div className="p-4 space-y-4">
      {/* 理独有：权限设置面板 · 哲学：助理代用户授权 */}
      {employeeId === 'chief' && <ChiefPermissionPanel />}

      {/* 人格速写：个性 + 工作风格 · 哲学 #5 拟人化 */}
      {(resume.personality || resume.workStyle) && (
        <div className="bg-bg-panel rounded-xl border border-line p-4">
          <h3 className="text-sm font-medium text-ink flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-busy" />
            人格速写
          </h3>
          {resume.personality && (
            <div className="mb-2">
              <div className="text-[10px] text-ink-4 mb-0.5">性格</div>
              <p className="text-sm text-ink-2 leading-relaxed">{resume.personality}</p>
            </div>
          )}
          {resume.workStyle && (
            <div>
              <div className="text-[10px] text-ink-4 mb-0.5">工作风格</div>
              <p className="text-sm text-ink-2 leading-relaxed">{resume.workStyle}</p>
            </div>
          )}
        </div>
      )}

      {/* 能力雷达图 */}
      <div className="bg-bg-panel rounded-xl border border-line p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-ink flex items-center gap-2">
            <Target className="w-4 h-4 text-active" />
            能力画像
          </h3>
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold text-ink">{avgScore}</span>
            <span className="text-xs text-ink-4">综合分</span>
          </div>
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={dimensions}>
              <PolarGrid stroke="var(--color-line)" />
              <PolarAngleAxis 
                dataKey="dimension" 
                tick={{ fill: 'var(--color-ink-3)', fontSize: 10 }}
              />
              <Radar
                name="能力值"
                dataKey="value"
                stroke={colorConfig.hex}
                fill={colorConfig.hex}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 近7天工作趋势 */}
      <div className="bg-bg-panel rounded-xl border border-line p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-ink flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-active" />
            近7天工作趋势
          </h3>
          <span className="text-xs text-ink-4">任务数 & 质量</span>
        </div>
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="taskGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colorConfig.hex} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={colorConfig.hex} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="day" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-ink-4)', fontSize: 10 }}
              />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ 
                  background: 'var(--color-bg-panel)', 
                  border: '1px solid var(--color-line)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Area
                type="monotone"
                dataKey="tasks"
                stroke={colorConfig.hex}
                fill="url(#taskGradient)"
                strokeWidth={2}
                name="任务数"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 核心优势 & 成长空间 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-active/5 rounded-xl p-3 border border-active/20">
          <h4 className="text-[10px] text-active font-medium mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            核心优势
          </h4>
          <div className="space-y-1.5">
            {resume.strengths.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-active" />
                <span className="text-xs text-ink">{s}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-bg-sunken rounded-xl p-3 border border-line">
          <h4 className="text-[10px] text-ink-4 font-medium mb-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            成长空间
          </h4>
          <div className="space-y-1.5">
            {resume.growthAreas.map((g, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-ink-4" />
                <span className="text-xs text-ink-3">{g}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 工作成就 */}
      <div className="bg-bg-panel rounded-xl border border-line overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center gap-2 bg-gradient-to-r from-busy/5 to-transparent">
          <Award className="w-4 h-4 text-busy" />
          <span className="text-sm font-medium text-ink">荣誉墙</span>
        </div>
        <div className="p-3 space-y-2">
          {resume.achievements.map((a, i) => (
            <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-bg-sunken transition-colors">
              <div className="w-8 h-8 rounded-lg bg-busy/10 flex items-center justify-center flex-shrink-0">
                <Award className="w-4 h-4 text-busy" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{a.title}</span>
                  <span className="text-[10px] text-ink-4 flex-shrink-0">{a.date}</span>
                </div>
                <p className="text-xs text-ink-3 mt-0.5">{a.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 认证背书 */}
      <div className="bg-bg-panel rounded-xl border border-line p-4">
        <h4 className="text-[10px] text-ink-4 font-medium mb-3">认证资质</h4>
        <div className="flex flex-wrap gap-2">
          {profile.certifications.map((cert, i) => (
            <span 
              key={i} 
              className="px-2.5 py-1 bg-ink/5 text-ink text-xs rounded-full border border-line flex items-center gap-1"
            >
              <Check className="w-3 h-3 text-active" />
              {cert}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillsTab({ employeeId, colorConfig }: { employeeId: RoleId; colorConfig: { main: string; accent: string; hex: string } }) {
  const skills = SKILL_PROFICIENCY[employeeId];
  const agentConfig = AGENT_CONFIGS[employeeId];

  return (
    <div className="p-4 space-y-4">
      {/* 技能熟练度 */}
      <div className="bg-bg-panel rounded-xl border border-line p-4">
        <h3 className="text-sm font-medium text-ink flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-busy" />
          技能熟练度
        </h3>
        <div className="space-y-4">
          {skills.map((skill, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-ink">{skill.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-4">{skill.uses} 次使用</span>
                  <span className="text-sm font-semibold text-ink">{skill.level}%</span>
                </div>
              </div>
              <div className="h-2 bg-bg-sunken rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${skill.level}%`,
                    background: `linear-gradient(90deg, ${colorConfig.hex}, ${colorConfig.hex}88)`
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 技能使用分布 */}
      <div className="bg-bg-panel rounded-xl border border-line p-4">
        <h3 className="text-sm font-medium text-ink flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-active" />
          技能使用分布
        </h3>
        <div className="h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={skills} layout="vertical">
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-ink-3)', fontSize: 11 }}
                width={80}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'var(--color-bg-panel)', 
                  border: '1px solid var(--color-line)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value: number) => [`${value} 次`, '使用次数']}
              />
              <Bar 
                dataKey="uses" 
                fill={colorConfig.hex}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 模型配置 */}
      <div className="bg-bg-panel rounded-xl border border-line p-4">
        <h3 className="text-sm font-medium text-ink flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-planner" />
          底层模型
        </h3>
        <div className="space-y-3">
          {/* 主模型 */}
          <div className="flex items-center gap-3 p-3 bg-active/5 rounded-lg border border-active/20">
            <div className="w-10 h-10 rounded-xl bg-active flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">
                  {MODEL_PROVIDER_NAMES[agentConfig.primaryModel.provider]}
                </span>
                <span className="px-1.5 py-0.5 bg-active text-white text-[10px] rounded">主模型</span>
              </div>
              <p className="text-xs text-ink-3 mt-0.5">{agentConfig.primaryModel.purpose}</p>
            </div>
          </div>
          {/* 备用模型 */}
          {agentConfig.fallbackModel && (
            <div className="flex items-center gap-3 p-3 bg-bg-sunken rounded-lg border border-line">
              <div className="w-10 h-10 rounded-xl bg-ink-4 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {MODEL_PROVIDER_NAMES[agentConfig.fallbackModel.provider]}
                  </span>
                  <span className="px-1.5 py-0.5 bg-ink-4 text-white text-[10px] rounded">备用</span>
                </div>
                <p className="text-xs text-ink-3 mt-0.5">{agentConfig.fallbackModel.purpose}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 消耗说明 */}
      <div className="bg-gradient-to-br from-busy/5 to-bg-panel rounded-xl border border-line p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-ink">能量消耗</h4>
            <p className="text-xs text-ink-3 mt-1">每次调用消耗能量，复杂任务消耗更多</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-busy">3-15</span>
            <span className="text-sm text-ink-4 ml-1">能量/次</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PactTab({ employeeId }: { employeeId: RoleId }) {
  const pact = PACT_DATA[employeeId];
  const [editing, setEditing] = useState(false);

  const pactItems = [
    { label: '说话风格', value: pact.tone, options: ['克制', '友好', '正式', '幽默'], icon: <MessageIcon /> },
    { label: '回复篇幅', value: pact.length, options: ['精简', '适中', '详细'], icon: <LengthIcon /> },
    { label: '有异议时', value: pact.objection, options: ['委婉提示', '直接指出', '据理力争'], icon: <DebateIcon /> },
    { label: '主动程度', value: pact.initiative, options: ['被动响应', '主动提醒', '主动预警'], icon: <InitiativeIcon /> },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* 说明 */}
      <div className="bg-gradient-to-br from-planner/5 to-bg-panel rounded-xl p-4 border border-line">
        <p className="text-sm text-ink-2 leading-relaxed">
          协议定义了你们的协作方式。修改后，Ta 会按新的方式工作。
        </p>
      </div>

      {/* 协议条目 */}
      <div className="bg-bg-panel rounded-xl border border-line overflow-hidden">
        {pactItems.map((item, i) => (
          <div 
            key={i}
            className={cn(
              'px-4 py-4 flex items-center gap-3',
              i !== pactItems.length - 1 && 'border-b border-line'
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-bg-sunken flex items-center justify-center text-ink-3">
              {item.icon}
            </div>
            <div className="flex-1">
              <span className="text-xs text-ink-4">{item.label}</span>
              {editing ? (
                <select 
                  defaultValue={item.value}
                  className="block w-full mt-1 text-sm text-ink bg-bg-sunken px-2 py-1.5 rounded-lg border border-line focus:outline-none focus:border-active"
                >
                  {item.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <span className="block text-sm text-ink font-medium mt-0.5">{item.value}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 人设 */}
      <div className="bg-bg-panel rounded-xl border border-line p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-ink-3" />
          <span className="text-sm font-medium text-ink">人设描述</span>
        </div>
        {editing ? (
          <textarea 
            defaultValue={pact.persona}
            className="w-full text-sm text-ink bg-bg-sunken p-3 rounded-lg border border-line focus:outline-none focus:border-active resize-none"
            rows={3}
          />
        ) : (
          <p className="text-sm text-ink-2 font-serif italic leading-relaxed bg-bg-sunken p-3 rounded-lg">
            &ldquo;{pact.persona}&rdquo;
          </p>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {editing ? (
          <>
            <button 
              onClick={() => setEditing(false)}
              className="flex-1 py-2.5 text-sm text-ink-3 hover:text-ink transition-colors flex items-center justify-center gap-1 border border-line rounded-xl"
            >
              <X className="w-4 h-4" />
              取消
            </button>
            <button 
              onClick={() => setEditing(false)}
              className="flex-1 py-2.5 text-sm bg-active text-white rounded-xl hover:bg-active/90 transition-colors flex items-center justify-center gap-1"
            >
              <Check className="w-4 h-4" />
              保存协议
            </button>
          </>
        ) : (
          <button 
            onClick={() => setEditing(true)}
            className="w-full py-2.5 text-sm text-ink border border-line rounded-xl hover:bg-bg-hover transition-colors"
          >
            修改协议
          </button>
        )}
      </div>
    </div>
  );
}

// 小图标组件
function MessageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function LengthIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/>
    </svg>
  );
}

function DebateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
}

function InitiativeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}
