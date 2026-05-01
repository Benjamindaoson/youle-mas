'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_COLORS, type RoleId } from '@/lib/types';

interface HireCeremonyProps {
  roleId: RoleId;
  onComplete: () => void;
}

export function HireCeremony({ roleId, onComplete }: HireCeremonyProps) {
  const [stage, setStage] = useState(1);
  const role = ROLES[roleId];
  const colorConfig = ROLE_COLORS[roleId];

  useEffect(() => {
    // 阶段 1: 0-1.2s
    const timer1 = setTimeout(() => setStage(2), 1200);
    // 阶段 2: 1.2-2.8s
    const timer2 = setTimeout(() => setStage(3), 2800);
    // 阶段 3: 2.8-3.0s
    const timer3 = setTimeout(() => setStage(4), 3000);
    // 阶段 4: 3.0-3.8s 完成
    const timer4 = setTimeout(() => onComplete(), 3800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-md flex items-center justify-center"
    >
      <AnimatePresence mode="wait">
        {/* 阶段 1-2: 头像和光圈 */}
        {(stage === 1 || stage === 2) && (
          <motion.div
            key="avatar-stage"
            className="flex flex-col items-center"
            exit={{ opacity: 0 }}
          >
            {/* 光圈 */}
            <div className="relative">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, opacity: 0.8 }}
                  animate={{ scale: 3, opacity: 0 }}
                  transition={{
                    duration: 1.5,
                    delay: i * 0.4,
                    repeat: stage === 1 ? Infinity : 0,
                    repeatDelay: 0.6,
                  }}
                  className="absolute inset-0 rounded-3xl border-2 border-white/30"
                  style={{
                    width: 120,
                    height: 120,
                    left: '50%',
                    top: '50%',
                    marginLeft: -60,
                    marginTop: -60,
                  }}
                />
              ))}

              {/* 头像 */}
              <motion.div
                animate={stage === 2 ? {
                  rotate: 360,
                  scale: [1, 1.25, 0.9, 1],
                } : {}}
                transition={{
                  duration: 1.6,
                  ease: [0.34, 1.56, 0.64, 1], // spring 缓动
                }}
                className={cn(
                  'w-[120px] h-[120px] rounded-3xl flex items-center justify-center text-[54px] font-semibold relative z-10 transition-colors duration-500',
                  stage === 1 ? 'bg-gradient-to-br from-ink-3 to-ink-4 text-white' : colorConfig.main
                )}
              >
                {role.initial}
              </motion.div>
            </div>

            {/* 文字 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: 0.3 }}
              className="text-center mt-8"
            >
              <h2 className="font-serif text-xl text-white mb-2">
                正在招募 {role.name}
              </h2>
              <p className="text-white/60 text-sm">
                这位 Agent 即将加入你的团队
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* 阶段 3: 合作关系已建立 */}
        {stage === 3 && (
          <motion.div
            key="complete-text"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <motion.div
              className={cn(
                'w-[120px] h-[120px] rounded-3xl flex items-center justify-center text-[54px] font-semibold mx-auto mb-8',
                colorConfig.main
              )}
            >
              {role.initial}
            </motion.div>
            <h2 className="font-serif text-xl text-white mb-2">
              招募成功
            </h2>
            <p className="text-white/60 text-sm">
              {role.name} 已加入你的团队
            </p>
          </motion.div>
        )}

        {/* 阶段 4: 飞走动画 */}
        {stage === 4 && (
          <motion.div
            key="fly-away"
            initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            animate={{ 
              opacity: 0, 
              scale: 0.2, 
              x: -400, 
              y: 200 
            }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className={cn(
              'w-[120px] h-[120px] rounded-3xl flex items-center justify-center text-[54px] font-semibold',
              colorConfig.main
            )}
          >
            {role.initial}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
