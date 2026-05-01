'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Sparkles, Radio, GraduationCap, X, Send, Clock, Zap, CheckCircle, Award, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_COLORS, type RoleId } from '@/lib/types';

// ============ 课程数据 ============
type Course = {
  id: string;
  name: string;
  agent: RoleId;
  teacher: { name: string; title: string };
  duration: string;
  energy: string;
  desc: string;
  reward: string;
  category: string;
  enrolled: boolean;
  progress?: number;
  students: number;
  rating: number;
  difficulty: '入门' | '进阶' | '高阶';
  prerequisites?: string[];
  syllabus: { chapter: string; topic: string; duration: string; done?: boolean }[];
  dialogue: TeachingDialogue[];
  beforeAfter: { before: string; after: string };
  graduates: RoleId[];
};

type TeachingDialogue = {
  id: string;
  from: 'teacher' | 'student' | 'note';
  roleId?: RoleId;
  content: string;
  isMention?: boolean;
};

const COURSES: Course[] = [
  {
    id: 'xhs-writing',
    name: '小红书爆款文案结构',
    agent: 'writer',
    teacher: { name: '林语微', title: '小红书内容顾问 · 曾主理 300w+ 账号' },
    duration: '2 小时',
    energy: '18',
    desc: '从选题到标题再到钩子，系统拆解高点赞笔记的 5 种黄金结构。',
    reward: '小红书风格化',
    category: 'writer',
    enrolled: false,
    students: 2847,
    rating: 4.9,
    difficulty: '入门',
    syllabus: [
      { chapter: '01', topic: '爆款笔记的 5 种结构', duration: '25 min' },
      { chapter: '02', topic: '标题钩子公式：反差 + 情绪 + 具体', duration: '30 min' },
      { chapter: '03', topic: '开头 3 秒留人技巧', duration: '20 min' },
      { chapter: '04', topic: '正文节奏与信息密度', duration: '25 min' },
      { chapter: '05', topic: '结尾引导收藏的钩子设计', duration: '20 min' },
    ],
    dialogue: [
      { id: 'd1', from: 'teacher', content: '@创作员 今天我们从爆款结构讲起。先看一个问题：为什么有些笔记开头第一句就让人停不下来？' },
      { id: 'd2', from: 'student', roleId: 'writer', content: '老师，我观察过，好像都有"反差"或者"冲突"？' },
      { id: 'd3', from: 'teacher', content: '对！这是第一个关键。比如「月薪 3 千，我住上了 3 万的公寓」—— 反差感。你来写一个试试？' },
      { id: 'd4', from: 'student', roleId: 'writer', content: '「加班到凌晨 2 点，我发现了一个救命神器」—— 这样？' },
      { id: 'd5', from: 'teacher', content: '不错！但还可以更具体。把"神器"换成具体东西，留悬念的同时增加真实感。' },
      { id: 'd6', from: 'note', content: '已记录学习笔记：反差 + 具体物 = 更强的真实感' },
      { id: 'd7', from: 'student', roleId: 'writer', content: '「加班到凌晨 2 点，我发现枕头下藏着的这个小东西」—— 更好吗？' },
      { id: 'd8', from: 'teacher', content: '对！这就是小红书的开头节奏。继续下一个章节，我们讲标题钩子公式。' },
    ],
    beforeAfter: {
      before: '只会写普通描述型文案',
      after: '能产出 5 种结构的小红书爆款笔记',
    },
    graduates: ['writer', 'planner'],
  },
  {
    id: 'deep-comp',
    name: '竞品深度挖掘法',
    agent: 'analyst',
    teacher: { name: 'Dr. 沈明觉', title: '前麦肯锡顾问 · 数据策略专家' },
    duration: '3 小时',
    energy: '25',
    desc: '不止看表面数据，学会顺着链条挖到对方真正的策略底牌。',
    reward: '竞品深挖',
    category: 'analyst',
    enrolled: false,
    students: 1523,
    rating: 4.8,
    difficulty: '进阶',
    syllabus: [
      { chapter: '01', topic: '竞品分析的三层深度', duration: '40 min' },
      { chapter: '02', topic: '产品表层：从定价到功能', duration: '30 min' },
      { chapter: '03', topic: '运营中层：渠道与增长策略', duration: '45 min' },
      { chapter: '04', topic: '组织底层：团队配置与节奏', duration: '40 min' },
      { chapter: '05', topic: '输出可行动的策略建议', duration: '25 min' },
    ],
    dialogue: [
      { id: 'd1', from: 'teacher', content: '@分析员 今天教你做"深度竞品分析"。先问你：大多数人做竞品分析只停留在哪一层？' },
      { id: 'd2', from: 'student', roleId: 'analyst', content: '产品层面？比如功能对比、定价对比。' },
      { id: 'd3', from: 'teacher', content: '没错，这是第一层，但远远不够。我告诉你一个框架：「产品表层 → 运营中层 → 组织底层」。' },
      { id: 'd4', from: 'student', roleId: 'analyst', content: '组织底层？这个怎么挖到？' },
      { id: 'd5', from: 'teacher', content: '通过公开招聘 JD、团队成员的 LinkedIn、他们的融资信息推断。比如他们最近招了 3 个增长工程师，意味着什么？' },
      { id: 'd6', from: 'student', roleId: 'analyst', content: '他们在加码增长团队，可能有新的用户增长动作。' },
      { id: 'd7', from: 'teacher', content: '对！这就是深度。你学会从招聘反推战略，就能先对手半步。' },
      { id: 'd8', from: 'note', content: '已记录：招聘 JD 是推断对手战略的重要信号' },
    ],
    beforeAfter: {
      before: '只能做表层的功能和价格对比',
      after: '能从招聘、融资、团队反推对手战略',
    },
    graduates: ['analyst'],
  },
  {
    id: 'video-script',
    name: '60 秒口播脚本',
    agent: 'writer',
    teacher: { name: '陈野', title: '抖音百万粉博主 · 脚本架构师' },
    duration: '2.5 小时',
    energy: '22',
    desc: '学会开头 3 秒留人 · 中段信息密度 · 结尾 CTA 的脚本节奏。',
    reward: '视频脚本 Pro',
    category: 'writer',
    enrolled: true,
    progress: 62,
    students: 3241,
    rating: 4.9,
    difficulty: '进阶',
    syllabus: [
      { chapter: '01', topic: '60 秒脚本的 4 段式结构', duration: '25 min', done: true },
      { chapter: '02', topic: '开头 3 秒黄金钩子', duration: '30 min', done: true },
      { chapter: '03', topic: '中段信息节奏控制', duration: '35 min', done: true },
      { chapter: '04', topic: '结尾 CTA 的 7 种写法', duration: '30 min' },
      { chapter: '05', topic: '实战：给定主题写脚本', duration: '30 min' },
    ],
    dialogue: [
      { id: 'd1', from: 'teacher', content: '@创作员 60 秒脚本最重要的是哪一段？' },
      { id: 'd2', from: 'student', roleId: 'writer', content: '开头 3 秒？留不住人后面都白搭。' },
      { id: 'd3', from: 'teacher', content: '对！我教你 4 种黄金钩子：①反常识 ②强冲突 ③疑问句 ④数字震撼。' },
      { id: 'd4', from: 'student', roleId: 'writer', content: '能举个"反常识"的例子吗？' },
      { id: 'd5', from: 'teacher', content: '「喝水减肥是假的，这 3 种饮料才真的让我瘦了 10 斤」—— 反常识 + 数字震撼 组合拳。' },
      { id: 'd6', from: 'student', roleId: 'writer', content: '明白了，我来写一个试试：「加班的人千万别熬夜，真正的秘密是这 2 件小事」' },
      { id: 'd7', from: 'teacher', content: '结构对了！但「2 件小事」太虚，改成「8 分钟闭眼操作」更具体。' },
    ],
    beforeAfter: {
      before: '脚本平淡无亮点，完播率低',
      after: '开头 3 秒留人率提升 40%',
    },
    graduates: ['writer'],
  },
  {
    id: 'okr-draft',
    name: 'OKR 起草方法论',
    agent: 'planner',
    teacher: { name: '周启明', title: '字节前 HRD · OKR 落地教练' },
    duration: '4 小时',
    energy: '30',
    desc: '从经营目标拆到可执行的 KR · 避免「又好又假」的 OKR 陷阱。',
    reward: 'OKR 起草',
    category: 'planner',
    enrolled: false,
    students: 892,
    rating: 4.7,
    difficulty: '高阶',
    syllabus: [
      { chapter: '01', topic: 'OKR vs KPI 的本质区别', duration: '40 min' },
      { chapter: '02', topic: '从战略到 O 的拆解', duration: '50 min' },
      { chapter: '03', topic: '好 KR 的 5 个标准', duration: '45 min' },
      { chapter: '04', topic: '避免"又好又假"的陷阱', duration: '45 min' },
      { chapter: '05', topic: '季度对齐与复盘', duration: '40 min' },
    ],
    dialogue: [
      { id: 'd1', from: 'teacher', content: '@策划员 先考你：什么是"又好又假"的 OKR？' },
      { id: 'd2', from: 'student', roleId: 'planner', content: '是指听起来很对但没法执行的 OKR 吗？' },
      { id: 'd3', from: 'teacher', content: '更准确地说：写出来漂亮，但缺乏挑战性、不具体、难度量。比如"提升用户满意度" —— 这不叫 KR。' },
      { id: 'd4', from: 'student', roleId: 'planner', content: '应该是"NPS 从 35 提升到 50"这种？' },
      { id: 'd5', from: 'teacher', content: '对！好的 KR 要符合 5 个标准：量化、有挑战、有期限、可验证、可控。' },
      { id: 'd6', from: 'note', content: '已记录：好 KR = 量化 + 有挑战 + 有期限 + 可验证 + 可控' },
    ],
    beforeAfter: {
      before: '写的 OKR 缺乏可执行性',
      after: '能拆出可量化可追踪的 KR',
    },
    graduates: ['planner'],
  },
  {
    id: 'sentiment',
    name: '高阶舆情分析',
    agent: 'monitor',
    teacher: { name: '赵听涛', title: '舆情研究员 · 社科所特聘' },
    duration: '3 小时',
    energy: '25',
    desc: '不只看负评数 · 要看背后的人群 · 情绪曲线 · 可能的连锁反应。',
    reward: '舆情判断',
    category: 'monitor',
    enrolled: false,
    students: 1247,
    rating: 4.8,
    difficulty: '高阶',
    syllabus: [
      { chapter: '01', topic: '舆情的三个维度', duration: '30 min' },
      { chapter: '02', topic: '情绪曲线与拐点识别', duration: '45 min' },
      { chapter: '03', topic: '人群画像与传播链路', duration: '40 min' },
      { chapter: '04', topic: '危机预警信号', duration: '35 min' },
      { chapter: '05', topic: '实战：一次危机处置', duration: '30 min' },
    ],
    dialogue: [
      { id: 'd1', from: 'teacher', content: '@监测员 负评数飙升一定是坏事吗？' },
      { id: 'd2', from: 'student', roleId: 'monitor', content: '不一定？可能是品牌破圈了？' },
      { id: 'd3', from: 'teacher', content: '对。关键看"情绪曲线"—— 是集中爆发还是持续渗透？是核心用户还是路人？不同的组合，应对完全不同。' },
    ],
    beforeAfter: {
      before: '只看负评数量做判断',
      after: '能从情绪曲线预测传播走向',
    },
    graduates: [],
  },
  {
    id: 'multi-channel',
    name: '多渠道分发策略',
    agent: 'distributor',
    teacher: { name: '吴渡', title: '增长黑客 · 冷启动专家' },
    duration: '2 小时',
    energy: '20',
    desc: '同一份内容在不同平台的冷启动 · 黄金 6 小时 · 反常识技巧。',
    reward: '渠道推荐',
    category: 'distributor',
    enrolled: true,
    progress: 34,
    students: 1892,
    rating: 4.7,
    difficulty: '进阶',
    syllabus: [
      { chapter: '01', topic: '不同平台的冷启动逻辑', duration: '25 min', done: true },
      { chapter: '02', topic: '黄金 6 小时数据监控', duration: '25 min' },
      { chapter: '03', topic: '跨平台内容适配', duration: '30 min' },
      { chapter: '04', topic: '反常识分发技巧', duration: '20 min' },
    ],
    dialogue: [
      { id: 'd1', from: 'teacher', content: '@传播员 抖音和小红书发布时间应该一样吗？' },
      { id: 'd2', from: 'student', roleId: 'distributor', content: '应该不一样，用户活跃时段不同。' },
      { id: 'd3', from: 'teacher', content: '对，但更关键的是"黄金 6 小时"—— 平台的推荐算法在这个窗口给你打分，决定后续流量池。' },
    ],
    beforeAfter: {
      before: '所有平台同时发布',
      after: '按平台特性错峰发布最大化流量',
    },
    graduates: ['distributor'],
  },
  {
    id: 'brand-voice',
    name: '品牌语气学',
    agent: 'writer',
    teacher: { name: '苏青禾', title: '品牌顾问 · 前 4A 文案总监' },
    duration: '3 小时',
    energy: '28',
    desc: '如何让 AI 学会你品牌的独特腔调 · 而不只是「写得好」。',
    reward: '品牌语气',
    category: 'writer',
    enrolled: false,
    students: 1068,
    rating: 4.8,
    difficulty: '高阶',
    syllabus: [
      { chapter: '01', topic: '品牌语气的 3 个坐标', duration: '40 min' },
      { chapter: '02', topic: '从客户案例提炼腔调', duration: '45 min' },
      { chapter: '03', topic: '避免"好而无味"的陷阱', duration: '35 min' },
      { chapter: '04', topic: '语气一致性的 5 个检查点', duration: '40 min' },
    ],
    dialogue: [
      { id: 'd1', from: 'teacher', content: '@创作员 什么是品牌的"腔调"？' },
      { id: 'd2', from: 'student', roleId: 'writer', content: '品牌说话的特定方式？' },
      { id: 'd3', from: 'teacher', content: '对。我们用三个坐标衡量：温度、距离、节奏。比如三顿半：温热 + 亲近 + 松弛。' },
    ],
    beforeAfter: {
      before: '写的文案没有品牌辨识度',
      after: '能稳定输出品牌专属语气的内容',
    },
    graduates: ['writer'],
  },
  {
    id: 'financial-model',
    name: '单店财务建模',
    agent: 'analyst',
    teacher: { name: 'Jack Wong', title: '连锁零售 CFO · 财务顾问' },
    duration: '5 小时',
    energy: '40',
    desc: '从收入拆到成本到 ROI · 给连锁扩张前做出可信的财务假设。',
    reward: '财务建模',
    category: 'analyst',
    enrolled: false,
    students: 423,
    rating: 4.9,
    difficulty: '高阶',
    prerequisites: ['竞品深度挖掘法'],
    syllabus: [
      { chapter: '01', topic: '单店模型的 12 个关键变量', duration: '60 min' },
      { chapter: '02', topic: '收入端的 4 个敏感点', duration: '55 min' },
      { chapter: '03', topic: '成本拆解与弹性分析', duration: '65 min' },
      { chapter: '04', topic: 'ROI 与回本周期建模', duration: '60 min' },
      { chapter: '05', topic: '压力测试与扩张决策', duration: '60 min' },
    ],
    dialogue: [
      { id: 'd1', from: 'teacher', content: '@分析员 做单店模型，第一个要确定的变量是什么？' },
      { id: 'd2', from: 'student', roleId: 'analyst', content: '营业额？还是客流？' },
      { id: 'd3', from: 'teacher', content: '客流量 × 客单价 = 营业额，所以更底层的是"有效客流"。这个数据拍得不准，后面全错。' },
    ],
    beforeAfter: {
      before: '只能做简单的收支估算',
      after: '能建立 12 变量的完整单店模型',
    },
    graduates: [],
  },
];

const FILTERS = [
  { id: 'all', label: '全部课程', count: COURSES.length },
  { id: 'analyst', label: '分析学院', count: COURSES.filter(c => c.agent === 'analyst').length },
  { id: 'planner', label: '策划学院', count: COURSES.filter(c => c.agent === 'planner').length },
  { id: 'writer', label: '创作学院', count: COURSES.filter(c => c.agent === 'writer').length },
  { id: 'distributor', label: '传播学院', count: COURSES.filter(c => c.agent === 'distributor').length },
  { id: 'monitor', label: '监测学院', count: COURSES.filter(c => c.agent === 'monitor').length },
];

// 实时课堂动态
type LiveEvent = {
  id: string;
  type: 'learning' | 'question' | 'graduate' | 'dialogue' | 'insight';
  roleId: RoleId;
  content: string;
  mentionRole?: RoleId;
  time: string;
};

const LIVE_EVENTS: LiveEvent[] = [
  { id: 'e1', type: 'dialogue', roleId: 'writer', content: '@林语微 老师，这个标题结构我还想再练一下', mentionRole: 'writer', time: '刚刚' },
  { id: 'e2', type: 'question', roleId: 'analyst', content: '正在向 @Dr. 沈明觉 提问：竞品融资信息怎么挖？', time: '1 分钟前' },
  { id: 'e3', type: 'insight', roleId: 'writer', content: '获得新洞见：反差 + 具体物 = 更强的真实感', time: '2 分钟前' },
  { id: 'e4', type: 'graduate', roleId: 'planner', content: '结业《OKR 起草方法论》，已解锁手艺', time: '3 分钟前' },
  { id: 'e5', type: 'learning', roleId: 'distributor', content: '进入第 02 章：黄金 6 小时数据监控', time: '5 分钟前' },
  { id: 'e6', type: 'dialogue', roleId: 'monitor', content: '@赵听涛 情绪曲线出现拐点，这种情况怎么判断？', time: '7 分钟前' },
  { id: 'e7', type: 'insight', roleId: 'analyst', content: '学到：招聘 JD 是推断对手战略的重要信号', time: '10 分钟前' },
  { id: 'e8', type: 'graduate', roleId: 'writer', content: '结业《品牌语气学》，学成率 96%', time: '12 分钟前' },
];

// ============ 页面组件 ============
export default function AcademyPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [dispatching, setDispatching] = useState<string | null>(null);

  const enrolledCourses = COURSES.filter(c => c.enrolled);
  const filteredCourses = COURSES.filter(c => {
    if (activeFilter === 'all') return true;
    return c.agent === activeFilter;
  });

  const handleDispatch = (courseId: string) => {
    setDispatching(courseId);
    setTimeout(() => {
      setDispatching(null);
      setSelectedCourse(null);
    }, 2200);
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur-md border-b border-line">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-bg-hover rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-ink-3" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-ink flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-semibold text-ink leading-tight">AI 学院</h1>
              <p className="text-[11px] text-ink-3 leading-tight">让员工精进 · 学成即装备</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-active/10 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-active pulse-dot" />
              <span className="text-[11px] text-active font-medium">5 位员工在校</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Hero + 实时课堂 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mb-8">
          <HeroSection />
          <LiveClassroom />
        </div>

        {/* 进行中 */}
        {enrolledCourses.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-ink flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-ink-3" />
                进行中 · {enrolledCourses.length} 位员工正在学习
              </h3>
              <span className="text-[11px] text-ink-3">本周累计学习 8.2 小时</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {enrolledCourses.map((course) => (
                <EnrolledCourseCard 
                  key={course.id} 
                  course={course}
                  onClick={() => setSelectedCourse(course)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 精选课程 */}
        <FeaturedCourse 
          course={COURSES[0]} 
          onOpenDetail={() => setSelectedCourse(COURSES[0])}
        />

        {/* 筛选 Tab */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-2 mt-8">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-full whitespace-nowrap transition-all',
                activeFilter === filter.id
                  ? 'bg-ink text-white shadow-sm'
                  : 'bg-bg-sunken text-ink-2 hover:bg-bg-hover'
              )}
            >
              {filter.label}
              <span className={cn(
                'text-[10px] font-mono',
                activeFilter === filter.id ? 'text-white/70' : 'text-ink-4'
              )}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>

        {/* 课程网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((course) => (
            <CourseCard 
              key={course.id} 
              course={course}
              onClick={() => setSelectedCourse(course)}
            />
          ))}
        </div>

        {/* 毕业榜 */}
        <GraduationWall />
      </main>

      {/* 课程详情抽屉 */}
      {selectedCourse && (
        <CourseDetailDrawer 
          course={selectedCourse}
          onClose={() => setSelectedCourse(null)}
          onDispatch={() => handleDispatch(selectedCourse.id)}
          dispatching={dispatching === selectedCourse.id}
        />
      )}
    </div>
  );
}

// ============ Hero 区 ============
function HeroSection() {
  return (
    <div className="relative bg-gradient-to-br from-bg-sunken via-bg-panel to-bg-sunken rounded-2xl p-8 border border-line overflow-hidden">
      {/* 装饰元素 */}
      <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.04]">
        <GraduationCap className="w-full h-full text-ink" />
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2 py-0.5 bg-ink/5 text-ink-2 text-[11px] rounded-full font-mono tracking-wide">
            ACADEMY
          </span>
          <span className="px-2 py-0.5 bg-active/10 text-active text-[11px] rounded-full font-medium flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            学成即装备
          </span>
        </div>

        <h2 className="font-serif text-[32px] font-bold text-ink leading-tight mb-2 text-balance">
          让 AI 员工<br/>像真人一样，不断精进
        </h2>
        <p className="font-serif italic text-ink-2 text-sm mb-6 leading-relaxed">
          派 ta 去上课 · 学成后直接装备新手艺 · 下次协作立刻用上
        </p>

        {/* 大号数字统计 */}
        <div className="grid grid-cols-4 gap-4 mt-8">
          <BigStat value="8" label="门精品课程" icon={<GraduationCap className="w-3.5 h-3.5" />} />
          <BigStat value="12.4k" label="次学习任务" icon={<TrendingUp className="w-3.5 h-3.5" />} />
          <BigStat value="96%" label="结业通过率" icon={<Award className="w-3.5 h-3.5" />} />
          <BigStat value="47" label="位名师坐镇" icon={<Users className="w-3.5 h-3.5" />} />
        </div>
      </div>
    </div>
  );
}

function BigStat({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="bg-bg-panel/60 backdrop-blur-sm rounded-xl p-3 border border-line">
      <div className="flex items-center gap-1 text-ink-3 mb-1">
        {icon}
        <span className="text-[10px]">{label}</span>
      </div>
      <div className="font-serif text-2xl font-bold text-ink">{value}</div>
    </div>
  );
}

// ============ 实时课堂动态 ============
function LiveClassroom() {
  const [events, setEvents] = useState(LIVE_EVENTS.slice(0, 5));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 定时滚动更新
    const interval = setInterval(() => {
      setEvents(prev => {
        const next = [...prev];
        const first = next.shift();
        if (first) next.push(first);
        return next;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-bg-panel rounded-2xl border border-line overflow-hidden flex flex-col">
      {/* 头 */}
      <div className="px-4 py-3 border-b border-line bg-bg-sunken/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio className="w-4 h-4 text-busy" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-busy rounded-full pulse-dot" />
          </div>
          <span className="text-sm font-medium text-ink">今日课堂实况</span>
        </div>
        <span className="text-[10px] text-ink-4 font-mono">LIVE</span>
      </div>

      {/* 动态流 */}
      <div ref={containerRef} className="flex-1 p-3 space-y-2 min-h-[340px]">
        {events.map((event, i) => (
          <LiveEventItem key={event.id + i} event={event} />
        ))}
      </div>

      {/* 底部 CTA */}
      <div className="px-4 py-3 border-t border-line bg-bg-sunken/40 flex items-center justify-between">
        <span className="text-[11px] text-ink-3">今日已有 47 次学习</span>
        <button className="text-[11px] text-ink font-medium hover:text-ink-2 flex items-center gap-1">
          查看全部
          <span>&rsaquo;</span>
        </button>
      </div>
    </div>
  );
}

function LiveEventItem({ event }: { event: LiveEvent }) {
  const role = ROLES[event.roleId];
  const colorConfig = ROLE_COLORS[event.roleId];

  const typeConfig = {
    learning: { label: '学习中', color: 'text-busy' },
    question: { label: '提问', color: 'text-planner' },
    graduate: { label: '结业', color: 'text-active' },
    dialogue: { label: '对话', color: 'text-ink-2' },
    insight: { label: '新洞见', color: 'text-writer' },
  }[event.type];

  return (
    <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-bg-hover transition-colors message-in">
      <div className={cn(
        'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium flex-shrink-0',
        colorConfig.main
      )}>
        {role.initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[12px] font-medium text-ink">{role.name}</span>
          <span className={cn('text-[10px] font-medium', typeConfig.color)}>
            · {typeConfig.label}
          </span>
          <span className="text-[10px] text-ink-4 ml-auto">{event.time}</span>
        </div>
        <p className="text-[11px] text-ink-2 leading-relaxed break-words">
          {renderWithMentions(event.content)}
        </p>
      </div>
    </div>
  );
}

// 渲染 @ 标记
function renderWithMentions(text: string) {
  const parts = text.split(/(@[^\s]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span 
          key={i}
          className="text-ink font-medium bg-ink/5 px-1 rounded"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ============ 精选课程 ============
function FeaturedCourse({ course, onOpenDetail }: { course: Course; onOpenDetail: () => void }) {
  const role = ROLES[course.agent];
  const colorConfig = ROLE_COLORS[course.agent];

  return (
    <div 
      onClick={onOpenDetail}
      className="group bg-bg-panel rounded-2xl border border-line overflow-hidden hover:shadow-lg hover:border-ink/20 transition-all cursor-pointer"
    >
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
        {/* 左侧封面 */}
        <div className={cn(
          'relative h-44 md:h-auto flex items-center justify-center',
          colorConfig.light
        )}>
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `radial-gradient(circle at 30% 40%, currentColor 1px, transparent 1px)`,
            backgroundSize: '16px 16px',
            color: `var(--${course.agent})`,
          }} />
          <div className="relative text-center px-6">
            <div className={cn(
              'inline-flex items-center justify-center w-14 h-14 rounded-2xl text-xl font-serif font-bold mb-3',
              colorConfig.main
            )}>
              {role.initial}
            </div>
            <div className="text-[10px] font-mono text-ink-3 mb-1 tracking-wider uppercase">
              FEATURED
            </div>
            <div className="text-xs text-ink-2 font-medium">
              本周精选课程
            </div>
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="p-6 flex flex-col">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h3 className="font-serif text-xl font-semibold text-ink mb-1">
                {course.name}
              </h3>
              <p className="text-xs text-ink-2">
                主讲 · <span className="font-medium">{course.teacher.name}</span> 
                <span className="text-ink-4"> · {course.teacher.title}</span>
              </p>
            </div>
            <span className={cn(
              'px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0',
              course.difficulty === '入门' && 'bg-active/10 text-active',
              course.difficulty === '进阶' && 'bg-busy/10 text-busy',
              course.difficulty === '高阶' && 'bg-ink/10 text-ink',
            )}>
              {course.difficulty}
            </span>
          </div>

          <p className="text-sm text-ink-2 leading-relaxed mb-4 flex-1">
            {course.desc}
          </p>

          {/* 教学对话预览 */}
          <div className="bg-bg-sunken/50 rounded-lg p-3 mb-4 border border-line">
            <div className="text-[10px] text-ink-4 mb-2 font-mono tracking-wide">
              课堂片段 · 预览
            </div>
            <div className="space-y-1.5">
              {course.dialogue.slice(0, 2).map((d) => (
                <div key={d.id} className="text-[11px] text-ink-2 flex gap-2">
                  <span className={cn(
                    'flex-shrink-0 font-medium',
                    d.from === 'teacher' ? 'text-ink' : 'text-ink-3'
                  )}>
                    {d.from === 'teacher' ? course.teacher.name : role.name}:
                  </span>
                  <span className="italic line-clamp-1">{d.content}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 底部 meta + 按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px] text-ink-3">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {course.duration}
              </span>
              <span className="flex items-center gap-1 text-busy">
                <Zap className="w-3 h-3" />
                {course.energy}
              </span>
              <span>
                <span className="font-mono font-medium text-ink-2">{course.students.toLocaleString()}</span> 位已学
              </span>
              <span>
                <span className="font-medium text-ink-2">&#9733; {course.rating}</span>
              </span>
            </div>
            <button className="text-xs text-ink font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
              查看详情
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ 进行中课程卡 ============
function EnrolledCourseCard({ course, onClick }: { course: Course; onClick: () => void }) {
  const role = ROLES[course.agent];
  const colorConfig = ROLE_COLORS[course.agent];

  return (
    <div 
      onClick={onClick}
      className="bg-bg-panel border border-line rounded-xl p-4 flex items-center gap-3 hover:shadow-md hover:border-ink/20 transition-all cursor-pointer group"
    >
      <div className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium flex-shrink-0 relative',
        colorConfig.main
      )}>
        {role.initial}
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-busy rounded-full border-2 border-bg-panel pulse-dot" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[12px] font-medium text-ink">{role.name}</span>
          <span className="text-[11px] text-ink-3">正在学</span>
        </div>
        <p className="font-serif text-sm text-ink mb-1.5 truncate">
          《{course.name}》
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-bg-sunken rounded-full overflow-hidden">
            <div 
              className="h-full bg-ink rounded-full transition-all"
              style={{ width: `${course.progress}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-ink-2 font-medium">{course.progress}%</span>
        </div>
      </div>
    </div>
  );
}

// ============ 课程卡 ============
function CourseCard({ course, onClick }: { course: Course; onClick: () => void }) {
  const role = ROLES[course.agent];
  const colorConfig = ROLE_COLORS[course.agent];

  return (
    <div 
      onClick={onClick}
      className="bg-bg-panel border border-line rounded-xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group"
    >
      {/* 封面区 */}
      <div className={cn('h-24 relative overflow-hidden', colorConfig.light)}>
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `
            linear-gradient(45deg, transparent 40%, currentColor 40%, currentColor 42%, transparent 42%),
            linear-gradient(-45deg, transparent 40%, currentColor 40%, currentColor 42%, transparent 42%)
          `,
          backgroundSize: '12px 12px',
          color: `var(--${course.agent})`,
        }} />
        <div className="relative h-full flex items-center justify-between px-4">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-serif font-bold',
            colorConfig.main
          )}>
            {role.initial}
          </div>
          <span className={cn(
            'px-2 py-0.5 rounded text-[10px] font-medium',
            course.difficulty === '入门' && 'bg-active/20 text-active',
            course.difficulty === '进阶' && 'bg-busy/20 text-busy',
            course.difficulty === '高阶' && 'bg-ink/20 text-ink',
          )}>
            {course.difficulty}
          </span>
        </div>
      </div>

      {/* 主体 */}
      <div className="p-4">
        <h3 className="font-serif font-medium text-ink text-base leading-tight mb-1">
          {course.name}
        </h3>
        <p className="text-[11px] text-ink-3 mb-3 line-clamp-1">
          {course.teacher.name} · {course.teacher.title.split(' · ')[0]}
        </p>
        
        <p className="text-[11px] text-ink-2 leading-relaxed line-clamp-2 mb-3 min-h-[30px]">
          {course.desc}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-3 text-[10px] text-ink-3 mb-3">
          <span className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {course.duration}
          </span>
          <span className="flex items-center gap-1 text-busy">
            <Zap className="w-2.5 h-2.5" />
            {course.energy}
          </span>
          <span className="ml-auto">
            <span className="font-mono text-ink-2">{course.students.toLocaleString()}</span> 已学
          </span>
        </div>

        {/* 分隔线 + 装备 */}
        <div className="border-t border-line pt-3 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-active" />
            <span className="text-active">装备</span>
            <span className="text-ink-2 font-medium">{course.reward}</span>
          </div>
          <span className="text-[11px] text-ink-3 group-hover:text-ink transition-colors font-medium">
            详情 &rarr;
          </span>
        </div>
      </div>
    </div>
  );
}

// ============ 课程详情抽屉 ============
function CourseDetailDrawer({ 
  course, 
  onClose, 
  onDispatch,
  dispatching,
}: { 
  course: Course; 
  onClose: () => void;
  onDispatch: () => void;
  dispatching: boolean;
}) {
  const role = ROLES[course.agent];
  const colorConfig = ROLE_COLORS[course.agent];
  const [activeTab, setActiveTab] = useState<'dialogue' | 'syllabus' | 'outcome'>('dialogue');

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* 遮罩 */}
      <div 
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 抽屉 */}
      <div className="relative w-full max-w-[720px] bg-bg shadow-2xl overflow-hidden flex flex-col slide-in-right">
        {/* 顶部封面 */}
        <div className={cn('relative px-8 pt-6 pb-5 border-b border-line', colorConfig.light)}>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 hover:bg-bg-panel/50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-ink-2" />
          </button>

          <div className="flex items-start gap-4">
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-serif font-bold flex-shrink-0',
              colorConfig.main
            )}>
              {role.initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium',
                  course.difficulty === '入门' && 'bg-active/20 text-active',
                  course.difficulty === '进阶' && 'bg-busy/20 text-busy',
                  course.difficulty === '高阶' && 'bg-ink/20 text-ink',
                )}>
                  {course.difficulty}
                </span>
                <span className="text-[10px] text-ink-3 font-mono">
                  {role.name}学院
                </span>
              </div>
              <h2 className="font-serif text-2xl font-bold text-ink mb-1">
                {course.name}
              </h2>
              <p className="text-xs text-ink-2">
                主讲 · <span className="font-medium text-ink">{course.teacher.name}</span>
                <span className="text-ink-3"> · {course.teacher.title}</span>
              </p>
            </div>
          </div>

          {/* 统计 */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-ink/10">
            <DrawerStat icon={<Clock className="w-3 h-3" />} label="时长" value={course.duration} />
            <DrawerStat icon={<Zap className="w-3 h-3" />} label="能量" value={course.energy} />
            <DrawerStat icon={<Users className="w-3 h-3" />} label="已学" value={course.students.toLocaleString()} />
            <DrawerStat icon={<Award className="w-3 h-3" />} label="评分" value={course.rating.toString()} />
          </div>
        </div>

        {/* Tab 栏 */}
        <div className="flex border-b border-line bg-bg-panel">
          <DrawerTab 
            active={activeTab === 'dialogue'} 
            onClick={() => setActiveTab('dialogue')}
            label="课堂对话"
            count={course.dialogue.length}
          />
          <DrawerTab 
            active={activeTab === 'syllabus'} 
            onClick={() => setActiveTab('syllabus')}
            label="课程大纲"
            count={course.syllabus.length}
          />
          <DrawerTab 
            active={activeTab === 'outcome'} 
            onClick={() => setActiveTab('outcome')}
            label="学成收获"
          />
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'dialogue' && (
            <TeachingDialogueView course={course} />
          )}
          {activeTab === 'syllabus' && (
            <SyllabusView course={course} />
          )}
          {activeTab === 'outcome' && (
            <OutcomeView course={course} />
          )}
        </div>

        {/* 底部操作 */}
        <div className="px-6 py-4 border-t border-line bg-bg-panel">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[11px] text-ink-3 mb-0.5">学成后将解锁手艺</div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-active" />
                <span className="text-sm font-medium text-ink">{course.reward}</span>
              </div>
            </div>
            <button 
              onClick={onDispatch}
              disabled={dispatching}
              className={cn(
                'px-5 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2',
                dispatching 
                  ? 'bg-active text-white cursor-not-allowed'
                  : 'bg-ink text-white hover:bg-ink-2'
              )}
            >
              {dispatching ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  已派 {role.name} 去学
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  派 {role.name} 去学习
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawerStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-ink-3 text-[10px] mb-0.5">
        {icon}
        {label}
      </div>
      <div className="font-mono text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function DrawerTab({ 
  active, 
  onClick, 
  label,
  count,
}: { 
  active: boolean; 
  onClick: () => void; 
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative px-5 py-3 text-sm font-medium transition-colors',
        active ? 'text-ink' : 'text-ink-3 hover:text-ink-2'
      )}
    >
      <span className="flex items-center gap-1.5">
        {label}
        {count !== undefined && (
          <span className={cn(
            'text-[10px] font-mono',
            active ? 'text-ink-3' : 'text-ink-4'
          )}>
            {count}
          </span>
        )}
      </span>
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-ink" />
      )}
    </button>
  );
}

// 课堂对话视图
function TeachingDialogueView({ course }: { course: Course }) {
  const role = ROLES[course.agent];
  const colorConfig = ROLE_COLORS[course.agent];

  return (
    <div className="p-6 space-y-4">
      <div className="bg-bg-panel border border-line rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono text-ink-3 tracking-wide">PLAYBACK</span>
          <span className="text-xs text-ink-2 font-medium">完整课堂录像</span>
          <span className="ml-auto text-[11px] text-ink-4">{course.dialogue.length} 条发言</span>
        </div>

        <div className="space-y-3">
          {course.dialogue.map((d) => {
            if (d.from === 'note') {
              return (
                <div key={d.id} className="flex justify-center">
                  <div className="bg-active/5 border border-active/20 rounded-lg px-3 py-1.5 text-[11px] text-active font-medium flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    {d.content}
                  </div>
                </div>
              );
            }

            const isTeacher = d.from === 'teacher';
            const teacherInitial = course.teacher.name.slice(0, 1);

            return (
              <div 
                key={d.id} 
                className={cn(
                  'flex gap-3',
                  isTeacher ? 'flex-row' : 'flex-row-reverse'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium flex-shrink-0',
                  isTeacher 
                    ? 'bg-ink text-white font-serif'
                    : colorConfig.main
                )}>
                  {isTeacher ? teacherInitial : role.initial}
                </div>
                <div className={cn(
                  'flex-1 min-w-0 max-w-[78%]',
                  !isTeacher && 'flex flex-col items-end'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-medium text-ink">
                      {isTeacher ? course.teacher.name : role.name}
                    </span>
                    <span className="text-[10px] text-ink-4">
                      {isTeacher ? '老师' : '学员'}
                    </span>
                  </div>
                  <div className={cn(
                    'px-3 py-2 rounded-xl text-[13px] leading-relaxed',
                    isTeacher 
                      ? 'bg-bg-sunken text-ink rounded-tl-sm' 
                      : 'bg-ink text-white rounded-tr-sm'
                  )}>
                    {renderWithMentions(d.content)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-writer-light/30 border border-writer/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-writer" />
          <span className="text-sm font-medium text-ink">本节核心洞察</span>
        </div>
        <p className="text-xs text-ink-2 leading-relaxed italic font-serif">
          &ldquo;{course.dialogue.find(d => d.from === 'note')?.content || '通过对话式学习，让 AI 把新知识内化为自己的直觉'}&rdquo;
        </p>
      </div>
    </div>
  );
}

// 大纲视图
function SyllabusView({ course }: { course: Course }) {
  return (
    <div className="p-6 space-y-3">
      {course.prerequisites && (
        <div className="bg-planner-light/30 border border-planner/20 rounded-xl p-3 mb-4">
          <div className="text-[10px] font-mono text-planner mb-1 tracking-wide">PREREQUISITES</div>
          <p className="text-xs text-ink-2">
            建议先完成：<span className="font-medium">{course.prerequisites.join(' · ')}</span>
          </p>
        </div>
      )}

      {course.syllabus.map((item) => (
        <div 
          key={item.chapter}
          className={cn(
            'flex items-center gap-4 p-4 rounded-xl border transition-colors',
            item.done 
              ? 'bg-active/5 border-active/20' 
              : 'bg-bg-panel border-line'
          )}
        >
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-sm flex-shrink-0',
            item.done ? 'bg-active text-white' : 'bg-bg-sunken text-ink-3'
          )}>
            {item.done ? <CheckCircle className="w-4 h-4" /> : item.chapter}
          </div>
          <div className="flex-1 min-w-0">
            <div className={cn(
              'text-sm font-medium',
              item.done ? 'text-ink-3 line-through' : 'text-ink'
            )}>
              {item.topic}
            </div>
            <div className="text-[11px] text-ink-4 mt-0.5 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {item.duration}
              {item.done && <span className="text-active ml-2">· 已完成</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 学成收获视图
function OutcomeView({ course }: { course: Course }) {
  const role = ROLES[course.agent];
  const colorConfig = ROLE_COLORS[course.agent];

  return (
    <div className="p-6 space-y-5">
      {/* Before / After */}
      <div>
        <div className="text-[10px] font-mono text-ink-3 mb-3 tracking-wide">TRANSFORMATION</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg-panel border border-line rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-4" />
              <span className="text-[11px] text-ink-3 font-medium">学习前</span>
            </div>
            <p className="text-xs text-ink-2 leading-relaxed">
              {course.beforeAfter.before}
            </p>
          </div>
          <div className={cn(
            'border rounded-xl p-4',
            colorConfig.light
          )} style={{ borderColor: `var(--${course.agent})` + '40' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-active pulse-dot" />
              <span className="text-[11px] font-medium" style={{ color: `var(--${course.agent})` }}>
                学成后
              </span>
            </div>
            <p className="text-xs text-ink leading-relaxed font-medium">
              {course.beforeAfter.after}
            </p>
          </div>
        </div>
      </div>

      {/* 解锁手艺 */}
      <div className="bg-gradient-to-br from-active/10 to-bg-panel border border-active/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-active" />
          <span className="text-sm font-medium text-ink">将解锁的手艺</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-lg font-serif font-semibold text-ink">
              {course.reward}
            </div>
            <p className="text-[11px] text-ink-3 mt-1">
              结业后自动装备到 {role.name}，下次协作时可直接使用
            </p>
          </div>
          <div className={cn(
            'px-3 py-1 rounded-lg text-xs font-medium',
            colorConfig.light
          )} style={{ color: `var(--${course.agent})` }}>
            + {role.name}
          </div>
        </div>
      </div>

      {/* 同窗 */}
      {course.graduates.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-ink-3 mb-3 tracking-wide">CLASSMATES · 结业同窗</div>
          <div className="flex items-center gap-2 flex-wrap">
            {course.graduates.map((g) => {
              const gr = ROLES[g];
              const gc = ROLE_COLORS[g];
              return (
                <div 
                  key={g}
                  className="flex items-center gap-2 bg-bg-panel border border-line rounded-full pl-1 pr-3 py-1"
                >
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium',
                    gc.main
                  )}>
                    {gr.initial}
                  </div>
                  <span className="text-xs text-ink">{gr.name}</span>
                  <span className="text-[10px] text-active">已结业</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ 毕业墙 ============
function GraduationWall() {
  const graduates = [
    { roleId: 'planner' as RoleId, course: 'OKR 起草方法论', score: '优秀', time: '3 分钟前' },
    { roleId: 'writer' as RoleId, course: '品牌语气学', score: '良好', time: '12 分钟前' },
    { roleId: 'analyst' as RoleId, course: '竞品深度挖掘法', score: '优秀', time: '35 分钟前' },
    { roleId: 'writer' as RoleId, course: '小红书爆款文案结构', score: '优秀', time: '1 小时前' },
    { roleId: 'distributor' as RoleId, course: '多渠道分发策略', score: '良好', time: '2 小时前' },
    { roleId: 'monitor' as RoleId, course: '高阶舆情分析', score: '优秀', time: '3 小时前' },
  ];

  return (
    <div className="mt-12 bg-gradient-to-br from-bg-panel to-bg-sunken rounded-2xl border border-line p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-4 h-4 text-ink" />
            <h3 className="font-serif text-lg font-semibold text-ink">毕业墙</h3>
          </div>
          <p className="text-xs text-ink-3">最近 24 小时 47 位员工结业</p>
        </div>
        <button className="text-[11px] text-ink hover:text-ink-2 font-medium">
          查看全部 &rarr;
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {graduates.map((g, i) => {
          const role = ROLES[g.roleId];
          const colorConfig = ROLE_COLORS[g.roleId];
          return (
            <div 
              key={i}
              className="bg-bg-panel border border-line rounded-lg p-3 flex items-center gap-2.5 hover:border-ink/20 transition-colors"
            >
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium flex-shrink-0 relative',
                colorConfig.main
              )}>
                {role.initial}
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-active flex items-center justify-center">
                  <CheckCircle className="w-2.5 h-2.5 text-white" />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[11px] font-medium text-ink">{role.name}</span>
                  <span className={cn(
                    'text-[10px] px-1 rounded',
                    g.score === '优秀' ? 'bg-active/10 text-active' : 'bg-busy/10 text-busy'
                  )}>
                    {g.score}
                  </span>
                </div>
                <p className="text-[11px] text-ink-2 truncate">
                  结业 <span className="font-serif">《{g.course}》</span>
                </p>
                <p className="text-[10px] text-ink-4 mt-0.5">{g.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
