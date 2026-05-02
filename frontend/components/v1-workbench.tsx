'use client';

/**
 * V1 主编排工作台 — 完整对接 backend `/v1/conduct` SSE 与 `/v1/skills`。
 *
 * 流程：
 *   1. 用户输入需求 → 流式调用 streamV1Conduct
 *   2. 后端依次发：start → intent_parsed → (clarify_required | skill_selected →
 *      agent_start/chunk/agent_done* → deliverable) → done
 *   3. 命中 clarify_required → 渲染选项面板，用户答完后用 clarify_answers 重发
 *   4. 落地的 chunk / artifact 实时渲染到事件流面板
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  FileSpreadsheet,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  listV1Skills,
  streamV1Conduct,
  type V1Skill,
  type V1ClarifyQuestion,
  type V1ConductEvent,
  type V1CapabilityKey,
} from '@/lib/api';

// ============================================================================
// 4 个能力 agent 的视觉
// ============================================================================

const CAPABILITIES: {
  id: V1CapabilityKey;
  name: string;
  Icon: typeof FileText;
  desc: string;
  color: string;
}[] = [
  { id: 'T', name: '文字', Icon: FileText, desc: '写作 / 推理 / 分析', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'I', name: '图', Icon: ImageIcon, desc: '理解 / 生成 / 改图', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'V', name: '视频', Icon: VideoIcon, desc: '剪辑 / 合成 / 配音', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  { id: 'D', name: '文档', Icon: FileSpreadsheet, desc: 'PPT / Excel / DOC', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
];

// ============================================================================
// 内部事件模型 — 把 SSE 事件流压成可渲染的"卡片"列表
// ============================================================================

type WorkbenchCard =
  | { kind: 'user'; text: string }
  | { kind: 'intent'; intent: Record<string, unknown> }
  | { kind: 'clarify'; questions: V1ClarifyQuestion[]; answered?: boolean }
  | { kind: 'skill'; skill_id: string; name: string; reason?: string }
  | {
      kind: 'agent';
      capability: V1CapabilityKey;
      task?: string;
      step_idx?: number;
      chunks: string[];
      artifacts: V1ConductEvent[];
      done: boolean;
    }
  | { kind: 'deliverable'; skill_id: string; count: number }
  | { kind: 'warning'; message: string; capability?: V1CapabilityKey }
  | { kind: 'error'; message: string }
  | { kind: 'done' };


// ============================================================================
// 主组件
// ============================================================================

export function V1Workbench() {
  const [input, setInput] = useState('');
  const [sessionId] = useState(
    () => `v1:${Math.random().toString(16).slice(2, 14)}`,
  );
  const [cards, setCards] = useState<WorkbenchCard[]>([]);
  const [running, setRunning] = useState(false);
  const [skills, setSkills] = useState<V1Skill[]>([]);
  const [skillsLoadError, setSkillsLoadError] = useState<string | null>(null);
  const [pendingClarify, setPendingClarify] = useState<{
    questions: V1ClarifyQuestion[];
    originalMessage: string;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    listV1Skills()
      .then((s) => {
        setSkills(s);
        setSkillsLoadError(null);
      })
      .catch((err) =>
        setSkillsLoadError(err instanceof Error ? err.message : String(err)),
      );
  }, []);

  // 自动滚到底
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [cards]);

  const activeAgents = useMemo(() => {
    const set = new Set<V1CapabilityKey>();
    for (const c of cards) {
      if (c.kind === 'agent' && !c.done) set.add(c.capability);
    }
    return set;
  }, [cards]);

  // ---------- SSE 事件流处理 ----------
  function appendEvent(ev: V1ConductEvent) {
    setCards((prev) => {
      const next = [...prev];
      switch (ev.type) {
        case 'start':
          break;
        case 'intent_parsed':
          next.push({ kind: 'intent', intent: ev.intent });
          break;
        case 'clarify_required':
          next.push({ kind: 'clarify', questions: ev.questions });
          break;
        case 'skill_selected':
          next.push({
            kind: 'skill',
            skill_id: ev.skill_id,
            name: ev.name,
            reason: ev.reason,
          });
          break;
        case 'agent_start':
          next.push({
            kind: 'agent',
            capability: ev.capability,
            task: ev.task,
            step_idx: ev.step_idx,
            chunks: [],
            artifacts: [],
            done: false,
          });
          break;
        case 'chunk': {
          // 把 chunk 拼到最近一个未完成的 agent 卡上
          for (let i = next.length - 1; i >= 0; i--) {
            const c = next[i];
            if (c.kind === 'agent' && !c.done) {
              c.chunks.push(ev.text);
              return [...next];
            }
          }
          break;
        }
        case 'artifact': {
          for (let i = next.length - 1; i >= 0; i--) {
            const c = next[i];
            if (c.kind === 'agent' && !c.done) {
              c.artifacts.push(ev);
              return [...next];
            }
          }
          break;
        }
        case 'agent_done': {
          for (let i = next.length - 1; i >= 0; i--) {
            const c = next[i];
            if (c.kind === 'agent' && !c.done && c.capability === ev.capability) {
              c.done = true;
              return [...next];
            }
          }
          break;
        }
        case 'deliverable':
          next.push({
            kind: 'deliverable',
            skill_id: ev.skill_id,
            count: Array.isArray(ev.artifacts) ? ev.artifacts.length : 0,
          });
          break;
        case 'warning':
          next.push({
            kind: 'warning',
            message: ev.message,
            capability: ev.capability,
          });
          break;
        case 'error':
          next.push({ kind: 'error', message: ev.message });
          break;
        case 'done':
          next.push({ kind: 'done' });
          break;
      }
      return next;
    });
  }

  // ---------- 提交 ----------
  async function submit(text: string, clarifyAnswers?: Record<string, string>) {
    if (!text.trim() || running) return;
    setRunning(true);
    setPendingClarify(null);

    const ac = new AbortController();
    abortRef.current = ac;

    setCards((prev) => [...prev, { kind: 'user', text }]);

    let sawClarify = false;
    let lastClarify: V1ClarifyQuestion[] | null = null;

    try {
      await streamV1Conduct(
        { message: text, sessionId, clarifyAnswers },
        (ev) => {
          if (ev.type === 'clarify_required') {
            sawClarify = true;
            lastClarify = ev.questions;
          }
          appendEvent(ev);
        },
        ac.signal,
      );
    } catch (e) {
      appendEvent({
        type: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRunning(false);
      abortRef.current = null;
      if (sawClarify && lastClarify) {
        setPendingClarify({ questions: lastClarify, originalMessage: text });
      }
    }
  }

  function handleAnswerClarify(answers: Record<string, string>) {
    if (!pendingClarify) return;
    // 把澄清回答 + 原话拼成新一轮请求
    const enriched =
      pendingClarify.originalMessage +
      ' [澄清: ' +
      Object.entries(answers)
        .map(([k, v]) => `${k}=${v}`)
        .join(' / ') +
      ']';
    submit(enriched, answers);
  }

  function handleAbort() {
    abortRef.current?.abort();
    setRunning(false);
  }

  // ---------- 渲染 ----------
  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto w-full">
      {skillsLoadError && (
        <div className="mx-6 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="font-medium">连不上后端 / 无法加载 skill 列表</p>
            <p className="mt-1 text-amber-950/85">{skillsLoadError}</p>
          </div>
        </div>
      )}
      {/* 4 能力 agent 面板 */}
      <div className="px-6 py-4 border-b border-line">
        <div className="grid grid-cols-4 gap-3">
          {CAPABILITIES.map((cap) => {
            const isActive = activeAgents.has(cap.id);
            return (
              <div
                key={cap.id}
                className={cn(
                  'border rounded-xl p-3 transition-all',
                  cap.color,
                  isActive && 'ring-2 ring-offset-1 ring-current animate-pulse',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <cap.Icon className="w-4 h-4" />
                  <span className="font-medium text-sm">{cap.name}</span>
                  {isActive && (
                    <Loader2 className="w-3 h-3 ml-auto animate-spin" />
                  )}
                </div>
                <p className="text-[11px] opacity-80">{cap.desc}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-ink-3">
          <Sparkles className="inline w-3 h-3 mr-1" />
          主编排在 {skills.length || '...'} 个 skill 中按你的意图自动选择并派工
        </p>
      </div>

      {/* 事件流 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
        {cards.length === 0 ? (
          <EmptyState skills={skills} onPick={(prompt) => submit(prompt)} />
        ) : (
          cards.map((card, i) => <CardView key={i} card={card} />)
        )}

        {pendingClarify && (
          <ClarifyPanel
            questions={pendingClarify.questions}
            onAnswer={handleAnswerClarify}
          />
        )}
      </div>

      {/* 输入区 */}
      <div className="border-t border-line p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = input;
            setInput('');
            submit(t);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={running}
            placeholder={
              running
                ? '主编排工作中...'
                : '告诉主编排你要做什么，例如：帮我给面膜写小红书标题'
            }
            className="flex-1 px-4 py-2.5 bg-bg-panel border border-line rounded-lg text-sm focus:outline-none focus:border-ink-3 disabled:opacity-50"
          />
          {running ? (
            <button
              type="button"
              onClick={handleAbort}
              className="px-4 py-2 bg-bg-sunken text-ink-2 text-sm rounded-lg hover:bg-bg-hover"
            >
              中止
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-4 py-2 bg-ink text-white text-sm rounded-lg hover:bg-ink-2 disabled:opacity-40 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              发送
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 子组件
// ============================================================================

function EmptyState({
  skills,
  onPick,
}: {
  skills: V1Skill[];
  onPick: (prompt: string) => void;
}) {
  const samples = [
    '帮我给面膜写小红书爆款标题',
    '生成一份咖啡店 8 月复盘 PPT',
    '做一张面膜电商主图，日系简约',
    '帮我做一个反诈短视频',
  ];
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-12">
      <Sparkles className="w-10 h-10 text-active mb-3" />
      <h3 className="font-serif text-lg font-semibold text-ink mb-1">
        告诉主编排你要做什么
      </h3>
      <p className="text-sm text-ink-3 mb-6 text-center max-w-md">
        主编排会理解你的话，自动选 skill，分给对应能力 agent 干活。<br />
        模糊的话也行，它会反问你。
      </p>
      <div className="space-y-2 w-full max-w-md">
        <p className="text-xs text-ink-4 mb-2">试试这些：</p>
        {samples.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="block w-full text-left px-4 py-2 bg-bg-panel border border-line rounded-lg text-sm text-ink-2 hover:border-ink-3 hover:bg-bg-hover transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
      {skills.length > 0 && (
        <p className="mt-6 text-[11px] text-ink-4">
          已注册 {skills.length} 个 skill：
          {skills.map((s) => s.name).join(' · ')}
        </p>
      )}
    </div>
  );
}

function CardView({ card }: { card: WorkbenchCard }) {
  switch (card.kind) {
    case 'user':
      return (
        <div className="flex justify-end">
          <div className="max-w-[80%] bg-ink text-white rounded-2xl rounded-tr-sm px-4 py-2 text-sm">
            {card.text}
          </div>
        </div>
      );
    case 'intent': {
      const i = card.intent as Record<string, unknown>;
      const conf = typeof i.confidence === 'number' ? i.confidence : 0;
      return (
        <SystemCard
          icon={<Sparkles className="w-3.5 h-3.5" />}
          title="意图理解"
        >
          <div className="text-xs text-ink-3 space-y-1">
            <div>
              <span className="text-ink-4">vertical</span>{' '}
              <code className="font-mono text-[11px]">{String(i.vertical)}</code>
              {'  '}
              <span className="text-ink-4">deliverable</span>{' '}
              <code className="font-mono text-[11px]">
                {String(i.deliverable_type)}
              </code>
            </div>
            <div>
              <span className="text-ink-4">subject</span>{' '}
              <span className="text-ink-2">{String(i.subject || '—')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ink-4">confidence</span>
              <div className="flex-1 max-w-32 h-1 bg-bg-sunken rounded-full overflow-hidden">
                <div
                  className="h-full bg-active"
                  style={{ width: `${Math.round(conf * 100)}%` }}
                />
              </div>
              <span className="font-mono text-[11px]">
                {(conf * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </SystemCard>
      );
    }
    case 'clarify':
      return (
        <SystemCard
          icon={<HelpCircle className="w-3.5 h-3.5" />}
          title="需要澄清"
          tone="warning"
        >
          <p className="text-xs text-ink-3">
            主编排正在等你回答（在下方回答面板）
          </p>
        </SystemCard>
      );
    case 'skill':
      return (
        <SystemCard
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          title={`选定 skill：${card.name}`}
        >
          <div className="text-xs text-ink-3 space-y-0.5">
            <div className="font-mono text-[11px]">{card.skill_id}</div>
            {card.reason && <div className="italic">{card.reason}</div>}
          </div>
        </SystemCard>
      );
    case 'agent': {
      const cap = CAPABILITIES.find((c) => c.id === card.capability);
      const Icon = cap?.Icon ?? FileText;
      return (
        <div
          className={cn(
            'border rounded-xl p-3',
            cap?.color ?? 'bg-bg-panel border-line',
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon className="w-3.5 h-3.5" />
            <span className="font-medium text-sm">
              {cap?.name ?? card.capability} agent
            </span>
            {card.task && (
              <span className="text-[11px] opacity-80 truncate flex-1">
                · {card.task}
              </span>
            )}
            {card.done ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
          </div>
          {card.chunks.length > 0 && (
            <pre className="text-xs whitespace-pre-wrap font-sans bg-white/40 rounded p-2 mb-2 max-h-72 overflow-y-auto">
              {card.chunks.join('')}
            </pre>
          )}
          {card.artifacts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {card.artifacts.map((a, idx) => {
                if (a.type !== 'artifact') return null;
                return (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-white/60 rounded text-[10px] font-mono"
                    title={a.file_path || a.title}
                  >
                    📎 {a.title || a.artifact_type}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    case 'deliverable':
      return (
        <SystemCard
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          title="交付完成"
          tone="success"
        >
          <p className="text-xs text-ink-3">
            skill <code className="font-mono">{card.skill_id}</code> 共产出{' '}
            {card.count} 个 artifact
          </p>
        </SystemCard>
      );
    case 'warning':
      return (
        <SystemCard
          icon={<AlertCircle className="w-3.5 h-3.5" />}
          title={card.capability ? `${card.capability} 降级提示` : '降级提示'}
          tone="warning"
        >
          <p className="text-xs">{card.message}</p>
        </SystemCard>
      );
    case 'error':
      return (
        <SystemCard
          icon={<AlertCircle className="w-3.5 h-3.5" />}
          title="出错了"
          tone="error"
        >
          <p className="text-xs">{card.message}</p>
        </SystemCard>
      );
    case 'done':
      return null;
  }
}

function SystemCard({
  icon,
  title,
  tone = 'info',
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone?: 'info' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
}) {
  const toneClass = {
    info: 'bg-bg-panel border-line',
    success: 'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
    error: 'bg-red-50 border-red-200',
  }[tone];
  return (
    <div className={cn('border rounded-xl px-3 py-2', toneClass)}>
      <div className="flex items-center gap-1.5 mb-1.5 text-ink-2">
        {icon}
        <span className="text-xs font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}

function ClarifyPanel({
  questions,
  onAnswer,
}: {
  questions: V1ClarifyQuestion[];
  onAnswer: (answers: Record<string, string>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const allAnswered = questions.every((q) => answers[q.slot]);

  return (
    <div className="border-2 border-amber-300 bg-amber-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-amber-800">
        <HelpCircle className="w-4 h-4" />
        <span className="text-sm font-medium">主编排想先确认几件事</span>
      </div>
      {questions.map((q) => (
        <div key={q.slot} className="space-y-1.5">
          <p className="text-sm text-ink-2">{q.question}</p>
          {q.free_form ? (
            <input
              type="text"
              value={answers[q.slot] || ''}
              onChange={(e) =>
                setAnswers({ ...answers, [q.slot]: e.target.value })
              }
              placeholder="输入..."
              className="w-full px-3 py-1.5 text-sm bg-white border border-amber-300 rounded-lg focus:outline-none focus:border-amber-500"
            />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {q.options?.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setAnswers({ ...answers, [q.slot]: opt })}
                  className={cn(
                    'px-3 py-1 text-xs rounded-full border transition-colors',
                    answers[q.slot] === opt
                      ? 'bg-amber-700 text-white border-amber-700'
                      : 'bg-white text-ink-2 border-amber-300 hover:border-amber-500',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <button
        onClick={() => onAnswer(answers)}
        disabled={!allAnswered}
        className="w-full py-2 bg-amber-700 text-white text-sm rounded-lg hover:bg-amber-800 disabled:opacity-40"
      >
        提交回答 → 重新派工
      </button>
    </div>
  );
}
