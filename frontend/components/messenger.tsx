'use client';

/**
 * 三列消息客户端布局：左侧导航 / 中部会话列表 / 右侧对话区。
 *
 * 锁死两个群：
 *   - antiscam-video（反诈短视频制作群） → 后端 skill_match 命中 anti_scam_video
 *   - ecommerce-content（电商内容制作群） → 命中 ecommerce_main_image / xiaohongshu 等
 *
 * 不依赖 lib/store.ts（V0 demo 状态机），直接走 streamTeamChat → /chat/team。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  MessageSquare,
  Users,
  Folder,
  Settings,
  Send,
  Smile,
  Paperclip,
  Mic,
  ChevronDown,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { streamTeamChat, type TeamSSEEvent } from '@/lib/api';

type Group = {
  id: string;
  name: string;
  emoji: string;
  intro: string;
  /** 群人数（展示用） */
  memberCount: number;
};

const GROUPS: Group[] = [
  {
    id: 'antiscam-video',
    name: '反诈短视频制作群',
    emoji: '🛡️',
    intro: '把新闻 / 案例转成 60 秒反诈短视频。脚本 → 配图 → 配音 → 视频合成。',
    memberCount: 6,
  },
  {
    id: 'ecommerce-content',
    name: '电商内容制作群',
    emoji: '🛒',
    intro: '电商主图 / 详情页 / 小红书种草 / 抖音口播 — 一句话出物料。',
    memberCount: 5,
  },
];

type Bubble = {
  id: string;
  side: 'me' | 'them';
  /** 显示在气泡上方的发送者；'me' 时不显示 */
  author?: string;
  text: string;
  /** 系统消息（撤销 / 加群 / 灰色提示） */
  kind?: 'text' | 'system';
  /** 流式中的"等待"占位 */
  pending?: boolean;
};

function nowHM(): string {
  const d = new Date();
  const h = `${d.getHours()}`.padStart(2, '0');
  const m = `${d.getMinutes()}`.padStart(2, '0');
  return `${h}:${m}`;
}

function lastPreview(bubbles: Bubble[]): string {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    if (b.kind === 'system') continue;
    return b.side === 'me' ? `你：${b.text}` : b.text;
  }
  return '点击开始对话';
}

export function Messenger() {
  const [activeId, setActiveId] = useState<string>(GROUPS[0].id);
  const [draft, setDraft] = useState('');
  const [bubblesByGroup, setBubblesByGroup] = useState<Record<string, Bubble[]>>(
    () => Object.fromEntries(GROUPS.map((g) => [g.id, [] as Bubble[]])),
  );
  const [streamingByGroup, setStreamingByGroup] = useState<Record<string, boolean>>({});
  const [previewByGroup, setPreviewByGroup] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const active = useMemo(
    () => GROUPS.find((g) => g.id === activeId) ?? GROUPS[0],
    [activeId],
  );
  const bubbles = bubblesByGroup[activeId] ?? [];
  const streaming = !!streamingByGroup[activeId];

  // 自动滚到底
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [bubbles, activeId]);

  // 切群时取消进行中的请求
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function patchBubbles(groupId: string, fn: (prev: Bubble[]) => Bubble[]) {
    setBubblesByGroup((s) => ({ ...s, [groupId]: fn(s[groupId] ?? []) }));
  }

  function setStreaming(groupId: string, v: boolean) {
    setStreamingByGroup((s) => ({ ...s, [groupId]: v }));
  }

  async function send() {
    const text = draft.trim();
    if (!text || streaming) return;
    setDraft('');

    const targetGroupId = activeId;
    const myMsg: Bubble = {
      id: `me-${Date.now()}`,
      side: 'me',
      text,
    };
    patchBubbles(targetGroupId, (b) => [...b, myMsg]);
    setPreviewByGroup((s) => ({ ...s, [targetGroupId]: `你：${text}` }));

    // 一个 agent_id → 一个气泡的映射
    const agentBubbleIds: Record<string, string> = {};
    setStreaming(targetGroupId, true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    function handleEvent(ev: TeamSSEEvent) {
      switch (ev.type) {
        case 'agent_start': {
          const id = `bot-${ev.agent_id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          agentBubbleIds[ev.agent_id] = id;
          patchBubbles(targetGroupId, (b) => [
            ...b,
            { id, side: 'them', author: ev.agent_name || ev.agent_id, text: '', pending: true },
          ]);
          break;
        }
        case 'chunk': {
          const id = agentBubbleIds[ev.agent_id];
          if (!id) {
            // 没 agent_start 直接 chunk：也建一个匿名气泡
            const fb = `bot-anon-${Date.now()}`;
            agentBubbleIds[ev.agent_id || '_'] = fb;
            patchBubbles(targetGroupId, (b) => [
              ...b,
              { id: fb, side: 'them', author: ev.agent_id || '助手', text: ev.text },
            ]);
            return;
          }
          patchBubbles(targetGroupId, (b) =>
            b.map((x) =>
              x.id === id ? { ...x, text: x.text + ev.text, pending: false } : x,
            ),
          );
          setPreviewByGroup((s) => ({ ...s, [targetGroupId]: ev.text.slice(0, 30) }));
          break;
        }
        case 'agent_done': {
          const id = agentBubbleIds[ev.agent_id];
          if (id) {
            patchBubbles(targetGroupId, (b) =>
              b.map((x) => (x.id === id ? { ...x, pending: false } : x)),
            );
          }
          break;
        }
        case 'dispatch': {
          patchBubbles(targetGroupId, (b) => [
            ...b,
            {
              id: `sys-dispatch-${Date.now()}`,
              side: 'them',
              kind: 'system',
              text: `已分派 · ${ev.steps.length} 个步骤`,
            },
          ]);
          break;
        }
        case 'handoff': {
          patchBubbles(targetGroupId, (b) => [
            ...b,
            {
              id: `sys-handoff-${Date.now()}-${ev.step_idx}`,
              side: 'them',
              kind: 'system',
              text: `${ev.from} → ${ev.to}：${ev.task}`,
            },
          ]);
          break;
        }
        case 'artifact_saved': {
          const m = ev.manifest;
          patchBubbles(targetGroupId, (b) => [
            ...b,
            {
              id: `sys-artifact-${m.id || Date.now()}`,
              side: 'them',
              kind: 'system',
              text: `产出已归档：${m.title || m.file}`,
            },
          ]);
          break;
        }
        case 'error': {
          patchBubbles(targetGroupId, (b) => [
            ...b,
            {
              id: `sys-err-${Date.now()}`,
              side: 'them',
              kind: 'system',
              text: `出错：${ev.message}`,
            },
          ]);
          break;
        }
        case 'done': {
          setStreaming(targetGroupId, false);
          break;
        }
        default:
          break;
      }
    }

    try {
      await streamTeamChat(
        { message: text, sessionId: `group:${targetGroupId}` },
        handleEvent,
        ctrl.signal,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      patchBubbles(targetGroupId, (b) => [
        ...b,
        {
          id: `sys-err-${Date.now()}`,
          side: 'them',
          kind: 'system',
          text: `请求失败：${msg}`,
        },
      ]);
    } finally {
      setStreaming(targetGroupId, false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setStreaming(activeId, false);
  }

  return (
    <div className="h-screen w-screen flex bg-[#EDEDED] text-[#1A1817] overflow-hidden">
      {/* ========== 左侧导航 ========== */}
      <nav className="w-[58px] flex flex-col items-center py-3 bg-[#2E2E2E] text-white/80 select-none">
        <div className="w-9 h-9 rounded-md bg-[#07C160] text-white flex items-center justify-center font-serif text-base font-semibold mb-4">
          有
        </div>
        <ul className="flex flex-col items-center gap-2 mt-1">
          <NavBtn icon={MessageSquare} active title="聊天" badge={2} />
          <NavBtn icon={Users} title="联系人" />
          <NavBtn icon={Folder} title="收藏" />
        </ul>
        <div className="mt-auto flex flex-col items-center gap-2">
          <NavBtn icon={Settings} title="设置" />
        </div>
      </nav>

      {/* ========== 中部会话列表 ========== */}
      <aside className="w-[280px] bg-[#F7F7F7] border-r border-[#E5E5E5] flex flex-col">
        <div className="px-3 py-3 border-b border-[#E5E5E5]">
          <div className="flex items-center gap-2 bg-white rounded-md px-2 py-1.5 border border-[#E5E5E5]">
            <Search className="w-3.5 h-3.5 text-[#999]" />
            <input
              placeholder="搜索"
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-[#999]"
            />
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {GROUPS.map((g) => {
            const isActive = g.id === activeId;
            const list = bubblesByGroup[g.id] ?? [];
            const preview = previewByGroup[g.id] || lastPreview(list);
            return (
              <li
                key={g.id}
                onClick={() => setActiveId(g.id)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-[#EDEDED]',
                  isActive ? 'bg-[#E5E5E5]' : 'hover:bg-[#EDEDED]',
                )}
              >
                <div className="w-10 h-10 rounded-md bg-[#D9D9D9] flex items-center justify-center text-xl shrink-0">
                  {g.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{g.name}</span>
                    <span className="text-[11px] text-[#999] ml-2 shrink-0">{nowHM()}</span>
                  </div>
                  <div className="text-xs text-[#888] truncate mt-0.5">{preview}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ========== 右侧对话区 ========== */}
      <main className="flex-1 flex flex-col bg-[#F5F5F5] min-w-0">
        {/* header */}
        <header className="h-[55px] px-5 flex items-center justify-between bg-white border-b border-[#E5E5E5]">
          <div className="font-medium text-[15px]">
            {active.name}
            <span className="text-[#999] ml-2 font-normal">({active.memberCount})</span>
          </div>
          <button className="text-[#666] hover:text-[#333]">
            <ChevronDown className="w-4 h-4" />
          </button>
        </header>

        {/* 群公告条 */}
        <div className="mx-5 mt-3 px-3 py-2 bg-white border border-[#E5E5E5] rounded-md text-xs text-[#666] flex items-center gap-2">
          <span>📢</span>
          <span className="flex-1 truncate">{active.intro}</span>
        </div>

        {/* messages */}
        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {bubbles.length === 0 && (
            <div className="text-center text-xs text-[#999] py-12">
              发条消息试试 · 比如{' '}
              <code className="bg-white border border-[#E5E5E5] px-1.5 py-0.5 rounded">
                {active.id === 'antiscam-video'
                  ? '做一支反诈短视频'
                  : '帮我做一张电商主图'}
              </code>
            </div>
          )}
          {bubbles.map((b, i) => {
            if (b.kind === 'system') {
              return (
                <div key={b.id} className="text-center">
                  <span className="inline-block text-[11px] text-[#999] bg-[#E8E8E8] px-2 py-0.5 rounded">
                    {b.text}
                  </span>
                </div>
              );
            }
            // 同一作者连续消息合并 author 显示
            const prev = i > 0 ? bubbles[i - 1] : null;
            const showAuthor =
              b.side === 'them' &&
              (!prev || prev.kind === 'system' || prev.author !== b.author);

            return (
              <div
                key={b.id}
                className={cn(
                  'flex gap-2 max-w-full',
                  b.side === 'me' ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 shrink-0 rounded flex items-center justify-center text-white text-xs font-medium',
                    b.side === 'me' ? 'bg-[#07C160]' : 'bg-[#576B95]',
                  )}
                >
                  {b.side === 'me' ? '我' : (b.author?.[0] ?? 'A')}
                </div>
                <div
                  className={cn(
                    'flex flex-col min-w-0',
                    b.side === 'me' ? 'items-end' : 'items-start',
                  )}
                >
                  {showAuthor && b.author && (
                    <span className="text-[11px] text-[#888] mb-1">{b.author}</span>
                  )}
                  <div
                    className={cn(
                      'relative max-w-[520px] px-3 py-2 text-sm rounded-md whitespace-pre-wrap break-words',
                      b.side === 'me'
                        ? 'bg-[#95EC69] text-[#1A1817]'
                        : 'bg-white border border-[#E5E5E5]',
                    )}
                  >
                    {b.text || (b.pending ? '正在输入…' : '')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* input */}
        <div className="bg-white border-t border-[#E5E5E5]">
          <div className="px-4 py-2 flex items-center gap-3 text-[#666]">
            <button title="表情" className="hover:text-[#333]">
              <Smile className="w-4 h-4" />
            </button>
            <button title="文件" className="hover:text-[#333]">
              <Paperclip className="w-4 h-4" />
            </button>
            <button title="语音" className="hover:text-[#333]">
              <Mic className="w-4 h-4" />
            </button>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={streaming ? '正在生成中…（Shift+Enter 换行）' : '输入消息（Enter 发送 / Shift+Enter 换行）'}
            disabled={streaming}
            rows={3}
            className="w-full resize-none bg-white px-4 pb-2 text-sm outline-none disabled:bg-[#FAFAFA]"
          />
          <div className="px-4 pb-3 flex justify-end gap-2">
            {streaming && (
              <button
                onClick={stop}
                className="px-3 py-1 text-xs border border-[#E5E5E5] rounded text-[#666] hover:bg-[#F5F5F5] flex items-center gap-1"
              >
                <Square className="w-3 h-3" />
                停止
              </button>
            )}
            <button
              onClick={send}
              disabled={!draft.trim() || streaming}
              className={cn(
                'px-4 py-1 text-xs rounded flex items-center gap-1',
                draft.trim() && !streaming
                  ? 'bg-[#07C160] text-white hover:bg-[#06A551]'
                  : 'bg-[#F5F5F5] text-[#999]',
              )}
            >
              <Send className="w-3 h-3" />
              发送
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavBtn({
  icon: Icon,
  title,
  active,
  badge,
}: {
  icon: typeof MessageSquare;
  title: string;
  active?: boolean;
  badge?: number;
}) {
  return (
    <li className="relative">
      <button
        title={title}
        className={cn(
          'w-9 h-9 rounded flex items-center justify-center transition-colors',
          active ? 'bg-white/15 text-white' : 'hover:bg-white/10',
        )}
      >
        <Icon className="w-[18px] h-[18px]" />
      </button>
      {badge ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#FA5151] text-white text-[10px] flex items-center justify-center">
          {badge}
        </span>
      ) : null}
    </li>
  );
}
