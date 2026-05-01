'use client';

import { useState } from 'react';
import { ArrowLeft, Star, Zap, Users, TrendingUp, Clock, CheckCircle2, Sparkles, Crown, Shield } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_COLORS, AGENT_MARKET_PROFILES, AGENT_LEVELS, AGENT_RESUMES, type RoleId } from '@/lib/types';
import { HireCeremony } from '@/components/hire-ceremony';

// 用户已招募的 Agent
const HIRED_AGENTS: RoleId[] = ['chief', 'analyst', 'planner', 'writer', 'distributor', 'coder', 'frontend', 'tester'];

const FILTERS = [
  { id: 'all', label: '全部 Agent' },
  { id: 'hired', label: '已招募' },
  { id: 'available', label: '待招募' },
];

const SORT_OPTIONS = [
  { id: 'popular', label: '最受欢迎' },
  { id: 'rating', label: '评分最高' },
  { id: 'price', label: '价格最低' },
];

export default function MarketPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [hiringRole, setHiringRole] = useState<RoleId | null>(null);

  const allAgents = Object.values(AGENT_MARKET_PROFILES);
  
  const filteredAgents = allAgents.filter((agent) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'hired') return HIRED_AGENTS.includes(agent.id);
    if (activeFilter === 'available') return !HIRED_AGENTS.includes(agent.id);
    return true;
  }).sort((a, b) => {
    if (sortBy === 'rating') return b.stats.avgRating - a.stats.avgRating;
    if (sortBy === 'price') return a.pricing.monthlyCost - b.pricing.monthlyCost;
    return b.stats.totalUsers - a.stats.totalUsers;
  });

  return (
    <div className="min-h-screen bg-bg">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 bg-bg/80 backdrop-blur-sm border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-bg-hover rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-ink-3" />
            </Link>
            <div>
              <h1 className="font-serif text-xl font-semibold text-ink">Agent 人才市场</h1>
              <p className="text-sm text-ink-3">发现专业 Agent，组建你的 AI 团队</p>
            </div>
          </div>
          
          {/* 用户金币 */}
          <div className="flex items-center gap-2 px-4 py-2 bg-busy/10 rounded-lg">
            <Zap className="w-4 h-4 text-busy" />
            <span className="font-mono font-semibold text-busy">1,284</span>
            <span className="text-xs text-ink-3">金币</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero 区 - 更大气的设计 */}
        <div className="relative bg-gradient-to-br from-ink via-ink-2 to-ink rounded-2xl p-8 mb-8 overflow-hidden">
          {/* 背景装饰 */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-active/20 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-busy/20 to-transparent rounded-full blur-3xl" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex-1 max-w-xl">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-5 h-5 text-busy" />
                <span className="text-busy text-sm font-medium">专业 AI 团队</span>
              </div>
              <h2 className="font-serif text-3xl font-semibold text-white mb-3">
                5 位专业 Agent<br />
                <span className="text-ink-4">随时待命，为你效力</span>
              </h2>
              <p className="text-ink-4 text-sm leading-relaxed mb-6">
                每位 Agent 都经过专业训练，拥有独特技能和丰富经验。<br />
                招募 ta 加入你的工作台，即刻开始 AI 协作。
              </p>
              
              {/* 统计数据 */}
              <div className="flex gap-8">
                <div>
                  <p className="text-2xl font-mono font-bold text-white">50,000+</p>
                  <p className="text-xs text-ink-4">累计完成任务</p>
                </div>
                <div>
                  <p className="text-2xl font-mono font-bold text-white">9,800+</p>
                  <p className="text-xs text-ink-4">服务用户</p>
                </div>
                <div>
                  <p className="text-2xl font-mono font-bold text-white">4.8</p>
                  <p className="text-xs text-ink-4">平均评分</p>
                </div>
              </div>
            </div>
            
            {/* Agent 头像堆叠 */}
            <div className="relative flex items-center">
              {Object.entries(AGENT_MARKET_PROFILES).map(([id, profile], index) => (
                <div
                  key={id}
                  className={cn(
                    'relative w-16 h-16 rounded-2xl overflow-hidden border-4 border-ink shadow-xl',
                    index > 0 && '-ml-4'
                  )}
                  style={{ zIndex: 5 - index }}
                >
                  <Image
                    src={profile.avatar}
                    alt={profile.fullName}
                    fill
                    className="object-cover"
                  />
                  {HIRED_AGENTS.includes(id as RoleId) && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-active rounded-full flex items-center justify-center border-2 border-ink z-10">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 筛选和排序 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  'px-4 py-2 text-sm rounded-lg transition-colors',
                  activeFilter === filter.id
                    ? 'bg-ink text-white'
                    : 'bg-bg-sunken text-ink-2 hover:bg-bg-hover'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-4">排序：</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 bg-bg-sunken text-sm text-ink rounded-lg border-none outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Agent 卡片网格 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isHired={HIRED_AGENTS.includes(agent.id)}
              onHire={() => setHiringRole(agent.id)}
            />
          ))}
        </div>

        {/* 更多 Agent 预告 */}
        <div className="bg-gradient-to-r from-bg-panel to-bg-sunken border border-line rounded-2xl p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex -space-x-2">
                {['设', '译', '服'].map((char, i) => (
                  <div
                    key={i}
                    className="w-12 h-12 bg-bg-sunken border-2 border-dashed border-line-2 rounded-xl flex items-center justify-center text-ink-4 font-medium"
                  >
                    {char}
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-semibold text-ink mb-1">更多专业 Agent 即将上线</h3>
                <p className="text-sm text-ink-3">设计员、翻译员、客服员... 持续扩充中</p>
              </div>
            </div>
            <button className="px-6 py-2.5 bg-ink text-white text-sm rounded-lg hover:bg-ink-2 transition-colors">
              申请内测
            </button>
          </div>
        </div>

        {/* 信任背书 */}
        <div className="mt-8 pt-8 border-t border-line">
          <div className="flex items-center justify-center gap-8 text-ink-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="text-xs">数据安全保障</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs">Claude 4 & GPT-4o 驱动</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-xs">7x24 小时服务</span>
            </div>
          </div>
        </div>
      </main>

      {/* 招募仪式 */}
      {hiringRole && (
        <HireCeremony 
          roleId={hiringRole} 
          onComplete={() => setHiringRole(null)} 
        />
      )}
    </div>
  );
}

interface AgentCardProps {
  agent: typeof AGENT_MARKET_PROFILES.analyst;
  isHired: boolean;
  onHire: () => void;
}

function AgentCard({ agent, isHired, onHire }: AgentCardProps) {
  const role = ROLES[agent.id];
  const colorConfig = ROLE_COLORS[agent.id];
  const resume = AGENT_RESUMES[agent.id];
  const levelInfo = AGENT_LEVELS[resume.level];

  return (
    <div className={cn(
      'bg-bg-panel border rounded-2xl overflow-hidden hover:shadow-lg transition-all group',
      isHired ? 'border-active/30' : 'border-line'
    )}>
      {/* 头部区域 */}
      <div className="p-5 pb-4">
        <div className="flex gap-4">
          {/* 头像 */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
              <Image
                src={agent.avatar}
                alt={agent.fullName}
                width={80}
                height={80}
                className="object-cover w-full h-full"
              />
            </div>
            {/* 在线状态 */}
            <div className={cn(
              'absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-3 border-bg-panel flex items-center justify-center',
              agent.availability === 'available' ? 'bg-active' : agent.availability === 'limited' ? 'bg-busy' : 'bg-ink-4'
            )}>
              {isHired && <CheckCircle2 className="w-3 h-3 text-white" />}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {/* 名字和职级 */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-serif font-semibold text-lg text-ink">{agent.fullName}</h3>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('px-2 py-0.5 text-[10px] rounded font-medium', levelInfo.color)}>
                {levelInfo.name}
              </span>
              <span className="text-xs text-ink-3">{agent.title}</span>
            </div>
            {/* Tagline */}
            <p className="text-sm text-ink-2 leading-relaxed">{agent.tagline}</p>
          </div>
        </div>
      </div>

      {/* 数据指标 */}
      <div className="px-5 py-3 bg-bg-sunken/50 border-y border-line flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-busy" />
            <span className="font-mono font-semibold text-ink">{agent.stats.avgRating}</span>
          </div>
          <div className="flex items-center gap-1 text-ink-3">
            <Users className="w-3.5 h-3.5" />
            <span className="text-xs">{agent.stats.totalUsers.toLocaleString()} 用户</span>
          </div>
          <div className="flex items-center gap-1 text-ink-3">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs">{agent.stats.successRate}% 成功率</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-ink-3">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs">{agent.stats.responseTime}</span>
        </div>
      </div>

      {/* 亮点标签 */}
      <div className="px-5 py-3">
        <div className="flex flex-wrap gap-2">
          {agent.highlights.map((h, i) => (
            <span key={i} className="px-2.5 py-1 bg-bg-sunken text-ink-2 text-xs rounded-md">
              {h}
            </span>
          ))}
          {agent.specialties.slice(0, 2).map((s, i) => (
            <span key={i} className={cn('px-2.5 py-1 text-xs rounded-md', colorConfig.bg, colorConfig.text)}>
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* 底部操作区 */}
      <div className="px-5 py-4 border-t border-line flex items-center justify-between">
        {/* 价格 */}
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-baseline gap-1">
              <Zap className="w-3.5 h-3.5 text-busy" />
              <span className="font-mono font-bold text-ink">{agent.pricing.monthlyCost}</span>
              <span className="text-[10px] text-ink-4">/月</span>
            </div>
            <p className="text-[10px] text-ink-4 mt-0.5">
              单次 {agent.pricing.perTaskCost} 金币起
              {agent.pricing.discount > 0 && (
                <span className="ml-1 text-active">-{agent.pricing.discount}%</span>
              )}
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Link
            href={`/market/${agent.id}`}
            className="px-4 py-2 text-sm text-ink-2 hover:text-ink bg-bg-sunken hover:bg-bg-hover rounded-lg transition-colors"
          >
            查看档案
          </Link>
          {isHired ? (
            <Link
              href="/"
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                colorConfig.main
              )}
            >
              @ ta
            </Link>
          ) : (
            <button 
              onClick={onHire}
              className="px-4 py-2 text-sm font-medium bg-ink text-white rounded-lg hover:bg-ink-2 transition-colors"
            >
              招募
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
