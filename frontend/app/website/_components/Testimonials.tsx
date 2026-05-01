'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TESTIMONIALS = [
  {
    quote: '这里填写用户评价文字，要真实有说服力，体现具体的价值点或使用感受。',
    name: '用户姓名',
    role: '职位 · 公司名',
    initials: '用',
    color: '#5B8CFF',
  },
  {
    quote: '第二条用户评价，换一个使用场景或角色，让多样性更强，增加可信度。',
    name: '用户姓名B',
    role: '职位 · 公司名',
    initials: '用',
    color: '#FF6B35',
  },
  {
    quote: '第三条用户评价，可以强调另一个核心功能的价值，配合不同的使用身份。',
    name: '用户姓名C',
    role: '职位 · 公司名',
    initials: '用',
    color: '#10B981',
  },
];

export function Testimonials() {
  const [active, setActive] = useState(0);

  return (
    <section
      id="testimonials"
      className="py-28 px-6"
      style={{ background: '#F7F5F2' }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: '#5B8CFF' }}
          >
            TESTIMONIALS · 评价区标签
          </span>
          <h2
            className="mt-3 text-4xl md:text-5xl font-bold"
            style={{ color: '#1A1A2E' }}
          >
            用户怎么说
          </h2>
        </div>

        {/* Carousel */}
        <div
          className="rounded-3xl p-10 relative overflow-hidden"
          style={{
            background: '#fff',
            boxShadow: '0 4px 40px rgba(0,0,0,0.06)',
            border: '1px solid rgba(0,0,0,0.05)',
          }}
        >
          {/* Decorative quote mark */}
          <div
            className="absolute top-6 right-8 text-8xl font-serif leading-none select-none"
            style={{ color: 'rgba(91,140,255,0.07)', fontFamily: 'Georgia, serif' }}
            aria-hidden
          >
            "
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <p
                className="text-lg leading-relaxed mb-8"
                style={{ color: '#374151', lineHeight: 1.9 }}
              >
                {TESTIMONIALS[active].quote}
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: TESTIMONIALS[active].color }}
                >
                  {TESTIMONIALS[active].initials}
                </div>
                <div>
                  <div className="font-semibold text-sm" style={{ color: '#1A1A2E' }}>
                    {TESTIMONIALS[active].name}
                  </div>
                  <div className="text-xs" style={{ color: '#9CA3AF' }}>
                    {TESTIMONIALS[active].role}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          <div className="flex gap-2 mt-8">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === active ? 24 : 8,
                  height: 8,
                  background: i === active ? '#5B8CFF' : 'rgba(0,0,0,0.12)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
