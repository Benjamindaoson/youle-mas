'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_COLORS, type RoleId } from '@/lib/types';

// 手艺数据
const ALL_SKILLS = [
  // 文本(5)
  {id:'s1', cat:'text', name:'文案写作', desc:'短平快的社媒文案 / 广告语 / 标题', model:'deepseek', energy:'3⚡', equipped:['writer'] as RoleId[]},
  {id:'s2', cat:'text', name:'长文写作', desc:'千字以上的深度文章 / 公众号长文', model:'claude', energy:'8⚡', equipped:['writer'] as RoleId[]},
  {id:'s3', cat:'text', name:'视频脚本', desc:'口播 / 分镜 / 字幕稿', model:'claude', energy:'6⚡', equipped:['writer'] as RoleId[]},
  {id:'s4', cat:'text', name:'邮件起草', desc:'商务邮件 / 客户沟通', model:'claude', energy:'3⚡', equipped:[] as RoleId[]},
  {id:'s5', cat:'text', name:'报告撰写', desc:'结构化分析报告 / 调研报告', model:'claude', energy:'8⚡', equipped:['analyst'] as RoleId[]},
  // 视觉(3)
  {id:'s6', cat:'visual', name:'封面设计', desc:'小红书 / 公众号封面 / 社交图', model:'gpt-image', energy:'15⚡', equipped:['writer'] as RoleId[]},
  {id:'s7', cat:'visual', name:'图表制作', desc:'数据可视化图表 / 信息图', model:'gpt-image', energy:'15⚡', equipped:['analyst'] as RoleId[]},
  {id:'s8', cat:'visual', name:'海报设计', desc:'活动海报 / 宣传图', model:'gpt-image', energy:'20⚡', equipped:[] as RoleId[]},
  // 视频(2)
  {id:'s9', cat:'video', name:'短视频生成', desc:'15 秒 AI 视频 · 每日限 3 次', model:'seedance', energy:'100⚡', equipped:['writer'] as RoleId[]},
  {id:'s10', cat:'video', name:'视频脚本转分镜', desc:'文字脚本自动转分镜表', model:'claude', energy:'6⚡', equipped:[] as RoleId[]},
  // 办公(3)
  {id:'s11', cat:'office', name:'PPT 生成', desc:'结构化 PPT 草稿 · 多模板', model:'kimi', energy:'20⚡', equipped:['planner'] as RoleId[]},
  {id:'s12', cat:'office', name:'Excel 分析', desc:'表格数据拆解 / 透视表生成', model:'claude', energy:'8⚡', equipped:[] as RoleId[]},
  {id:'s13', cat:'office', name:'思维导图', desc:'方案框架可视化', model:'kimi', energy:'4⚡', equipped:['planner'] as RoleId[]},
  // 监测(2)
  {id:'s14', cat:'monitor', name:'关键词监测', desc:'多平台实时监测指定关键词', model:'deepseek', energy:'1⚡/天', equipped:['monitor'] as RoleId[]},
  {id:'s15', cat:'monitor', name:'舆情追踪', desc:'事件舆情走势 / 情绪分析', model:'deepseek', energy:'5⚡', equipped:['monitor'] as RoleId[]},
  // 协作(2)
  {id:'s16', cat:'collab', name:'多平台适配', desc:'一份内容适配小红书/公众号/朋友圈', model:'claude', energy:'4⚡', equipped:['distributor'] as RoleId[]},
  {id:'s17', cat:'collab', name:'发布包打包', desc:'文案+封面+标签一键打包', model:'claude', energy:'3⚡', equipped:['distributor'] as RoleId[]},
];

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'text', label: '文本' },
  { id: 'visual', label: '视觉' },
  { id: 'video', label: '视频' },
  { id: 'office', label: '办公' },
  { id: 'monitor', label: '监测' },
  { id: 'collab', label: '协作' },
];

export default function SkillsPage() {
  const [activeFilter, setActiveFilter] = useState('all');

  const equippedCount = ALL_SKILLS.filter(s => s.equipped.length > 0).length;
  const filteredSkills = ALL_SKILLS.filter(s => {
    if (activeFilter === 'all') return true;
    return s.cat === activeFilter;
  });

  return (
    <div className="min-h-screen bg-bg">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 bg-bg border-b border-line">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-bg-hover rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-ink-3" />
          </Link>
          <div>
            <h1 className="font-serif text-xl font-semibold text-ink">能力库</h1>
            <p className="text-sm text-ink-3">所有手艺一览 · 装备给合适的员工</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Hero 区 + 统计 */}
        <div className="bg-gradient-to-br from-bg-sunken to-bg-hover rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-ink mb-2">
                团队的能力武器库
              </h2>
              <p className="font-serif italic text-ink-2 text-sm">
                给员工装备合适的手艺，让 ta 们更强大
              </p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <span className="font-serif text-2xl font-semibold text-ink">{ALL_SKILLS.length}</span>
                <p className="text-xs text-ink-3 mt-0.5">项手艺</p>
              </div>
              <div className="text-center">
                <span className="font-serif text-2xl font-semibold text-ink">{equippedCount}</span>
                <p className="text-xs text-ink-3 mt-0.5">已装备</p>
              </div>
            </div>
          </div>
        </div>

        {/* 筛选条 */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                'px-4 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors',
                activeFilter === filter.id
                  ? 'bg-ink text-white'
                  : 'bg-bg-sunken text-ink-2 hover:bg-bg-hover'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* 手艺卡片网格 */}
        <div className="grid grid-cols-3 gap-4">
          {filteredSkills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      </main>
    </div>
  );
}

function SkillCard({ skill }: { skill: typeof ALL_SKILLS[0] }) {
  return (
    <div className="bg-bg-panel border border-line rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
      {/* 顶部 */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-serif font-medium text-ink text-sm">{skill.name}</h3>
        <span className="px-1.5 py-0.5 bg-busy/10 text-busy text-[10px] font-mono rounded">
          {skill.energy}
        </span>
      </div>

      {/* 描述 */}
      <p className="font-serif text-[11px] text-ink-3 min-h-[38px] mb-3">
        {skill.desc}
      </p>

      {/* 底层模型 */}
      <div className="border-t border-dashed border-line pt-3 mb-3 flex items-center justify-between">
        <span className="text-[10px] text-ink-4">底层模型</span>
        <span className="px-2 py-0.5 bg-bg-sunken text-ink-3 text-[10px] rounded">
          {skill.model}
        </span>
      </div>

      {/* 已装备区 */}
      <div className="mb-3">
        {skill.equipped.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ink-4">已装备给</span>
            <div className="flex -space-x-1">
              {skill.equipped.map((roleId) => {
                const role = ROLES[roleId];
                const colorConfig = ROLE_COLORS[roleId];
                return (
                  <div
                    key={roleId}
                    className={cn(
                      'w-[18px] h-[18px] rounded flex items-center justify-center text-[10px] font-medium border border-bg-panel',
                      colorConfig.main
                    )}
                    title={role.name}
                  >
                    {role.initial}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <span className="font-serif italic text-[10px] text-ink-4">暂无员工装备</span>
        )}
      </div>

      {/* 按钮 */}
      <div className="flex gap-2">
        <button className="flex-1 py-1.5 text-xs text-ink-3 hover:text-ink transition-colors">
          详情
        </button>
        <button className="flex-1 py-1.5 text-xs bg-ink text-white rounded hover:bg-ink-2 transition-colors">
          装备给 ta
        </button>
      </div>
    </div>
  );
}
