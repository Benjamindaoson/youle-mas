'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import {
  ROLES,
  RESOURCES,
  ROLE_COLORS,
  type RoleId,
  type WorkGroup,
} from '@/lib/types';

interface SidebarProps {
  selectedEmployee: RoleId | null;
  onSelectEmployee: (id: RoleId) => void;
  selectedGroup: string;
  onSelectGroup: (id: string) => void;
  currentPage: string;
  onNavigate: (page: string) => void;
  onNewGroup: () => void;
}

export function Sidebar({
  selectedEmployee,
  onSelectEmployee,
  selectedGroup,
  onSelectGroup,
  currentPage,
  onNavigate,
  onNewGroup,
}: SidebarProps) {
  const { groups } = useAppStore();

  return (
    <aside className="w-60 h-screen bg-bg-sunken flex flex-col border-r border-line overflow-hidden">
      {/* Logo */}
      <div className="p-4 flex items-center gap-2">
        <div className="w-7 h-7 bg-ink rounded-md flex items-center justify-center">
          <span className="text-white font-serif text-sm font-semibold">有</span>
        </div>
        <span className="font-serif text-lg font-semibold text-ink">有了</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 工作群 */}
        <div className="px-3 py-2">
          <SectionTitle>工作群 · {groups.length}</SectionTitle>
          <div className="space-y-0.5">
            {groups.map((group) => (
              <GroupItem
                key={group.id}
                group={group}
                selected={selectedGroup === group.id}
                onClick={() => onSelectGroup(group.id)}
              />
            ))}
            <button
              onClick={onNewGroup}
              className="w-full mt-2 py-2 border border-dashed border-line-2 rounded-lg text-ink-3 text-xs hover:bg-bg-hover transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" />
              新建工作群
            </button>
          </div>
        </div>

        {/* 我的员工 */}
        <div className="px-3 py-2">
          <SectionTitle>我的员工 · {Object.values(ROLES).length}</SectionTitle>
          <div className="space-y-0.5">
            {Object.values(ROLES).filter(e => e.id === 'chief').map((employee) => (
              <EmployeeItem
                key={employee.id}
                employee={employee}
                selected={selectedEmployee === employee.id}
                onClick={() => onSelectEmployee(employee.id)}
              />
            ))}
            <div className="my-1.5 mx-2 border-t border-line-2/60" />
            {Object.values(ROLES).filter(e => e.id !== 'chief').map((employee) => (
              <EmployeeItem
                key={employee.id}
                employee={employee}
                selected={selectedEmployee === employee.id}
                onClick={() => onSelectEmployee(employee.id)}
              />
            ))}
          </div>
        </div>

        {/* 资源 */}
        <div className="px-3 py-2">
          <SectionTitle>资源</SectionTitle>
          <div className="space-y-0.5">
            {RESOURCES.map((item) => (
              <ResourceNavItem
                key={item.id}
                item={item}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 底部 — V0 阶段无账号系统 / 计费，只展示 DEMO 标识 */}
      <div className="p-3 border-t border-line">
        <div className="flex items-center justify-between text-[11px] text-ink-3">
          <span className="font-medium">Youle V0</span>
          <span className="px-1.5 py-0.5 bg-active/10 text-active rounded font-medium">
            DEMO
          </span>
        </div>
      </div>
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-medium text-ink-4 uppercase tracking-wider mb-2 px-2">
      {children}
    </h3>
  );
}

function NavItem({ 
  children, 
  active, 
  onClick, 
  icon,
  hasActivity 
}: { 
  children: React.ReactNode; 
  active?: boolean; 
  onClick?: () => void;
  icon?: React.ReactNode;
  hasActivity?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors',
        active ? 'bg-bg-panel text-ink font-medium shadow-sm' : 'text-ink-2 hover:bg-bg-hover'
      )}
    >
      {icon}
      {children}
      {hasActivity && (
        <span className="w-1.5 h-1.5 rounded-full bg-active pulse-dot ml-auto" />
      )}
    </button>
  );
}

function EmployeeItem({ 
  employee, 
  selected, 
  onClick 
}: { 
  employee: typeof ROLES.analyst;
  selected?: boolean;
  onClick?: () => void;
}) {
  const { activeAgents } = useAppStore();
  const colorConfig = ROLE_COLORS[employee.id];
  const isWorking = activeAgents.some(a => a.roleId === employee.id);
  const workingAgent = activeAgents.find(a => a.roleId === employee.id);

  return (
    <button
      onClick={onClick}
      title={
        isWorking && workingAgent
          ? `${employee.name} · ${workingAgent.action}`
          : employee.name
      }
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all',
        selected ? 'bg-bg-panel shadow-sm' : 'hover:bg-bg-hover',
        isWorking && 'bg-busy/5'
      )}
    >
      {/* 头像 */}
      <div className={cn(
        'w-[22px] h-[22px] rounded-md flex items-center justify-center text-xs font-medium transition-transform relative',
        colorConfig.main,
        selected && 'scale-110'
      )}>
        {employee.initial}
        {isWorking && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-busy rounded-full pulse-dot" />
        )}
      </div>
      
      {/* 名称和状态 */}
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-ink truncate">{employee.name}</span>
          {employee.id === 'chief' && (
            <span className="px-1 py-0 text-[9px] leading-[14px] rounded bg-chief text-white font-medium flex-shrink-0">
              首席
            </span>
          )}
        </div>
        {isWorking && workingAgent && (
          <span className="text-[10px] text-busy truncate block">{workingAgent.action}</span>
        )}
      </div>
    </button>
  );
}

function GroupItem({ 
  group, 
  selected, 
  onClick 
}: { 
  group: WorkGroup;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all',
        selected ? 'bg-bg-panel shadow-sm' : 'hover:bg-bg-hover'
      )}
    >
      <span className={cn("transition-transform", selected && "scale-110")}>{group.emoji}</span>
      <span className="text-ink flex-1 text-left truncate">{group.name}</span>
      
      {group.hasActivity && !group.unreadCount && (
        <span className="w-1.5 h-1.5 rounded-full bg-busy pulse-dot" />
      )}
      
      {group.unreadCount && group.unreadCount > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 bg-alert text-white text-[10px] font-medium rounded-full flex items-center justify-center badge-pop">
          {group.unreadCount}
        </span>
      )}
    </button>
  );
}

function ResourceNavItem({ 
  item,
}: { 
  item: typeof RESOURCES[0];
}) {
  const cls =
    'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-ink-2 hover:bg-bg-hover transition-colors';
  if (item.externalHref) {
    return (
      <a
        href={item.externalHref}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
      >
        <span>{item.icon}</span>
        <span className="flex-1 text-left">{item.name}</span>
        {item.badge != null ? (
          <span className="text-[10px] text-ink-4 font-mono">{item.badge}</span>
        ) : null}
      </a>
    );
  }
  return (
    <Link href={item.href ?? '/'} className={cls}>
      <span>{item.icon}</span>
      <span className="flex-1 text-left">{item.name}</span>
      {item.badge != null ? (
        <span className="text-[10px] text-ink-4 font-mono">{item.badge}</span>
      ) : null}
    </Link>
  );
}
