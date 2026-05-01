'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Share2, Star, Zap, Users, TrendingUp, Clock, CheckCircle2, Award, Briefcase, MessageSquare, Shield, Sparkles, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { 
  ROLES, 
  ROLE_COLORS, 
  AGENT_CONFIGS, 
  AGENT_MARKET_PROFILES,
  AGENT_RESUMES,
  AGENT_LEVELS,
  MODEL_PROVIDER_NAMES, 
  CAPABILITY_NAMES, 
  type RoleId 
} from '@/lib/types';
import { HireCeremony } from '@/components/hire-ceremony';

// 用户已招募的 Agent
const HIRED_AGENTS: RoleId[] = ['chief', 'analyst', 'planner', 'writer', 'distributor', 'coder', 'frontend', 'tester'];

// 评价数据
const REVIEWS: Record<RoleId, { type: string; rating: number; text: string; date: string }[]> = {
  analyst: [
    { type: '创业者', rating: 5, text: '融资前让 ta 帮我做竞品分析，投资人说这是他看过最清晰的。', date: '2024-08' },
    { type: '产品经理', rating: 5, text: '每周一份行业周报，比我自己看的还全面。', date: '2024-07' },
    { type: '运营总监', rating: 4, text: '数据解读很到位，偶尔需要补充一些业务背景。', date: '2024-06' },
    { type: '市场负责人', rating: 5, text: '竞品监测功能太好用了，再也不怕漏掉重要动态。', date: '2024-05' },
  ],
  planner: [
    { type: 'CEO', rating: 5, text: '季度规划让 ta 先出框架，效率提升太多了。', date: '2024-08' },
    { type: '项目经理', rating: 4, text: '方案结构很清晰，细节需要根据实际情况调整。', date: '2024-07' },
    { type: '创始人', rating: 5, text: 'BP 框架帮了大忙，投资人夸逻辑清晰。', date: '2024-06' },
    { type: '运营', rating: 5, text: '活动方案从此不再从零开始写了。', date: '2024-05' },
  ],
  writer: [
    { type: '自媒体人', rating: 5, text: '小红书文案终于不用自己憋了，爆款率提升明显。', date: '2024-08' },
    { type: '品牌主理人', rating: 5, text: '品牌调性把握得很准，像是真的理解我们。', date: '2024-07' },
    { type: '内容运营', rating: 5, text: '日更不再是噩梦，质量还很稳定。', date: '2024-06' },
    { type: '创业者', rating: 4, text: '效率很高，偶尔需要微调一些细节。', date: '2024-05' },
  ],
  distributor: [
    { type: '运营', rating: 5, text: '一篇文章发三个平台，以前要改半天，现在几分钟。', date: '2024-08' },
    { type: '自媒体', rating: 4, text: '格式适配很方便，偶尔小红书标签需要手动调整。', date: '2024-07' },
    { type: '品牌运营', rating: 5, text: '发布包功能太实用了，团队效率翻倍。', date: '2024-06' },
    { type: '内容负责人', rating: 4, text: '基本能满足日常需求，期待更多平台支持。', date: '2024-05' },
  ],
  monitor: [
    { type: 'PR 负责人', rating: 5, text: '舆情预警救了我们好几次，反应速度很快。', date: '2024-08' },
    { type: '品牌总监', rating: 5, text: '竞品动态再也不会漏掉了。', date: '2024-07' },
    { type: '创始人', rating: 4, text: '监测很全面，希望分析能再深入一些。', date: '2024-06' },
    { type: '市场经理', rating: 5, text: '周报自动生成，省了大量整理时间。', date: '2024-05' },
  ],
  chief: [
    { type: '创始人', rating: 5, text: '每天开机第一件事先问她今天该忙啥，比秘书还周到。', date: '2024-09' },
    { type: '团队 leader', rating: 5, text: '她能判断该派给谁，省了我很多反复确认的时间。', date: '2024-08' },
    { type: '自由职业者', rating: 5, text: '一个人也能像一个团队在运转，全靠她编排。', date: '2024-07' },
    { type: '产品经理', rating: 4, text: '周到有余、强势不足，重要决策还是要我拍板。', date: '2024-06' },
  ],
  coder: [
    { type: '技术负责人', rating: 5, text: '架构评审交给他，少了很多后面的坑。', date: '2024-09' },
    { type: '独立开发者', rating: 5, text: '重构工作量估得很准，落地速度也快。', date: '2024-08' },
    { type: '创业者', rating: 4, text: '偶尔选型偏保守，但稳是真稳。', date: '2024-07' },
    { type: '全栈工程师', rating: 5, text: '代码评审像大师兄，能指出我忽略的边界条件。', date: '2024-06' },
  ],
  frontend: [
    { type: '设计师', rating: 5, text: '像素级还原 + 动效不打折，合作起来太省心。', date: '2024-09' },
    { type: '产品经理', rating: 5, text: '组件抽象得漂亮，后续迭代速度起飞。', date: '2024-08' },
    { type: '独立开发者', rating: 4, text: '审美在线，偶尔对可访问性抠得过细。', date: '2024-07' },
    { type: '技术负责人', rating: 5, text: '性能优化做得细致，LCP 降了一大截。', date: '2024-06' },
  ],
  tester: [
    { type: '项目经理', rating: 5, text: '拦 bug 的能力惊人，上线前救了我们很多次。', date: '2024-09' },
    { type: '技术负责人', rating: 5, text: '自动化脚本写得干净，回归时间断崖式下降。', date: '2024-08' },
    { type: '产品经理', rating: 4, text: '边界场景想得全，有时候会问我一些我没想到的问题。', date: '2024-07' },
    { type: '创业者', rating: 5, text: '发版前的风险清单，帮我做决策太有用了。', date: '2024-06' },
  ],
};

// 技能数据
const SKILLS: Record<RoleId, { name: string; energy: string; model: string; locked?: boolean }[]> = {
  analyst: [
    { name: '报告撰写', energy: '8', model: 'Claude 4 Sonnet' },
    { name: '数据可视化', energy: '12', model: 'Claude 4 Sonnet' },
    { name: '联网搜索', energy: '3', model: 'GPT-4o + Serper' },
    { name: '财务建模', energy: '40', model: 'Claude 4 Sonnet', locked: true },
  ],
  planner: [
    { name: 'OKR 制定', energy: '10', model: 'Claude 4 Sonnet' },
    { name: '方案大纲', energy: '8', model: 'Claude 4 Sonnet' },
    { name: '思维导图', energy: '12', model: 'Claude 4 Sonnet' },
    { name: '战略咨询', energy: '50', model: 'Claude 4 Opus', locked: true },
  ],
  writer: [
    { name: '文案写作', energy: '3', model: 'Claude 4 Sonnet' },
    { name: '长文写作', energy: '8', model: 'Claude 4 Sonnet' },
    { name: '视频脚本', energy: '6', model: 'Claude 4 Sonnet' },
    { name: '图片生成', energy: '15', model: 'Midjourney v6.1' },
    { name: '视频生成', energy: '100', model: 'Sora', locked: true },
  ],
  distributor: [
    { name: '格式适配', energy: '5', model: 'GPT-4o' },
    { name: '发布排期', energy: '3', model: 'GPT-4o' },
    { name: '多平台同步', energy: '8', model: 'GPT-4o + API' },
    { name: '小红书直连', energy: '20', model: '小红书 API', locked: true },
  ],
  monitor: [
    { name: '关键词监测', energy: '1/天', model: 'GPT-4o + Webhook' },
    { name: '数据追踪', energy: '5', model: 'GPT-4o' },
    { name: '定时报告', energy: '8', model: 'Claude 4 Sonnet' },
    { name: '舆情分析', energy: '25', model: 'Claude 4 Sonnet', locked: true },
  ],
  chief: [
    { name: '需求诊断', energy: '2', model: 'Claude 4 Sonnet' },
    { name: '任务派发', energy: '3', model: 'Claude 4 Sonnet' },
    { name: '日常问答', energy: '1', model: 'Claude 4 Sonnet' },
    { name: '偏好记忆', energy: '2', model: 'Claude 4 Sonnet' },
  ],
  coder: [
    { name: '架构设计', energy: '15', model: 'Claude 4 Sonnet' },
    { name: '代码重构', energy: '10', model: 'Claude 4 Sonnet' },
    { name: 'API 设计', energy: '8', model: 'Claude 4 Sonnet' },
    { name: '技术评审', energy: '30', model: 'Claude 4 Opus', locked: true },
  ],
  frontend: [
    { name: '组件开发', energy: '8', model: 'Claude 4 Sonnet' },
    { name: '交互动效', energy: '6', model: 'Claude 4 Sonnet' },
    { name: '响应式布局', energy: '5', model: 'Claude 4 Sonnet' },
    { name: '设计系统', energy: '25', model: 'Claude 4 Sonnet', locked: true },
  ],
  tester: [
    { name: '用例设计', energy: '4', model: 'GPT-4o' },
    { name: '自动化脚本', energy: '8', model: 'GPT-4o + Playwright' },
    { name: '回归测试', energy: '3', model: 'GPT-4o' },
    { name: '性能测试', energy: '20', model: 'GPT-4o', locked: true },
  ],
};

// 使用场景
const SCENARIOS: Record<RoleId, { icon: string; name: string; desc: string }[]> = {
  analyst: [
    { icon: 'chart', name: '竞品分析', desc: '快速扫描竞品动态，输出结构化报告' },
    { icon: 'trending', name: '数据解读', desc: '把复杂数据变成可执行的洞察' },
    { icon: 'file', name: '调研总结', desc: '从海量信息中提炼关键发现' },
  ],
  planner: [
    { icon: 'target', name: 'OKR 起草', desc: '从目标拆解到可执行的关键结果' },
    { icon: 'layout', name: '方案框架', desc: '快速搭建逻辑清晰的方案骨架' },
    { icon: 'git-branch', name: '思维导图', desc: '把复杂问题可视化拆解' },
  ],
  writer: [
    { icon: 'edit', name: '社媒文案', desc: '小红书、朋友圈、微博一键生成' },
    { icon: 'file-text', name: '长文写作', desc: '公众号、专栏文章深度创作' },
    { icon: 'video', name: '视频脚本', desc: '口播脚本、分镜稿专业输出' },
  ],
  distributor: [
    { icon: 'share', name: '多平台适配', desc: '一份内容适配多个平台格式' },
    { icon: 'package', name: '发布包', desc: '文案+封面+标签一键打包' },
    { icon: 'calendar', name: '智能排期', desc: '基于流量热力的最佳发布时间' },
  ],
  monitor: [
    { icon: 'search', name: '关键词监测', desc: '多平台实时监测指定关键词' },
    { icon: 'alert', name: '舆情追踪', desc: '事件舆情走势、情绪分析' },
    { icon: 'bar-chart', name: '定时报告', desc: '每日/每周自动生成数据报告' },
  ],
  chief: [
    { icon: 'message-circle', name: '默认接待', desc: '未指名消息第一时间接住' },
    { icon: 'git-branch', name: '协调派发', desc: '听完需求判断该谁来干' },
    { icon: 'book', name: '偏好记账', desc: '记住你的偏好并同步给同事' },
  ],
  coder: [
    { icon: 'layers', name: '架构设计', desc: '从需求到服务划分的技术方案' },
    { icon: 'git-merge', name: '代码重构', desc: '在保留行为的前提下改进代码结构' },
    { icon: 'terminal', name: '接口设计', desc: '清晰稳定的 API 契约' },
  ],
  frontend: [
    { icon: 'monitor', name: '组件开发', desc: 'React/TS 组件库沉淀' },
    { icon: 'zap', name: '交互动效', desc: '像素级还原 + 手感打磨' },
    { icon: 'smartphone', name: '响应式', desc: '多端一致体验' },
  ],
  tester: [
    { icon: 'check-square', name: '用例设计', desc: '边界场景 + 冒烟 + 回归' },
    { icon: 'play', name: '自动化脚本', desc: 'Playwright/Jest 脚本库' },
    { icon: 'alert-triangle', name: '缺陷追踪', desc: '复现路径 + 日志 + 优先级' },
  ],
};

export default function AgentDetailPage() {
  const params = useParams();
  const roleId = params.roleId as RoleId;
  const [showCeremony, setShowCeremony] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'skills' | 'reviews'>('profile');

  const role = ROLES[roleId];
  const profile = AGENT_MARKET_PROFILES[roleId];
  const resume = AGENT_RESUMES[roleId];
  const agentConfig = AGENT_CONFIGS[roleId];
  const colorConfig = ROLE_COLORS[roleId];
  const levelInfo = AGENT_LEVELS[resume.level];
  const isHired = HIRED_AGENTS.includes(roleId);
  const reviews = REVIEWS[roleId];
  const skills = SKILLS[roleId];
  const scenarios = SCENARIOS[roleId];

  if (!role || !profile) {
    return <div className="min-h-screen bg-bg flex items-center justify-center text-ink-3">Agent 不存在</div>;
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 bg-bg/80 backdrop-blur-sm border-b border-line">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/market" className="p-2 hover:bg-bg-hover rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-ink-3" />
            </Link>
            <h1 className="font-serif text-lg font-semibold text-ink">Agent 档案</h1>
          </div>
          <button className="px-3 py-1.5 text-sm text-ink-3 hover:text-ink border border-line rounded-lg hover:bg-bg-hover transition-colors">
            <Share2 className="w-4 h-4 inline mr-1.5" />
            分享
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Hero 区 - 更专业的简历风格 */}
        <div className="relative bg-gradient-to-br from-ink via-ink-2 to-ink rounded-2xl p-8 mb-8 overflow-hidden">
          {/* 背景装饰 */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-active/20 to-transparent rounded-full blur-3xl" />
          
          <div className="relative flex gap-8">
            {/* 大头像 */}
            <div className="relative flex-shrink-0">
              <div className="w-32 h-32 rounded-3xl overflow-hidden shadow-2xl">
                <Image
                  src={profile.avatar}
                  alt={profile.fullName}
                  width={128}
                  height={128}
                  className="object-cover w-full h-full"
                />
              </div>
              {/* 状态标记 */}
              <div className={cn(
                'absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-4 border-ink flex items-center justify-center',
                profile.availability === 'available' ? 'bg-active' : profile.availability === 'limited' ? 'bg-busy' : 'bg-ink-4'
              )}>
                {isHired ? (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                ) : (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
            </div>

            <div className="flex-1">
              {/* 名字和职级 */}
              <div className="flex items-center gap-3 mb-2">
                <h2 className="font-serif text-3xl font-semibold text-white">{profile.fullName}</h2>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <span className={cn('px-2.5 py-1 text-xs rounded font-medium', levelInfo.color)}>
                  {levelInfo.name}
                </span>
                <span className="text-ink-4">{profile.title}</span>
                {isHired && (
                  <span className="px-2.5 py-1 bg-active/20 text-active text-xs rounded font-medium">
                    已在团队
                  </span>
                )}
              </div>
              
              {/* Tagline */}
              <p className="text-lg text-ink-4 mb-4 leading-relaxed">{profile.tagline}</p>
              
              {/* 核心数据 */}
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-busy" />
                  <span className="font-mono font-bold text-white text-lg">{profile.stats.avgRating}</span>
                  <span className="text-xs text-ink-4">评分</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-ink-4" />
                  <span className="font-mono font-bold text-white text-lg">{profile.stats.totalUsers.toLocaleString()}</span>
                  <span className="text-xs text-ink-4">用户</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-ink-4" />
                  <span className="font-mono font-bold text-white text-lg">{profile.stats.successRate}%</span>
                  <span className="text-xs text-ink-4">成功率</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-ink-4" />
                  <span className="font-mono font-bold text-white text-lg">{profile.stats.responseTime}</span>
                  <span className="text-xs text-ink-4">响应</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-1 mb-6 bg-bg-sunken rounded-lg p-1">
          {[
            { id: 'profile', label: '个人简介', icon: Briefcase },
            { id: 'skills', label: '技能手艺', icon: Award },
            { id: 'reviews', label: '用户评价', icon: MessageSquare },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-md transition-colors',
                activeTab === tab.id
                  ? 'bg-bg-panel text-ink font-medium shadow-sm'
                  : 'text-ink-3 hover:text-ink'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
        {activeTab === 'profile' && (
          <div className="space-y-8">
            {/* 自我介绍 */}
            <Section title="关于我">
              <div className="bg-bg-panel border border-line rounded-xl p-6">
                <p className="text-ink-2 leading-relaxed">{profile.bio}</p>
                <div className="mt-4 pt-4 border-t border-line">
                  <p className="font-serif italic text-ink text-lg">&ldquo;{resume.signature}&rdquo;</p>
                </div>
              </div>
            </Section>

            {/* 个人特质 */}
            <Section title="个人特质">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg-panel border border-line rounded-xl p-5">
                  <h4 className="text-xs text-ink-4 mb-3">性格特点</h4>
                  <p className="text-ink font-medium">{resume.personality}</p>
                </div>
                <div className="bg-bg-panel border border-line rounded-xl p-5">
                  <h4 className="text-xs text-ink-4 mb-3">工作风格</h4>
                  <p className="text-ink font-medium">{resume.workStyle}</p>
                </div>
              </div>
              
              {/* 优势和成长空间 */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-active/5 border border-active/20 rounded-xl p-5">
                  <h4 className="text-xs text-active mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    核心优势
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {resume.strengths.map((s, i) => (
                      <span key={i} className="px-2.5 py-1 bg-active/10 text-active text-sm rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-bg-sunken/50 border border-line rounded-xl p-5">
                  <h4 className="text-xs text-ink-4 mb-3">成长空间</h4>
                  <div className="flex flex-wrap gap-2">
                    {resume.growthAreas.map((g, i) => (
                      <span key={i} className="px-2.5 py-1 bg-bg-sunken text-ink-3 text-sm rounded">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* 擅长场景 */}
            <Section title="擅长场景">
              <div className="grid grid-cols-3 gap-4">
                {scenarios.map((s, i) => (
                  <div key={i} className="bg-bg-panel border border-line rounded-xl p-5 hover:border-ink-4 transition-colors">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', colorConfig.bg)}>
                      <span className={cn('text-lg', colorConfig.text)}>{['1', '2', '3'][i]}</span>
                    </div>
                    <h4 className="font-medium text-ink mb-1">{s.name}</h4>
                    <p className="text-xs text-ink-3 leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* 工作成就 */}
            <Section title="工作成就">
              <div className="space-y-3">
                {resume.achievements.map((a, i) => (
                  <div key={i} className="flex items-center gap-4 bg-bg-panel border border-line rounded-xl p-4">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', colorConfig.bg)}>
                      <Award className={cn('w-6 h-6', colorConfig.text)} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-ink">{a.title}</h4>
                      <p className="text-xs text-ink-3 mt-0.5">{a.description}</p>
                    </div>
                    <span className="text-xs text-ink-4">{a.date}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* 认证背书 */}
            <Section title="认证背书">
              <div className="flex flex-wrap gap-3">
                {profile.certifications.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2 bg-bg-panel border border-line rounded-lg">
                    <Shield className="w-4 h-4 text-active" />
                    <span className="text-sm text-ink">{c}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="space-y-8">
            {/* 模型配置 */}
            <Section title="核心模型">
              <div className="grid grid-cols-2 gap-4">
                {/* 主模型 */}
                <div className="bg-bg-panel border-2 border-active rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-active" />
                    <span className="text-xs text-active font-medium">主模型</span>
                  </div>
                  <h4 className="font-mono text-xl font-bold text-ink mb-1">
                    {MODEL_PROVIDER_NAMES[agentConfig.primaryModel.provider]}
                  </h4>
                  <p className="text-sm text-ink-3 mb-3">{agentConfig.primaryModel.model}</p>
                  <p className="text-xs text-ink-4 leading-relaxed">
                    {agentConfig.primaryModel.purpose}
                  </p>
                </div>
                
                {/* 备用模型 */}
                {agentConfig.fallbackModel && (
                  <div className="bg-bg-panel border border-line rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-ink-4" />
                      <span className="text-xs text-ink-4 font-medium">备用模型</span>
                    </div>
                    <h4 className="font-mono text-xl font-bold text-ink mb-1">
                      {MODEL_PROVIDER_NAMES[agentConfig.fallbackModel.provider]}
                    </h4>
                    <p className="text-sm text-ink-3 mb-3">{agentConfig.fallbackModel.model}</p>
                    <p className="text-xs text-ink-4 leading-relaxed">
                      {agentConfig.fallbackModel.purpose}
                    </p>
                  </div>
                )}
              </div>
            </Section>

            {/* 能力清单 */}
            <Section title="能力清单">
              <div className="bg-bg-panel border border-line rounded-xl divide-y divide-line overflow-hidden">
                {agentConfig.capabilities.map((cap) => (
                  <div key={cap.type} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium',
                        cap.status === 'active' ? 'bg-active/10 text-active' :
                        cap.status === 'beta' ? 'bg-busy/10 text-busy' : 'bg-ink-4/10 text-ink-4'
                      )}>
                        {CAPABILITY_NAMES[cap.type].charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">{CAPABILITY_NAMES[cap.type]}</p>
                        {cap.tools && cap.tools.length > 0 && (
                          <p className="text-[10px] text-ink-4 mt-0.5">
                            接入：{cap.tools.slice(0, 2).join('、')}{cap.tools.length > 2 && ` 等 ${cap.tools.length} 个`}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={cn(
                      'px-2.5 py-1 text-xs rounded-full font-medium',
                      cap.status === 'active' && 'bg-active/10 text-active',
                      cap.status === 'beta' && 'bg-busy/10 text-busy',
                      cap.status === 'coming-soon' && 'bg-ink-4/10 text-ink-4'
                    )}>
                      {cap.status === 'active' && '已启用'}
                      {cap.status === 'beta' && '内测中'}
                      {cap.status === 'coming-soon' && '即将上线'}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            {/* 技能手艺 */}
            <Section title="技能手艺" action="可在 AI 学院解锁更多">
              <div className="grid grid-cols-2 gap-4">
                {skills.map((skill) => (
                  <div 
                    key={skill.name} 
                    className={cn(
                      'bg-bg-panel border rounded-xl p-4 transition-all',
                      skill.locked ? 'border-dashed border-line-2 opacity-60' : 'border-line hover:border-ink-4'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-ink">{skill.name}</h4>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-busy" />
                        <span className="font-mono text-sm text-busy">{skill.energy}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-bg-sunken text-ink-3 text-[10px] rounded">
                        {skill.model}
                      </span>
                      {skill.locked && (
                        <span className="text-[10px] text-ink-4">需解锁</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* 定价 */}
            <Section title="服务定价">
              <div className="bg-gradient-to-br from-bg-panel to-bg-sunken border border-line rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-sm text-ink-3 mb-1">月度订阅</p>
                    <div className="flex items-baseline gap-1">
                      <Zap className="w-5 h-5 text-busy" />
                      <span className="font-mono text-4xl font-bold text-ink">{profile.pricing.monthlyCost}</span>
                      <span className="text-ink-3">金币/月</span>
                    </div>
                  </div>
                  {profile.pricing.discount > 0 && (
                    <span className="px-3 py-1.5 bg-active/10 text-active text-sm font-medium rounded-lg">
                      限时 -{profile.pricing.discount}%
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-line">
                  <div className="text-center">
                    <p className="text-xs text-ink-4 mb-1">招募费</p>
                    <p className="font-mono font-semibold text-ink">
                      {profile.pricing.hireCost === 0 ? '免费' : profile.pricing.hireCost}
                    </p>
                  </div>
                  <div className="text-center border-x border-line">
                    <p className="text-xs text-ink-4 mb-1">单次任务</p>
                    <p className="font-mono font-semibold text-ink">{profile.pricing.perTaskCost} 起</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-ink-4 mb-1">试用</p>
                    <p className="font-mono font-semibold text-active">3 次免费</p>
                  </div>
                </div>
              </div>
            </Section>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-8">
            {/* 评分总结 */}
            <div className="bg-bg-panel border border-line rounded-xl p-6">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="font-serif text-5xl font-bold text-ink">{profile.stats.avgRating}</p>
                  <div className="flex justify-center mt-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star 
                        key={i} 
                        className={cn(
                          'w-5 h-5',
                          i <= Math.floor(profile.stats.avgRating) ? 'text-busy fill-busy' : 'text-ink-4'
                        )} 
                      />
                    ))}
                  </div>
                  <p className="text-xs text-ink-3 mt-2">{profile.stats.totalUsers.toLocaleString()} 位用户评价</p>
                </div>
                
                {/* 评分分布 */}
                <div className="flex-1 space-y-2">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = reviews.filter(r => r.rating === rating).length;
                    const percentage = (count / reviews.length) * 100;
                    return (
                      <div key={rating} className="flex items-center gap-2">
                        <span className="text-xs text-ink-3 w-8">{rating} 星</span>
                        <div className="flex-1 h-2 bg-bg-sunken rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-busy rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-ink-4 w-8">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 评价列表 */}
            <Section title="用户评价">
              <div className="space-y-4">
                {reviews.map((review, i) => (
                  <div key={i} className="bg-bg-panel border border-line rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-bg-sunken flex items-center justify-center text-ink-3 font-medium">
                          {review.type.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-ink">{review.type}</p>
                          <p className="text-[10px] text-ink-4">{review.date}</p>
                        </div>
                      </div>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((j) => (
                          <Star 
                            key={j} 
                            className={cn(
                              'w-4 h-4',
                              j <= review.rating ? 'text-busy fill-busy' : 'text-ink-4'
                            )} 
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-ink-2 leading-relaxed">&ldquo;{review.text}&rdquo;</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}
      </main>

      {/* 底部 CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-bg-panel/95 backdrop-blur-sm border-t border-line py-4">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-ink">
              {isHired ? 'Ta 已在你的团队中' : '招募后即可 @ ta 协作'}
            </p>
            <p className="text-xs text-ink-3 mt-0.5">
              {isHired 
                ? `已合作 ${resume.collaborationStats.totalTasks} 次，采纳率 ${resume.collaborationStats.adoptionRate}%`
                : '新用户享 3 次免费试聊'
              }
            </p>
          </div>
          <div className="flex gap-3">
            {isHired ? (
              <>
                <button className="px-4 py-2.5 text-sm text-ink-3 hover:text-ink transition-colors">
                  解除合作
                </button>
                <Link 
                  href="/"
                  className={cn(
                    'px-6 py-2.5 text-sm font-medium rounded-lg transition-colors',
                    colorConfig.main
                  )}
                >
                  回工作台 @ ta
                </Link>
              </>
            ) : (
              <>
                <button className="px-4 py-2.5 text-sm text-ink-3 hover:text-ink border border-line rounded-lg hover:bg-bg-hover transition-colors">
                  免费试聊
                </button>
                <button 
                  onClick={() => setShowCeremony(true)}
                  className="px-6 py-2.5 text-sm font-medium bg-ink text-white rounded-lg hover:bg-ink-2 transition-colors flex items-center gap-2"
                >
                  <span>招募 ta</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 入职仪式 */}
      {showCeremony && (
        <HireCeremony roleId={roleId} onComplete={() => setShowCeremony(false)} />
      )}
    </div>
  );
}

// Section 组件
function Section({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-lg font-semibold text-ink">{title}</h3>
        {action && (
          <Link href="/school" className="text-xs text-ink-3 hover:text-ink transition-colors">
            {action}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
