'use client';

import { X, Copy, Archive, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_COLORS, type RoleId } from '@/lib/types';

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'artifact' | 'stage';
  data: {
    kind?: string;
    title: string;
    content: string;
    time?: string;
    energy?: string;
    roleId?: RoleId;
    stage?: number;
  };
}

export function DetailDrawer({ isOpen, onClose, type, data }: DetailDrawerProps) {
  if (!isOpen) return null;

  const role = data.roleId ? ROLES[data.roleId] : null;

  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 z-40 bg-ink/20"
        onClick={onClose}
      />

      {/* 抽屉 */}
      <div className="fixed right-0 top-0 bottom-0 w-[440px] bg-bg-panel border-l border-line z-50 flex flex-col shadow-xl">
        {/* 头部 */}
        <div className="p-4 border-b border-line">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {data.kind && (
                <span className="inline-block px-2 py-0.5 bg-bg-sunken text-ink-3 text-[10px] font-mono rounded mb-2">
                  {data.kind}
                </span>
              )}
              <h2 className="font-serif text-lg font-semibold text-ink">{data.title}</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-bg-hover rounded-md transition-colors"
            >
              <X className="w-4 h-4 text-ink-3" />
            </button>
          </div>

          {/* Meta 信息 */}
          <div className="flex items-center gap-3 mt-3 text-xs text-ink-3">
            {data.time && <span>{data.time}</span>}
            {data.energy && (
              <span className="text-busy font-mono">{data.energy}</span>
            )}
            {role && (
              <span className="flex items-center gap-1">
                <span 
                  className={cn(
                    'w-4 h-4 rounded flex items-center justify-center text-[10px] font-medium',
                    ROLE_COLORS[data.roleId!].main
                  )}
                >
                  {role.initial}
                </span>
                {role.name}
              </span>
            )}
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-6">
          <article className="prose prose-sm max-w-none">
            <div className="font-serif text-ink leading-relaxed whitespace-pre-wrap">
              {data.content}
            </div>
          </article>
        </div>

        {/* 底部操作栏 */}
        <div className="p-4 border-t border-line flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-ink-2 hover:text-ink hover:bg-bg-hover rounded-lg transition-colors">
            <Copy className="w-4 h-4" />
            复制
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-ink-2 hover:text-ink hover:bg-bg-hover rounded-lg transition-colors">
            <Archive className="w-4 h-4" />
            存入成果库
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 text-sm bg-ink text-white rounded-lg hover:bg-ink-2 transition-colors ml-auto">
            <RotateCcw className="w-4 h-4" />
            回到这步
          </button>
        </div>
      </div>
    </>
  );
}
