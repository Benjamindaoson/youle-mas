'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { AGENT_MARKET_PROFILES, ROLES, ROLE_COLORS, type RoleId } from '@/lib/types';
import { Search, Brain, Sparkles, PenTool, Send, BarChart3, FileSearch, Globe } from 'lucide-react';

// 思考状态类型
export type ThinkingState = 
  | 'thinking'      // 正在思考
  | 'searching'     // 正在搜索
  | 'analyzing'     // 正在分析
  | 'writing'       // 正在写作
  | 'generating'    // 正在生成
  | 'reviewing'     // 正在审核
  | 'preparing';    // 正在准备

// 状态配置
const THINKING_STATES: Record<ThinkingState, {
  icon: typeof Brain;
  text: string;
  color: string;
}> = {
  thinking: { icon: Brain, text: '正在思考...', color: 'text-ink-3' },
  searching: { icon: Globe, text: '正在搜索资料...', color: 'text-active' },
  analyzing: { icon: BarChart3, text: '正在分析数据...', color: 'text-analyst' },
  writing: { icon: PenTool, text: '正在撰写内容...', color: 'text-writer' },
  generating: { icon: Sparkles, text: '正在生成创意...', color: 'text-busy' },
  reviewing: { icon: FileSearch, text: '正在检查质量...', color: 'text-planner' },
  preparing: { icon: Send, text: '正在准备发布...', color: 'text-distributor' },
};

// 根据角色获取默认思考状态
export function getDefaultThinkingState(roleId: RoleId): ThinkingState {
  switch (roleId) {
    case 'analyst': return 'analyzing';
    case 'planner': return 'thinking';
    case 'writer': return 'writing';
    case 'distributor': return 'preparing';
    case 'monitor': return 'searching';
    case 'coder': return 'generating';
    case 'frontend': return 'writing';
    case 'tester': return 'reviewing';
    default: return 'thinking';
  }
}

interface ThinkingIndicatorProps {
  roleId: RoleId;
  state?: ThinkingState;
  detail?: string;
}

export function ThinkingIndicator({ roleId, state, detail }: ThinkingIndicatorProps) {
  const role = ROLES[roleId];
  const profile = AGENT_MARKET_PROFILES[roleId];
  const colorConfig = ROLE_COLORS[roleId];
  const thinkingState = state || getDefaultThinkingState(roleId);
  const stateConfig = THINKING_STATES[thinkingState];
  const Icon = stateConfig.icon;

  // 动态思考文案
  const [dots, setDots] = useState('');
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-2.5 message-in">
      {/* 头像 */}
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm">
          <Image
            src={profile.avatar}
            alt={role.name}
            width={32}
            height={32}
            className="object-cover w-full h-full"
          />
        </div>
      </div>

      {/* 状态气泡 */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-xl rounded-tl-sm',
        colorConfig.light
      )}>
        {/* 状态图标 */}
        <Icon className={cn('w-4 h-4 animate-pulse', stateConfig.color)} />
        
        {/* 状态文字 */}
        <div className="flex flex-col">
          <span className={cn('text-sm', stateConfig.color)}>
            {stateConfig.text.replace('...', dots)}
          </span>
          {detail && (
            <span className="text-[10px] text-ink-4">{detail}</span>
          )}
        </div>
        
        {/* 打字点 */}
        <div className="flex items-center gap-0.5 ml-2">
          <span className="w-1.5 h-1.5 bg-ink-3 rounded-full typing-dot" />
          <span className="w-1.5 h-1.5 bg-ink-3 rounded-full typing-dot" />
          <span className="w-1.5 h-1.5 bg-ink-3 rounded-full typing-dot" />
        </div>
      </div>
    </div>
  );
}

// 多角色协作思考状态
interface CollaborativeThinkingProps {
  agents: { roleId: RoleId; state: ThinkingState; detail?: string }[];
}

export function CollaborativeThinking({ agents }: CollaborativeThinkingProps) {
  return (
    <div className="space-y-3">
      {agents.map((agent, i) => (
        <div key={i} style={{ animationDelay: `${i * 150}ms` }}>
          <ThinkingIndicator
            roleId={agent.roleId}
            state={agent.state}
            detail={agent.detail}
          />
        </div>
      ))}
    </div>
  );
}

// 进度条思考状态
interface ThinkingWithProgressProps {
  roleId: RoleId;
  state: ThinkingState;
  progress: number;
  total?: number;
  detail?: string;
}

export function ThinkingWithProgress({ 
  roleId, 
  state, 
  progress, 
  total = 100,
  detail 
}: ThinkingWithProgressProps) {
  const role = ROLES[roleId];
  const profile = AGENT_MARKET_PROFILES[roleId];
  const colorConfig = ROLE_COLORS[roleId];
  const stateConfig = THINKING_STATES[state];
  const Icon = stateConfig.icon;
  const percentage = Math.round((progress / total) * 100);

  return (
    <div className="flex gap-2.5 message-in">
      {/* 头像 */}
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm">
          <Image
            src={profile.avatar}
            alt={role.name}
            width={32}
            height={32}
            className="object-cover w-full h-full"
          />
        </div>
      </div>

      {/* 状态气泡 */}
      <div className={cn(
        'flex-1 max-w-[300px] px-4 py-3 rounded-xl rounded-tl-sm',
        colorConfig.light
      )}>
        {/* 状态头部 */}
        <div className="flex items-center gap-2 mb-2">
          <Icon className={cn('w-4 h-4', stateConfig.color)} />
          <span className={cn('text-sm', stateConfig.color)}>
            {stateConfig.text.replace('...', '')}
          </span>
          <span className="text-xs text-ink-4 ml-auto">{percentage}%</span>
        </div>
        
        {/* 进度条 */}
        <div className="h-1.5 bg-bg-panel rounded-full overflow-hidden">
          <div 
            className={cn('h-full rounded-full transition-all duration-300', colorConfig.main.replace('text-', 'bg-'))}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        {detail && (
          <p className="text-[10px] text-ink-4 mt-2">{detail}</p>
        )}
      </div>
    </div>
  );
}
