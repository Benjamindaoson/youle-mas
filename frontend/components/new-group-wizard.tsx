'use client';

import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_COLORS, type RoleId } from '@/lib/types';
import { useAppStore } from '@/lib/store';

interface NewGroupWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMOJI_OPTIONS = ['📍', '☕', '💼', '🚀', '📊', '💡', '🎯', '🔥', '📚', '🎨'];

export function NewGroupWizard({ isOpen, onClose }: NewGroupWizardProps) {
  const [step, setStep] = useState(1);
  const [groupName, setGroupName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('&#128205;');
  const [selectedMembers, setSelectedMembers] = useState<RoleId[]>([]);
  const { createGroup } = useAppStore();

  if (!isOpen) return null;

  const handleCreate = () => {
    if (groupName.trim()) {
      createGroup(groupName.trim(), selectedEmoji, selectedMembers);
    }
    onClose();
    setStep(1);
    setGroupName('');
    setSelectedEmoji('&#128205;');
    setSelectedMembers([]);
  };

  const toggleMember = (id: RoleId) => {
    setSelectedMembers(prev => 
      prev.includes(id) 
        ? prev.filter(m => m !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 弹窗 */}
      <div className="relative w-[560px] bg-bg-panel rounded-2xl shadow-xl">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <div>
            <h2 className="font-serif font-semibold text-ink">新建工作群</h2>
            <p className="text-xs text-ink-3 mt-0.5">
              第 {step} 步 / 共 2 步 · {step === 1 ? '给这个群起个名' : '挑选入群的 AI 员工'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-ink-3" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6">
          {step === 1 ? (
            <div className="space-y-4">
              {/* 群名输入 */}
              <div>
                <label className="text-sm text-ink-2 mb-2 block">群名称</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="比如：5 月新品上市"
                  className="w-full px-4 py-2.5 bg-bg-sunken border border-line rounded-lg text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-ink-4 transition-colors"
                />
              </div>

              {/* Emoji 选择 */}
              <div>
                <label className="text-sm text-ink-2 mb-2 block">选择图标</label>
                <div className="flex gap-2 flex-wrap">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setSelectedEmoji(emoji)}
                      className={cn(
                        'w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all',
                        selectedEmoji === emoji 
                          ? 'bg-bg-sunken border-2 border-ink' 
                          : 'bg-bg-sunken border border-line hover:border-ink-4'
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="text-sm text-ink-2 block">选哪些岗位进群？（可多选）</label>
              
              <div className="space-y-2">
                {Object.values(ROLES).map((employee) => {
                  const isSelected = selectedMembers.includes(employee.id);
                  const colorConfig = ROLE_COLORS[employee.id];

                  return (
                    <button
                      key={employee.id}
                      onClick={() => toggleMember(employee.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                        isSelected ? 'bg-bg-sunken' : 'bg-bg-panel hover:bg-bg-hover'
                      )}
                    >
                      {/* 头像 */}
                      <div className={cn(
                        'w-[26px] h-[26px] rounded-md flex items-center justify-center text-xs font-medium',
                        colorConfig.main
                      )}>
                        {employee.initial}
                      </div>

                      {/* 信息 */}
                      <div className="flex-1">
                        <span className="text-sm font-medium text-ink">{employee.name}</span>
                        <p className="text-xs text-ink-3">{employee.role}</p>
                      </div>

                      {/* 选中框 */}
                      <div className={cn(
                        'w-5 h-5 rounded flex items-center justify-center transition-colors',
                        isSelected ? 'bg-ink' : 'border border-line-2'
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between p-4 border-t border-line">
          {step === 1 ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-ink-3 hover:text-ink transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!groupName.trim()}
                className={cn(
                  'px-4 py-2 text-sm rounded-lg transition-colors',
                  groupName.trim() 
                    ? 'bg-ink text-white hover:bg-ink-2' 
                    : 'bg-bg-sunken text-ink-4 cursor-not-allowed'
                )}
              >
                下一步 →
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm text-ink-3 hover:text-ink transition-colors"
              >
                ← 上一步
              </button>
              <button
                onClick={handleCreate}
                disabled={selectedMembers.length === 0}
                className={cn(
                  'px-4 py-2 text-sm rounded-lg transition-colors',
                  selectedMembers.length > 0 
                    ? 'bg-ink text-white hover:bg-ink-2' 
                    : 'bg-bg-sunken text-ink-4 cursor-not-allowed'
                )}
              >
                创建群
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
