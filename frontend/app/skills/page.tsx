'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_COLORS, type RoleId } from '@/lib/types';
import { listV1Skills, type V1Skill, type V1CapabilityKey } from '@/lib/api';

// 旧的「员工能力」demo 数据 — 保留作为视觉参考。
// V1 真后端的 skill 在页面最上方单独展示。
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

const CAPABILITY_LABEL: Record<V1CapabilityKey, string> = {
  T: '文字',
  I: '图',
  V: '视频',
  D: '办公文档',
};

const CAPABILITY_COLOR: Record<V1CapabilityKey, string> = {
  T: 'bg-amber-100 text-amber-800',
  I: 'bg-emerald-100 text-emerald-800',
  V: 'bg-pink-100 text-pink-800',
  D: 'bg-cyan-100 text-cyan-800',
};

export default function SkillsPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [v1Skills, setV1Skills] = useState<V1Skill[]>([]);
  const [v1Loading, setV1Loading] = useState(true);
  const [v1Error, setV1Error] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const skills = await listV1Skills();
        if (!cancelled) setV1Skills(skills);
      } catch (e) {
        if (!cancelled) setV1Error(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setV1Loading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const equippedCount = ALL_SKILLS.filter(s => s.equipped.length > 0).length;
  const filteredSkills = ALL_SKILLS.filter(s => {
    if (activeFilter === 'all') return true;
    return s.cat === activeFilter;
  });

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-bg border-b border-line">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-bg-hover rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-ink-3" />
          </Link>
          <div>
            <h1 className="font-serif text-xl font-semibold text-ink">能力库</h1>
            <p className="text-sm text-ink-3">Skill 市场（V1 真后端） + 员工能力 demo</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* ============ V1 Skill 市场（真后端 / mock 兜底） ============ */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-active" />
            <h2 className="font-serif text-lg font-semibold text-ink">
              Skill 市场
            </h2>
            <span className="text-xs text-ink-3">
              · 主编排 agent 会按用户意图自动调用
            </span>
          </div>
          <p className="text-sm text-ink-3 mb-4">
            每个 skill 是一个 workflow，主编排理解你的话之后自动选并派给对应能力 agent
            (T/I/V/D)。你不直接选 skill。
          </p>

          {v1Loading ? (
            <div className="flex items-center gap-2 py-8 text-ink-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">读取 skill 注册表...</span>
            </div>
          ) : v1Error ? (
            <div className="text-sm text-ink-3 py-4">
              读取失败：{v1Error}
            </div>
          ) : v1Skills.length === 0 ? (
            <div className="text-sm text-ink-3 py-4">
              skill 注册表为空。检查 backend/skills/ 目录是否存在 yaml。
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {v1Skills.map((sk) => (
                <V1SkillCard key={sk.id} skill={sk} />
              ))}
            </div>
          )}
        </section>

        {/* ============ 旧的"员工手艺"展示（保留作为视觉参考） ============ */}
        <section className="border-t border-line pt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg font-semibold text-ink">
              员工能力（视觉概念）
            </h2>
            <span className="text-xs text-ink-3">
              {equippedCount}/{ALL_SKILLS.length} 已装备
            </span>
          </div>
          <p className="text-sm text-ink-3 mb-4">
            以下是按"装备给员工"的视觉模型展示能力。真正的能力调度走 V1 主编排（上方 Skill 市场）。
          </p>

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

          <div className="grid grid-cols-3 gap-4">
            {filteredSkills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function V1SkillCard({ skill }: { skill: V1Skill }) {
  const stepCount = skill.steps?.length ?? 0;
  const isRunner = !!skill.runner;
  return (
    <div className="bg-bg-panel border border-line rounded-xl p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-1.5">
        <h3 className="font-serif font-medium text-ink text-sm">{skill.name}</h3>
        <span className="px-1.5 py-0.5 bg-bg-sunken text-ink-3 text-[10px] font-mono rounded">
          {skill.deliverable_type}
        </span>
      </div>
      <p className="font-mono text-[10px] text-ink-4 mb-2">{skill.id}</p>
      <p className="text-[12px] text-ink-3 mb-3 line-clamp-3 min-h-[54px]">
        {skill.description.split('\n')[0] ?? skill.description}
      </p>

      <div className="border-t border-dashed border-line pt-2.5 mb-2 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-ink-4">能力链:</span>
        {skill.steps && skill.steps.length > 0 ? (
          skill.steps.map((s, i) => (
            <span
              key={i}
              className={cn(
                'px-1.5 py-0 text-[10px] font-mono rounded',
                CAPABILITY_COLOR[s.agent]
              )}
              title={s.task}
            >
              {CAPABILITY_LABEL[s.agent] ?? s.agent}
            </span>
          ))
        ) : (
          <span className="text-[10px] text-ink-4 italic">仅由 runner 执行</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-ink-4">
          {isRunner ? 'Python runner' : `${stepCount} 步声明式`}
        </span>
        {skill.expected_cost_usd > 0 && (
          <span className="text-[10px] text-ink-3 font-mono">
            ≈ ${skill.expected_cost_usd.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

function SkillCard({ skill }: { skill: typeof ALL_SKILLS[0] }) {
  return (
    <div className="bg-bg-panel border border-line rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-serif font-medium text-ink text-sm">{skill.name}</h3>
        <span className="px-1.5 py-0.5 bg-busy/10 text-busy text-[10px] font-mono rounded">
          {skill.energy}
        </span>
      </div>

      <p className="font-serif text-[11px] text-ink-3 min-h-[38px] mb-3">
        {skill.desc}
      </p>

      <div className="border-t border-dashed border-line pt-3 mb-3 flex items-center justify-between">
        <span className="text-[10px] text-ink-4">底层模型</span>
        <span className="px-2 py-0.5 bg-bg-sunken text-ink-3 text-[10px] rounded">
          {skill.model}
        </span>
      </div>

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
