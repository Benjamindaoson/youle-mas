'use client';

import { motion } from 'framer-motion';
import { Zap, Brain, Users, Shield, Rocket, BarChart2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const FEATURES: { Icon: LucideIcon; title: string; desc: string }[] = [
  {
    Icon: Brain,
    title: '功能点标题一',
    desc: '这里填写功能描述，说明这个功能能帮用户解决什么具体问题，两三句话即可。',
  },
  {
    Icon: Zap,
    title: '功能点标题二',
    desc: '这里填写功能描述，说明这个功能能帮用户解决什么具体问题，两三句话即可。',
  },
  {
    Icon: Users,
    title: '功能点标题三',
    desc: '这里填写功能描述，说明这个功能能帮用户解决什么具体问题，两三句话即可。',
  },
  {
    Icon: Shield,
    title: '功能点标题四',
    desc: '这里填写功能描述，说明这个功能能帮用户解决什么具体问题，两三句话即可。',
  },
  {
    Icon: Rocket,
    title: '功能点标题五',
    desc: '这里填写功能描述，说明这个功能能帮用户解决什么具体问题，两三句话即可。',
  },
  {
    Icon: BarChart2,
    title: '功能点标题六',
    desc: '这里填写功能描述，说明这个功能能帮用户解决什么具体问题，两三句话即可。',
  },
];

export function Features() {
  return (
    <section id="features" style={{ background: '#F7F5F2' }} className="py-28 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: '#5B8CFF' }}
          >
            FEATURES · 功能区标签
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-4xl md:text-5xl font-bold"
            style={{ color: '#1A1A2E' }}
          >
            功能区主标题
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-base max-w-xl mx-auto"
            style={{ color: '#6B7280', lineHeight: 1.8 }}
          >
            功能区副标题，一两句话概括这部分要表达的核心价值。
          </motion.p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ Icon, title, desc }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="p-6 rounded-2xl transition-all duration-300 group"
              style={{
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow =
                  '0 8px 32px rgba(91,140,255,0.12)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(91,140,255,0.2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow =
                  '0 2px 12px rgba(0,0,0,0.04)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.06)';
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(91,140,255,0.08)', color: '#5B8CFF' }}
              >
                <Icon size={22} strokeWidth={1.8} />
              </div>
              <h3 className="text-base font-semibold mb-2" style={{ color: '#1A1A2E' }}>
                {title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
                {desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
