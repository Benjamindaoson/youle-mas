'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[] = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.2,
      });
    }

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(91, 140, 255, ${p.alpha})`;
        ctx.fill();
      });

      // Draw connection lines
      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach((b) => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(91, 140, 255, ${0.12 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.6 }}
    />
  );
}

export function Hero() {
  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: '#111827' }}
    >
      <ParticleCanvas />

      {/* Gradient overlays */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 38%, rgba(91,140,255,0.18) 0%, transparent 65%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 40% 30% at 50% 38%, rgba(91,140,255,0.08) 0%, transparent 100%)',
        }}
      />
      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(17,24,39,0.8))',
        }}
      />

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span
            className="inline-block text-xs font-medium px-3 py-1 rounded-full mb-6"
            style={{
              background: 'rgba(91,140,255,0.15)',
              color: '#5B8CFF',
              border: '1px solid rgba(91,140,255,0.3)',
            }}
          >
            【标签占位 · 版本/状态等】
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold text-white leading-tight"
        >
          主标题
          <br />
          <span style={{ color: '#5B8CFF' }}>副标题占位</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-lg md:text-xl leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          一句话价值主张占位 · 用来说清楚「有了」能帮用户解决什么问题
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
        >
          <a
            href="#"
            className="px-8 py-3.5 rounded-full font-semibold text-white transition-all"
            style={{ background: '#5B8CFF' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#FF6B35')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#5B8CFF')}
          >
            主按钮 CTA
          </a>
          <a
            href="#features"
            className="px-8 py-3.5 rounded-full font-medium transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.75)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
            }}
          >
            次按钮 · 了解更多
          </a>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 grid grid-cols-3 gap-8 max-w-lg mx-auto"
        >
          {['数据点一', '数据点二', '数据点三'].map((label, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl font-bold" style={{ color: '#5B8CFF' }}>
                —
              </div>
              <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
        style={{ color: 'rgba(255,255,255,0.25)' }}
      >
        <svg width="20" height="30" viewBox="0 0 20 30" fill="none">
          <rect x="1" y="1" width="18" height="28" rx="9" stroke="currentColor" strokeWidth="1.5" />
          <motion.rect
            x="9" y="6" width="2" height="6" rx="1" fill="currentColor"
            animate={{ y: [0, 8, 0], opacity: [1, 0, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        </svg>
      </motion.div>
    </section>
  );
}
