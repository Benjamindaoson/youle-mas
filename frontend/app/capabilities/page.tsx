'use client';

import { useState } from 'react';
import { ArrowLeft, Zap, Search, Cpu, Sparkles, ImageIcon, Video, Globe, Wrench, BarChart3, PenTool, CheckCircle, Clock, Lock, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { AGENT_MARKET_PROFILES, AGENT_CONFIGS, CAPABILITY_NAMES, MVP_CAPABILITIES, type RoleId, type CapabilityType } from '@/lib/types';

// 能力分类
const CAPABILITY_CATEGORIES = [
  { id: 'all', name: '全部能力', icon: Sparkles },
  { id: 'text', name: '文本处理', icon: PenTool },
  { id: 'data', name: '数据分析', icon: BarChart3 },
  { id: 'media', name: '多媒体', icon: ImageIcon },
  { id: 'tool', name: '工具集成', icon: Wrench },
];

// 能力详情数据
const CAPABILITIES_DATA: {
  id: CapabilityType;
  name: string;
  icon: typeof Cpu;
  description: string;
  useCases: string[];
  agents: RoleId[];
  models: { name: string; provider: string; isPrimary?: boolean }[];
  stats: { label: string; value: string }[];
  category: string;
}[] = [
  {
    id: 'copywriting',
    name: '文案创作',
    icon: PenTool,
    description: '生成各类营销文案、社媒内容、长文章，支持多种风格和调性切换。',
    useCases: ['小红书笔记', '公众号文章', '朋友圈文案', '广告语', '产品描述'],
    agents: ['writer', 'planner'],
    models: [
      { name: 'Claude 4 Sonnet', provider: 'Anthropic', isPrimary: true },
      { name: 'GPT-4o', provider: 'OpenAI' },
    ],
    stats: [
      { label: '日均生成', value: '1.2万篇' },
      { label: '满意度', value: '94%' },
    ],
    category: 'text',
  },
  {
    id: 'reasoning',
    name: '推理分析',
    icon: Cpu,
    description: '深度逻辑推理、复杂问题拆解、策略规划和方案设计。',
    useCases: ['战略规划', 'OKR制定', '问题诊断', '决策建议', '方案评估'],
    agents: ['planner', 'analyst'],
    models: [
      { name: 'Claude 4 Sonnet', provider: 'Anthropic', isPrimary: true },
      { name: 'GPT-4o', provider: 'OpenAI' },
    ],
    stats: [
      { label: '方案采纳率', value: '96%' },
      { label: '平均响应', value: '< 45秒' },
    ],
    category: 'text',
  },
  {
    id: 'search',
    name: '联网搜索',
    icon: Globe,
    description: '实时搜索互联网信息，获取最新资讯、数据和趋势。',
    useCases: ['竞品监测', '行业动态', '热点追踪', '信息核实', '资料查找'],
    agents: ['analyst', 'monitor'],
    models: [
      { name: 'GPT-4o + Serper', provider: 'OpenAI', isPrimary: true },
    ],
    stats: [
      { label: '数据源', value: '100+' },
      { label: '更新频率', value: '实时' },
    ],
    category: 'data',
  },
  {
    id: 'data-analysis',
    name: '数据分析',
    icon: BarChart3,
    description: '处理和分析数据，生成可视化图表和洞察报告。',
    useCases: ['数据报告', '趋势分析', '用户画像', '效果复盘', '预测建模'],
    agents: ['analyst', 'monitor'],
    models: [
      { name: 'Claude 4 Sonnet', provider: 'Anthropic', isPrimary: true },
      { name: 'GPT-4o', provider: 'OpenAI' },
    ],
    stats: [
      { label: '图表类型', value: '20+' },
      { label: '准确率', value: '94%' },
    ],
    category: 'data',
  },
  {
    id: 'image-gen',
    name: '图片生成',
    icon: ImageIcon,
    description: '根据文字描述生成高质量图片，支持多种艺术风格。',
    useCases: ['封面设计', '配图生成', '产品图', '创意海报', '社媒素材'],
    agents: ['writer'],
    models: [
      { name: 'Midjourney v6.1', provider: 'Midjourney', isPrimary: true },
      { name: 'DALL-E 3', provider: 'OpenAI' },
      { name: 'Ideogram v2', provider: 'Ideogram' },
    ],
    stats: [
      { label: '生成速度', value: '< 30秒' },
      { label: '分辨率', value: '4K' },
    ],
    category: 'media',
  },
  {
    id: 'video-gen',
    name: '视频生成',
    icon: Video,
    description: '根据脚本自动生成短视频，包括画面、字幕和配音。',
    useCases: ['短视频', '产品演示', '广告片', '教程视频', '口播视频'],
    agents: ['writer'],
    models: [
      { name: 'Sora', provider: 'OpenAI', isPrimary: true },
      { name: 'Kling v1.5', provider: '快手' },
      { name: 'Runway Gen-3', provider: 'Runway' },
    ],
    stats: [
      { label: '最长时长', value: '60秒' },
      { label: '分辨率', value: '1080p' },
    ],
    category: 'media',
  },
  {
    id: 'tool-use',
    name: '工具调用',
    icon: Wrench,
    description: '自动调用外部工具和 API，完成复杂任务流程。',
    useCases: ['自动化流程', '数据抓取', '定时任务', '系统集成', '批量操作'],
    agents: ['distributor', 'monitor'],
    models: [
      { name: 'GPT-4o', provider: 'OpenAI', isPrimary: true },
    ],
    stats: [
      { label: '支持工具', value: '50+' },
      { label: '成功率', value: '99%' },
    ],
    category: 'tool',
  },
  {
    id: 'platform-api',
    name: '平台直连',
    icon: Globe,
    description: '直接连接小红书、抖音、微信等平台，自动发布和管理内容。',
    useCases: ['一键发布', '多平台同步', '数据回收', '评论管理', '粉丝互动'],
    agents: ['distributor'],
    models: [
      { name: 'GPT-4o + 平台 API', provider: 'OpenAI', isPrimary: true },
    ],
    stats: [
      { label: '支持平台', value: '6个' },
      { label: '发布成功率', value: '99.8%' },
    ],
    category: 'tool',
  },
];

export default function CapabilitiesPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCapability, setSelectedCapability] = useState<typeof CAPABILITIES_DATA[0] | null>(null);

  const filteredCapabilities = CAPABILITIES_DATA.filter(cap => {
    const matchesCategory = activeCategory === 'all' || cap.category === activeCategory;
    const matchesSearch = !searchQuery || 
      cap.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cap.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
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
              <h1 className="font-serif text-xl font-semibold text-ink">能力库</h1>
              <p className="text-sm text-ink-3">Agent 团队的全部能力，一目了然</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero 统计 */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-active/10 to-active/5 rounded-xl p-5 border border-active/20">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-active" />
              <span className="text-xs text-active font-medium">已启用</span>
            </div>
            <p className="text-3xl font-mono font-bold text-ink">5</p>
            <p className="text-xs text-ink-3 mt-1">核心能力运行中</p>
          </div>
          <div className="bg-gradient-to-br from-busy/10 to-busy/5 rounded-xl p-5 border border-busy/20">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-busy" />
              <span className="text-xs text-busy font-medium">内测中</span>
            </div>
            <p className="text-3xl font-mono font-bold text-ink">1</p>
            <p className="text-xs text-ink-3 mt-1">图片生成能力</p>
          </div>
          <div className="bg-gradient-to-br from-ink-4/10 to-ink-4/5 rounded-xl p-5 border border-line">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-5 h-5 text-ink-4" />
              <span className="text-xs text-ink-4 font-medium">即将上线</span>
            </div>
            <p className="text-3xl font-mono font-bold text-ink">2</p>
            <p className="text-xs text-ink-3 mt-1">视频生成、平台直连</p>
          </div>
          <div className="bg-gradient-to-br from-bg-sunken to-bg-hover rounded-xl p-5 border border-line">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-ink-3" />
              <span className="text-xs text-ink-3 font-medium">模型支持</span>
            </div>
            <p className="text-3xl font-mono font-bold text-ink">12</p>
            <p className="text-xs text-ink-3 mt-1">顶尖 AI 模型</p>
          </div>
        </div>

        {/* 搜索和分类 */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-4" />
            <input
              type="text"
              placeholder="搜索能力..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-bg-sunken border border-line rounded-lg text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-active/20"
            />
          </div>
          <div className="flex bg-bg-sunken rounded-lg p-1">
            {CAPABILITY_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors',
                  activeCategory === cat.id
                    ? 'bg-bg-panel text-ink font-medium shadow-sm'
                    : 'text-ink-3 hover:text-ink'
                )}
              >
                <cat.icon className="w-4 h-4" />
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* 能力网格 */}
        <div className="grid grid-cols-2 gap-4">
          {filteredCapabilities.map((cap) => {
            const mvpInfo = MVP_CAPABILITIES[cap.id];
            return (
              <div
                key={cap.id}
                onClick={() => setSelectedCapability(cap)}
                className={cn(
                  'bg-bg-panel border rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg group',
                  mvpInfo?.status === 'active' ? 'border-line hover:border-active/50' :
                  mvpInfo?.status === 'beta' ? 'border-busy/30' :
                  'border-line opacity-75'
                )}
              >
                {/* 头部 */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      mvpInfo?.status === 'active' ? 'bg-active/10 text-active' :
                      mvpInfo?.status === 'beta' ? 'bg-busy/10 text-busy' :
                      'bg-ink-4/10 text-ink-4'
                    )}>
                      <cap.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink">{cap.name}</h3>
                      <span className={cn(
                        'text-[10px] font-medium px-2 py-0.5 rounded-full',
                        mvpInfo?.status === 'active' ? 'bg-active/10 text-active' :
                        mvpInfo?.status === 'beta' ? 'bg-busy/10 text-busy' :
                        'bg-ink-4/10 text-ink-4'
                      )}>
                        {mvpInfo?.status === 'active' ? '已启用' : 
                         mvpInfo?.status === 'beta' ? '内测中' : '即将上线'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-ink-4 group-hover:text-ink transition-colors" />
                </div>

                {/* 描述 */}
                <p className="text-sm text-ink-2 mb-4 line-clamp-2">{cap.description}</p>

                {/* 使用场景标签 */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {cap.useCases.slice(0, 4).map((use, i) => (
                    <span key={i} className="px-2 py-1 bg-bg-sunken text-ink-3 text-xs rounded">
                      {use}
                    </span>
                  ))}
                  {cap.useCases.length > 4 && (
                    <span className="px-2 py-1 text-ink-4 text-xs">
                      +{cap.useCases.length - 4}
                    </span>
                  )}
                </div>

                {/* 底部：Agent 头像和统计 */}
                <div className="flex items-center justify-between pt-3 border-t border-line">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {cap.agents.map((agentId) => {
                        const profile = AGENT_MARKET_PROFILES[agentId];
                        return (
                          <div key={agentId} className="w-7 h-7 rounded-full overflow-hidden border-2 border-bg-panel">
                            <Image
                              src={profile.avatar}
                              alt={profile.fullName}
                              width={28}
                              height={28}
                              className="object-cover"
                            />
                          </div>
                        );
                      })}
                    </div>
                    <span className="text-xs text-ink-4">{cap.agents.length} 位 Agent 可用</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {cap.stats.slice(0, 1).map((stat, i) => (
                      <div key={i} className="text-right">
                        <p className="text-sm font-mono font-semibold text-ink">{stat.value}</p>
                        <p className="text-[10px] text-ink-4">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 模型支持说明 */}
        <div className="mt-12 pt-8 border-t border-line">
          <h3 className="font-serif text-lg font-semibold text-ink mb-4">底层模型支持</h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { name: 'Claude 4 Sonnet', provider: 'Anthropic', desc: '深度推理与中文写作', color: 'bg-analyst' },
              { name: 'GPT-4o', provider: 'OpenAI', desc: '多模态与工具调用', color: 'bg-planner' },
              { name: 'Midjourney v6.1', provider: 'Midjourney', desc: '艺术风格图片生成', color: 'bg-writer' },
              { name: 'Sora', provider: 'OpenAI', desc: '高质量视频生成', color: 'bg-distributor' },
            ].map((model, i) => (
              <div key={i} className="bg-bg-panel border border-line rounded-xl p-4">
                <div className={cn('w-2 h-2 rounded-full mb-3', model.color)} />
                <h4 className="font-mono font-medium text-ink text-sm">{model.name}</h4>
                <p className="text-xs text-ink-4 mt-0.5">{model.provider}</p>
                <p className="text-xs text-ink-3 mt-2">{model.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 能力详情抽屉 - 简化版 */}
      {selectedCapability && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => setSelectedCapability(null)}
          />
          <div className="relative w-[480px] bg-bg border-l border-line overflow-y-auto">
            <div className="sticky top-0 bg-bg border-b border-line px-6 py-4 flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold text-ink">{selectedCapability.name}</h2>
              <button
                onClick={() => setSelectedCapability(null)}
                className="p-2 hover:bg-bg-hover rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-ink-3" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* 图标和状态 */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-active/10 flex items-center justify-center">
                  <selectedCapability.icon className="w-8 h-8 text-active" />
                </div>
                <div>
                  <p className="text-sm text-ink-2">{selectedCapability.description}</p>
                </div>
              </div>

              {/* 统计 */}
              <div className="grid grid-cols-2 gap-3">
                {selectedCapability.stats.map((stat, i) => (
                  <div key={i} className="bg-bg-sunken rounded-lg p-3">
                    <p className="text-lg font-mono font-bold text-ink">{stat.value}</p>
                    <p className="text-xs text-ink-4">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* 使用场景 */}
              <div>
                <h4 className="text-sm font-medium text-ink mb-2">适用场景</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCapability.useCases.map((use, i) => (
                    <span key={i} className="px-3 py-1.5 bg-bg-sunken text-ink-2 text-sm rounded-lg">
                      {use}
                    </span>
                  ))}
                </div>
              </div>

              {/* 模型支持 */}
              <div>
                <h4 className="text-sm font-medium text-ink mb-2">模型支持</h4>
                <div className="space-y-2">
                  {selectedCapability.models.map((model, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                      <div className="flex items-center gap-2">
                        {model.isPrimary && <span className="w-2 h-2 rounded-full bg-active" />}
                        <span className="font-mono text-sm text-ink">{model.name}</span>
                      </div>
                      <span className="text-xs text-ink-4">{model.provider}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 可用 Agent */}
              <div>
                <h4 className="text-sm font-medium text-ink mb-2">可用 Agent</h4>
                <div className="space-y-2">
                  {selectedCapability.agents.map((agentId) => {
                    const profile = AGENT_MARKET_PROFILES[agentId];
                    return (
                      <div key={agentId} className="flex items-center gap-3 p-2 bg-bg-sunken rounded-lg">
                        <div className="w-10 h-10 rounded-full overflow-hidden">
                          <Image
                            src={profile.avatar}
                            alt={profile.fullName}
                            width={40}
                            height={40}
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-ink">{profile.fullName}</p>
                          <p className="text-xs text-ink-4">{profile.title}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
