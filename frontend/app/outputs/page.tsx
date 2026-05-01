'use client';

import { useState } from 'react';
import { ArrowLeft, Search, Filter, Download, Share2, Copy, Star, Clock, Eye, FileText, ImageIcon, Video, BarChart3, Calendar, MoreHorizontal, CheckCircle, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { AGENT_MARKET_PROFILES, type RoleId } from '@/lib/types';

// 成果类型
type OutputType = 'article' | 'post' | 'image' | 'report' | 'plan' | 'script';

// 成果数据
type OutputItem = {
  id: string;
  title: string;
  type: OutputType;
  preview: string;
  creator: RoleId;
  createdAt: string;
  starred: boolean;
  views: number;
  status: 'published' | 'draft' | 'archived';
  platform?: string;
  stats?: { likes?: number; comments?: number; shares?: number };
};

// 类型配置
const OUTPUT_TYPES = {
  article: { label: '文章', icon: FileText, color: 'text-analyst bg-analyst/10' },
  post: { label: '帖子', icon: FileText, color: 'text-writer bg-writer/10' },
  image: { label: '图片', icon: ImageIcon, color: 'text-planner bg-planner/10' },
  report: { label: '报告', icon: BarChart3, color: 'text-monitor bg-monitor/10' },
  plan: { label: '方案', icon: Calendar, color: 'text-planner bg-planner/10' },
  script: { label: '脚本', icon: Video, color: 'text-distributor bg-distributor/10' },
};

// 筛选选项
const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'published', label: '已发布' },
  { id: 'draft', label: '草稿' },
  { id: 'starred', label: '已收藏' },
];

// 示例成果数据
const OUTPUTS: OutputItem[] = [
  {
    id: 'o1',
    title: '3个月从0到10万粉：我的小红书涨粉秘籍',
    type: 'post',
    preview: '今天分享一下我是如何在3个月内从0做到10万粉丝的。先说结论：选题比努力更重要...',
    creator: 'writer',
    createdAt: '2024-08-20',
    starred: true,
    views: 2341,
    status: 'published',
    platform: '小红书',
    stats: { likes: 1823, comments: 234, shares: 89 },
  },
  {
    id: 'o2',
    title: 'Q4 市场竞品分析报告',
    type: 'report',
    preview: '本报告分析了5家主要竞品在Q3的市场表现、产品更新、营销策略变化...',
    creator: 'analyst',
    createdAt: '2024-08-18',
    starred: true,
    views: 156,
    status: 'published',
  },
  {
    id: 'o3',
    title: '2024 下半年品牌营销规划',
    type: 'plan',
    preview: '基于上半年复盘和市场趋势，制定下半年三大核心营销方向：1. 内容种草深耕...',
    creator: 'planner',
    createdAt: '2024-08-15',
    starred: false,
    views: 89,
    status: 'published',
  },
  {
    id: 'o4',
    title: '打工人的100种咖啡喝法',
    type: 'script',
    preview: '【开场】画面：清晨的办公室，阳光透过百叶窗洒进来。旁白：作为一个咖啡重度依赖者...',
    creator: 'writer',
    createdAt: '2024-08-12',
    starred: false,
    views: 234,
    status: 'draft',
  },
  {
    id: 'o5',
    title: '用户增长周报 - Week 33',
    type: 'report',
    preview: '本周新增用户2,341人，较上周增长12%。主要增长来源：小红书笔记引流占43%...',
    creator: 'monitor',
    createdAt: '2024-08-19',
    starred: false,
    views: 67,
    status: 'published',
  },
  {
    id: 'o6',
    title: '新品上市 Social 传播方案',
    type: 'plan',
    preview: '围绕新品"云朵拿铁"上市，制定为期2周的社媒传播计划。分三阶段：预热期...',
    creator: 'planner',
    createdAt: '2024-08-10',
    starred: true,
    views: 178,
    status: 'published',
  },
  {
    id: 'o7',
    title: '周五下午的办公室日常｜治愈系',
    type: 'post',
    preview: '有没有一瞬间觉得工作也没那么讨厌？就是周五下午，阳光正好，手边有杯热咖啡...',
    creator: 'writer',
    createdAt: '2024-08-08',
    starred: false,
    views: 1456,
    status: 'published',
    platform: '小红书',
    stats: { likes: 892, comments: 123, shares: 45 },
  },
  {
    id: 'o8',
    title: '抖音短视频脚本 - 咖啡知识科普系列',
    type: 'script',
    preview: '系列主题：「你可能不知道的咖啡冷知识」\n第1集：为什么咖啡喝多了会心慌？...',
    creator: 'writer',
    createdAt: '2024-08-05',
    starred: false,
    views: 89,
    status: 'draft',
  },
];

export default function OutputsPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState(OUTPUTS);

  const filteredItems = items.filter(item => {
    // 筛选条件
    if (activeFilter === 'starred' && !item.starred) return false;
    if (activeFilter === 'published' && item.status !== 'published') return false;
    if (activeFilter === 'draft' && item.status !== 'draft') return false;
    
    // 搜索条件
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return item.title.toLowerCase().includes(query) || 
             item.preview.toLowerCase().includes(query);
    }
    return true;
  });

  const toggleStar = (id: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, starred: !item.starred } : item
    ));
  };

  // 统计数据
  const totalOutputs = items.length;
  const publishedCount = items.filter(i => i.status === 'published').length;
  const totalViews = items.reduce((sum, i) => sum + i.views, 0);
  const starredCount = items.filter(i => i.starred).length;

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
              <h1 className="font-serif text-xl font-semibold text-ink">成果库</h1>
              <p className="text-sm text-ink-3">Agent 团队产出的所有作品，一站式管理</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-bg-panel border border-line rounded-xl p-5">
            <p className="text-3xl font-mono font-bold text-ink">{totalOutputs}</p>
            <p className="text-xs text-ink-3 mt-1">总成果数</p>
          </div>
          <div className="bg-bg-panel border border-line rounded-xl p-5">
            <p className="text-3xl font-mono font-bold text-active">{publishedCount}</p>
            <p className="text-xs text-ink-3 mt-1">已发布</p>
          </div>
          <div className="bg-bg-panel border border-line rounded-xl p-5">
            <p className="text-3xl font-mono font-bold text-ink">{totalViews.toLocaleString()}</p>
            <p className="text-xs text-ink-3 mt-1">总浏览量</p>
          </div>
          <div className="bg-bg-panel border border-line rounded-xl p-5">
            <p className="text-3xl font-mono font-bold text-busy">{starredCount}</p>
            <p className="text-xs text-ink-3 mt-1">已收藏</p>
          </div>
        </div>

        {/* 搜索和筛选 */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-4" />
            <input
              type="text"
              placeholder="搜索成果..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-bg-sunken border border-line rounded-lg text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-active/20"
            />
          </div>
          <div className="flex bg-bg-sunken rounded-lg p-1">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  'px-4 py-2 text-sm rounded-md transition-colors',
                  activeFilter === filter.id
                    ? 'bg-bg-panel text-ink font-medium shadow-sm'
                    : 'text-ink-3 hover:text-ink'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-3 py-2.5 bg-bg-sunken border border-line rounded-lg text-sm text-ink-2 hover:bg-bg-hover transition-colors">
            <Filter className="w-4 h-4" />
            更多筛选
          </button>
        </div>

        {/* 成果列表 */}
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <OutputCard key={item.id} item={item} onToggleStar={toggleStar} />
          ))}
        </div>

        {/* 空状态 */}
        {filteredItems.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto bg-bg-sunken rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-ink-4" />
            </div>
            <p className="text-ink-3 mb-2">没有找到匹配的成果</p>
            <p className="text-sm text-ink-4">尝试调整搜索条件或筛选器</p>
          </div>
        )}
      </main>
    </div>
  );
}

function OutputCard({ item, onToggleStar }: { item: OutputItem; onToggleStar: (id: string) => void }) {
  const typeConfig = OUTPUT_TYPES[item.type];
  const profile = AGENT_MARKET_PROFILES[item.creator];
  const Icon = typeConfig.icon;

  return (
    <div className="bg-bg-panel border border-line rounded-xl p-5 hover:shadow-md transition-all group">
      <div className="flex gap-4">
        {/* 类型图标 */}
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', typeConfig.color)}>
          <Icon className="w-6 h-6" />
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-ink line-clamp-1">{item.title}</h3>
                {item.status === 'draft' && (
                  <span className="px-2 py-0.5 bg-bg-sunken text-ink-4 text-[10px] rounded">草稿</span>
                )}
                {item.platform && (
                  <span className="px-2 py-0.5 bg-active/10 text-active text-[10px] rounded">{item.platform}</span>
                )}
              </div>
              <p className="text-sm text-ink-3 line-clamp-2">{item.preview}</p>
            </div>
          </div>

          {/* 底部信息 */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
            <div className="flex items-center gap-4">
              {/* 创作者 */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full overflow-hidden">
                  <Image
                    src={profile.avatar}
                    alt={profile.fullName}
                    width={24}
                    height={24}
                    className="object-cover"
                  />
                </div>
                <span className="text-xs text-ink-3">{profile.fullName}</span>
              </div>
              
              {/* 时间 */}
              <div className="flex items-center gap-1 text-xs text-ink-4">
                <Clock className="w-3 h-3" />
                {item.createdAt}
              </div>

              {/* 浏览量 */}
              <div className="flex items-center gap-1 text-xs text-ink-4">
                <Eye className="w-3 h-3" />
                {item.views}
              </div>

              {/* 互动数据 */}
              {item.stats && (
                <div className="flex items-center gap-3 text-xs text-ink-4">
                  {item.stats.likes && <span>{item.stats.likes} 赞</span>}
                  {item.stats.comments && <span>{item.stats.comments} 评</span>}
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => onToggleStar(item.id)}
                className="p-2 hover:bg-bg-hover rounded-lg transition-colors"
              >
                <Star className={cn('w-4 h-4', item.starred ? 'text-busy fill-busy' : 'text-ink-4')} />
              </button>
              <button className="p-2 hover:bg-bg-hover rounded-lg transition-colors">
                <Copy className="w-4 h-4 text-ink-4" />
              </button>
              <button className="p-2 hover:bg-bg-hover rounded-lg transition-colors">
                <Share2 className="w-4 h-4 text-ink-4" />
              </button>
              <button className="p-2 hover:bg-bg-hover rounded-lg transition-colors">
                <Download className="w-4 h-4 text-ink-4" />
              </button>
              <button className="p-2 hover:bg-bg-hover rounded-lg transition-colors">
                <MoreHorizontal className="w-4 h-4 text-ink-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
