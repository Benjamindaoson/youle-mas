'use client';

import Link from 'next/link';
import { Sparkles, Layers } from 'lucide-react';
import { V1Workbench } from '@/components/v1-workbench';

/**
 * 默认首页 = V1 主编排工作台。
 * V0 的 9 头像 + group-chat / employee-chat demo 移到 /legacy 路径，仍可访问。
 *
 * 切换原因：V0 demo 是按"角色"切分的概念演示，V1 是产品真正的形态
 * （按"能力"切分 + 主编排 + skill 市场）。详见 docs/v1-architecture.md。
 */
export default function Home() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="sticky top-0 z-10 bg-bg border-b border-line">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="w-7 h-7 bg-ink rounded-md flex items-center justify-center">
            <span className="text-white font-serif text-sm font-semibold">有</span>
          </div>
          <div className="flex-1">
            <h1 className="font-serif text-lg font-semibold text-ink">有了 · 主编排</h1>
            <p className="text-[11px] text-ink-3">
              <Sparkles className="inline w-3 h-3 mr-1" />
              意图理解 + skill 调度 + 4 能力 agent (T/I/V/D)
            </p>
          </div>
          <nav className="flex items-center gap-3 text-xs">
            <Link href="/skills" className="text-ink-2 hover:text-ink">Skill 市场</Link>
            <Link href="/artifacts" className="text-ink-2 hover:text-ink">成果库</Link>
            <Link
              href="/legacy"
              className="flex items-center gap-1 text-ink-3 hover:text-ink-2"
              title="V0 角色 demo（9 头像）"
            >
              <Layers className="w-3 h-3" />
              旧版
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <V1Workbench />
      </main>
    </div>
  );
}
