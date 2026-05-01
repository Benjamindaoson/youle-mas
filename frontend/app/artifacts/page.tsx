'use client';

import { useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_COLORS, type RoleId } from '@/lib/types';
import { toast } from 'sonner';

// 成果数据
const ARTIFACTS = [
  {kind:'文案', emoji:'✍️', cover:'text', title:'咖啡师的第 128 次杯测', preview:'今天烘焙房又忙到凌晨...', by:'writer' as RoleId, date:'今天'},
  {kind:'报告', emoji:'📊', cover:'report', title:'小红书咖啡爆款洞察', preview:'Top 100 笔记 5 点共同特征', by:'analyst' as RoleId, date:'今天'},
  {kind:'方案', emoji:'📋', cover:'report', title:'3 个内容切入角度', preview:'A · 城市里的豆子实验室 · B...', by:'planner' as RoleId, date:'今天'},
  {kind:'发布包', emoji:'📦', cover:'pack', title:'咖啡师 128 次 · 3 平台发布包', preview:'小红书 + 公众号 + 朋友圈', by:'distributor' as RoleId, date:'今天'},
  {kind:'方案', emoji:'📋', cover:'report', title:'Q2 增长计划 · v1', preview:'存活率优先 · Q2 新开 3 店', by:'planner' as RoleId, date:'昨天'},
  {kind:'数据', emoji:'📊', cover:'report', title:'精品咖啡 3 家扩张复盘', preview:'Manner 47 店 · M Stand 12 店...', by:'analyst' as RoleId, date:'昨天'},
  {kind:'文案', emoji:'✍️', cover:'text', title:'朋友圈 3 条 · 新品上架', preview:'这一支豆子，我们等了三个月', by:'writer' as RoleId, date:'昨天'},
  {kind:'预警', emoji:'🚨', cover:'report', title:'竞品云南工坊动态', preview:'6 小时 8.3k 赞 · 5 月或首发', by:'monitor' as RoleId, date:'昨天'},
  {kind:'图片', emoji:'🎨', cover:'image', title:'咖啡师杯测封面图', preview:'白桌面俯拍 · 拉花特写', by:'writer' as RoleId, date:'今天'},
  {kind:'脚本', emoji:'🎬', cover:'video', title:'短视频 · 开店一日', preview:'60 秒 · 12 个分镜', by:'writer' as RoleId, date:'周一'},
  {kind:'PPT', emoji:'📽', cover:'ppt', title:'融资 BP · v1', preview:'12 页 · 含财务模型', by:'planner' as RoleId, date:'周一'},
  {kind:'整理', emoji:'📄', cover:'text', title:'用户访谈 230 条归纳', preview:'8 个关键诉求 · 分人群分析', by:'analyst' as RoleId, date:'周一'},
  {kind:'发布包', emoji:'📦', cover:'pack', title:'上周周报发布包', preview:'3 平台同步 · 附封面', by:'distributor' as RoleId, date:'上周'},
  {kind:'文案', emoji:'✍️', cover:'text', title:'品牌故事重写 v2', preview:'从一颗豆子开始...', by:'writer' as RoleId, date:'上周'},
  {kind:'报告', emoji:'📊', cover:'report', title:'上周数据周报', preview:'3 平台综合 · 粉丝 +412', by:'monitor' as RoleId, date:'上周'},
  {kind:'方案', emoji:'📋', cover:'report', title:'新品上架节奏方案', preview:'预热 · 首发 · 回访三阶段', by:'planner' as RoleId, date:'上周'},
];

const KIND_FILTERS = ['全部', '文案', '图片', '视频脚本', 'PPT', '报告', '方案', '发布包'];
const ROLE_FILTERS = [
  { id: 'all', label: '全员' },
  { id: 'analyst', label: '分析员', count: 4 },
  { id: 'planner', label: '策划员', count: 4 },
  { id: 'writer', label: '创作员', count: 5 },
  { id: 'distributor', label: '传播员', count: 2 },
  { id: 'monitor', label: '监测员', count: 2 },
];

// 封面渐变色
const COVER_COLORS: Record<string, string> = {
  text: 'from-amber-50 to-amber-100',
  report: 'from-slate-100 to-slate-200',
  image: 'from-emerald-50 to-emerald-100',
  video: 'from-pink-50 to-pink-100',
  ppt: 'from-cyan-50 to-cyan-100',
  pack: 'from-orange-50 to-orange-100',
};

export default function ArtifactsPage() {
  const [kindFilter, setKindFilter] = useState('全部');
  const [roleFilter, setRoleFilter] = useState('all');

  const hasFilter = kindFilter !== '全部' || roleFilter !== 'all';

  const filteredArtifacts = ARTIFACTS.filter(a => {
    const kindMatch = kindFilter === '全部' || a.kind === kindFilter || 
      (kindFilter === '视频脚本' && a.kind === '脚本');
    const roleMatch = roleFilter === 'all' || a.by === roleFilter;
    return kindMatch && roleMatch;
  });

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
      {/* 顶部导航 */}
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
        {/* Hero 区 + 统计 */}
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
                <span className="font-serif text-2xl font-semibold text-ink">32</span>
                <p className="text-xs text-ink-3 mt-0.5">份产出</p>
              </div>
              <div className="text-center">
                <span className="font-serif text-2xl font-semibold text-ink">5</span>
                <p className="text-xs text-ink-3 mt-0.5">位员工</p>
              </div>
              <div className="text-center">
                <span className="font-serif text-2xl font-semibold text-ink">14</span>
                <p className="text-xs text-ink-3 mt-0.5">天积累</p>
              </div>
            </div>
          </div>
        </div>

        {/* 双层筛选 */}
        <div className="space-y-3 mb-6">
          {/* 第一行：按类型 */}
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

          {/* 第二行：按员工 */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-4 w-16">按员工</span>
            <div className="flex gap-2 flex-wrap">
              {ROLE_FILTERS.map((filter) => (
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
                  {filter.count && <span className="ml-1 opacity-60">({filter.count})</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 活动状态 */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-ink-2">{filteredArtifacts.length} 份结果</span>
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

        {/* 成果网格 */}
        <div className="grid grid-cols-4 gap-4">
          {filteredArtifacts.map((artifact, index) => (
            <ArtifactCard 
              key={index} 
              artifact={artifact} 
              onClick={handleCardClick}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function ArtifactCard({ 
  artifact, 
  onClick 
}: { 
  artifact: typeof ARTIFACTS[0];
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
      {/* 封面区 */}
      <div className={cn('h-[130px] relative bg-gradient-to-br', coverColor)}>
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl opacity-70 grayscale-[0.3]">
          {artifact.emoji}
        </span>
        {/* 预览条 */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/10 backdrop-blur-sm px-3 py-1.5">
          <p className="font-serif italic text-[9px] text-ink-2 truncate">{artifact.preview}</p>
        </div>
      </div>

      {/* 主体 */}
      <div className="p-3">
        {/* kind chip */}
        <span className="px-1.5 py-0.5 bg-bg-sunken text-ink-3 text-[10px] font-mono rounded">
          {artifact.kind}
        </span>

        {/* 标题 */}
        <h3 className="font-serif font-medium text-ink text-[13px] mt-2 line-clamp-2 min-h-[36px]">
          {artifact.title}
        </h3>

        {/* 底部 */}
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
