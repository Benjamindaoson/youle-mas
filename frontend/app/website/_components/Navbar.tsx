'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const NAV_LINKS = [
  { label: '导航项一', href: '#features' },
  { label: '导航项二', href: '#how-it-works' },
  { label: '导航项三', href: '#testimonials' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled
          ? 'rgba(17, 24, 39, 0.85)'
          : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.08)' : 'none',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/website" className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #5B8CFF, #FF6B35)' }}
          >
            有
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">有了</span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm transition-colors"
              style={{ color: 'rgba(255,255,255,0.65)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <a
            href="#"
            className="text-sm transition-colors hidden md:block"
            style={{ color: 'rgba(255,255,255,0.65)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
          >
            登录
          </a>
          <a
            href="#"
            className="text-sm px-4 py-2 rounded-full font-medium transition-all"
            style={{ background: '#5B8CFF', color: '#fff' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#FF6B35')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#5B8CFF')}
          >
            免费开始
          </a>
        </div>
      </div>
    </nav>
  );
}
