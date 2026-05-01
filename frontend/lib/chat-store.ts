/**
 * 聊天会话存储（zustand）
 *
 * 按 sessionId 分桶保存消息，切换员工 / 群聊不重置。
 *
 * sessionId 约定：
 *   - 单聊: `solo:${roleId}`（例：`solo:chief`）
 *   - 群聊: `group:${groupId}`（例：`group:g1`）
 *
 * 后端 server/main.py 的 CHAT_HISTORY 用同一个 sessionId 作 key，保证
 * 前后端视角的会话历史对齐。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { RoleId } from './types';
import type { ArtifactManifest } from './api';

/**
 * 对应 thinking-states.tsx 的 ThinkingState 7 值 + 'streaming' + 'done' + 'error'。
 * 'thinking' 类的值（analyzing/writing/…）用于渲染 ThinkingIndicator。
 */
export type MessageStatus =
  | 'thinking' | 'analyzing' | 'writing' | 'searching'
  | 'generating' | 'reviewing' | 'preparing'
  | 'streaming' | 'done' | 'error';

/** 消息种类（默认 'text'；群聊扩展 system/dispatch/handoff/discussion/decision/pass/mention） */
export type MessageKind =
  | 'text' | 'system' | 'dispatch' | 'handoff' | 'discussion' | 'decision'
  | 'pass' | 'mention';

export type ChatMessage = {
  id: string;
  /** 'user' · 'system'（群聊用）· RoleId */
  sender: 'user' | 'system' | RoleId;
  /** 'text' 是普通对话；'dispatch'/'handoff' 是群聊下的结构化系统消息 */
  kind?: MessageKind;
  content: string;
  time: string;
  /** agent 消息的进行时状态；user 消息不用 */
  status?: MessageStatus;
  /** 状态的补充文字（前端显示小字） */
  detail?: string;

  // —— 群聊 kind='dispatch' 时的附加字段（理的分派计划）——
  plan?: string;
  steps?: { to: string; task: string }[];

  // —— 群聊 kind='discussion' 时的附加字段（理的讨论议题 · 含锚点）——
  topic?: string;
  question?: string;
  participants?: string[];
  scopeIn?: string[];
  scopeOut?: string[];
  deadlineTurns?: number;
  /** 场景流（discuss / broadcast / direct）- 决定讨论卡的渲染风格 */
  flowType?: 'discuss' | 'broadcast' | 'direct';

  // —— 群聊 kind='pass'（员工本轮跳过）/ 'mention'（@ 插队）时的附加字段 ——
  passReason?: string;
  mentionFrom?: string;
  mentionTo?: string;
  turnIndex?: number;

  // —— 群聊 kind='decision' 时的附加字段（请老板拍板的选项卡）——
  // 哲学 #4：ai 请求用户决策必须以 artifact 卡片形式，选项外支持自定义输入
  decisionQuestion?: string;
  decisionOptions?: string[];
  decisionAllowCustom?: boolean;
  decisionAnswered?: string;  // 用户选中/输入的答案（已回答则此条卡片变只读）

  // —— 群聊 kind='handoff' 时的附加字段（理 → 某员工的交接提示）——
  handoffFrom?: string;
  handoffTo?: string;
  handoffTask?: string;
  stepIdx?: number;
  stepTotal?: number;

  // —— 归档产出引用（agent 完成一步后由后端 artifact_saved 事件触发挂载）——
  // 哲学 #3 #7：前台只展示摘要卡 + 跳链，细节在后台 outputs/。
  artifact?: ArtifactManifest;

  // —— agent 气泡阶段（决定内容展示策略）——
  // 'execute' = 任务执行中，**不展示 chunk 文本**，全程 thinking + 字数计数，
  //              done 后显示 "✓《标题》" + artifact 卡
  // 'summary'/'direct'/'discuss'/'discuss-summary' = 正常流式对话，全文展示
  phase?: 'dispatch' | 'execute' | 'summary' | 'direct' | 'discuss' | 'discuss-summary';

  // —— execute 阶段的实时字数（代替 content 展示）——
  charCount?: number;
};

type SessionKey = string;

interface ChatStore {
  sessions: Record<SessionKey, ChatMessage[]>;
  /** 每个 session 的输入框草稿，切页面/换员工/换群不丢 */
  drafts: Record<SessionKey, string>;

  /** 首次访问某 session 时播种初始消息（mock 历史）。已存在则不动。 */
  seed: (sid: SessionKey, initial: ChatMessage[]) => void;

  /** 追加一条消息。 */
  append: (sid: SessionKey, msg: ChatMessage) => void;

  /** 按消息 id 更新该消息（用于流式 chunk 追加到已存在的气泡）。 */
  patch: (sid: SessionKey, msgId: string, updater: (prev: ChatMessage) => ChatMessage) => void;

  /** 清空某 session 的消息。前端和后端历史都会被清（调用方负责调后端 DELETE /history/:sid）。 */
  clear: (sid: SessionKey) => void;

  /** 读取消息（不修改）。组件内可直接 useChatStore(s => s.sessions[sid]) 订阅。 */
  get: (sid: SessionKey) => ChatMessage[];

  /** 保存 session 输入框草稿 */
  setDraft: (sid: SessionKey, text: string) => void;

  /** 清空 session 输入框草稿（发送后调用） */
  clearDraft: (sid: SessionKey) => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: {},
      drafts: {},

      seed: (sid, initial) =>
        set((s) => {
          if (s.sessions[sid] !== undefined) return s; // 已有则保留
          return { sessions: { ...s.sessions, [sid]: initial } };
        }),

      append: (sid, msg) =>
        set((s) => ({
          sessions: { ...s.sessions, [sid]: [...(s.sessions[sid] ?? []), msg] },
        })),

      patch: (sid, msgId, updater) =>
        set((s) => ({
          sessions: {
            ...s.sessions,
            [sid]: (s.sessions[sid] ?? []).map((m) => (m.id === msgId ? updater(m) : m)),
          },
        })),

      clear: (sid) =>
        set((s) => ({ sessions: { ...s.sessions, [sid]: [] } })),

      get: (sid) => get().sessions[sid] ?? [],

      setDraft: (sid, text) =>
        set((s) => ({ drafts: { ...s.drafts, [sid]: text } })),

      clearDraft: (sid) =>
        set((s) => {
          if (!(sid in s.drafts)) return s;
          const next = { ...s.drafts };
          delete next[sid];
          return { drafts: next };
        }),
    }),
    {
      name: 'youle-chat-v1',
      // 只持久化 sessions + drafts，action 函数不进 localStorage
      partialize: (state) => ({
        sessions: state.sessions,
        drafts: state.drafts,
      }),
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

export function soloSessionId(roleId: string): SessionKey {
  return `solo:${roleId}`;
}

export function groupSessionId(groupId: string): SessionKey {
  return `group:${groupId}`;
}

/** 清空后端对应 session 的历史。前端 store 由调用方自行 clear()。
 *  Mock 模式（无后端 URL）下直接 no-op；前端 clear() 已经满足展示需求。 */
export async function clearServerHistory(sessionId: string): Promise<void> {
  const API_BASE = process.env.NEXT_PUBLIC_AGENT_SERVER_URL;
  if (!API_BASE) return;
  try {
    await fetch(`${API_BASE}/history/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  } catch {
    // 后端不可达就算了
  }
}
