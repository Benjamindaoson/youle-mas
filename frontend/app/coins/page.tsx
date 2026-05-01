'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Zap, TrendingUp, TrendingDown, Clock, Gift, CreditCard, ChevronRight, Sparkles, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AGENT_MARKET_PROFILES, type RoleId } from '@/lib/types';
import { Button } from '@/components/ui/button';

// 模拟用户金币数据
const USER_COINS = {
  balance: 1284,
  monthlyUsed: 128,
  monthlyTotal: 500,
  lastRecharge: '2024-01-15',
};

// 充值套餐
const RECHARGE_PLANS = [
  { id: 'starter', coins: 100, price: 9.9, popular: false, bonus: 0 },
  { id: 'basic', coins: 500, price: 39.9, popular: true, bonus: 50 },
  { id: 'pro', coins: 1000, price: 69.9, popular: false, bonus: 150 },
  { id: 'enterprise', coins: 5000, price: 299.9, popular: false, bonus: 1000 },
];

// 模拟消费记录
const TRANSACTIONS = [
  { id: '1', type: 'expense', amount: 8, description: '竞品分析报告', agent: 'analyst' as RoleId, time: '今天 14:30' },
  { id: '2', type: 'expense', amount: 15, description: '小红书爆款文案', agent: 'writer' as RoleId, time: '今天 11:20' },
  { id: '3', type: 'expense', amount: 5, description: '发布排期优化', agent: 'distributor' as RoleId, time: '昨天 16:45' },
  { id: '4', type: 'recharge', amount: 500, description: '充值 500 金币', time: '2024-01-15 10:00' },
  { id: '5', type: 'expense', amount: 12, description: 'BP 策略框架', agent: 'planner' as RoleId, time: '2024-01-14 09:30' },
  { id: '6', type: 'gift', amount: 100, description: '新用户注册奖励', time: '2024-01-10 12:00' },
  { id: '7', type: 'expense', amount: 3, description: '关键词监测设置', agent: 'monitor' as RoleId, time: '2024-01-09 15:20' },
];

export default function CoinsPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>('basic');
  const [filter, setFilter] = useState<'all' | 'expense' | 'recharge'>('all');

  const filteredTransactions = TRANSACTIONS.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'expense') return t.type === 'expense';
    if (filter === 'recharge') return t.type === 'recharge' || t.type === 'gift';
    return true;
  });

  const usagePercentage = (USER_COINS.monthlyUsed / USER_COINS.monthlyTotal) * 100;

  return (
    <div className="min-h-screen bg-bg">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 bg-bg-panel border-b border-line px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-bg-hover rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-ink-3" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-ink">金币中心</h1>
              <p className="text-sm text-ink-3">管理你的能量货币</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* 余额卡片 */}
        <div className="bg-gradient-to-br from-ink to-ink-2 rounded-2xl p-6 text-white mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-white/60 text-sm mb-1">当前余额</p>
              <div className="flex items-baseline gap-2">
                <Zap className="w-8 h-8 text-busy" />
                <span className="text-4xl font-bold">{USER_COINS.balance.toLocaleString()}</span>
                <span className="text-white/60">金币</span>
              </div>
            </div>
            <Button className="bg-white text-ink hover:bg-white/90">
              <Plus className="w-4 h-4 mr-1" />
              充值
            </Button>
          </div>

          {/* 本月用量 */}
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/80">本月已用</span>
              <span className="text-sm text-white/80">{USER_COINS.monthlyUsed} / {USER_COINS.monthlyTotal}</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-busy rounded-full transition-all"
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
            <p className="text-[10px] text-white/50 mt-2">
              月度套餐剩余 {USER_COINS.monthlyTotal - USER_COINS.monthlyUsed} 金币，{new Date().getDate() > 15 ? '即将' : '本月底'}重置
            </p>
          </div>
        </div>

        {/* 快速统计 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-bg-panel border border-line rounded-xl p-4">
            <div className="flex items-center gap-2 text-ink-3 mb-2">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs">今日消耗</span>
            </div>
            <p className="text-2xl font-bold text-ink">23</p>
          </div>
          <div className="bg-bg-panel border border-line rounded-xl p-4">
            <div className="flex items-center gap-2 text-ink-3 mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-xs">本周消耗</span>
            </div>
            <p className="text-2xl font-bold text-ink">89</p>
          </div>
          <div className="bg-bg-panel border border-line rounded-xl p-4">
            <div className="flex items-center gap-2 text-ink-3 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">节省估算</span>
            </div>
            <p className="text-2xl font-bold text-active">12h</p>
          </div>
        </div>

        {/* 充值套餐 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            充值套餐
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {RECHARGE_PLANS.map((plan) => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={cn(
                  'relative bg-bg-panel border rounded-xl p-4 cursor-pointer transition-all',
                  selectedPlan === plan.id
                    ? 'border-active ring-2 ring-active/20'
                    : 'border-line hover:border-ink-4'
                )}
              >
                {plan.popular && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-busy text-white text-[10px] rounded-full">
                    最受欢迎
                  </span>
                )}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <Zap className="w-5 h-5 text-busy" />
                    <span className="text-2xl font-bold text-ink">{plan.coins}</span>
                  </div>
                  {plan.bonus > 0 && (
                    <span className="text-xs text-active">+{plan.bonus} 赠送</span>
                  )}
                  <p className="text-lg font-semibold text-ink mt-2">¥{plan.price}</p>
                  <p className="text-[10px] text-ink-4">¥{(plan.price / plan.coins).toFixed(3)}/金币</p>
                </div>
              </div>
            ))}
          </div>
          <Button className="w-full mt-4 h-12 bg-ink hover:bg-ink-2 text-white">
            立即充值
          </Button>
        </section>

        {/* 消费记录 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
              <Clock className="w-5 h-5" />
              消费记录
            </h2>
            <div className="flex gap-1">
              {(['all', 'expense', 'recharge'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-full transition-colors',
                    filter === f
                      ? 'bg-ink text-white'
                      : 'bg-bg-sunken text-ink-3 hover:text-ink'
                  )}
                >
                  {f === 'all' ? '全部' : f === 'expense' ? '消费' : '充值'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-bg-panel border border-line rounded-xl divide-y divide-line">
            {filteredTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-4 p-4">
                {/* 图标/头像 */}
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  tx.type === 'expense' && tx.agent ? '' : 'bg-bg-sunken'
                )}>
                  {tx.type === 'expense' && tx.agent ? (
                    <Image
                      src={AGENT_MARKET_PROFILES[tx.agent].avatar}
                      alt=""
                      width={40}
                      height={40}
                      className="rounded-xl object-cover"
                    />
                  ) : tx.type === 'recharge' ? (
                    <CreditCard className="w-5 h-5 text-active" />
                  ) : (
                    <Gift className="w-5 h-5 text-busy" />
                  )}
                </div>

                {/* 描述 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{tx.description}</p>
                  <p className="text-xs text-ink-4">{tx.time}</p>
                </div>

                {/* 金额 */}
                <div className={cn(
                  'flex items-center gap-1 font-semibold',
                  tx.type === 'expense' ? 'text-ink' : 'text-active'
                )}>
                  {tx.type === 'expense' ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownLeft className="w-4 h-4" />
                  )}
                  <span>{tx.type === 'expense' ? '-' : '+'}{tx.amount}</span>
                  <Zap className="w-3.5 h-3.5 text-busy" />
                </div>
              </div>
            ))}
          </div>

          <button className="w-full mt-4 py-3 text-sm text-ink-3 hover:text-ink transition-colors">
            查看更多记录
          </button>
        </section>

        {/* 金币说明 */}
        <section className="mt-8 p-6 bg-bg-sunken rounded-xl">
          <h3 className="font-medium text-ink mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-busy" />
            金币说明
          </h3>
          <ul className="space-y-2 text-sm text-ink-3">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-4 mt-1.5 flex-shrink-0" />
              金币是「有了」的能量货币，用于支付 Agent 的任务费用
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-4 mt-1.5 flex-shrink-0" />
              不同 Agent、不同任务消耗不同数量的金币
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-4 mt-1.5 flex-shrink-0" />
              充值金币永久有效，赠送金币有效期 90 天
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-4 mt-1.5 flex-shrink-0" />
              如有疑问请联系客服
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
