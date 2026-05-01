'use client';

import { motion } from 'framer-motion';

const STEPS = [
  { num: '01', title: '步骤标题一', desc: '步骤描述占位，说明用户需要做什么或者系统会做什么。' },
  { num: '02', title: '步骤标题二', desc: '步骤描述占位，说明用户需要做什么或者系统会做什么。' },
  { num: '03', title: '步骤标题三', desc: '步骤描述占位，说明用户需要做什么或者系统会做什么。' },
  { num: '04', title: '步骤标题四', desc: '步骤描述占位，说明用户需要做什么或者系统会做什么。' },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-28 px-6"
      style={{ background: '#111827' }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: '#FF6B35' }}
          >
            HOW IT WORKS · 流程区标签
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-4xl md:text-5xl font-bold text-white"
          >
            流程区主标题
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-base max-w-xl mx-auto"
            style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.8 }}
          >
            流程区副标题，简要说明整体流程的价值。
          </motion.p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative p-6 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {/* Connector arrow */}
              {i < STEPS.length - 1 && (
                <div className="hidden lg:flex absolute top-8 -right-4 z-10 items-center">
                  <div className="w-5 h-px" style={{ background: 'rgba(91,140,255,0.35)' }} />
                  <div
                    style={{
                      borderTop: '4px solid transparent',
                      borderBottom: '4px solid transparent',
                      borderLeft: '5px solid rgba(91,140,255,0.35)',
                    }}
                  />
                </div>
              )}

              <div
                className="text-3xl font-bold mb-4 tabular-nums"
                style={{
                  background: 'linear-gradient(135deg, #5B8CFF 0%, rgba(91,140,255,0.3) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {step.num}
              </div>
              <h3 className="text-base font-semibold mb-2 text-white">{step.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
