'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { PanelRightClose, PanelRightOpen, Send, Paperclip, BookOpen, Sparkles, MessageCircle, Eraser, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ROLES,
  ROLE_COLORS,
  AGENT_MARKET_PROFILES,
  AGENT_RESUMES,
  type RoleId,
} from '@/lib/types';
import { streamChat, AVAILABLE_AGENTS } from '@/lib/api';
import {
  useChatStore,
  soloSessionId,
  clearServerHistory,
  type ChatMessage,
  type MessageStatus,
} from '@/lib/chat-store';
import { ThinkingIndicator, type ThinkingState } from '@/components/thinking-states';
import { MessageContent } from '@/components/message-content';
import { ArtifactPicker } from '@/components/artifact-picker';
import {
  type Attachment,
  buildAttachmentPrefix,
  uploadFile,
} from '@/lib/attachments';
import { useAppStore } from '@/lib/store';

interface EmployeeChatProps {
  roleId: RoleId | null;
  onToggleDossier: () => void;
  isDossierOpen: boolean;
  /** 理在单聊里自主拉群时由 page.tsx 调用：切 group id + 把 viewMode 切到 group */
  onNavigateToGroup?: (groupId: string) => void;
}

// 哪些 status 需要渲染成 ThinkingIndicator（而非普通气泡）
const THINKING_STATUSES = new Set<MessageStatus>([
  'thinking', 'analyzing', 'writing', 'searching',
  'generating', 'reviewing', 'preparing',
]);

/** 扫 ```decision JSON 块，剥离正文并返回结构化对象（哲学 #4 · 全员适用） */
function extractDecision(content: string): {
  stripped: string;
  decision: { question: string; options: string[]; allowCustom: boolean } | null;
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
    if (!question || options.length === 0) return { stripped: content, decision: null };
    return {
      stripped: content.replace(m[0], '').trim(),
      decision: { question, options, allowCustom },
    };
  } catch {
    return { stripped: content, decision: null };
  }
}

/** 扫 ```create_group JSON 块（哲学 #2 · 只 chief 能拉群） */
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
    if (!name || !emoji) return { stripped: content, group: null };
    return {
      stripped: content.replace(m[0], '').trim(),
      group: { name, emoji, reason, members },
    };
  } catch {
    return { stripped: content, group: null };
  }
}

// 稳定的空消息数组引用，避免 Zustand selector 每次返回新 [] 触发 getSnapshot 无限循环
const EMPTY_MESSAGES: ChatMessage[] = [];

// 每位员工的 1v1 历史对话 mock
const CHAT_HISTORY: Record<RoleId, ChatMessage[]> = {
  chief: [
    { id: 'ch1', sender: 'chief', content: '早。今天的日程我理了一下：\n· 上午：小红书群，@策 要交本周选题框架\n· 下午 2 点：融资 BP 群，@创 的 v2 初稿该看了\n· 晚间：发布窗口，@播 会做最终确认\n另外昨天你让我记下的「不要用『赋能』这个词」我已经同步给 @创 了。', time: '09:00' },
    { id: 'ch2', sender: 'user', content: '嗯，另外我想搞一个清明节的内容', time: '09:12' },
    { id: 'ch3', sender: 'chief', content: '收到。这事需要几位同事配合，我的初判：\n· @析 先查清明赛道热度和节假日历史数据\n· @策 基于数据出三天内容框架\n· @创 按框架产出文案初稿\n· @播 最后给发布建议\n\n当前我还没有调度权限（默认 L0），以上只是建议安排。你说一声「就这么办」我就去请各位接手；或者你直接 @ 某位同事他/她就先开工。', time: '09:13' },
    { id: 'ch4', sender: 'user', content: '就这么办', time: '09:14' },
    { id: 'ch5', sender: 'chief', content: '好的，我先把需求和历史偏好同步给 @析，Ta 看完会告诉我们预计多久有数据。我这边会盯进度，有结果第一时间给你。', time: '09:14' },
  ],
  analyst: [
    { id: 'a1', sender: 'analyst', content: '早，刚把昨晚的小红书竞品数据清理完了。有三家值得看。', time: '09:12' },
    { id: 'a2', sender: 'user', content: '那先看流量增速最快的那家', time: '09:15' },
    { id: 'a3', sender: 'analyst', content: '@完子日记，近 30 天粉丝 +18.4%，主要靠「早 C 晚 A」选题矩阵。我拉了他们的爆款词频和发文节奏，回头给你做成一页纸。', time: '09:16' },
    { id: 'a4', sender: 'user', content: '嗯，顺便帮我对比一下我们自己的号', time: '09:20' },
    { id: 'a5', sender: 'analyst', content: '已排进今天的活。差距主要在发文频次 (他们 1.3 条/天，我们 0.5) 和夜间流量（21-23 点）。下午 2 点前给你结论。', time: '09:21' },
  ],
  planner: [
    { id: 'p1', sender: 'planner', content: '融资 BP 第一版我搭好了骨架：市场 → 产品 → 模式 → 数据 → 团队 → 融资用途。', time: '昨天 16:40' },
    { id: 'p2', sender: 'user', content: '市场那页再压一压，投资人看烦了', time: '昨天 16:42' },
    { id: 'p3', sender: 'planner', content: '好，市场从 3 页压到 1 页，留「TAM / 增速 / 我们的切口」三张图就够。我顺便把数据那页的假设条件做成可折叠。', time: '昨天 16:43' },
    { id: 'p4', sender: 'user', content: '周五前能搞定吗', time: '昨天 16:50' },
    { id: 'p5', sender: 'planner', content: '周五中午前给你 v2。中间会找 @分析员 要最近一版渠道数据，不耽误。', time: '昨天 16:51' },
  ],
  writer: [
    { id: 'w1', sender: 'writer', content: '这周三条小红书的文案初稿出炉了，都在成果库里，辛苦你看看手感。', time: '11:05' },
    { id: 'w2', sender: 'user', content: '第二条那个标题太温吞，换一版', time: '11:18' },
    { id: 'w3', sender: 'writer', content: '收到。我出三个方向：「悬念式 / 反差式 / 数字式」，中午 12 点前发你。顺便第二条的封面我也一起换了，现在这版和标题不搭。', time: '11:19' },
    { id: 'w4', sender: 'user', content: '好', time: '11:20' },
  ],
  distributor: [
    { id: 'd1', sender: 'distributor', content: '今天有两条要发。第一条 20:30 小红书 + 抖音双发；第二条我建议明天 7 点早高峰，这个点位历史点击率高 23%。', time: '10:02' },
    { id: 'd2', sender: 'user', content: '明天那条改到晚上吧，早上忙', time: '10:05' },
    { id: 'd3', sender: 'distributor', content: '晚上可以，推荐 21:00。话题词我重新选了三个，都是这周上升最快的，避开了和大盘撞车的。', time: '10:06' },
  ],
  monitor: [
    { id: 'm1', sender: 'monitor', content: '叮——上周日发的那条「早八急救包」24 小时涨粉 +412，评论区出现 3 次「求同款」关键词。', time: '08:40' },
    { id: 'm2', sender: 'user', content: '这算爆了吗', time: '08:42' },
    { id: 'm3', sender: 'monitor', content: '对我们号来说算小爆款，分数 78/100。建议 48 小时内跟一条同主题，我已经给 @创作员 发了信号。另外评论区有个潜在合作博主，要不要我加进观察列表？', time: '08:43' },
    { id: 'm4', sender: 'user', content: '加上', time: '08:45' },
    { id: 'm5', sender: 'monitor', content: '已加，有互动我第一时间告诉你。', time: '08:45' },
  ],
  coder: [
    { id: 'c1', sender: 'coder', content: '昨天评审的那版架构我落地了。把「订单 / 支付 / 通知」拆成了三个独立服务，通过事件总线解耦。', time: '昨天 15:20' },
    { id: 'c2', sender: 'user', content: '通知会不会丢？', time: '昨天 15:22' },
    { id: 'c3', sender: 'coder', content: '加了 at-least-once 语义 + 幂等键。极端情况下重复投递，但业务侧是幂等的。我还补了一个死信队列兜底，失败超过 3 次进 DLQ，我这边会收到告警。', time: '昨天 15:23' },
    { id: 'c4', sender: 'user', content: '行，老规矩——测试那边同步一下', time: '昨天 15:30' },
    { id: 'c5', sender: 'coder', content: '已经把集成测试清单给 @测试员 了，明天可以并行跑。', time: '昨天 15:31' },
  ],
  frontend: [
    { id: 'f1', sender: 'frontend', content: '右侧面板的抽屉动画调好了，从 240ms 降到 180ms，也加了 ease-out 缓动，手感顺多了。', time: '10:48' },
    { id: 'f2', sender: 'user', content: '移动端会不会卡？', time: '10:50' },
    { id: 'f3', sender: 'frontend', content: '实测 iPhone 12 和中低端安卓都 60fps 稳定。我也把阴影从 filter 换成了 box-shadow，GPU 吃得没那么重。顺便把暗黑模式下的边框对比度补到 WCAG AA。', time: '10:51' },
    { id: 'f4', sender: 'user', content: '好，封面那块记得和 @创作员 对一下', time: '10:53' },
    { id: 'f5', sender: 'frontend', content: '已同步，等 Ta 的新封面一出我就接上。', time: '10:54' },
  ],
  tester: [
    { id: 't1', sender: 'tester', content: '昨晚跑了一轮回归，86 个用例通过 84 个。有两个挂在「连续点击发送」的场景上。', time: '09:05' },
    { id: 't2', sender: 'user', content: '能复现吗', time: '09:07' },
    { id: 't3', sender: 'tester', content: '稳定复现。300ms 内连点三次发送按钮，会触发重复提交。我录了视频+日志，已经贴给 @代码员 了。建议前端侧做个防抖兜底。', time: '09:08' },
    { id: 't4', sender: 'user', content: '严重吗', time: '09:10' },
    { id: 't5', sender: 'tester', content: '中等。影响面是所有手动操作用户，但业务侧有幂等保护不会造成数据错乱。我会写进发版风险清单。', time: '09:11' },
  ],
};

export function EmployeeChat({
  roleId,
  onToggleDossier,
  isDossierOpen,
  onNavigateToGroup,
}: EmployeeChatProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 全局聊天存储：按 sessionId 分桶，切换员工不丢消息
  const sid = roleId ? soloSessionId(roleId) : null;
  const seed = useChatStore((s) => s.seed);
  const appendMsg = useChatStore((s) => s.append);
  const patchMsg = useChatStore((s) => s.patch);
  const clearSession = useChatStore((s) => s.clear);
  const messages = useChatStore((s) => (sid ? s.sessions[sid] : undefined)) ?? EMPTY_MESSAGES;

  // 理自主拉群用（仅 chief 单聊有效）
  const createGroup = useAppStore((s) => s.createGroup);
  const setCurrentGroup = useAppStore((s) => s.setCurrentGroup);
  const markAgentBusy = useAppStore((s) => s.markAgentBusy);
  const markAgentFree = useAppStore((s) => s.markAgentFree);

  useEffect(() => {
    if (!roleId || !sid) return;
    // 首次访问此 session 才播种 mock；已有对话保持不变
    seed(sid, CHAT_HISTORY[roleId] || []);
    setIsStreaming(false);
  }, [roleId, sid, seed]);

  if (!roleId || !sid) {
    return (
      <div className="h-full flex items-center justify-center bg-bg">
        <div className="text-center text-ink-3 text-sm">请选择一位员工</div>
      </div>
    );
  }

  const role = ROLES[roleId];
  const profile = AGENT_MARKET_PROFILES[roleId];
  const resume = AGENT_RESUMES[roleId];
  const colorConfig = ROLE_COLORS[roleId];

  const handleUserSend = async (text: string) => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const stamp = now.getTime();
    const userMsgId = `u-${stamp}`;
    const agentMsgId = `a-${stamp}`;

    appendMsg(sid, { id: userMsgId, sender: 'user', content: text, time });

    if (!AVAILABLE_AGENTS.has(roleId)) {
      appendMsg(sid, {
        id: agentMsgId,
        sender: roleId,
        content: `（还在入职中，暂时没法真回复。目前可对话：析、理。你可以把想法告诉 @理，由我代为转达。）`,
        time,
      });
      return;
    }

    // 占位消息先以 "thinking" 状态入场，后端发 progress 再具体化
    appendMsg(sid, {
      id: agentMsgId,
      sender: roleId,
      content: '',
      time,
      status: 'thinking',
    });
    setIsStreaming(true);
    const ac = new AbortController();
    abortRef.current = ac;
    // 全局忙碌状态
    if (roleId) {
      markAgentBusy(roleId, '和你单聊中', sid);
    }

    try {
      await streamChat(
        { message: text, agentId: roleId, sessionId: sid },
        (event) => {
          if (event.type === 'progress') {
            patchMsg(sid, agentMsgId, (m) => ({
              ...m,
              status: (event.stage as MessageStatus) ?? 'thinking',
              detail: event.detail,
            }));
          } else if (event.type === 'chunk') {
            patchMsg(sid, agentMsgId, (m) => ({
              ...m,
              content: m.content + event.text,
              // 首次收到文本：切到 streaming，MessageList 会改成普通气泡
              status: m.status === 'streaming' ? m.status : 'streaming',
            }));
          } else if (event.type === 'done') {
            // 完成时扫两种特殊代码块：
            //   ```decision      → 决策卡（全员适用，哲学 #4）
            //   ```create_group  → 理自主拉群（仅 chief，哲学 #2）
            patchMsg(sid, agentMsgId, (m) => {
              if (!m.content) return { ...m, status: 'done' };
              let working = m.content;

              // ① decision 块
              const dec = extractDecision(working);
              if (dec.decision) {
                working = dec.stripped;
                setTimeout(() => {
                  appendMsg(sid, {
                    id: `decision-${Date.now()}`,
                    sender: roleId,
                    kind: 'decision',
                    content: dec.decision!.question,
                    decisionQuestion: dec.decision!.question,
                    decisionOptions: dec.decision!.options,
                    decisionAllowCustom: dec.decision!.allowCustom,
                    time,
                  });
                }, 0);
              }

              // ② create_group 块 · 仅 chief 能拉群
              if (roleId === 'chief') {
                const cg = extractCreateGroup(working);
                if (cg.group) {
                  working = cg.stripped;
                  const { name, emoji, reason, members } = cg.group;
                  setTimeout(() => {
                    const newId = createGroup(name, emoji, members);
                    const ROLE_CN_MAP: Record<string, string> = {
                      chief: '理', analyst: '析', planner: '策', writer: '创',
                      distributor: '播', monitor: '观',
                      coder: '工', frontend: '端', tester: '测',
                    };
                    const memberDisplay = members.length > 0
                      ? ` · 成员：${members.map((r) => ROLE_CN_MAP[r] ?? r).join('/')}`
                      : '';
                    appendMsg(sid, {
                      id: `group-created-${Date.now()}`,
                      sender: 'system',
                      kind: 'system',
                      content:
                        `🎉 理创建了工作群「${emoji} ${name}」` +
                        (reason ? `（${reason}）` : '') +
                        memberDisplay +
                        `。3 秒后自动跳转过去…`,
                      time,
                    });
                    // 把视图切到群聊（由 page.tsx 切 viewMode）
                    setTimeout(() => {
                      if (onNavigateToGroup) onNavigateToGroup(newId);
                      else setCurrentGroup(newId);
                    }, 2500);
                  }, 0);
                }
              }

              if (working !== m.content) {
                return { ...m, content: working, status: 'done' };
              }
              return { ...m, status: 'done' };
            });
          } else if (event.type === 'error') {
            patchMsg(sid, agentMsgId, (m) => ({
              ...m,
              content: `（抱歉，出错了：${event.message}）`,
              status: 'error',
            }));
          }
        },
        ac.signal,
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      if (roleId) markAgentFree(roleId);
      // 被中止时当前气泡可能还在 thinking/streaming，强制收尾
      patchMsg(sid, agentMsgId, (m) => {
        if (m.status === 'streaming' || m.status === 'thinking' ||
            m.status === 'analyzing' || m.status === 'writing' ||
            m.status === 'searching' || m.status === 'generating' ||
            m.status === 'reviewing' || m.status === 'preparing') {
          return {
            ...m,
            status: 'done',
            content: m.content
              ? m.content + '\n\n_（已中止）_'
              : '（已中止）',
          };
        }
        return m;
      });
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleClearHistory = () => {
    if (!confirm(`清空与「${role.name}」的对话记录？（前后端都清）`)) return;
    clearSession(sid);
    clearServerHistory(sid);
    // 清完重新播种 mock，不至于变成空白页
    seed(sid, CHAT_HISTORY[roleId] || []);
  };

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* 顶栏 */}
      <header className="px-4 py-3 border-b border-line flex items-center justify-between bg-bg-panel">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg overflow-hidden shadow-sm">
              <Image
                src={profile.avatar}
                alt={role.name}
                width={36}
                height={36}
                className="object-cover w-full h-full"
              />
            </div>
            <div
              className={cn(
                'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg-panel',
                profile.availability === 'available' ? 'bg-active' : 'bg-busy'
              )}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-semibold text-ink">{profile.fullName}</h1>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded font-medium',
                  colorConfig.light
                )}
              >
                {role.name}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-ink-3">{profile.title}</span>
              <span className="text-ink-4 text-[10px]">·</span>
              <span className="text-xs text-ink-3 flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {resume.collaborationStats.totalTasks} 次协作
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClearHistory}
            className="p-2 rounded-lg hover:bg-bg-hover transition-colors"
            title="清空对话（前后端都清）"
          >
            <Eraser className="w-4 h-4 text-ink-3" />
          </button>
          <button
            onClick={onToggleDossier}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isDossierOpen ? 'bg-bg-hover' : 'hover:bg-bg-hover'
            )}
            title={isDossierOpen ? '收起侧栏' : '展开侧栏'}
          >
            {isDossierOpen ? (
              <PanelRightClose className="w-4 h-4 text-ink-3" />
            ) : (
              <PanelRightOpen className="w-4 h-4 text-ink-3" />
            )}
          </button>
        </div>
      </header>

      {/* 快捷指令条 */}
      <div className="px-4 py-2 border-b border-line bg-bg-sunken/40 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <Sparkles className="w-3.5 h-3.5 text-active flex-shrink-0" />
        <span className="text-[11px] text-ink-4 flex-shrink-0">快捷指令</span>
        {resume.strengths.slice(0, 3).map((s, i) => (
          <button
            key={i}
            className="text-[11px] px-2 py-0.5 bg-bg-panel border border-line rounded-full text-ink-2 hover:border-ink-4 transition-colors flex-shrink-0"
          >
            {s}
          </button>
        ))}
      </div>

      {/* 消息流 */}
      <MessageList
        key={roleId}
        messages={messages}
        roleId={roleId}
        onAnswerDecision={(msgId, answer) => {
          patchMsg(sid, msgId, (m) => ({ ...m, decisionAnswered: answer }));
          handleUserSend(answer);
        }}
      />

      {/* 输入框 */}
      <SoloComposer
        sessionId={sid}
        roleId={roleId}
        onSend={handleUserSend}
        onStop={handleStop}
        isStreaming={isStreaming}
      />
    </div>
  );
}

function MessageList({
  messages,
  roleId,
  onAnswerDecision,
}: {
  messages: ChatMessage[];
  roleId: RoleId;
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

  const role = ROLES[roleId];
  const profile = AGENT_MARKET_PROFILES[roleId];
  const colorConfig = ROLE_COLORS[roleId];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex justify-center">
        <span className="text-[11px] text-ink-4 bg-bg-sunken px-3 py-1 rounded-full">
          与 {profile.fullName} 的对话
        </span>
      </div>
      {messages.map((m) => {
        if (m.sender === 'user') {
          return (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[70%]">
                <div className="bg-ink text-white px-4 py-2.5 rounded-xl rounded-tr-sm">
                  <p className="text-sm leading-relaxed">{m.content}</p>
                </div>
                <p className="text-[10px] text-ink-4 text-right mt-1">{m.time}</p>
              </div>
            </div>
          );
        }

        // 决策卡：任何 agent 请求老板拍板（哲学 #4）
        if (m.kind === 'decision') {
          return (
            <SoloDecisionCard
              key={m.id}
              msg={m}
              onAnswer={(answer) => onAnswerDecision(m.id, answer)}
            />
          );
        }

        // 进行时：content 为空 + status 属于 thinking 族 → 渲染 ThinkingIndicator
        const isThinking =
          !m.content &&
          m.status !== undefined &&
          THINKING_STATUSES.has(m.status);

        if (isThinking) {
          return (
            <ThinkingIndicator
              key={m.id}
              roleId={m.sender as RoleId}
              state={m.status as ThinkingState}
              detail={m.detail}
            />
          );
        }

        return (
          <div key={m.id} className="flex gap-2.5">
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
                <span className={cn('text-sm font-medium', `text-${roleId}`)}>{role.name}</span>
                <span className="text-[10px] text-ink-4">{m.time}</span>
              </div>
              <div
                className={cn(
                  'px-4 py-2.5 rounded-xl rounded-tl-sm max-w-[85%]',
                  colorConfig.light
                )}
              >
                <MessageContent content={m.content} />
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

function SoloComposer({
  sessionId,
  roleId,
  onSend,
  onStop,
  isStreaming,
}: {
  sessionId: string;
  roleId: RoleId;
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
}) {
  // 草稿持久化到 zustand —— 切页面 / 换员工 / 刷新前都不丢
  const value = useChatStore((s) => s.drafts[sessionId] ?? '');
  const setDraft = useChatStore((s) => s.setDraft);
  const clearDraft = useChatStore((s) => s.clearDraft);
  const setValue = (v: string) => setDraft(sessionId, v);
  const role = ROLES[roleId];

  // 附件（组件本地 state；不跨会话持久化）
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
    e.target.value = ''; // 允许再选同一文件
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSend = () => {
    const hasText = value.trim().length > 0;
    if ((!hasText && !attachments.length) || isStreaming) return;
    const prefix = buildAttachmentPrefix(attachments);
    const toSend = prefix + value;
    clearDraft(sessionId);
    setAttachments([]);
    onSend(toSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasInput = value.trim().length > 0 || attachments.length > 0;

  return (
    <div className="p-4 border-t border-line bg-bg-panel">
      <div className="relative bg-bg-sunken rounded-xl border border-line focus-within:border-ink-4 focus-within:shadow-sm transition-all">
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
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`直接对 ${role.name} 说...`}
          className="w-full px-4 py-3 bg-transparent text-sm text-ink placeholder:text-ink-4 resize-none focus:outline-none"
          rows={2}
        />
        <div className="flex items-center justify-between px-3 py-2 border-t border-line">
          <div className="flex items-center gap-1">
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
              title="中止当前回复（前端立刻停 + 后端 kill 子进程）"
            >
              <Square className="w-3 h-3 fill-current" />
              停止
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!hasInput}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors',
                hasInput
                  ? 'bg-ink text-white hover:bg-ink-2'
                  : 'bg-ink-4 text-ink-3 cursor-not-allowed'
              )}
            >
              <Send className="w-3.5 h-3.5" />
              发送
            </button>
          )}
        </div>
      </div>

      {/* 隐藏的文件选择 input（由 Paperclip 触发） */}
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

/* ---------------------------- 单聊决策卡 ---------------------------- */

function SoloDecisionCard({
  msg,
  onAnswer,
}: {
  msg: ChatMessage;
  onAnswer: (answer: string) => void;
}) {
  const senderRole = (msg.sender as RoleId) ?? 'chief';
  const profile = AGENT_MARKET_PROFILES[senderRole];
  const role = ROLES[senderRole];
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
          alt={role.name}
          width={32}
          height={32}
          className="object-cover w-full h-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('text-sm font-medium', `text-${senderRole}`)}>
            {role.name}
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
