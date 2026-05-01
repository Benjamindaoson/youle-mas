'use client';

import { useState } from 'react';
import { ArrowLeft, Search, MoreHorizontal, Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_COLORS, AGENT_MARKET_PROFILES, type RoleId } from '@/lib/types';

// 文件夹数据
const KB_FOLDERS = [
  { id: 'brand', icon: '✨', name: '品牌资料', count: 5 },
  { id: 'history', icon: '📚', name: '历史内容', count: 12 },
  { id: 'customer', icon: '👥', name: '客户资料', count: 3 },
  { id: 'industry', icon: '🌐', name: '行业洞察', count: 8 },
];

// 文件数据
const KB_FILES: Record<string, {
  icon: string;
  name: string;
  desc: string;
  readers: RoleId[];
  date: string;
}[]> = {
  brand: [
    { icon: '📄', name: '豆子实验室品牌故事.docx', desc: '从一颗豆子开始 · 3,200 字', readers: ['analyst', 'writer'], date: '3/12' },
    { icon: '🎨', name: 'VI 视觉规范.pdf', desc: 'Logo / 主色 / 字体 / 延展', readers: ['writer', 'distributor'], date: '3/15' },
    { icon: '📋', name: '产品清单.xlsx', desc: '当前 SKU · 价格 · 成本 · 描述', readers: ['analyst', 'planner', 'writer'], date: '4/03' },
    { icon: '🎯', name: '品牌 slogan 备选.md', desc: '5 个方向 · 待选', readers: [], date: '4/12' },
    { icon: '📝', name: '创始人自述.docx', desc: '王小明为什么做咖啡 · 5,100 字', readers: ['writer'], date: '2/20' },
  ],
  history: [
    { icon: '📄', name: '2024 Q1 公众号合集.zip', desc: '12 篇长文 · 总阅读 8.2w', readers: ['writer', 'analyst'], date: '4/01' },
    { icon: '🎬', name: '短视频脚本库.xlsx', desc: '38 条脚本 · 含数据', readers: ['writer'], date: '3/28' },
    { icon: '📊', name: '2024 年度运营数据.xlsx', desc: '各平台粉丝 / 互动 / 转化', readers: ['analyst', 'monitor'], date: '1/15' },
    { icon: '📋', name: '活动复盘合集.docx', desc: '6 场活动 · 经验总结', readers: ['planner'], date: '3/20' },
    { icon: '✍️', name: '爆款文案收藏.md', desc: '精选 23 篇高互动内容', readers: ['writer'], date: '2/28' },
    { icon: '📄', name: '用户反馈汇总.xlsx', desc: '230+ 条真实评价', readers: ['analyst', 'planner'], date: '4/05' },
    { icon: '🎨', name: '往期封面图库.zip', desc: '86 张 · 含源文件', readers: ['writer'], date: '3/10' },
    { icon: '📋', name: '内容日历模板.xlsx', desc: '排期 / 选题 / 负责人', readers: ['planner', 'distributor'], date: '1/08' },
    { icon: '📄', name: '合作博主清单.xlsx', desc: '47 位 · 含报价', readers: ['distributor'], date: '2/14' },
    { icon: '🎬', name: '直播切片素材.zip', desc: '12 场直播精华', readers: ['writer'], date: '3/05' },
    { icon: '📊', name: '竞品内容分析.pdf', desc: '5 家竞品 · 内容策略', readers: ['analyst', 'planner'], date: '2/22' },
    { icon: '📄', name: 'SEO 关键词库.xlsx', desc: '328 个关键词 · 含热度', readers: ['writer', 'distributor'], date: '1/20' },
  ],
  customer: [
    { icon: '👤', name: '用户画像 v2.pdf', desc: '3 类核心用户 · 详细特征', readers: ['analyst', 'planner', 'writer'], date: '3/18' },
    { icon: '📋', name: '访谈记录 - 咖啡发烧友.docx', desc: '8 人深访 · 原始记录', readers: ['analyst'], date: '3/25' },
    { icon: '📊', name: '用户行为数据.xlsx', desc: '复购 / 客单 / 偏好', readers: ['analyst'], date: '4/08' },
  ],
  industry: [
    { icon: '📊', name: '2024 咖啡行业报告.pdf', desc: '艾瑞咨询 · 86 页', readers: ['analyst', 'planner'], date: '2/10' },
    { icon: '📈', name: '精品咖啡趋势.pdf', desc: '全球市场 · 消费趋势', readers: ['analyst'], date: '3/02' },
    { icon: '📄', name: '竞品融资动态.md', desc: '近半年融资事件汇总', readers: ['analyst', 'planner'], date: '4/10' },
    { icon: '🏪', name: '线下店选址研究.pdf', desc: '5 城 · 商圈分析', readers: ['planner'], date: '1/28' },
    { icon: '📋', name: '供应链研究.docx', desc: '豆源 / 烘焙 / 物流', readers: ['analyst'], date: '2/05' },
    { icon: '📊', name: '消费者调研报告.pdf', desc: '1,200 份问卷 · 分析', readers: ['analyst', 'planner'], date: '3/12' },
    { icon: '📈', name: '社媒平台规则汇总.md', desc: '小红书 / 抖音 / 微信', readers: ['distributor'], date: '4/01' },
    { icon: '📄', name: '行业术语表.md', desc: '咖啡专业词汇 · 中英对照', readers: ['writer'], date: '1/15' },
  ],
};

export default function KnowledgePage() {
  const [activeFolder, setActiveFolder] = useState('brand');
  const [searchQuery, setSearchQuery] = useState('');

  const currentFolder = KB_FOLDERS.find(f => f.id === activeFolder);
  const files = KB_FILES[activeFolder] || [];
  
  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-bg">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 bg-bg border-b border-line">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-bg-hover rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-ink-3" />
          </Link>
          <div>
            <h1 className="font-serif text-xl font-semibold text-ink">知识库</h1>
            <p className="text-sm text-ink-3">把你的业务资料给到团队 · 让 ta 们更懂你</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Hero 区 + 统计 */}
        <div className="bg-gradient-to-br from-bg-sunken to-bg-hover rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-ink mb-2">
                你的业务资料库
              </h2>
              <p className="font-serif italic text-ink-2 text-sm">
                员工们会从这里学习了解你的业务
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <span className="font-serif text-2xl font-semibold text-ink">28</span>
                <p className="text-xs text-ink-3 mt-0.5">份资料</p>
              </div>
              <div className="text-center">
                <span className="font-serif text-2xl font-semibold text-ink">4</span>
                <p className="text-xs text-ink-3 mt-0.5">个文件夹</p>
              </div>
              <button className="px-4 py-2 bg-ink text-white text-sm rounded-lg hover:bg-ink-2 transition-colors flex items-center gap-2">
                <Upload className="w-4 h-4" />
                上传
              </button>
            </div>
          </div>
        </div>

        {/* 双栏布局 */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '220px 1fr' }}>
          {/* 左侧文件夹树 */}
          <div className="bg-bg-sunken rounded-xl p-3">
            <h3 className="text-[10px] font-medium text-ink-4 uppercase tracking-wider mb-3 px-2">
              文件夹
            </h3>
            <div className="space-y-1">
              {KB_FOLDERS.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setActiveFolder(folder.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors text-left',
                    activeFolder === folder.id 
                      ? 'bg-bg-panel shadow-sm' 
                      : 'hover:bg-bg-hover'
                  )}
                >
                  <span>{folder.icon}</span>
                  <span className="flex-1 text-ink">{folder.name}</span>
                  <span className="text-[10px] text-ink-4 font-mono">({folder.count})</span>
                </button>
              ))}
            </div>
            
            {/* 新建文件夹 */}
            <button className="w-full mt-3 py-2 border border-dashed border-line-2 rounded-lg text-ink-3 text-xs hover:bg-bg-hover transition-colors flex items-center justify-center gap-1">
              <Plus className="w-3 h-3" />
              新建文件夹
            </button>
          </div>

          {/* 右侧文件列表 */}
          <div className="bg-bg-panel border border-line rounded-xl overflow-hidden">
            {/* 顶部 */}
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{currentFolder?.icon}</span>
                <span className="font-medium text-ink">{currentFolder?.name}</span>
                <span className="text-xs text-ink-3">· {filteredFiles.length} 份</span>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-ink-4 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索文件..."
                  className="w-44 pl-9 pr-3 py-1.5 bg-bg-sunken rounded-lg text-sm text-ink placeholder:text-ink-4 focus:outline-none"
                />
              </div>
            </div>

            {/* 文件行 */}
            <div className="divide-y divide-line">
              {filteredFiles.map((file, index) => (
                <FileRow key={index} file={file} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function FileRow({ file }: { file: typeof KB_FILES.brand[0] }) {
  return (
    <div className="px-4 py-3 hover:bg-bg-hover/50 transition-colors grid items-center gap-4" style={{ gridTemplateColumns: '32px 1fr 150px 80px 44px' }}>
      {/* 图标 */}
      <span className="text-xl">{file.icon}</span>
      
      {/* 文件名和描述 */}
      <div className="min-w-0">
        <p className="font-serif text-sm text-ink truncate">{file.name}</p>
        <p className="text-[10px] text-ink-3 truncate">{file.desc}</p>
      </div>
      
      {/* 读过的员工 */}
      <div className="flex items-center gap-2">
        {file.readers.length > 0 ? (
          <>
            <div className="flex -space-x-1">
              {file.readers.slice(0, 3).map((roleId) => {
                const profile = AGENT_MARKET_PROFILES[roleId];
                return (
                  <div
                    key={roleId}
                    className="w-6 h-6 rounded-full overflow-hidden border-2 border-bg-panel"
                    title={profile.fullName}
                  >
                    <Image
                      src={profile.avatar}
                      alt={profile.fullName}
                      width={24}
                      height={24}
                      className="object-cover"
                    />
                  </div>
                );
              })}
            </div>
            <span className="text-[10px] text-ink-3">
              {file.readers.length} 位读过
            </span>
          </>
        ) : (
          <span className="font-serif italic text-[10px] text-ink-4">暂无员工读过</span>
        )}
      </div>
      
      {/* 日期 */}
      <span className="text-[10px] text-ink-4 font-mono">{file.date}</span>
      
      {/* 更多按钮 */}
      <button className="p-1.5 hover:bg-bg-sunken rounded transition-colors">
        <MoreHorizontal className="w-4 h-4 text-ink-4" />
      </button>
    </div>
  );
}
