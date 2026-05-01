'use client';

import { motion } from 'framer-motion';

export function CTA() {
  return (
    <section className="py-28 px-6" style={{ background: '#111827' }}>
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl p-14 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 50%, #111827 100%)',
            border: '1px solid rgba(91,140,255,0.2)',
          }}
        >
          {/* Grid texture */}
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              backgroundImage:
                'linear-gradient(rgba(91,140,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(91,140,255,0.06) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
          {/* Top glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 blur-3xl"
            style={{ background: 'rgba(91,140,255,0.25)' }}
          />
          {/* Bottom corner glow */}
          <div
            className="absolute bottom-0 right-0 w-48 h-48 blur-3xl rounded-full"
            style={{ background: 'rgba(255,107,53,0.1)' }}
          />

          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              CTA 区主标题
            </h2>
            <p
              className="text-base mb-10"
              style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.8 }}
            >
              CTA 副标题，一句话说清楚下一步行动和利益点，消除顾虑。
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#"
                className="px-10 py-4 rounded-full font-semibold text-white transition-all"
                style={{ background: '#5B8CFF' }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = '#FF6B35')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = '#5B8CFF')
                }
              >
                主 CTA 按钮
              </a>
              <a
                href="#"
                className="px-10 py-4 rounded-full font-medium transition-all"
                style={{
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.4)';
                  (e.currentTarget as HTMLElement).style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)';
                }}
              >
                次 CTA 按钮
              </a>
            </div>

            <p className="mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              免责声明 / 无信用卡 / 免费试用等说明文字占位
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
