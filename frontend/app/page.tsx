'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { WorkStage } from '@/components/work-stage';
import { GroupChat } from '@/components/group-chat';
import { EmployeeChat } from '@/components/employee-chat';
import { GroupDashboard } from '@/components/group-dashboard';
import { Dossier } from '@/components/dossier';
import { NewGroupWizard } from '@/components/new-group-wizard';
import { Onboarding, useOnboarding } from '@/components/onboarding';
import { useAppStore } from '@/lib/store';
import type { RoleId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MessageSquare, LayoutDashboard } from 'lucide-react';

type ViewMode = 'group' | 'employee';
type GroupTab = 'chat' | 'board';

export default function Home() {
  const router = useRouter();
  const {
    selectedEmployeeId,
    setSelectedEmployee,
    currentGroupId,
    setCurrentGroup,
    groups,
  } = useAppStore();

  const { showOnboarding, completeOnboarding } = useOnboarding();
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('group');
  const [groupTab, setGroupTab] = useState<GroupTab>('chat');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);

  const currentGroup = groups.find((g) => g.id === currentGroupId) || groups[0];

  const handleSelectEmployee = (id: RoleId) => {
    setSelectedEmployee(id);
    setViewMode('employee');
    setIsSidePanelOpen(true);
  };

  const handleSelectGroup = (id: string) => {
    setCurrentGroup(id);
    setViewMode('group');
    setIsSidePanelOpen(true);
  };

  const handleTogglePanel = () => {
    setIsSidePanelOpen((v) => !v);
  };

  const handleNavigate = (page: string) => {
    // V1 范围的 market / knowledge 已删除；保留 V0 已实现路由
    const routes: Record<string, string> = {
      school: '/school',
      skills: '/skills',
      artifacts: '/artifacts',
      capabilities: '/capabilities',
    };
    if (routes[page]) router.push(routes[page]);
  };

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar
        selectedEmployee={viewMode === 'employee' ? selectedEmployeeId : null}
        onSelectEmployee={handleSelectEmployee}
        selectedGroup={viewMode === 'group' ? currentGroupId : ''}
        onSelectGroup={handleSelectGroup}
        currentPage="work"
        onNavigate={handleNavigate}
        onNewGroup={() => setIsNewGroupOpen(true)}
      />

      <main className="flex-1 bg-bg-panel overflow-hidden flex flex-col">
        {viewMode === 'group' ? (
          <>
            <div className="px-3 pt-2 border-b border-line bg-bg-panel flex-shrink-0 flex items-center gap-1">
              <button
                onClick={() => setGroupTab('chat')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t-md border border-b-0 transition-colors',
                  groupTab === 'chat'
                    ? 'bg-bg border-line text-ink font-medium'
                    : 'bg-transparent border-transparent text-ink-3 hover:text-ink-2'
                )}
                title="真·群聊：调用后端 Team 编排"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                群聊
              </button>
              <button
                onClick={() => setGroupTab('board')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t-md border border-b-0 transition-colors',
                  groupTab === 'board'
                    ? 'bg-bg border-line text-ink font-medium'
                    : 'bg-transparent border-transparent text-ink-3 hover:text-ink-2'
                )}
                title="项目看板（历史 mock 视图）"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                看板
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {groupTab === 'chat' ? (
                <GroupChat
                  groupId={currentGroup.id}
                  groupName={currentGroup.name}
                  groupEmoji={currentGroup.emoji}
                  onToggleDossier={handleTogglePanel}
                  isDossierOpen={isSidePanelOpen}
                />
              ) : (
                <WorkStage
                  onToggleDossier={handleTogglePanel}
                  isDossierOpen={isSidePanelOpen}
                />
              )}
            </div>
          </>
        ) : (
          <EmployeeChat
            roleId={selectedEmployeeId}
            onToggleDossier={handleTogglePanel}
            isDossierOpen={isSidePanelOpen}
            onNavigateToGroup={(id) => {
              setCurrentGroup(id);
              setViewMode('group');
              setGroupTab('chat');
              setIsSidePanelOpen(true);
            }}
          />
        )}
      </main>

      {viewMode === 'group'
        ? isSidePanelOpen && (
            <GroupDashboard
              groupId={currentGroupId}
              onClose={() => setIsSidePanelOpen(false)}
            />
          )
        : (
            <Dossier
              employeeId={selectedEmployeeId}
              isOpen={isSidePanelOpen}
              onClose={handleTogglePanel}
            />
          )}

      <NewGroupWizard
        isOpen={isNewGroupOpen}
        onClose={() => setIsNewGroupOpen(false)}
      />

      {showOnboarding && <Onboarding onComplete={completeOnboarding} />}
    </div>
  );
}
