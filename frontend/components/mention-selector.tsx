'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { AGENT_MARKET_PROFILES, ROLE_COLORS, AGENT_RESUMES, AGENT_LEVELS, type RoleId } from '@/lib/types';
import { Zap, Clock, TrendingUp } from 'lucide-react';

interface MentionSelectorProps {
  isOpen: boolean;
  searchQuery: string;
  onSelect: (roleId: RoleId, displayName: string) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

const AGENT_ORDER: RoleId[] = ['chief', 'analyst', 'planner', 'writer', 'distributor', 'monitor', 'coder', 'frontend', 'tester'];

export const ROLE_DISPLAY_NAMES: Record<RoleId, string> = {
  chief: '首席助理',
  analyst: '分析员',
  planner: '策划员',
  writer: '创作员',
  distributor: '播报员',
  monitor: '观测员',
  coder: '代码员',
  frontend: '前端员',
  tester: '测试员',
};

export function MentionSelector({ isOpen, searchQuery, onSelect, onClose, position }: MentionSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 过滤匹配的 Agent
  const filteredAgents = AGENT_ORDER.filter((roleId) => {
    const profile = AGENT_MARKET_PROFILES[roleId];
    const displayName = ROLE_DISPLAY_NAMES[roleId];
    const query = searchQuery.toLowerCase();
    
    return (
      displayName.includes(query) ||
      profile.fullName.toLowerCase().includes(query) ||
      profile.title.toLowerCase().includes(query) ||
      roleId.includes(query)
    );
  });

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredAgents.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredAgents.length) % filteredAgents.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredAgents[selectedIndex]) {
          onSelect(filteredAgents[selectedIndex], ROLE_DISPLAY_NAMES[filteredAgents[selectedIndex]]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredAgents, selectedIndex, onSelect, onClose]);

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  if (!isOpen || filteredAgents.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-bg-panel border border-line rounded-xl shadow-xl overflow-hidden z-50"
      style={position ? { top: position.top, left: position.left } : undefined}
    >
      {/* 头部 */}
      <div className="px-3 py-2 bg-bg-sunken border-b border-line">
        <div className="flex items-center gap-2">
          <span className="text-active font-bold">@</span>
          <span className="text-xs text-ink-3">选择员工</span>
          <span className="text-[10px] text-ink-4 ml-auto">↑↓ 选择 · Enter 确认</span>
        </div>
      </div>

      {/* Agent 列表 */}
      <div className="max-h-80 overflow-y-auto">
        {filteredAgents.map((roleId, index) => {
          const profile = AGENT_MARKET_PROFILES[roleId];
          const resume = AGENT_RESUMES[roleId];
          const levelInfo = AGENT_LEVELS[resume.level];
          const colorConfig = ROLE_COLORS[roleId];
          const isSelected = index === selectedIndex;

          return (
            <div
              key={roleId}
              onClick={() => onSelect(roleId, ROLE_DISPLAY_NAMES[roleId])}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                'flex items-start gap-3 p-3 cursor-pointer transition-colors',
                isSelected ? 'bg-bg-hover' : 'hover:bg-bg-sunken/50'
              )}
            >
              {/* 头像 */}
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md">
                  <Image
                    src={profile.avatar}
                    alt={profile.fullName}
                    width={48}
                    height={48}
                    className="object-cover w-full h-full"
                  />
                </div>
                {/* 在线状态 */}
                <div className={cn(
                  'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-bg-panel',
                  profile.availability === 'available' ? 'bg-active' : profile.availability === 'limited' ? 'bg-busy' : 'bg-ink-4'
                )} />
              </div>

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-ink">{ROLE_DISPLAY_NAMES[roleId]}</span>
                  <span className={cn('px-1.5 py-0.5 text-[10px] rounded font-medium', levelInfo.color)}>
                    {levelInfo.name}
                  </span>
                </div>
                <p className="text-xs text-ink-3 truncate mb-1.5">{profile.tagline}</p>
                
                {/* 能力标签 */}
                <div className="flex flex-wrap gap-1">
                  {profile.specialties.slice(0, 3).map((specialty, i) => (
                    <span
                      key={i}
                      className={cn('px-1.5 py-0.5 text-[10px] rounded', colorConfig.light)}
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>

              {/* 快速数据 */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
                <div className="flex items-center gap-1 text-[10px] text-ink-3">
                  <TrendingUp className="w-3 h-3" />
                  <span>{profile.stats.successRate}%</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-ink-3">
                  <Clock className="w-3 h-3" />
                  <span>{profile.stats.responseTime}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-busy">
                  <Zap className="w-3 h-3" />
                  <span>{profile.pricing.perTaskCost} 金币/次</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部提示 */}
      <div className="px-3 py-2 bg-bg-sunken border-t border-line">
        <p className="text-[10px] text-ink-4 text-center">
          直接输入需求也可以，员工会自动协作分工
        </p>
      </div>
    </div>
  );
}

// @ 提及标签组件
export function MentionTag({ roleId, className }: { roleId: RoleId; className?: string }) {
  const profile = AGENT_MARKET_PROFILES[roleId];
  const colorConfig = ROLE_COLORS[roleId];

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium',
      colorConfig.light,
      className
    )}>
      <span className="w-4 h-4 rounded overflow-hidden flex-shrink-0">
        <Image
          src={profile.avatar}
          alt={profile.fullName}
          width={16}
          height={16}
          className="object-cover"
        />
      </span>
      @{ROLE_DISPLAY_NAMES[roleId]}
    </span>
  );
}
