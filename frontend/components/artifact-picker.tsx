'use client';

/**
 * Artifact 选择浮层 —— 让用户从产出里挑一份作为附件引用。
 *
 * 两种模式：
 *   - 全局（sessionId 不传）：列出所有 session 的产出，按来源分组
 *   - 单 session（sessionId 传入）：只列该 session 的产出
 *
 * 数据源：后端 /artifacts（全局）/ /artifacts/{sid}（单 session）
 */

import { useEffect, useMemo, useState } from 'react';
import { X, FileText, Download, Lock } from 'lucide-react';
import {
  listArtifacts,
  listAllArtifacts,
  fetchArtifact,
  artifactDownloadUrl,
  isBinaryArtifact,
  type ArtifactManifest,
} from '@/lib/api';
import type { Attachment } from '@/lib/attachments';

type ArtifactWithSession = ArtifactManifest & { session_id: string };

interface Props {
  /** 不传 = 全局模式（所有 session 的产出） */
  sessionId?: string;
  onPick: (attachment: Attachment) => void;
  onClose: () => void;
}

export function ArtifactPicker({ sessionId, onPick, onClose }: Props) {
  const [list, setList] = useState<ArtifactWithSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingId, setFetchingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = sessionId
      ? listArtifacts(sessionId).then((res) =>
          (res.artifacts ?? []).map((a) => ({ ...a, session_id: sessionId })),
        )
      : listAllArtifacts(200);
    loader.then((items) => {
      if (cancelled) return;
      setList(items);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  /** 按 session_id 分组（全局模式下用），单 session 模式也能工作（只有一组）。 */
  const grouped = useMemo(() => {
    if (!list) return [] as Array<{ sid: string; items: ArtifactWithSession[] }>;
    const m = new Map<string, ArtifactWithSession[]>();
    for (const it of list) {
      const key = it.session_id ?? '';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(it);
    }
    return Array.from(m.entries()).map(([sid, items]) => ({ sid, items }));
  }, [list]);

  const handlePick = async (m: ArtifactWithSession) => {
    // 二进制类产出（xlsx/png/pdf/docx）无法作为文本引用，引导用户去下载
    if (isBinaryArtifact(m.artifact_type)) {
      return;
    }
    setFetchingId(m.id);
    const content = await fetchArtifact(m.session_id, m.file);
    setFetchingId(null);
    if (content == null) {
      alert(`读取「${m.title}」失败，请重试。`);
      return;
    }
    onPick({
      kind: 'artifact',
      id: m.id,
      title: m.title,
      agentName: m.agent_name,
      content,
    });
    onClose();
  };

  /** 把后端的 session_id 渲染成可读标签 */
  const renderSessionLabel = (sid: string) => {
    if (sid.startsWith('group:')) return `群聊 · ${sid.slice(6)}`;
    if (sid.startsWith('solo:')) return `单聊 · ${sid.slice(5)}`;
    return sid || '未知来源';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-bg-panel rounded-xl shadow-2xl border border-line w-[min(560px,92vw)] max-h-[72vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-ink-3" />
            <h3 className="text-sm font-medium text-ink">
              {sessionId ? '引用本群成果' : '引用同事的所有成果'}
            </h3>
            {list && list.length > 0 && (
              <span className="text-[11px] text-ink-4">· 共 {list.length} 份</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-hover"
            title="关闭"
          >
            <X className="w-4 h-4 text-ink-3" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-2 min-h-[120px]">
          {loading ? (
            <p className="text-sm text-ink-3 px-3 py-8 text-center">加载中…</p>
          ) : !list?.length ? (
            <p className="text-sm text-ink-3 px-3 py-8 text-center">
              {sessionId
                ? '本群还没有可引用的成果。'
                : '整个工作区还没产出任何文档。'}
              <br />
              群聊编排（@理 派活）结束后通常会生成 artifact。
            </p>
          ) : (
            <div className="space-y-3">
              {grouped.map(({ sid, items }) => (
                <section key={sid}>
                  {/* 只在全局模式下显示分组标题（单 session 只有一组，省略标题更简洁） */}
                  {!sessionId && (
                    <h4 className="text-[11px] uppercase tracking-wide text-ink-4 px-3 pb-1 pt-1">
                      {renderSessionLabel(sid)}
                    </h4>
                  )}
                  <ul className="space-y-1">
                    {items.map((m) => {
                      const binary = isBinaryArtifact(m.artifact_type);
                      return (
                        <li key={`${m.session_id}::${m.id}`}>
                          {binary ? (
                            /* 二进制：禁点击引用，只给下载按钮 */
                            <div className="w-full text-left px-3 py-2 rounded-md bg-bg-sunken/40 flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Lock className="w-3 h-3 text-ink-4 flex-shrink-0" />
                                  <span className="text-sm text-ink-3 truncate">{m.title}</span>
                                  <span className="text-[10px] font-mono px-1 py-0.5 bg-bg-sunken text-ink-4 rounded uppercase flex-shrink-0">
                                    {m.artifact_type}
                                  </span>
                                </div>
                                <div className="text-[11px] text-ink-4 mt-0.5 truncate">
                                  @{m.agent_name} · 第 {m.step_idx} 步 ·{' '}
                                  {(m.size / 1024).toFixed(1)} KB · 仅可下载
                                </div>
                              </div>
                              <a
                                href={artifactDownloadUrl(m.session_id, m.file)}
                                download={m.file}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-ink-2 hover:text-ink hover:bg-bg-hover border border-line"
                                title={`下载 ${m.file}`}
                              >
                                <Download className="w-3 h-3" />
                                下载
                              </a>
                            </div>
                          ) : (
                            <button
                              onClick={() => handlePick(m)}
                              disabled={fetchingId === m.id}
                              className="w-full text-left px-3 py-2 rounded-md hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-wait"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm text-ink truncate">{m.title}</span>
                                {m.artifact_type && m.artifact_type !== 'markdown' && (
                                  <span className="text-[10px] font-mono px-1 py-0.5 bg-bg-sunken text-ink-4 rounded uppercase flex-shrink-0">
                                    {m.artifact_type}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-ink-4 mt-0.5 truncate">
                                @{m.agent_name} · 第 {m.step_idx} 步 ·{' '}
                                {(m.size / 1024).toFixed(1)} KB
                                {fetchingId === m.id && ' · 加载中…'}
                              </div>
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
