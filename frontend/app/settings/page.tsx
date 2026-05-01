'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, User, Bell, Shield, Palette, Languages,
  ChevronRight, Moon, Sun, Volume2, VolumeX, LogOut,
  Mail, Phone, Building, Camera, Check, Zap, Crown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AGENT_MARKET_PROFILES, AGENT_RESUMES, AGENT_LEVELS, ROLES, type RoleId } from '@/lib/types';
import { Button } from '@/components/ui/button';

// 模拟用户数据
const USER_PROFILE = {
  name: '王小明',
  email: 'xiaoming@company.com',
  phone: '138****8888',
  company: '有了科技',
  avatar: null,
  plan: 'pro',
  joinDate: '2024-01-10',
};

// 非首席员工按入职顺序展示；首席单独置顶
const REGULAR_AGENTS: RoleId[] = (Object.keys(ROLES) as RoleId[]).filter((id) => id !== 'chief');

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'account' | 'agents' | 'notifications' | 'appearance'>('account');
  const [darkMode, setDarkMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  return (
    <div className="min-h-screen bg-bg">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 bg-bg-panel border-b border-line px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-bg-hover rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-ink-3" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-ink">设置</h1>
              <p className="text-sm text-ink-3">管理你的账户和偏好</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/coins" className="flex items-center gap-1 px-3 py-1.5 bg-bg-sunken rounded-lg hover:bg-bg-hover transition-colors">
              <Zap className="w-4 h-4 text-busy" />
              <span className="text-sm font-medium text-ink">1,284</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* 左侧导航 */}
          <nav className="w-48 flex-shrink-0">
            <ul className="space-y-1">
              {[
                { id: 'account', icon: User, label: '账户信息' },
                { id: 'agents', icon: Building, label: '我的员工' },
                { id: 'notifications', icon: Bell, label: '通知设置' },
                { id: 'appearance', icon: Palette, label: '外观偏好' },
              ].map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveTab(item.id as typeof activeTab)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      activeTab === item.id
                        ? 'bg-ink text-white'
                        : 'text-ink-3 hover:text-ink hover:bg-bg-hover'
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-8 pt-8 border-t border-line">
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-alert hover:bg-alert/10 transition-colors">
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </div>
          </nav>

          {/* 右侧内容 */}
          <div className="flex-1">
            {/* 账户信息 */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div className="bg-bg-panel border border-line rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-ink mb-6">个人资料</h2>
                  
                  {/* 头像 */}
                  <div className="flex items-center gap-6 mb-6 pb-6 border-b border-line">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-2xl bg-ink flex items-center justify-center text-2xl font-bold text-white">
                        {USER_PROFILE.name[0]}
                      </div>
                      <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-active text-white rounded-full flex items-center justify-center shadow-lg">
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-ink">{USER_PROFILE.name}</h3>
                      <p className="text-sm text-ink-3">{USER_PROFILE.company}</p>
                      <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-active/10 text-active text-xs rounded">
                        <Check className="w-3 h-3" />
                        Pro 会员
                      </span>
                    </div>
                  </div>

                  {/* 信息表单 */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-ink-3 mb-1.5">姓名</label>
                        <input
                          type="text"
                          defaultValue={USER_PROFILE.name}
                          className="w-full px-3 py-2 bg-bg-sunken border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-ink-4"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-ink-3 mb-1.5">公司</label>
                        <input
                          type="text"
                          defaultValue={USER_PROFILE.company}
                          className="w-full px-3 py-2 bg-bg-sunken border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-ink-4"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-ink-3 mb-1.5">邮箱</label>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-ink-4" />
                        <input
                          type="email"
                          defaultValue={USER_PROFILE.email}
                          className="flex-1 px-3 py-2 bg-bg-sunken border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-ink-4"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-ink-3 mb-1.5">手机</label>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-ink-4" />
                        <input
                          type="tel"
                          defaultValue={USER_PROFILE.phone}
                          className="flex-1 px-3 py-2 bg-bg-sunken border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-ink-4"
                        />
                      </div>
                    </div>
                  </div>

                  <Button className="mt-6 bg-ink hover:bg-ink-2 text-white">
                    保存更改
                  </Button>
                </div>

                {/* 安全设置 */}
                <div className="bg-bg-panel border border-line rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    安全设置
                  </h2>
                  <div className="space-y-3">
                    <button className="w-full flex items-center justify-between p-3 bg-bg-sunken rounded-lg hover:bg-bg-hover transition-colors">
                      <span className="text-sm text-ink">修改密码</span>
                      <ChevronRight className="w-4 h-4 text-ink-4" />
                    </button>
                    <button className="w-full flex items-center justify-between p-3 bg-bg-sunken rounded-lg hover:bg-bg-hover transition-colors">
                      <span className="text-sm text-ink">两步验证</span>
                      <span className="text-xs text-ink-4">未启用</span>
                    </button>
                    <button className="w-full flex items-center justify-between p-3 bg-bg-sunken rounded-lg hover:bg-bg-hover transition-colors">
                      <span className="text-sm text-ink">登录设备管理</span>
                      <ChevronRight className="w-4 h-4 text-ink-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 我的员工 */}
            {activeTab === 'agents' && (
              <div className="space-y-6">
                {/* 首席助理 · 预置 */}
                <div className="bg-bg-panel border border-line rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-ink mb-2 flex items-center gap-2">
                    <Crown className="w-5 h-5 text-chief" />
                    首席助理
                  </h2>
                  <p className="text-sm text-ink-3 mb-4">预置员工 · 永远在岗，不可解除</p>
                  <ChiefCard />
                </div>

                {/* 其他员工 */}
                <div className="bg-bg-panel border border-line rounded-xl p-6">
                  <div className="flex items-baseline justify-between mb-2">
                    <h2 className="text-lg font-semibold text-ink">已招募的员工</h2>
                    <span className="text-xs text-ink-4 font-mono">{REGULAR_AGENTS.length} 位</span>
                  </div>
                  <p className="text-sm text-ink-3 mb-6">管理你的 AI 团队成员</p>

                  <div className="space-y-3">
                    {REGULAR_AGENTS.map((roleId) => (
                      <AgentRow key={roleId} roleId={roleId} />
                    ))}
                  </div>

                  <Link href="/market">
                    <Button variant="outline" className="w-full mt-4">
                      前往人才市场招募更多
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* 通知设置 */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="bg-bg-panel border border-line rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-ink mb-6">通知偏好</h2>

                  <div className="space-y-4">
                    {[
                      { label: '任务完成通知', description: '当 Agent 完成任务时通知你', enabled: true },
                      { label: '协作消息提醒', description: 'Agent 之间的协作讨论', enabled: true },
                      { label: '金币余额提醒', description: '余额不足时提醒充值', enabled: true },
                      { label: '每日工作摘要', description: '每天 9:00 发送前一天的工作汇总', enabled: false },
                      { label: '周报邮件', description: '每周一发送上周的工作报告', enabled: false },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-3 border-b border-line last:border-0">
                        <div>
                          <p className="text-sm font-medium text-ink">{item.label}</p>
                          <p className="text-xs text-ink-4">{item.description}</p>
                        </div>
                        <button
                          className={cn(
                            'w-11 h-6 rounded-full transition-colors relative',
                            item.enabled ? 'bg-active' : 'bg-ink-4'
                          )}
                        >
                          <span
                            className={cn(
                              'absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow',
                              item.enabled ? 'left-6' : 'left-1'
                            )}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 外观偏好 */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div className="bg-bg-panel border border-line rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-ink mb-6">外观设置</h2>

                  {/* 主题 */}
                  <div className="mb-6">
                    <label className="block text-sm text-ink-3 mb-3">主题模式</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setDarkMode(false)}
                        className={cn(
                          'flex items-center justify-center gap-2 p-4 rounded-xl border transition-colors',
                          !darkMode ? 'border-active bg-active/10' : 'border-line hover:border-ink-4'
                        )}
                      >
                        <Sun className={cn('w-5 h-5', !darkMode ? 'text-active' : 'text-ink-3')} />
                        <span className={cn('text-sm', !darkMode ? 'text-active' : 'text-ink-3')}>浅色</span>
                      </button>
                      <button
                        onClick={() => setDarkMode(true)}
                        className={cn(
                          'flex items-center justify-center gap-2 p-4 rounded-xl border transition-colors',
                          darkMode ? 'border-active bg-active/10' : 'border-line hover:border-ink-4'
                        )}
                      >
                        <Moon className={cn('w-5 h-5', darkMode ? 'text-active' : 'text-ink-3')} />
                        <span className={cn('text-sm', darkMode ? 'text-active' : 'text-ink-3')}>深色</span>
                      </button>
                    </div>
                  </div>

                  {/* 声音 */}
                  <div className="mb-6">
                    <label className="block text-sm text-ink-3 mb-3">声音效果</label>
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className="flex items-center justify-between w-full p-4 bg-bg-sunken rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        {soundEnabled ? (
                          <Volume2 className="w-5 h-5 text-ink" />
                        ) : (
                          <VolumeX className="w-5 h-5 text-ink-4" />
                        )}
                        <span className="text-sm text-ink">消息提示音</span>
                      </div>
                      <span
                        className={cn(
                          'w-11 h-6 rounded-full transition-colors relative',
                          soundEnabled ? 'bg-active' : 'bg-ink-4'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow',
                            soundEnabled ? 'left-6' : 'left-1'
                          )}
                        />
                      </span>
                    </button>
                  </div>

                  {/* 语言 */}
                  <div>
                    <label className="block text-sm text-ink-3 mb-3">语言</label>
                    <div className="flex items-center justify-between p-4 bg-bg-sunken rounded-xl">
                      <div className="flex items-center gap-3">
                        <Languages className="w-5 h-5 text-ink" />
                        <span className="text-sm text-ink">界面语言</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-ink-3">简体中文</span>
                        <ChevronRight className="w-4 h-4 text-ink-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function AgentRow({ roleId }: { roleId: RoleId }) {
  const profile = AGENT_MARKET_PROFILES[roleId];
  const resume = AGENT_RESUMES[roleId];
  const levelInfo = AGENT_LEVELS[resume.level];
  const displayName = profile.fullName.split('·')[0].trim();

  return (
    <div className="flex items-center gap-4 p-4 bg-bg-sunken rounded-xl">
      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-bg-panel">
        <Image
          src={profile.avatar}
          alt={profile.fullName}
          width={48}
          height={48}
          className="object-cover w-full h-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink truncate">{displayName}</span>
          <span className={cn('px-1.5 py-0.5 text-[10px] rounded font-medium flex-shrink-0', levelInfo.color)}>
            {levelInfo.name}
          </span>
        </div>
        <p className="text-xs text-ink-3 truncate">{profile.tagline}</p>
      </div>
      <div className="text-right hidden sm:block">
        <p className="text-sm font-medium text-ink">{resume.collaborationStats.totalTasks} 次</p>
        <p className="text-[10px] text-ink-4">合作任务</p>
      </div>
      <Link
        href={`/market/${roleId}`}
        className="p-2 hover:bg-bg-hover rounded-lg transition-colors"
      >
        <ChevronRight className="w-4 h-4 text-ink-4" />
      </Link>
    </div>
  );
}

function ChiefCard() {
  const profile = AGENT_MARKET_PROFILES.chief;
  const resume = AGENT_RESUMES.chief;
  const displayName = profile.fullName.split('·')[0].trim();

  return (
    <div className="flex items-center gap-4 p-4 bg-chief-light/60 border border-chief/20 rounded-xl">
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-bg-panel">
          <Image
            src={profile.avatar}
            alt={profile.fullName}
            width={48}
            height={48}
            className="object-cover w-full h-full"
          />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-chief flex items-center justify-center shadow">
          <Crown className="w-3 h-3 text-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink truncate">{displayName}</span>
          <span className="px-1.5 py-0.5 text-[10px] rounded font-medium bg-chief text-white flex-shrink-0">
            首席
          </span>
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-bg-panel border border-line text-ink-3 flex-shrink-0">
            预置
          </span>
        </div>
        <p className="text-xs text-ink-3 truncate">{profile.tagline}</p>
      </div>
      <div className="text-right hidden sm:block">
        <p className="text-sm font-medium text-ink">{resume.collaborationStats.totalTasks} 次</p>
        <p className="text-[10px] text-ink-4">接待派发</p>
      </div>
      <Link
        href="/market/chief"
        className="p-2 hover:bg-bg-hover rounded-lg transition-colors"
      >
        <ChevronRight className="w-4 h-4 text-ink-4" />
      </Link>
    </div>
  );
}
