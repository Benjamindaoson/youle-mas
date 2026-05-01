'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { V1Workbench } from '@/components/v1-workbench';

export default function V1Page() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="sticky top-0 z-10 bg-bg border-b border-line">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-bg-hover rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-ink-3" />
          </Link>
          <div className="flex-1">
            <h1 className="font-serif text-xl font-semibold text-ink">
              V1 主编排工作台
            </h1>
            <p className="text-sm text-ink-3">
              一个意图 → 一个交付。主编排自己理解、自己选 skill、自己派工。
            </p>
          </div>
          <span className="px-2 py-0.5 bg-active/10 text-active text-[10px] rounded font-medium">
            V1 PREVIEW
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <V1Workbench />
      </main>
    </div>
  );
}
