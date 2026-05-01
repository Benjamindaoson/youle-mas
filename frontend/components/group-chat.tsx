'use client';

/**
 * 群聊 UI · 对应后端 /chat/team 的 Team 编排流程。
 *
 * 事件 → UI 映射：
 *   dispatch   → 一条特殊卡片（理的分派计划，展示 plan + steps）
 *   handoff    → 一行极简胶囊（"理 → 析：查清明数据"）
 *   agent_start→ 新建一条目标 agent 的气泡（status=thinking）
 *   chunk      → patch 最近一条对应 agent 气泡，追加文本 + 切 streaming
 *   agent_done → patch 最近一条对应 agent 气泡，切 done
 *   error      → 独立的错误系统消息
 *
 * 消息去重键：每次 agent_start 开新气泡，记录 agentMsgId；chunk 按 agent_id
 * 定位"当前正在写的那条气泡"——由 currentAgentMsgIdRef 维护。
 */

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  Send,
  Paperclip,
  BookOpen,
  Users,
  Eraser,
  ArrowRight,
  Sparkles,
  FileText,
  X,
  Briefcase,
  MessageCircle,
  Archive,
  Lock,
  Square,
  PanelRightOpen,
  PanelRightClose,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ROLES,
  ROLE_COLORS,
  AGENT_MARKET_PROFILES,
  type RoleId,
  type WorkGroupMember,
} from '@/lib/types';
import {
  streamTeamChat,
  fetchArtifact,
  artifactDownloadUrl,
  isBinaryArtifact,
  getArchiveStatus,
  archiveSession,
  unarchiveSession,
  type ArtifactManifest,
  type ArchiveSnapshot,
} from '@/lib/api';
import { ArtifactRenderer } from '@/components/artifact-renderer';
import {
  useChatStore,
  groupSessionId,
  clearServerHistory,
  type ChatMessage,
  type MessageStatus,
} from '@/lib/chat-store';
import { useAppStore } from '@/lib/store';
import {
  ThinkingIndicator,
  type ThinkingState,
} from '@/components/thinking-states';
import { MentionSelector } from '@/components/mention-selector';
import { MessageContent } from '@/components/message-content';
import { ArtifactPicker } from '@/components/artifact-picker';
import {
  type Attachment,
  buildAttachmentPrefix,
  uploadFile,
} from '@/lib/attachments';

interface GroupChatProps {
  groupId: string;
  groupName: string;
  groupEmoji?: string;
  /** 右侧看板开关；可选，page.tsx 传入 */
  onToggleDossier?: () => void;
  isDossierOpen?: boolean;
}

const THINKING_STATUSES = new Set<MessageStatus>([
  'thinking',
  'analyzing',
  'writing',
  'searching',
  'generating',
  'reviewing',
  'preparing',
]);

const EMPTY_MESSAGES: ChatMessage[] = [];

const STAGE_BY_ROLE: Record<string, MessageStatus> = {
  analyst: 'analyzing',
  planner: 'thinking',
  writer: 'writing',
  distributor: 'preparing',
  monitor: 'searching',
  chief: 'thinking',
  coder: 'generating',
  frontend: 'writing',
  tester: 'reviewing',
};

const ROLE_CN: Record<string, string> = {
  chief: '理',
  analyst: '析',
  planner: '策',
  writer: '创',
  distributor: '播',
  monitor: '观',
  coder: '剪',
  frontend: '端',
  tester: '测',
};

/**
 * 从 chief 的最终文本里提取 ```decision JSON 块。
 * 返回 { stripped: 剥离后的正文, decision: 解析后的决策请求 | null }
 * 哲学 #4：agent 请求决策 → 前台渲染成卡片，不在气泡里裸露 JSON。
 */
function extractDecision(content: string): {
  stripped: string;
  decision: {
    question: string;
    options: string[];
    allowCustom: boolean;
  } | null;
} {
  const m = content.match(/```decision\s*([\s\S]*?)```/);
  if (!m) return { stripped: content, decision: null };
  try {
    const parsed = JSON.parse(m[1].trim());
    const question = String(parsed.question ?? '').trim();
    const options = Array.isArray(parsed.options)
      ? parsed.options.map((x: unknown) => String(x)).filter(Boolean)
      : [];
    const allowCustom = parsed.allowCustom !== false;
    if (!question || options.length === 0) {
      return { stripped: content, decision: null };
    }
    return {
      stripped: content.replace(m[0], '').trim(),
      decision: { question, options, allowCustom },
    };
  } catch {
    return { stripped: content, decision: null };
  }
}

/**
 * 从 chief 的文本里提取 ```create_group JSON 块 —— 理自主拉群（哲学 #2+#8）。
 */
function extractCreateGroup(content: string): {
  stripped: string;
  group: { name: string; emoji: string; reason?: string; members: RoleId[] } | null;
} {
  const m = content.match(/```create_group\s*([\s\S]*?)```/);
  if (!m) return { stripped: content, group: null };
  try {
    const parsed = JSON.parse(m[1].trim());
    const name = String(parsed.name ?? '').trim();
    const emoji = String(parsed.emoji ?? '').trim();
    const reason = parsed.reason ? String(parsed.reason).trim() : undefined;
    const validRoles: RoleId[] = [
      'analyst', 'planner', 'writer', 'distributor', 'monitor',
      'coder', 'frontend', 'tester',
    ];
    const rawMembers = Array.isArray(parsed.members) ? parsed.members : [];
    const members: RoleId[] = rawMembers
      .map((x: unknown) => String(x).trim())
      .filter((r: string): r is RoleId => validRoles.includes(r as RoleId));
    if (!name || !emoji) {
      return { stripped: content, group: null };
    }
    return {
      stripped: content.replace(m[0], '').trim(),
      group: { name, emoji, reason, members },
    };
  } catch {
    return { stripped: content, group: null };
  }
}

export function GroupChat({
  groupId,
  groupName,
  groupEmoji,
  onToggleDossier,
  isDossierOpen,
}: GroupChatProps) {
  const sid = groupSessionId(groupId);
  const append = useChatStore((s) => s.append);
  const patch = useChatStore((s) => s.patch);
  const clear = useChatStore((s) => s.clear);
  const messages =
    useChatStore((s) => s.sessions[sid]) ?? EMPTY_MESSAGES;

  // 理自主拉群 → 直接调 zustand 的 createGroup + 切到新群
  const createGroup = useAppStore((s) => s.createGroup);
  const setCurrentGroup = useAppStore((s) => s.setCurrentGroup);
  const groupMembers = useAppStore((s) => s.groups.find((g) => g.id === groupId)?.members);
  // AI 员工白名单：若当前群有 memberRoles 则传给后端约束 chief
  const memberRoles = useAppStore((s) => s.groups.find((g) => g.id === groupId)?.memberRoles);
  // 全局 agent 忙碌状态
  const markAgentBusy = useAppStore((s) => s.markAgentBusy);
  const markAgentFree = useAppStore((s) => s.markAgentFree);

  const [isStreaming, setIsStreaming] = useState(false);
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set());
  // 'dispatch'（派活接力） | 'discuss'（讨论各抒己见）
  const [mode, setMode] = useState<'dispatch' | 'discuss'>('dispatch');
  // 当前正在"写"的那条气泡 id（按 agent_id 索引）
  const currentMsgByAgent = useRef<Map<string, string>>(new Map());
  // artifact 详情弹窗
  const [viewArtifact, setViewArtifact] = useState<ArtifactManifest | null>(null);
  // 归档状态
  const [archive, setArchive] = useState<ArchiveSnapshot | null>(null);
  // 正在进行的请求的 AbortController（点停止会 abort，触发后端生成器 close → kill subprocess）
  const abortRef = useRef<AbortController | null>(null);

  // 进入群时拉归档状态
  useEffect(() => {
    let cancelled = false;
    getArchiveStatus(sid).then((res) => {
      if (!cancelled && res.archived && res.snapshot) {
        setArchive(res.snapshot);
      } else if (!cancelled) {
        setArchive(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sid]);

  const handleArchive = async () => {
    if (!confirm(`归档「${groupName}」？归档后此群变只读，仅保留历史和成果，不能继续对话。`)) return;
    const snap = await archiveSession(sid);
    if (snap) setArchive(snap);
  };

  const handleUnarchive = async () => {
    await unarchiveSession(sid);
    setArchive(null);
  };

  const nowTime = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes(),
    ).padStart(2, '0')}`;
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    if (archive) return;  // 已归档只读

    const stamp = Date.now();
    const userMsgId = `u-${stamp}`;
    append(sid, {
      id: userMsgId,
      sender: 'user',
      kind: 'text',
      content: text,
      time: nowTime(),
    });

    setIsStreaming(true);
    currentMsgByAgent.current.clear();
    setActiveAgents(new Set());

    // 为这一轮创建独立 AbortController，点"停止"按钮会 abort
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      await streamTeamChat({
        message: text,
        sessionId: sid,
        mode,
        // memberRoles 非空才传给后端限制；为 undefined 或空数组 → 不限制（全员可派）
        members: memberRoles && memberRoles.length > 0 ? memberRoles : undefined,
      }, (ev) => {
        if (ev.type === 'start') {
          // 忽略：只是宣告开始
        } else if (ev.type === 'dispatch') {
          // 只在有 steps 时显示分派卡片；空 steps 是降级为直接对话，不展示卡片
          if (ev.steps && ev.steps.length > 0) {
            append(sid, {
              id: `dispatch-${stamp}`,
              sender: 'chief',
              kind: 'dispatch',
              content: ev.plan,
              plan: ev.plan,
              steps: ev.steps,
              time: nowTime(),
            });
          }
        } else if (ev.type === 'discussion') {
          // 讨论议题卡：只在有 participants 时显示
          if (ev.participants && ev.participants.length > 0) {
            append(sid, {
              id: `discussion-${stamp}`,
              sender: 'chief',
              kind: 'discussion',
              content: ev.topic,
              topic: ev.topic,
              question: ev.question,
              participants: ev.participants,
              scopeIn: ev.scope_in,
              scopeOut: ev.scope_out,
              deadlineTurns: ev.deadline_turns,
              flowType: ev.flow_type,
              time: nowTime(),
            });
          }
        } else if (ev.type === 'handoff') {
          append(sid, {
            id: `handoff-${stamp}-${ev.step_idx}`,
            sender: 'system',
            kind: 'handoff',
            content: `${ROLE_CN[ev.from] ?? ev.from} → ${ROLE_CN[ev.to] ?? ev.to}：${ev.task}`,
            handoffFrom: ev.from,
            handoffTo: ev.to,
            handoffTask: ev.task,
            stepIdx: ev.step_idx,
            stepTotal: ev.step_total,
            time: nowTime(),
          });
        } else if (ev.type === 'agent_start') {
          // dispatch 阶段的 chief 内部调用（非流式），不开气泡
          if (ev.phase === 'dispatch') return;
          const newId = `a-${stamp}-${ev.agent_id}-${Date.now()}`;
          currentMsgByAgent.current.set(ev.agent_id, newId);
          setActiveAgents((prev) => new Set(prev).add(ev.agent_id));
          // 全局忙碌状态：让 sidebar 其他群都能看到
          const actionByPhase: Record<string, string> = {
            execute: `在「${groupName}」产出`,
            summary: `在「${groupName}」汇总`,
            direct: `在「${groupName}」回复`,
            discuss: `在「${groupName}」讨论`,
            'discuss-summary': `在「${groupName}」收束讨论`,
          };
          markAgentBusy(
            ev.agent_id as RoleId,
            actionByPhase[ev.phase] ?? `在「${groupName}」工作`,
            sid,
          );
          // 每个 phase 都给一句具体文案 —— 任何员工（不只是 chief）在任意阶段
          // 都能在 ThinkingIndicator 上看到"正在 XX"的状态提示。
          const detailByPhase: Record<string, string> = {
            summary: '正在汇总',
            direct: '正在回复',
            execute: '正在产出',
            discuss: '正在发言',
            'discuss-summary': '正在收束讨论',
          };
          append(sid, {
            id: newId,
            sender: ev.agent_id as RoleId,
            kind: 'text',
            content: '',
            time: nowTime(),
            status: STAGE_BY_ROLE[ev.agent_id] ?? 'thinking',
            phase: ev.phase as ChatMessage['phase'],
            charCount: 0,
            detail: detailByPhase[ev.phase] ?? '正在工作',
          });
        } else if (ev.type === 'chunk') {
          const msgId = currentMsgByAgent.current.get(ev.agent_id);
          if (!msgId) return;
          patch(sid, msgId, (m) => {
            // 关键分支：execute 阶段的内容不能倾倒到前台——只计字数、保持 thinking
            // 哲学 #3：前台只汇报进度+成果，细节归档后台
            if (m.phase === 'execute') {
              const newCount = (m.charCount ?? 0) + ev.text.length;
              return {
                ...m,
                charCount: newCount,
                detail: `正在产出 · ${newCount} 字`,
                // 保持 thinking 族状态，让 ThinkingIndicator 持续显示
              };
            }
            // 其他阶段（summary/direct/discuss*）正常流式
            return {
              ...m,
              content: m.content + ev.text,
              status: m.status === 'streaming' ? m.status : 'streaming',
            };
          });
        } else if (ev.type === 'agent_done') {
          const msgId = currentMsgByAgent.current.get(ev.agent_id);
          if (msgId) {
            patch(sid, msgId, (m) => {
              if (m.phase === 'execute') {
                // execute 完成但 artifact 可能还没到 → 先占位
                return {
                  ...m,
                  status: 'done',
                  detail: m.artifact
                    ? undefined
                    : `已完成 · ${m.charCount ?? 0} 字 · 正在归档…`,
                };
              }
              // 所有展示型阶段（非 execute）结束后，扫特殊代码块：
              //   ```decision      → 任何 agent 可请决策（哲学 #4）
              //   ```create_group  → 仅 chief 可拉群（哲学 #2+#8）
              // execute 阶段内容不展示，不扫
              const isDisplayPhase =
                m.phase === 'summary' ||
                m.phase === 'discuss-summary' ||
                m.phase === 'direct' ||
                m.phase === 'discuss';
              if (isDisplayPhase && m.content) {
                let workingContent = m.content;

                // ① decision 块 · 任何 agent 都可发起
                const dec = extractDecision(workingContent);
                if (dec.decision) {
                  workingContent = dec.stripped;
                  const sender = ev.agent_id as RoleId;
                  setTimeout(() => {
                    append(sid, {
                      id: `decision-${Date.now()}`,
                      sender,
                      kind: 'decision',
                      content: dec.decision!.question,
                      decisionQuestion: dec.decision!.question,
                      decisionOptions: dec.decision!.options,
                      decisionAllowCustom: dec.decision!.allowCustom,
                      time: nowTime(),
                    });
                  }, 0);
                }

                // ② create_group 块 · 仅 chief 能拉群（哲学 #2）
                const cg = ev.agent_id === 'chief'
                  ? extractCreateGroup(workingContent)
                  : { stripped: workingContent, group: null };
                if (cg.group) {
                  workingContent = cg.stripped;
                  const { name, emoji, reason, members } = cg.group;
                  setTimeout(() => {
                    const newId = createGroup(name, emoji, members);
                    const membersDisplay = members.length > 0
                      ? ` · 成员：${members.map((r) => ROLE_CN[r] ?? r).join('/')}`
                      : '';
                    append(sid, {
                      id: `group-created-${Date.now()}`,
                      sender: 'system',
                      kind: 'system',
                      content:
                        `🎉 理创建了工作群「${emoji} ${name}」` +
                        (reason ? `（${reason}）` : '') +
                        membersDisplay +
                        `。3 秒后自动跳转…`,
                      time: nowTime(),
                    });
                    // 自动跳转到新群（也让用户知道去了哪）
                    setTimeout(() => setCurrentGroup(newId), 2500);
                  }, 0);
                }

                if (workingContent !== m.content) {
                  return { ...m, content: workingContent, status: 'done' };
                }
              }
              return { ...m, status: 'done' };
            });
          }
          setActiveAgents((prev) => {
            const next = new Set(prev);
            next.delete(ev.agent_id);
            return next;
          });
          markAgentFree(ev.agent_id as RoleId);
        } else if (ev.type === 'artifact_saved') {
          // 把归档挂到对应 agent 最近一条气泡上（紧跟 agent_done 触发）
          const msgId = currentMsgByAgent.current.get(ev.manifest.agent_id);
          if (msgId) {
            patch(sid, msgId, (m) => ({
              ...m,
              artifact: ev.manifest,
              detail: undefined,  // 归档到位，不再显示字数/等待文案
            }));
          }
        } else if (ev.type === 'pass') {
          // 员工跳过本轮：灰色胶囊
          append(sid, {
            id: `pass-${stamp}-${ev.agent_id}-${ev.turn}`,
            sender: 'system',
            kind: 'pass',
            content: `${ev.agent_name} 本轮跳过 · ${ev.reason}`,
            passReason: ev.reason,
            mentionFrom: ev.agent_id,  // 复用字段存谁 pass 了
            turnIndex: ev.turn,
            time: nowTime(),
          });
        } else if (ev.type === 'mention') {
          // 员工 @ 下一个：橙色胶囊
          append(sid, {
            id: `mention-${stamp}-${ev.from}-${ev.to}-${ev.turn}`,
            sender: 'system',
            kind: 'mention',
            content: `${ROLE_CN[ev.from] ?? ev.from} → @${ROLE_CN[ev.to] ?? ev.to}（请立刻回应）`,
            mentionFrom: ev.from,
            mentionTo: ev.to,
            turnIndex: ev.turn,
            time: nowTime(),
          });
        } else if (ev.type === 'error') {
          append(sid, {
            id: `err-${stamp}-${Date.now()}`,
            sender: 'system',
            kind: 'system',
            content: `⚠️ ${ev.message}`,
            time: nowTime(),
          });
        }
        // 'done' 由 finally 兜底
      }, ac.signal);
    } finally {
      setIsStreaming(false);
      // 清全局 busy 状态（当轮所有 active agent 释放）
      const lastActive = Array.from(activeAgents);
      lastActive.forEach((rid) => markAgentFree(rid as RoleId));
      setActiveAgents(new Set());
      currentMsgByAgent.current.clear();
      abortRef.current = null;
      // 正在"写"的气泡若还没 done（被中止）→ 标成"已中止"
      const messagesNow = useChatStore.getState().sessions[sid] ?? [];
      for (const m of messagesNow) {
        if (m.status === 'streaming' || (m.status && THINKING_STATUSES.has(m.status))) {
          patch(sid, m.id, (old) => ({
            ...old,
            status: 'done',
            detail: old.phase === 'execute'
              ? `已中止 · ${old.charCount ?? 0} 字`
              : undefined,
            content: old.content
              ? old.content + '\n\n_（已中止）_'
              : old.content,
          }));
        }
      }
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleClear = () => {
    if (!confirm(`清空「${groupName}」的群聊记录？（前后端都清）`)) return;
    clear(sid);
    clearServerHistory(sid);
  };

  return (
    <div className="h-full flex flex-col bg-bg">
      <GroupHeader
        groupName={groupName}
        groupEmoji={groupEmoji}
        activeAgents={activeAgents}
        extraMembers={groupMembers}
        memberRoles={memberRoles}
        onClear={handleClear}
        archive={archive}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onToggleDossier={onToggleDossier}
        isDossierOpen={isDossierOpen}
      />
      {archive && <ArchiveBanner snapshot={archive} onUnarchive={handleUnarchive} />}
      <MessageList
        key={groupId}
        messages={messages}
        onOpenArtifact={setViewArtifact}
        onAnswerDecision={(msgId, answer) => {
          if (archive) return;
          patch(sid, msgId, (m) => ({ ...m, decisionAnswered: answer }));
          handleSend(answer);
        }}
      />
      {archive ? (
        <div className="p-4 border-t border-line bg-bg-sunken/60 text-center">
          <p className="text-xs text-ink-3 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3" />
            此群聊已归档为数字资产，不再接受新对话
          </p>
        </div>
      ) : (
        <GroupComposer
          sessionId={sid}
          onSend={handleSend}
          onStop={handleStop}
          isStreaming={isStreaming}
          mode={mode}
          onModeChange={setMode}
        />
      )}
      {viewArtifact && (
        <ArtifactModal
          sessionId={sid}
          manifest={viewArtifact}
          onClose={() => setViewArtifact(null)}
        />
      )}
    </div>
  );
}

/* ---------------------------- 顶栏 ---------------------------- */

function GroupHeader({
  groupName,
  groupEmoji,
  activeAgents,
  extraMembers,
  memberRoles,
  onClear,
  archive,
  onArchive,
  onUnarchive,
  onToggleDossier,
  isDossierOpen,
}: {
  groupName: string;
  groupEmoji?: string;
  activeAgents: Set<string>;
  extraMembers?: WorkGroupMember[];
  memberRoles?: RoleId[];
  onClear: () => void;
  archive: ArchiveSnapshot | null;
  onArchive: () => void;
  onUnarchive: () => void;
  onToggleDossier?: () => void;
  isDossierOpen?: boolean;
}) {
  // chief 固定首位；其余按群 memberRoles 显示；若 memberRoles 未配置
  // （老群 / mock 群）则按默认 6 人显示
  const defaultMembers: RoleId[] = [
    'analyst', 'planner', 'writer', 'distributor', 'monitor',
  ];
  const memberOrder: RoleId[] = [
    'chief',
    ...(memberRoles && memberRoles.length > 0 ? memberRoles : defaultMembers),
  ];

  return (
    <header className="px-4 py-3 border-b border-line flex items-center justify-between bg-bg-panel">
      <div className="flex items-center gap-3">
        {groupEmoji && <span className="text-xl">{groupEmoji}</span>}
        <div>
          <h1 className="font-serif font-semibold text-ink flex items-center gap-2">
            {groupName}
            <span className="text-[10px] px-1.5 py-0.5 bg-busy/10 text-busy rounded">
              真·群聊
            </span>
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex -space-x-1.5">
              {memberOrder.map((rid) => {
                const profile = AGENT_MARKET_PROFILES[rid];
                const isActive = activeAgents.has(rid);
                return (
                  <div
                    key={rid}
                    className={cn(
                      'w-6 h-6 rounded-md overflow-hidden border-2 border-bg-panel relative transition-transform',
                      isActive && 'scale-110 ring-1 ring-busy/50',
                    )}
                    title={ROLES[rid].name}
                  >
                    <Image
                      src={profile.avatar}
                      alt={ROLES[rid].name}
                      width={24}
                      height={24}
                      className="object-cover w-full h-full"
                    />
                    {isActive && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-busy rounded-full pulse-dot" />
                    )}
                  </div>
                );
              })}
              {extraMembers?.map((m) => (
                <div
                  key={m.name}
                  className="w-6 h-6 rounded-md border-2 border-bg-panel flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ backgroundColor: m.color }}
                  title={`${m.name} · ${m.role}`}
                >
                  {m.initials}
                </div>
              ))}
            </div>
            {activeAgents.size > 0 ? (
              <span className="text-xs text-busy font-medium">
                {activeAgents.size} 位工作中
              </span>
            ) : (
              <span className="text-xs text-ink-3">
                <Users className="w-3 h-3 inline mr-0.5" />
                待命中
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {archive ? (
          <button
            onClick={onUnarchive}
            className="px-2 py-1 text-xs text-ink-3 hover:text-ink rounded hover:bg-bg-hover transition-colors flex items-center gap-1"
            title="取消归档（恢复可写）"
          >
            <Lock className="w-3.5 h-3.5" />
            已归档
          </button>
        ) : (
          <button
            onClick={onArchive}
            className="px-2 py-1 text-xs text-ink-3 hover:text-ink rounded hover:bg-bg-hover transition-colors flex items-center gap-1"
            title="归档此群（任务完成，沉淀为数字资产）"
          >
            <Archive className="w-3.5 h-3.5" />
            归档
          </button>
        )}
        <button
          onClick={onClear}
          disabled={!!archive}
          className="p-2 rounded-lg hover:bg-bg-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={archive ? '已归档，不可清空' : '清空群聊（前后端都清）'}
        >
          <Eraser className="w-4 h-4 text-ink-3" />
        </button>
        {onToggleDossier && (
          <button
            onClick={onToggleDossier}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isDossierOpen ? 'bg-bg-hover' : 'hover:bg-bg-hover',
            )}
            title={isDossierOpen ? '收起右侧看板' : '展开右侧看板'}
          >
            {isDossierOpen ? (
              <PanelRightClose className="w-4 h-4 text-ink-3" />
            ) : (
              <PanelRightOpen className="w-4 h-4 text-ink-3" />
            )}
          </button>
        )}
      </div>
    </header>
  );
}

function ArchiveBanner({
  snapshot,
  onUnarchive,
}: {
  snapshot: ArchiveSnapshot;
  onUnarchive: () => void;
}) {
  return (
    <div className="px-4 py-2 border-b border-line bg-chief-light/40 flex items-center gap-3">
      <Archive className="w-4 h-4 text-chief flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-ink font-medium">
          此群已归档为数字资产
        </p>
        <p className="text-[11px] text-ink-3 mt-0.5">
          归档于 {snapshot.archived_at.replace('T', ' ')} · 产出 {snapshot.artifact_count} 份 · 对话 {snapshot.turn_count} 轮
          {snapshot.participants.length > 0 && ` · 参与 ${snapshot.participants.map((p) => ROLE_CN[p] ?? p).join(' / ')}`}
        </p>
      </div>
      <button
        onClick={onUnarchive}
        className="text-[11px] text-ink-3 hover:text-ink underline-offset-2 hover:underline flex-shrink-0"
      >
        取消归档
      </button>
    </div>
  );
}

/* ---------------------------- 消息列表 ---------------------------- */

function MessageList({
  messages,
  onOpenArtifact,
  onAnswerDecision,
}: {
  messages: ChatMessage[];
  onOpenArtifact: (m: ArtifactManifest) => void;
  onAnswerDecision: (msgId: string, answer: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  useEffect(() => {
    const el = endRef.current;
    if (!el) return;
    const container = el.parentElement;
    if (!container) return;

    const prevCount = prevCountRef.current;
    prevCountRef.current = messages.length;
    const isFirstRun = prevCount === 0 && messages.length > 0;
    const lengthIncreased = messages.length > prevCount;
    const lastIsUser =
      lengthIncreased && messages[messages.length - 1]?.sender === 'user';

    const distance =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distance < 120;

    // 粘底：首次进入此会话强制滚；用户发消息强制滚；agent 流式仅当已在底部才跟
    if (isFirstRun || lastIsUser || nearBottom) {
      el.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.length === 0 && <EmptyHint />}
      {messages.map((m) => (
        <MessageItem
          key={m.id}
          msg={m}
          onOpenArtifact={onOpenArtifact}
          onAnswerDecision={onAnswerDecision}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
      <Sparkles className="w-8 h-8 text-ink-4 mb-2" />
      <p className="text-sm text-ink-3 mb-1">
        群里还没说话。说一句需求，理会分派给合适的同事。
      </p>
      <p className="text-xs text-ink-4">
        试试："帮我做个清明节的小红书内容"
      </p>
    </div>
  );
}

function MessageItem({
  msg,
  onOpenArtifact,
  onAnswerDecision,
}: {
  msg: ChatMessage;
  onOpenArtifact: (m: ArtifactManifest) => void;
  onAnswerDecision: (msgId: string, answer: string) => void;
}) {
  // 1) 用户消息
  if (msg.sender === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%]">
          <div className="bg-ink text-white px-4 py-2.5 rounded-xl rounded-tr-sm">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </p>
          </div>
          <p className="text-[10px] text-ink-4 text-right mt-1">{msg.time}</p>
        </div>
      </div>
    );
  }

  // 2) 分派计划卡
  if (msg.kind === 'dispatch' && msg.sender === 'chief') {
    return <DispatchCard msg={msg} />;
  }

  // 2b) 讨论议题卡
  if (msg.kind === 'discussion' && msg.sender === 'chief') {
    return <DiscussionCard msg={msg} />;
  }

  // 2c) 决策卡：任何 agent 请求老板拍板（哲学 #4 · 全员适用）
  // user 消息已在上方处理；system 不发决策；剩下就是 RoleId
  if (msg.kind === 'decision' && msg.sender !== 'system') {
    return (
      <DecisionCard
        msg={msg}
        onAnswer={(answer) => onAnswerDecision(msg.id, answer)}
      />
    );
  }

  // 3) 交接胶囊
  if (msg.kind === 'handoff' && msg.sender === 'system') {
    return <HandoffPill msg={msg} />;
  }

  // 3b) pass 胶囊：员工本轮跳过（哲学：员工有能动性）
  if (msg.kind === 'pass' && msg.sender === 'system') {
    return <PassPill msg={msg} />;
  }

  // 3c) mention 胶囊：员工 @ 某人插队（讨论自主流）
  if (msg.kind === 'mention' && msg.sender === 'system') {
    return <MentionPill msg={msg} />;
  }

  // 4) 系统错误/提示
  if (msg.sender === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-[11px] text-ink-4 bg-bg-sunken px-3 py-1 rounded-full">
          {msg.content}
        </span>
      </div>
    );
  }

  // 5) agent 消息（RoleId sender）
  return <AgentBubble msg={msg} onOpenArtifact={onOpenArtifact} />;
}

function DispatchCard({ msg }: { msg: ChatMessage }) {
  const profile = AGENT_MARKET_PROFILES.chief;
  return (
    <div className="flex gap-2.5">
      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
        <Image
          src={profile.avatar}
          alt="理"
          width={32}
          height={32}
          className="object-cover w-full h-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-chief">理</span>
          <span className="text-[10px] text-ink-4">{msg.time}</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-chief-light text-chief rounded">
            分派
          </span>
        </div>
        <div className="bg-bg-panel border border-chief/30 rounded-xl rounded-tl-sm p-3 max-w-[520px]">
          <p className="text-sm text-ink mb-2 leading-relaxed">{msg.plan}</p>
          <div className="space-y-1.5">
            {msg.steps?.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs bg-bg-sunken/50 rounded-md px-2.5 py-1.5"
              >
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-chief text-white text-[10px] flex items-center justify-center font-medium">
                  {i + 1}
                </span>
                <span className="font-medium text-ink min-w-[24px]">
                  {ROLE_CN[s.to] ?? s.to}
                </span>
                <ArrowRight className="w-3 h-3 text-ink-4 flex-shrink-0 mt-0.5" />
                <span className="text-ink-2 flex-1 leading-relaxed">
                  {s.task}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DiscussionCard({ msg }: { msg: ChatMessage }) {
  // broadcast 模式：chief 让路，只出一个极简胶囊提示"大家开放发言"
  // 不展示议题/问题/scope/锚点（那些是 discuss 才有的编排味道）
  if (msg.flowType === 'broadcast') {
    return (
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] bg-bg-sunken border border-line rounded-full px-3 py-1 text-ink-3">
          <span>🗣️</span>
          <span>开放发言</span>
          <span className="w-px h-3 bg-line-2" />
          <span className="flex items-center gap-1">
            {msg.participants?.map((p, i) => (
              <span
                key={i}
                className={cn(
                  'text-[11px] px-1.5 py-0.5 rounded font-medium',
                  `bg-${p}/10 text-${p}`,
                )}
              >
                {ROLE_CN[p] ?? p}
              </span>
            ))}
          </span>
        </div>
      </div>
    );
  }

  // discuss 模式：保留原有的"理 · 讨论"卡（含锚点、scope、轮次）
  const profile = AGENT_MARKET_PROFILES.chief;
  return (
    <div className="flex gap-2.5">
      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
        <Image
          src={profile.avatar}
          alt="理"
          width={32}
          height={32}
          className="object-cover w-full h-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-chief">理</span>
          <span className="text-[10px] text-ink-4">{msg.time}</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-planner/10 text-planner rounded inline-flex items-center gap-0.5">
            <MessageCircle className="w-2.5 h-2.5" />
            讨论
          </span>
        </div>
        <div className="bg-bg-panel border border-planner/30 rounded-xl rounded-tl-sm p-3 max-w-[520px]">
          <p className="text-sm text-ink font-medium mb-1">{msg.topic}</p>
          {msg.question && (
            <p className="text-xs text-ink-2 mb-2 leading-relaxed">
              {msg.question}
            </p>
          )}

          {/* 锚点：scope_in / scope_out / 轮次 */}
          {(msg.scopeIn?.length || msg.scopeOut?.length || msg.deadlineTurns) && (
            <div className="mb-2 p-2 rounded-md bg-bg-sunken/60 text-[11px] leading-relaxed space-y-1">
              {msg.scopeIn && msg.scopeIn.length > 0 && (
                <div>
                  <span className="text-active font-medium">范围内：</span>
                  <span className="text-ink-2">{msg.scopeIn.join(' · ')}</span>
                </div>
              )}
              {msg.scopeOut && msg.scopeOut.length > 0 && (
                <div>
                  <span className="text-alert font-medium">禁区：</span>
                  <span className="text-ink-3">{msg.scopeOut.join(' · ')}</span>
                </div>
              )}
              {msg.deadlineTurns !== undefined && msg.deadlineTurns > 0 && (
                <div className="text-ink-4">
                  讨论轮次上限：{msg.deadlineTurns} 轮（超过强制收敛到老板）
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-ink-4">参会：</span>
            {msg.participants?.map((p, i) => {
              const cn_ = ROLE_CN[p] ?? p;
              return (
                <span
                  key={i}
                  className={cn(
                    'text-[11px] px-1.5 py-0.5 rounded font-medium',
                    `bg-${p}/10 text-${p}`,
                  )}
                >
                  {cn_}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function DecisionCard({
  msg,
  onAnswer,
}: {
  msg: ChatMessage;
  onAnswer: (answer: string) => void;
}) {
  // 发起决策的 agent（chief 或其他员工都可能）
  const senderRole = (msg.sender as RoleId) ?? 'chief';
  const profile = AGENT_MARKET_PROFILES[senderRole] ?? AGENT_MARKET_PROFILES.chief;
  const senderName = ROLES[senderRole]?.name ?? '理';
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState('');
  const isAnswered = !!msg.decisionAnswered;

  const handleOption = (opt: string) => {
    if (isAnswered) return;
    onAnswer(opt);
  };

  const handleCustom = () => {
    if (!customText.trim() || isAnswered) return;
    onAnswer(customText.trim());
    setShowCustom(false);
    setCustomText('');
  };

  return (
    <div className="flex gap-2.5">
      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
        <Image
          src={profile.avatar}
          alt={senderName}
          width={32}
          height={32}
          className="object-cover w-full h-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('text-sm font-medium', `text-${senderRole}`)}>
            {senderName}
          </span>
          <span className="text-[10px] text-ink-4">{msg.time}</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-busy/10 text-busy rounded">
            需要你拍板
          </span>
        </div>
        <div
          className={cn(
            'bg-bg-panel border rounded-xl rounded-tl-sm p-3 max-w-[520px] transition-colors',
            isAnswered ? 'border-active/40 bg-active/5' : 'border-busy/40',
          )}
        >
          <p className="text-sm text-ink font-medium mb-2.5 leading-relaxed">
            {msg.decisionQuestion}
          </p>
          <div className="flex flex-col gap-1.5">
            {msg.decisionOptions?.map((opt, i) => {
              const isPicked = msg.decisionAnswered === opt;
              return (
                <button
                  key={i}
                  onClick={() => handleOption(opt)}
                  disabled={isAnswered}
                  className={cn(
                    'text-left px-3 py-2 rounded-md text-sm border transition-all',
                    isPicked
                      ? 'border-active bg-active/10 text-ink font-medium'
                      : isAnswered
                        ? 'border-line text-ink-3 cursor-not-allowed'
                        : 'border-line text-ink-2 hover:border-ink-4 hover:bg-bg-hover',
                  )}
                >
                  <span className="inline-block w-5 h-5 mr-2 rounded-full bg-bg-sunken text-[11px] font-mono text-ink-3 leading-5 text-center">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                  {isPicked && <span className="ml-2 text-active">✓</span>}
                </button>
              );
            })}
          </div>
          {msg.decisionAllowCustom && !isAnswered && (
            <div className="mt-2 pt-2 border-t border-line">
              {!showCustom ? (
                <button
                  onClick={() => setShowCustom(true)}
                  className="text-xs text-ink-3 hover:text-ink underline-offset-2 hover:underline"
                >
                  都不满意 · 我来说
                </button>
              ) : (
                <div className="space-y-1.5">
                  <textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="说说你的想法…"
                    className="w-full text-sm text-ink px-2.5 py-1.5 bg-bg-sunken rounded-md border border-line focus:border-ink-4 focus:outline-none resize-none"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCustom}
                      disabled={!customText.trim()}
                      className={cn(
                        'text-xs px-3 py-1 rounded transition-colors',
                        customText.trim()
                          ? 'bg-ink text-white hover:bg-ink-2'
                          : 'bg-ink-4 text-ink-3 cursor-not-allowed',
                      )}
                    >
                      提交
                    </button>
                    <button
                      onClick={() => {
                        setShowCustom(false);
                        setCustomText('');
                      }}
                      className="text-xs px-3 py-1 text-ink-3 hover:text-ink"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {isAnswered && msg.decisionAnswered &&
            !msg.decisionOptions?.includes(msg.decisionAnswered) && (
              <div className="mt-2 pt-2 border-t border-line text-xs text-ink-2">
                <span className="text-ink-4">你的回答：</span>
                {msg.decisionAnswered}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function HandoffPill({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex items-center gap-1.5 text-[11px] text-ink-3 bg-bg-sunken border border-line rounded-full px-3 py-1">
        <span className="text-ink-4">
          步骤 {msg.stepIdx}/{msg.stepTotal}
        </span>
        <span className="w-px h-3 bg-line-2" />
        <span className="font-medium text-ink-2">
          {ROLE_CN[msg.handoffFrom ?? ''] ?? msg.handoffFrom}
        </span>
        <ArrowRight className="w-3 h-3" />
        <span className="font-medium text-ink-2">
          {ROLE_CN[msg.handoffTo ?? ''] ?? msg.handoffTo}
        </span>
        <span className="text-ink-3 max-w-[320px] truncate">
          : {msg.handoffTask}
        </span>
      </div>
    </div>
  );
}

function PassPill({ msg }: { msg: ChatMessage }) {
  // 灰色胶囊：员工本轮跳过
  const fromRole = msg.mentionFrom ?? '';
  const display = ROLE_CN[fromRole] ?? fromRole;
  return (
    <div className="flex justify-center">
      <div className="inline-flex items-center gap-1.5 text-[11px] text-ink-4 bg-bg-sunken/60 border border-dashed border-line rounded-full px-3 py-1 opacity-80">
        <span className="w-1.5 h-1.5 rounded-full bg-ink-4" />
        <span className="font-medium text-ink-3">{display}</span>
        <span>本轮跳过</span>
        {msg.passReason && (
          <>
            <span className="w-px h-3 bg-line-2" />
            <span className="max-w-[260px] truncate italic">{msg.passReason}</span>
          </>
        )}
        {msg.turnIndex && (
          <span className="text-ink-4 ml-1">· 第 {msg.turnIndex} 轮</span>
        )}
      </div>
    </div>
  );
}

function MentionPill({ msg }: { msg: ChatMessage }) {
  // 橙色胶囊：员工 @ 某人插队
  const fromRole = msg.mentionFrom ?? '';
  const toRole = msg.mentionTo ?? '';
  return (
    <div className="flex justify-center">
      <div className="inline-flex items-center gap-1.5 text-[11px] bg-busy/10 border border-busy/30 text-ink-2 rounded-full px-3 py-1">
        <span className={cn('font-medium', `text-${fromRole}`)}>
          {ROLE_CN[fromRole] ?? fromRole}
        </span>
        <ArrowRight className="w-3 h-3 text-busy" />
        <span className="font-medium text-busy">
          @{ROLE_CN[toRole] ?? toRole}
        </span>
        <span className="text-ink-3">插队回应</span>
        {msg.turnIndex && (
          <span className="text-ink-4">· 第 {msg.turnIndex} 轮</span>
        )}
      </div>
    </div>
  );
}

function AgentBubble({
  msg,
  onOpenArtifact,
}: {
  msg: ChatMessage;
  onOpenArtifact: (m: ArtifactManifest) => void;
}) {
  const roleId = msg.sender as RoleId;
  const profile = AGENT_MARKET_PROFILES[roleId];
  const colorConfig = ROLE_COLORS[roleId];
  const role = ROLES[roleId];

  const isThinking =
    !msg.content &&
    msg.status !== undefined &&
    THINKING_STATUSES.has(msg.status);

  if (isThinking) {
    return (
      <ThinkingIndicator
        roleId={roleId}
        state={msg.status as ThinkingState}
        detail={msg.detail}
      />
    );
  }

  // execute 阶段完成后的极简态：不展示 chunk 全文，只给"已产出"+成果卡
  // 哲学 #3：前台只汇报进度+成果，细节在后台
  const isExecuteDone =
    msg.phase === 'execute' && !msg.content && msg.status === 'done';

  if (isExecuteDone) {
    return (
      <div className="flex gap-2.5">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
          <Image
            src={profile.avatar}
            alt={role.name}
            width={32}
            height={32}
            className="object-cover w-full h-full"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-sm font-medium', `text-${roleId}`)}>
              {role.name}
            </span>
            <span className="text-[10px] text-ink-4">{msg.time}</span>
          </div>
          {msg.artifact ? (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs text-ink-2 bg-bg-sunken/60 rounded-full mb-2">
                <span className="text-active">✓</span>
                <span>已产出成果 · {msg.charCount ?? 0} 字</span>
              </div>
              <button
                onClick={() => onOpenArtifact(msg.artifact!)}
                className="flex items-start gap-2 bg-bg-panel border border-line rounded-lg px-3 py-2 max-w-[85%] text-left hover:border-ink-4 hover:shadow-sm transition-all group"
              >
                <FileText className="w-4 h-4 text-ink-3 flex-shrink-0 mt-0.5 group-hover:text-ink" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-bg-sunken text-ink-3 rounded">
                      成果 · 第 {msg.artifact.step_idx} 步
                    </span>
                    <span className="text-xs font-medium text-ink truncate">
                      {msg.artifact.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-3 leading-relaxed line-clamp-2">
                    {msg.artifact.summary}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-ink-4 font-mono">
                      {msg.artifact.file}
                    </span>
                    <span className="text-[10px] text-ink-4">
                      · {(msg.artifact.size / 1024).toFixed(1)} KB
                    </span>
                    <span className="text-[10px] text-active ml-auto group-hover:underline">
                      查看全文 →
                    </span>
                  </div>
                </div>
              </button>
            </>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs text-ink-3 bg-bg-sunken/60 rounded-full">
              <span>已完成 · {msg.charCount ?? 0} 字 · 正在归档…</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
        <Image
          src={profile.avatar}
          alt={role.name}
          width={32}
          height={32}
          className="object-cover w-full h-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('text-sm font-medium', `text-${roleId}`)}>
            {role.name}
          </span>
          <span className="text-[10px] text-ink-4">{msg.time}</span>
          {msg.status === 'streaming' && (
            <span className="text-[10px] text-busy animate-pulse">输入中</span>
          )}
          {(msg.phase === 'discuss' || msg.phase === 'discuss-summary') && msg.status === 'done' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-planner/10 text-planner rounded">
              {msg.phase === 'discuss-summary' ? '汇总' : '发言'}
            </span>
          )}
        </div>
        <div
          className={cn(
            'px-4 py-2.5 rounded-xl rounded-tl-sm max-w-[85%]',
            colorConfig.light,
          )}
        >
          <MessageContent content={msg.content} />
          {msg.status === 'streaming' && (
            <span className="inline-block w-1 h-3 bg-ink-3 ml-0.5 align-middle animate-pulse" />
          )}
        </div>
        {msg.artifact && (
          <button
            onClick={() => onOpenArtifact(msg.artifact!)}
            className="mt-2 flex items-start gap-2 bg-bg-panel border border-line rounded-lg px-3 py-2 max-w-[85%] text-left hover:border-ink-4 hover:shadow-sm transition-all group"
          >
            <FileText className="w-4 h-4 text-ink-3 flex-shrink-0 mt-0.5 group-hover:text-ink" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-bg-sunken text-ink-3 rounded">
                  成果 · 第 {msg.artifact.step_idx} 步
                </span>
                <span className="text-xs font-medium text-ink truncate">
                  {msg.artifact.title}
                </span>
              </div>
              <p className="text-[11px] text-ink-3 leading-relaxed line-clamp-2">
                {msg.artifact.summary}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-ink-4 font-mono">
                  {msg.artifact.file}
                </span>
                <span className="text-[10px] text-ink-4">
                  · {(msg.artifact.size / 1024).toFixed(1)} KB
                </span>
                <span className="text-[10px] text-active ml-auto group-hover:underline">
                  查看全文 →
                </span>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- Artifact 详情 Modal ---------------------------- */

export function ArtifactModal({
  sessionId,
  manifest,
  onClose,
}: {
  sessionId: string;
  manifest: ArtifactManifest;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isBinary = isBinaryArtifact(manifest.artifact_type);
  const downloadUrl = artifactDownloadUrl(sessionId, manifest.file);

  useEffect(() => {
    // 二进制不走文本 fetch，直接用 downloadUrl 让 renderer 通过 <img>/<iframe> 拉
    if (isBinary) {
      setContent('');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchArtifact(sessionId, manifest.file).then((c) => {
      if (!cancelled) {
        setContent(c);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, manifest.file, isBinary]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cnName = {
    chief: '理',
    analyst: '析',
    planner: '策',
    writer: '创',
    distributor: '播',
    monitor: '观',
    coder: '工',
    frontend: '端',
    tester: '测',
  }[manifest.agent_id] ?? manifest.agent_id;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="bg-bg-panel rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b border-line flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-bg-sunken text-ink-3 rounded">
                成果 · 第 {manifest.step_idx} 步
              </span>
              <span className={cn('text-xs font-medium', `text-${manifest.agent_id}`)}>
                {cnName}
              </span>
              {manifest.artifact_type && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-bg-sunken text-ink-3 rounded uppercase">
                  {manifest.artifact_type}
                </span>
              )}
              <span className="text-[10px] text-ink-4 font-mono truncate">
                {manifest.file}
              </span>
            </div>
            <h2 className="font-serif font-semibold text-ink text-base truncate">
              {manifest.title}
            </h2>
            <p className="text-[10px] text-ink-4 mt-0.5">
              归档于 {manifest.created_at} · {(manifest.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <a
              href={downloadUrl}
              download={manifest.file}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line hover:bg-bg-hover text-xs text-ink-2 hover:text-ink transition-colors"
              title="下载原文件"
            >
              <Download className="w-3.5 h-3.5" />
              下载
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-bg-hover transition-colors"
              title="关闭（Esc）"
            >
              <X className="w-4 h-4 text-ink-3" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-sm text-ink-3">加载中…</p>
          ) : content === null ? (
            <p className="text-sm text-ink-3">（读取失败）</p>
          ) : (
            <ArtifactRenderer
              content={content}
              artifactType={manifest.artifact_type}
              filename={manifest.file}
              downloadUrl={downloadUrl}
              size={manifest.size}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- 输入框 ---------------------------- */

function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: 'dispatch' | 'discuss';
  onChange: (m: 'dispatch' | 'discuss') => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 bg-bg-panel border border-line rounded-md p-0.5">
      <button
        onClick={() => onChange('dispatch')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors',
          mode === 'dispatch'
            ? 'bg-ink text-white'
            : 'text-ink-3 hover:text-ink disabled:opacity-50',
        )}
        title="派活：理分派任务，员工接力产出成果"
      >
        <Briefcase className="w-3 h-3" />
        派活
      </button>
      <button
        onClick={() => onChange('discuss')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors',
          mode === 'discuss'
            ? 'bg-planner text-white'
            : 'text-ink-3 hover:text-ink disabled:opacity-50',
        )}
        title="讨论：员工各抒己见，理汇总共识"
      >
        <MessageCircle className="w-3 h-3" />
        讨论
      </button>
    </div>
  );
}

function GroupComposer({
  sessionId,
  onSend,
  onStop,
  isStreaming,
  mode,
  onModeChange,
}: {
  sessionId: string;
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  mode: 'dispatch' | 'discuss';
  onModeChange: (m: 'dispatch' | 'discuss') => void;
}) {
  // 草稿持久化到 zustand —— 切页面 / 换群 / 刷新前都不丢
  const value = useChatStore((s) => s.drafts[sessionId] ?? '');
  const setDraft = useChatStore((s) => s.setDraft);
  const clearDraft = useChatStore((s) => s.clearDraft);
  const setValue = (v: string) => setDraft(sessionId, v);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 附件（组件本地 state，不跨会话持久化）
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const added: Attachment[] = [];
    for (const f of Array.from(files)) {
      // 任意类型：上传到后端，拿绝对路径；Claude Code 会用 Read 工具读
      const att = await uploadFile(sessionId, f);
      if (!att) {
        alert(`上传失败：${f.name}`);
        continue;
      }
      added.push(att);
    }
    if (added.length) setAttachments((prev) => [...prev, ...added]);
    e.target.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    const hasText = value.trim().length > 0;
    if ((!hasText && !attachments.length) || isStreaming) return;
    const prefix = buildAttachmentPrefix(attachments);
    const toSend = prefix + value.trim();
    onSend(toSend);
    clearDraft(sessionId);
    setAttachments([]);
    setMentionOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (mentionOpen && (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') setMentionOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    const pos = e.target.selectionStart;
    setValue(v);
    const before = v.slice(0, pos);
    const m = before.match(/@([^\s@]*)$/);
    if (m) {
      setMentionOpen(true);
      setMentionQuery(m[1]);
      setMentionStart(pos - m[0].length);
    } else {
      setMentionOpen(false);
      setMentionQuery('');
    }
  };

  const handleMention = (_roleId: RoleId, displayName: string) => {
    const before = value.slice(0, mentionStart);
    const after = value.slice(mentionStart + mentionQuery.length + 1);
    const next = `${before}@${displayName} ${after}`;
    setValue(next);
    setMentionOpen(false);
    setTimeout(() => {
      textareaRef.current?.focus();
      const p = mentionStart + displayName.length + 2;
      textareaRef.current?.setSelectionRange(p, p);
    }, 0);
  };

  const hasInput = value.trim().length > 0 || attachments.length > 0;

  return (
    <div className="p-4 border-t border-line bg-bg-panel">
      <div className="relative bg-bg-sunken rounded-xl border border-line focus-within:border-ink-4 focus-within:shadow-sm transition-all">
        <MentionSelector
          isOpen={mentionOpen}
          searchQuery={mentionQuery}
          onSelect={handleMention}
          onClose={() => setMentionOpen(false)}
        />

        {/* 附件胶囊条 */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {attachments.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-1 bg-bg-panel border border-line rounded-full pl-2 pr-1 py-0.5 text-xs text-ink-2 max-w-full"
              >
                <span className="truncate max-w-[200px]">
                  {a.kind === 'file' ? `📎 ${a.name}` : `📄 ${a.title}`}
                </span>
                <button
                  onClick={() => removeAttachment(i)}
                  className="text-ink-4 hover:text-ink p-0.5 rounded-full hover:bg-bg-sunken"
                  title="移除"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={
            mode === 'discuss'
              ? '抛个议题让大家讨论，例如"该不该做短视频"…'
              : '给团队派活，或 @ 某位同事...'
          }
          className="w-full px-4 py-3 bg-transparent text-sm text-ink placeholder:text-ink-4 resize-none focus:outline-none"
          rows={2}
          disabled={isStreaming}
        />
        <div className="flex items-center justify-between px-3 py-2 border-t border-line">
          <div className="flex items-center gap-2">
            <ModeToggle mode={mode} onChange={onModeChange} disabled={isStreaming} />
            <span className="w-px h-4 bg-line" />
            <button
              onClick={() => setPickerOpen(true)}
              className="p-1.5 hover:bg-bg-hover rounded-md transition-colors"
              title="引用同事已产出的文档"
            >
              <BookOpen className="w-4 h-4 text-ink-3" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 hover:bg-bg-hover rounded-md transition-colors"
              title="上传本地文件（文本类）"
            >
              <Paperclip className="w-4 h-4 text-ink-3" />
            </button>
          </div>
          {isStreaming ? (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors bg-alert text-white hover:bg-alert/90"
              title="中止当前协作（前端立刻停 + 后端 kill 子进程）"
            >
              <Square className="w-3 h-3 fill-current" />
              停止
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!hasInput}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors',
                hasInput
                  ? 'bg-ink text-white hover:bg-ink-2'
                  : 'bg-ink-4 text-ink-3 cursor-not-allowed',
              )}
            >
              <Send className="w-3.5 h-3.5" />
              {mode === 'discuss' ? '发起讨论' : '派活'}
            </button>
          )}
        </div>
      </div>

      {/* 隐藏的文件选择 input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFilePick}
        className="hidden"
      />

      {/* artifact 选择浮层 · 全局模式（跨所有 session 列出成果） */}
      {pickerOpen && (
        <ArtifactPicker
          onPick={(a) => setAttachments((prev) => [...prev, a])}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
