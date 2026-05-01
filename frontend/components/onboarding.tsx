'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Sparkles, ArrowRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AGENT_MARKET_PROFILES, type RoleId } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface OnboardingProps {
  onComplete: () => void;
}

const AGENT_ORDER: RoleId[] = ['analyst', 'planner', 'writer', 'distributor', 'monitor'];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const handleStart = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 500);
  };

  if (!isVisible) return null;

  return (
    <div className={cn(
      'fixed inset-0 z-50 flex items-center justify-center transition-all duration-500',
      isExiting ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
    )}>
      {/* 背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink-2 to-ink" />
      
      {/* 装饰性光效 */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-active/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-busy/20 rounded-full blur-3xl" />
      
      {/* 内容 */}
      <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
        {/* Logo */}
        <div className="mb-8 inline-flex items-center justify-center">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center border border-white/20 shadow-2xl">
            <span className="text-4xl font-bold text-white font-serif">有</span>
          </div>
        </div>

        {/* 主标题 */}
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight">
          <span className="text-active">@</span>一下，你就有了
        </h1>
        
        {/* 副标题 */}
        <p className="text-xl md:text-2xl text-white/80 mb-12 leading-relaxed">
          我是您的专属AI团队，为您做专业的工作，为您赚钱!
        </p>

        {/* 团队头像展示 */}
        <div className="flex justify-center items-center mb-12">
          <div className="relative flex items-center">
            {AGENT_ORDER.map((roleId, i) => {
              const profile = AGENT_MARKET_PROFILES[roleId];
              return (
                <div
                  key={roleId}
                  className={cn(
                    'relative w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden border-4 border-ink shadow-2xl transition-all duration-500 hover:scale-110 hover:z-10',
                    i > 0 && '-ml-4'
                  )}
                  style={{ 
                    zIndex: 5 - i,
                    animationDelay: `${i * 100}ms`,
                  }}
                >
                  <Image
                    src={profile.avatar}
                    alt={profile.fullName}
                    fill
                    className="object-cover"
                  />
                  {/* 呼吸光效 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
              );
            })}
            
            {/* 连接动效 */}
            <div className="absolute -inset-4 rounded-3xl border border-white/10 -z-10" />
          </div>
        </div>

        {/* 能力标签 */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {['分析洞察', '策略规划', '内容创作', '多平台分发', '数据监测'].map((tag, i) => (
            <span 
              key={i}
              className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm text-white/80 border border-white/10"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTA 按钮 */}
        <Button
          onClick={handleStart}
          size="lg"
          className="h-14 px-10 bg-white text-ink hover:bg-white/90 rounded-2xl text-lg font-semibold shadow-2xl hover:shadow-white/20 transition-all duration-300 hover:scale-105"
        >
          开始使用
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>

        {/* 底部说明 */}
        <p className="mt-8 text-sm text-white/40 flex items-center justify-center gap-2">
          <Zap className="w-4 h-4" />
          首次赠送 1,284 金币，立即体验
        </p>
      </div>
    </div>
  );
}

// 空状态组件 - 保留给新建群使用
export function EmptyState({ groupName, onSuggestionClick }: { groupName: string; onSuggestionClick?: (text: string) => void }) {
  const suggestions = [
    { text: '帮我做一条小红书爆款', icon: '🔥' },
    { text: '@分析员 调研一下竞品', icon: '🔍' },
    { text: '策划一个新品发布方案', icon: '📋' },
    { text: '写一篇公众号文章', icon: '✍️' },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 bg-bg-sunken rounded-3xl flex items-center justify-center mb-6">
        <Sparkles className="w-10 h-10 text-ink-4" />
      </div>
      <h3 className="text-lg font-medium text-ink mb-2">
        {groupName} 已准备就绪
      </h3>
      <p className="text-sm text-ink-3 mb-6 max-w-sm">
        你的 5 位 AI 员工正待命中。说出你的需求，或者试试下面的快捷指令：
      </p>
      
      <div className="grid grid-cols-2 gap-2 w-full max-w-md">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSuggestionClick?.(s.text)}
            className="flex items-center gap-2 p-3 bg-bg-panel hover:bg-bg-hover border border-line rounded-xl text-left transition-colors group"
          >
            <span className="text-lg">{s.icon}</span>
            <span className="text-sm text-ink truncate group-hover:text-active transition-colors">{s.text}</span>
          </button>
        ))}
      </div>
      
      {/* 团队头像 */}
      <div className="mt-8 flex items-center gap-3">
        <div className="flex -space-x-2">
          {AGENT_ORDER.map((roleId) => {
            const profile = AGENT_MARKET_PROFILES[roleId];
            return (
              <div
                key={roleId}
                className="w-8 h-8 rounded-full overflow-hidden border-2 border-bg-panel"
              >
                <Image
                  src={profile.avatar}
                  alt={profile.fullName}
                  width={32}
                  height={32}
                  className="object-cover"
                />
              </div>
            );
          })}
        </div>
        <span className="text-xs text-ink-3">5 位员工待命中</span>
      </div>
    </div>
  );
}

// 首次访问检测 Hook
export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('youle_onboarding_complete');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('youle_onboarding_complete', 'true');
    setShowOnboarding(false);
  };

  return { showOnboarding, completeOnboarding };
}
