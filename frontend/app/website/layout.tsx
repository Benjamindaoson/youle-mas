import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '有了 — 占位标题',
  description: '占位描述',
};

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ fontFamily: "'DM Sans', 'PingFang SC', sans-serif" }}>
      {children}
    </div>
  );
}
