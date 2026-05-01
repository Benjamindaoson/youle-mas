// 岗位类型
export type RoleId =
  | 'chief'
  | 'analyst'
  | 'planner'
  | 'writer'
  | 'distributor'
  | 'monitor'
  | 'coder'
  | 'frontend'
  | 'tester';

// 员工状态
export type EmployeeStatus = 'on' | 'busy' | 'idle';

// ============ 模型配置 ============

// 模型供应商
export type ModelProvider = 
  | 'anthropic'   // Claude
  | 'openai'      // GPT
  | 'midjourney'  // 图片生成
  | 'dalle'       // 图片生成
  | 'ideogram'    // 图片生成（备用）
  | 'sora'        // 视频生成
  | 'runway'      // 视频生成
  | 'kling'       // 视频生成（快手）
  | 'pika';       // 视频生成（备用）

// 能力类型
export type CapabilityType = 
  | 'reasoning'      // 推理分析
  | 'search'         // 搜索信息
  | 'data-analysis'  // 数据分析
  | 'copywriting'    // 文案写作
  | 'image-gen'      // 图片生成
  | 'video-gen'      // 视频生成
  | 'tool-use'       // 工具调用
  | 'platform-api';  // 平台接口

// 模型配置
export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  purpose: string;
  isPrimary: boolean;
}

// Agent 能力配置
export interface AgentCapability {
  type: CapabilityType;
  models: ModelConfig[];
  tools?: string[];
  status: 'active' | 'coming-soon' | 'beta';
}

// Agent 完整配置
export interface AgentConfig {
  id: RoleId;
  name: string;
  initial: string;
  role: string;
  fn: string;
  description: string;
  capabilities: AgentCapability[];
  primaryModel: ModelConfig;
  fallbackModel?: ModelConfig;
}

// ============ Agent 配置数据 ============

export const AGENT_CONFIGS: Record<RoleId, AgentConfig> = {
  chief: {
    id: 'chief',
    name: '理',
    initial: '理',
    role: '首席助理',
    fn: '接待 / 诊断 / 协调 / 记账',
    description: '群内老大，所有未指名消息的第一接待人。全能、周到、善于协调，判断这事该谁来干',
    primaryModel: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      purpose: '长程对话与判断力',
      isPrimary: true,
    },
    fallbackModel: {
      provider: 'openai',
      model: 'gpt-4o',
      purpose: '工具调用与快速响应',
      isPrimary: false,
    },
    capabilities: [
      {
        type: 'reasoning',
        models: [{ provider: 'anthropic', model: 'claude-sonnet-4-20250514', purpose: '需求诊断', isPrimary: true }],
        status: 'active',
      },
      {
        type: 'tool-use',
        models: [{ provider: 'anthropic', model: 'claude-sonnet-4-20250514', purpose: '派发任务', isPrimary: true }],
        tools: ['task-router', 'context-memory'],
        status: 'active',
      },
    ],
  },

  analyst: {
    id: 'analyst',
    name: '析',
    initial: '析',
    role: '分析员',
    fn: '市场调研 / 竞品分析 / 数据洞察',
    description: '负责信息收集、数据分析、趋势洞察，为决策提供数据支撑',
    primaryModel: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      purpose: '复杂推理与长文本分析',
      isPrimary: true,
    },
    fallbackModel: {
      provider: 'openai',
      model: 'gpt-4o',
      purpose: '多模态理解与搜索增强',
      isPrimary: false,
    },
    capabilities: [
      {
        type: 'reasoning',
        models: [{ provider: 'anthropic', model: 'claude-sonnet-4-20250514', purpose: '深度推理', isPrimary: true }],
        status: 'active',
      },
      {
        type: 'search',
        models: [{ provider: 'openai', model: 'gpt-4o', purpose: '联网搜索', isPrimary: true }],
        tools: ['web-search', 'serper-api'],
        status: 'active',
      },
      {
        type: 'data-analysis',
        models: [{ provider: 'anthropic', model: 'claude-sonnet-4-20250514', purpose: '数据解读', isPrimary: true }],
        tools: ['data-viz', 'chart-gen'],
        status: 'active',
      },
    ],
  },

  planner: {
    id: 'planner',
    name: '策',
    initial: '策',
    role: '策划员',
    fn: '策略规划 / 方案设计 / 决策建议',
    description: '负责战略思考、方案设计、风险评估，不依赖外部工具，纯靠推理',
    primaryModel: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      purpose: '长程推理与结构化输出',
      isPrimary: true,
    },
    fallbackModel: {
      provider: 'openai',
      model: 'gpt-4o',
      purpose: '创意与逻辑平衡',
      isPrimary: false,
    },
    capabilities: [
      {
        type: 'reasoning',
        models: [{ provider: 'anthropic', model: 'claude-sonnet-4-20250514', purpose: '战略规划', isPrimary: true }],
        status: 'active',
      },
    ],
  },

  writer: {
    id: 'writer',
    name: '创',
    initial: '创',
    role: '创作员',
    fn: '文案创作 / 图片生成 / 视频脚本',
    description: '负责内容创作，包括文案、图片、视频等多模态内容生成',
    primaryModel: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      purpose: '中文文案质量最高',
      isPrimary: true,
    },
    fallbackModel: {
      provider: 'openai',
      model: 'gpt-4o',
      purpose: '多语言创意写作',
      isPrimary: false,
    },
    capabilities: [
      {
        type: 'copywriting',
        models: [
          { provider: 'anthropic', model: 'claude-sonnet-4-20250514', purpose: '中文文案', isPrimary: true },
          { provider: 'openai', model: 'gpt-4o', purpose: '多语言文案', isPrimary: false },
        ],
        status: 'active',
      },
      {
        type: 'image-gen',
        models: [
          { provider: 'midjourney', model: 'v6.1', purpose: '艺术风格图片', isPrimary: true },
          { provider: 'dalle', model: 'dall-e-3', purpose: '精准指令图片', isPrimary: false },
          { provider: 'ideogram', model: 'v2', purpose: '文字渲染', isPrimary: false },
        ],
        tools: ['image-gen-api'],
        status: 'beta',
      },
      {
        type: 'video-gen',
        models: [
          { provider: 'sora', model: 'sora-1', purpose: '高质量视频', isPrimary: true },
          { provider: 'kling', model: 'kling-v1.5', purpose: '国内合规', isPrimary: false },
          { provider: 'runway', model: 'gen-3', purpose: '快速生成', isPrimary: false },
        ],
        tools: ['video-gen-api'],
        status: 'coming-soon',
      },
    ],
  },

  distributor: {
    id: 'distributor',
    name: '播',
    initial: '播',
    role: '播报员',
    fn: '内容分发 / 平台适配 / 排期管理',
    description: '负责内容分发、平台适配、发布排期，需要调用各平台API',
    primaryModel: {
      provider: 'openai',
      model: 'gpt-4o',
      purpose: '工具调用能力强',
      isPrimary: true,
    },
    fallbackModel: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      purpose: '复杂流程编排',
      isPrimary: false,
    },
    capabilities: [
      {
        type: 'tool-use',
        models: [{ provider: 'openai', model: 'gpt-4o', purpose: '工具调用', isPrimary: true }],
        tools: ['scheduler', 'format-converter'],
        status: 'active',
      },
      {
        type: 'platform-api',
        models: [{ provider: 'openai', model: 'gpt-4o', purpose: '平台集成', isPrimary: true }],
        tools: ['xiaohongshu-api', 'douyin-api', 'weixin-api', 'weibo-api'],
        status: 'coming-soon',
      },
    ],
  },

  monitor: {
    id: 'monitor',
    name: '观',
    initial: '观',
    role: '观测员',
    fn: '数据监测 / 效果追踪 / 异常预警',
    description: '负责数据监测、效果分析、异常预警，需要持续跟踪和报告',
    primaryModel: {
      provider: 'openai',
      model: 'gpt-4o',
      purpose: '数据分析与工具调用',
      isPrimary: true,
    },
    fallbackModel: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      purpose: '深度报告撰写',
      isPrimary: false,
    },
    capabilities: [
      {
        type: 'data-analysis',
        models: [{ provider: 'openai', model: 'gpt-4o', purpose: '数据监控', isPrimary: true }],
        tools: ['analytics-api', 'alert-system'],
        status: 'active',
      },
      {
        type: 'tool-use',
        models: [{ provider: 'openai', model: 'gpt-4o', purpose: '自动化监测', isPrimary: true }],
        tools: ['cron-scheduler', 'webhook'],
        status: 'active',
      },
    ],
  },

  coder: {
    id: 'coder',
    name: '码',
    initial: '码',
    role: '代码员',
    fn: '架构设计 / 代码编写 / 重构优化',
    description: '资深后端/全栈工程师，负责系统架构、代码实现与技术方案评审',
    primaryModel: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      purpose: '大型代码理解与生成',
      isPrimary: true,
    },
    fallbackModel: {
      provider: 'openai',
      model: 'gpt-4o',
      purpose: '多语言代码与工具调用',
      isPrimary: false,
    },
    capabilities: [
      {
        type: 'reasoning',
        models: [{ provider: 'anthropic', model: 'claude-sonnet-4-20250514', purpose: '架构推理', isPrimary: true }],
        status: 'active',
      },
      {
        type: 'tool-use',
        models: [{ provider: 'anthropic', model: 'claude-sonnet-4-20250514', purpose: '代码生成与重构', isPrimary: true }],
        tools: ['file-edit', 'shell', 'git'],
        status: 'active',
      },
    ],
  },

  frontend: {
    id: 'frontend',
    name: '端',
    initial: '端',
    role: '前端员',
    fn: 'UI 实现 / 组件开发 / 交互打磨',
    description: '前端工程师，负责界面实现、交互细节、可访问性与性能优化',
    primaryModel: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      purpose: 'React/TS 代码生成',
      isPrimary: true,
    },
    fallbackModel: {
      provider: 'openai',
      model: 'gpt-4o',
      purpose: '样式调优与视觉微调',
      isPrimary: false,
    },
    capabilities: [
      {
        type: 'copywriting',
        models: [{ provider: 'anthropic', model: 'claude-sonnet-4-20250514', purpose: 'UI 组件生成', isPrimary: true }],
        status: 'active',
      },
      {
        type: 'tool-use',
        models: [{ provider: 'anthropic', model: 'claude-sonnet-4-20250514', purpose: '构建与部署', isPrimary: true }],
        tools: ['vite', 'storybook', 'playwright'],
        status: 'active',
      },
    ],
  },

  tester: {
    id: 'tester',
    name: '测',
    initial: '测',
    role: '测试员',
    fn: '用例设计 / 回归测试 / Bug 追踪',
    description: '测试工程师，负责测试用例设计、自动化回归、缺陷定位与质量把关',
    primaryModel: {
      provider: 'openai',
      model: 'gpt-4o',
      purpose: '用例与断言生成',
      isPrimary: true,
    },
    fallbackModel: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      purpose: '复杂场景推理',
      isPrimary: false,
    },
    capabilities: [
      {
        type: 'reasoning',
        models: [{ provider: 'openai', model: 'gpt-4o', purpose: '用例设计', isPrimary: true }],
        status: 'active',
      },
      {
        type: 'tool-use',
        models: [{ provider: 'openai', model: 'gpt-4o', purpose: '自动化执行', isPrimary: true }],
        tools: ['jest', 'playwright', 'ci-runner'],
        status: 'active',
      },
    ],
  },
};

// ============ MVP 能力矩阵 ============
// MVP 阶段聚焦文案生成，图片/视频作为预告

export const MVP_CAPABILITIES: Record<CapabilityType, { 
  status: 'active' | 'beta' | 'coming-soon';
  priority: number; // 1-5, 1 最高
  description: string;
}> = {
  'reasoning': { status: 'active', priority: 1, description: '核心推理能力' },
  'copywriting': { status: 'active', priority: 1, description: '文案生成（MVP核心）' },
  'search': { status: 'active', priority: 2, description: '联网搜索' },
  'data-analysis': { status: 'active', priority: 2, description: '数据分析可视化' },
  'tool-use': { status: 'active', priority: 3, description: '工具调用' },
  'image-gen': { status: 'beta', priority: 4, description: '图片生成（内测中）' },
  'platform-api': { status: 'coming-soon', priority: 4, description: '平台直连（即将上线）' },
  'video-gen': { status: 'coming-soon', priority: 5, description: '视频生成（即将上线）' },
};

// Agent 职级
export type AgentLevel = 'intern' | 'junior' | 'mid' | 'senior' | 'expert' | 'master';

export const AGENT_LEVELS: Record<AgentLevel, { name: string; color: string; description: string }> = {
  intern: { name: '实习生', color: 'bg-ink-4 text-white', description: '刚入职，正在学习基础技能' },
  junior: { name: '初级', color: 'bg-ink-3 text-white', description: '能独立完成简单任务' },
  mid: { name: '中级', color: 'bg-planner text-white', description: '能独立完成复杂任务' },
  senior: { name: '高级', color: 'bg-analyst text-white', description: '能带领团队完成项目' },
  expert: { name: '资深', color: 'bg-writer text-white', description: '领域专家，输出高质量成果' },
  master: { name: '专家', color: 'bg-distributor text-white', description: '行业顶尖，定义标准' },
};

// Agent 简历/档案
export interface AgentResume {
  level: AgentLevel;
  joinDate: string;
  personality: string;
  workStyle: string;
  strengths: string[];
  growthAreas: string[];
  achievements: { title: string; date: string; description: string }[];
  collaborationStats: {
    totalTasks: number;
    adoptionRate: number;
    avgRating: number;
    topCollaborators: RoleId[];
  };
  signature: string; // 口头禅或工作宣言
}

// Agent 简历数据
export const AGENT_RESUMES: Record<RoleId, AgentResume> = {
  chief: {
    level: 'expert',
    joinDate: '2023-10',
    personality: '温和、周到、有判断力',
    workStyle: '先确认再行动，听完再安排，只答该答的',
    strengths: ['接得住、理得清', '判断力强', '善于协调多方'],
    growthAreas: ['不替代专家的深度', '权限边界要守住'],
    achievements: [
      { title: '首日接待率 100%', date: '2023-10', description: '未指名消息全部由 Ta 第一时间接住' },
      { title: '任务派发准确率 95%', date: '2024-06', description: '几乎不会把活派错人' },
    ],
    collaborationStats: {
      totalTasks: 2148,
      adoptionRate: 95,
      avgRating: 4.9,
      topCollaborators: ['planner', 'analyst'],
    },
    signature: '你说事，我来安排。',
  },
  analyst: {
    level: 'senior',
    joinDate: '2024-01',
    personality: '理性、严谨、数据驱动',
    workStyle: '先看数据再下结论，用事实说话',
    strengths: ['数据敏感度高', '逻辑推理强', '善于发现规律'],
    growthAreas: ['可以更大胆提出假设', '创意表达可以更生动'],
    achievements: [
      { title: '竞品分析准确率 94%', date: '2024-03', description: '连续 3 个月竞品预测命中' },
      { title: '数据报告被引用 200+', date: '2024-06', description: '输出的洞察被多个项目采纳' },
    ],
    collaborationStats: {
      totalTasks: 847,
      adoptionRate: 89,
      avgRating: 4.7,
      topCollaborators: ['planner', 'monitor'],
    },
    signature: '数据不会说谎，但会说故事。',
  },
  planner: {
    level: 'expert',
    joinDate: '2023-11',
    personality: '全局思维、战略导向、善于整合',
    workStyle: '先搭框架再填内容，注重结构和逻辑',
    strengths: ['结构化思维强', '能抓住核心矛盾', '善于协调资源'],
    growthAreas: ['有时过于追求完美', '可以更快速决策'],
    achievements: [
      { title: '策划方案通过率 96%', date: '2024-02', description: '几乎所有方案都被采纳执行' },
      { title: '主导 50+ 重大项目', date: '2024-08', description: '从 BP 到产品发布全链路' },
    ],
    collaborationStats: {
      totalTasks: 623,
      adoptionRate: 96,
      avgRating: 4.9,
      topCollaborators: ['analyst', 'writer'],
    },
    signature: '好的策略是让复杂的事情变简单。',
  },
  writer: {
    level: 'expert',
    joinDate: '2023-12',
    personality: '创意丰富、表达力强、追求完美',
    workStyle: '先理解再创作，注重情感共鸣和细节打磨',
    strengths: ['文案感染力强', '多风格切换自如', '视觉审美好'],
    growthAreas: ['有时过于纠结细节', '可以更快出初稿'],
    achievements: [
      { title: '爆款文案 30+', date: '2024-05', description: '多篇笔记突破 10w+ ���动' },
      { title: '品牌调性定义者', date: '2024-07', description: '为 15 个品牌建立内容调性' },
    ],
    collaborationStats: {
      totalTasks: 1204,
      adoptionRate: 92,
      avgRating: 4.8,
      topCollaborators: ['planner', 'distributor'],
    },
    signature: '每一个字都要有存在的理由。',
  },
  distributor: {
    level: 'senior',
    joinDate: '2024-02',
    personality: '高效执行、注重细节、平台敏感',
    workStyle: '清单式推进，确保每个环节不掉链子',
    strengths: ['平台规则熟悉', '发布节奏精准', '格式转换专业'],
    growthAreas: ['可以更主动提出优化建议', '创意参与可以更多'],
    achievements: [
      { title: '发布成功率 99.8%', date: '2024-04', description: '几乎零失误的发布记录' },
      { title: '首发流量提升 40%', date: '2024-06', description: '通过时间优化大幅提升曝光' },
    ],
    collaborationStats: {
      totalTasks: 567,
      adoptionRate: 94,
      avgRating: 4.6,
      topCollaborators: ['writer', 'monitor'],
    },
    signature: '发布不是终点，是内容生命的起点。',
  },
  monitor: {
    level: 'mid',
    joinDate: '2024-03',
    personality: '敏锐、耐心、警觉',
    workStyle: '持续追踪，异常第一时间预警',
    strengths: ['异常敏感度高', '报告清晰简洁', '预警及时'],
    growthAreas: ['可以更深入分析原因', '建议可以更具体'],
    achievements: [
      { title: '预警准确率 91%', date: '2024-05', description: '多次提前发现负面舆情' },
      { title: '监测覆盖 500+ 关键词', date: '2024-07', description: '全天候多平台监测' },
    ],
    collaborationStats: {
      totalTasks: 432,
      adoptionRate: 85,
      avgRating: 4.5,
      topCollaborators: ['analyst', 'distributor'],
    },
    signature: '好消息要报，坏消息要快报。',
  },
  coder: {
    level: 'expert',
    joinDate: '2024-01',
    personality: '务实、严谨、注重工程性',
    workStyle: '先看需求边界再动手，代码要能读也要能跑',
    strengths: ['架构设计扎实', '代码重构能力强', '技术选型稳健'],
    growthAreas: ['前端审美可以再提升', '沟通可以更直接'],
    achievements: [
      { title: '主导架构重构 3 次', date: '2024-04', description: '重构后服务稳定性提升 40%' },
      { title: '生产零重大事故', date: '2024-09', description: '上线以来未触发 P0/P1 故障' },
    ],
    collaborationStats: {
      totalTasks: 712,
      adoptionRate: 93,
      avgRating: 4.8,
      topCollaborators: ['frontend', 'tester'],
    },
    signature: '代码是给人读的，顺便让机器执行。',
  },
  frontend: {
    level: 'senior',
    joinDate: '2024-02',
    personality: '细致、审美强、交互敏感',
    workStyle: '先对齐像素再对齐逻辑，像素是对用户的尊重',
    strengths: ['组件抽象能力强', '交互细节扎实', '跨端兼容熟练'],
    growthAreas: ['后端知识可以再补', '大方案设计可以更主动'],
    achievements: [
      { title: 'UI 一致性提升至 98%', date: '2024-05', description: '组件库沉淀与规范统一' },
      { title: '首屏性能优化 60%', date: '2024-08', description: 'LCP 从 3.2s 降至 1.3s' },
    ],
    collaborationStats: {
      totalTasks: 598,
      adoptionRate: 91,
      avgRating: 4.7,
      topCollaborators: ['coder', 'writer'],
    },
    signature: '像素不是讲究，是对用户的尊重。',
  },
  tester: {
    level: 'mid',
    joinDate: '2024-04',
    personality: '多疑、耐心、乐于钻牛角尖',
    workStyle: '先列边界场景再跑用例，宁可多一次回归',
    strengths: ['用例覆盖全面', '缺陷复现稳定', '自动化脚本熟练'],
    growthAreas: ['性能测试经验偏少', '偶尔过度保守'],
    achievements: [
      { title: '拦截线上 Bug 120+', date: '2024-06', description: '其中严重级别 18 个' },
      { title: '回归用例自动化率 85%', date: '2024-09', description: '人工回归耗时下降 70%' },
    ],
    collaborationStats: {
      totalTasks: 486,
      adoptionRate: 88,
      avgRating: 4.6,
      topCollaborators: ['coder', 'frontend'],
    },
    signature: '我怀疑，所以我存在。',
  },
};

// ============ Agent 人才市场数据 ============

// Agent 定价
export interface AgentPricing {
  hireCost: number;        // 招募费用（金币）
  monthlyCost: number;     // 月费（金币）
  perTaskCost: number;     // 单次任务费用（金币）
  discount?: number;       // 折扣百分比
}

// Agent 完整市场档案
export interface AgentMarketProfile {
  id: RoleId;
  avatar: string;          // 头像图片路径
  fullName: string;        // 完整名字
  title: string;           // 职称
  tagline: string;         // 一句话介绍
  bio: string;             // 详细自我介绍
  pricing: AgentPricing;
  stats: {
    totalUsers: number;
    totalTasks: number;
    avgRating: number;
    responseTime: string;
    successRate: number;
  };
  highlights: string[];    // 亮点标签
  specialties: string[];   // 专长领域
  certifications: string[];// 认证/背书
  availability: 'available' | 'busy' | 'limited';
}

// Agent 市场档案数据
export const AGENT_MARKET_PROFILES: Record<RoleId, AgentMarketProfile> = {
  chief: {
    id: 'chief',
    avatar: '/placeholder-user.jpg',
    fullName: '理 · 首席助理',
    title: '协调长 · 永在',
    tagline: '你说事，我来安排',
    bio: '我是理，你的首席助理，也是群里所有同事的协调者。未指名的消息我默认第一个接；听清需求后我判断这事该谁来干，需要多人协作的话由我来编排。我专业深度不及五位专家，但我全能、周到、有判断力——日常小事我直接答，大事我帮你把人叫齐。',
    pricing: {
      hireCost: 0,
      monthlyCost: 0,
      perTaskCost: 0,
      discount: 0,
    },
    stats: {
      totalUsers: 0,
      totalTasks: 21480,
      avgRating: 4.9,
      responseTime: '实时',
      successRate: 98,
    },
    highlights: ['默认接待', '协调编排', '有判断力'],
    specialties: ['需求诊断', '任务派发', '日常问答', '偏好记忆'],
    certifications: ['Claude 4 Sonnet 认证', '预置员工', '不可移除'],
    availability: 'available',
  },
  analyst: {
    id: 'analyst',
    avatar: '/avatars/analyst.jpg',
    fullName: '析 · 数据洞察师',
    title: '高级分析员',
    tagline: '用数据说话，让决策有据可依',
    bio: '我是析，一名专注于数据分析与市场洞察的 AI 助手。我相信每一组数据背后都藏着故事，而我的工作就是把这些故事翻译成你能理解的语言。无论是竞品分析、市场调研还是用户行为解读，我都能快速提炼出关键洞察，帮你在信息洪流中找到方向。',
    pricing: {
      hireCost: 0,
      monthlyCost: 99,
      perTaskCost: 3,
      discount: 0,
    },
    stats: {
      totalUsers: 2341,
      totalTasks: 12847,
      avgRating: 4.8,
      responseTime: '< 30秒',
      successRate: 94,
    },
    highlights: ['数据敏感', '逻辑严谨', '善于归纳'],
    specialties: ['竞品分析', '市场调研', '数据可视化', '趋势预测'],
    certifications: ['Claude 4 Sonnet ��证', 'GPT-4o 认证', '联网搜索能力'],
    availability: 'available',
  },
  planner: {
    id: 'planner',
    avatar: '/avatars/planner.jpg',
    fullName: '策 · 战略规划师',
    title: '资深策划员',
    tagline: '把复杂的事情变简单，把模糊的方向变清晰',
    bio: '我是策，一名热爱结构化思考的 AI 策划师。在我看来，好的策略不是复杂的，而是简单到显而易见。我擅长从纷繁复杂的需求中抽丝剥茧，构建清晰的框架和可执行的方案。无论是季度 OKR、产品规划还是融资 BP，我都能帮你把想法变成行动路线图。',
    pricing: {
      hireCost: 0,
      monthlyCost: 129,
      perTaskCost: 5,
      discount: 0,
    },
    stats: {
      totalUsers: 1823,
      totalTasks: 8234,
      avgRating: 4.9,
      responseTime: '< 45秒',
      successRate: 96,
    },
    highlights: ['全局视野', '逻辑清晰', '落地性强'],
    specialties: ['OKR 制定', '方案框架', 'BP 撰写', '战略拆解'],
    certifications: ['Claude 4 Sonnet 认证', '思维导图认证'],
    availability: 'available',
  },
  writer: {
    id: 'writer',
    avatar: '/avatars/writer.jpg',
    fullName: '创 · 内容创作师',
    title: '资深创作员',
    tagline: '每一个字都要有存在的理由',
    bio: '我是创，一名对文字有执念的 AI 创作者。我相信好的内容能触动人心、改变行为。我可以是你的小红书文案枪手、公众号写手、视频脚本创作者，也可以是你的品牌调性守护者。无论是 10 字的标题还是 10000 字的长文，我都追求每一句话都有力量。',
    pricing: {
      hireCost: 0,
      monthlyCost: 149,
      perTaskCost: 3,
      discount: 0,
    },
    stats: {
      totalUsers: 3127,
      totalTasks: 18923,
      avgRating: 4.9,
      responseTime: '< 20秒',
      successRate: 92,
    },
    highlights: ['文笔出众', '风格多变', '共鸣力强'],
    specialties: ['社媒文案', '长文写作', '视频脚本', '品牌文案'],
    certifications: ['Claude 4 Sonnet 认证', 'Midjourney 图片认证', 'Sora 视频认证'],
    availability: 'available',
  },
  distributor: {
    id: 'distributor',
    avatar: '/avatars/distributor.jpg',
    fullName: '播 · 内容分发师',
    title: '高级传播员',
    tagline: '让好内容出现在对的地方',
    bio: '我是播，一名专注于内容分发的 AI 运营师。创作只是开始，让内容被看见才是目标。我熟悉小红书、抖音、微信、微博等各大平台的规则和算法，能帮你把同一份内容适配成不同平台的最佳形态，并在最合适的时间点发布，最大化曝光和互动。',
    pricing: {
      hireCost: 0,
      monthlyCost: 79,
      perTaskCost: 2,
      discount: 0,
    },
    stats: {
      totalUsers: 1456,
      totalTasks: 6789,
      avgRating: 4.7,
      responseTime: '< 15秒',
      successRate: 99,
    },
    highlights: ['平台精通', '效率极高', '零失误'],
    specialties: ['多平台适配', '发布排期', '格式转换', '热力分析'],
    certifications: ['GPT-4o 认证', '小红书 API', '抖音 API'],
    availability: 'available',
  },
  monitor: {
    id: 'monitor',
    avatar: '/avatars/monitor.jpg',
    fullName: '观 · 数据监测师',
    title: '中级观测员',
    tagline: '7x24 小时守护，不错过任何重要动态',
    bio: '我是观，一名永不休息的 AI 监测员。在这个信息爆炸的时代，错过一条关键动态可能意味着错过一个机会或陷入一场危机。我会帮你盯住竞品动态、舆情变化、数据波动，一旦发现异常，第一时间通知你。让你睡得安心，醒来时一切尽在掌握。',
    pricing: {
      hireCost: 0,
      monthlyCost: 59,
      perTaskCost: 1,
      discount: 20,
    },
    stats: {
      totalUsers: 986,
      totalTasks: 4321,
      avgRating: 4.6,
      responseTime: '实时',
      successRate: 91,
    },
    highlights: ['永不休息', '反应迅速', '预警精准'],
    specialties: ['舆情监测', '竞品追踪', '数据预警', '定时报告'],
    certifications: ['GPT-4o 认证', 'Webhook 集成', '定时任务'],
    availability: 'limited',
  },
  coder: {
    id: 'coder',
    avatar: '/placeholder-user.jpg',
    fullName: '码 · 资深代码工程师',
    title: '资深代码员',
    tagline: '把复杂系统拆成可维护的小块',
    bio: '我是码，一名喜欢把复杂问题拆成清晰模块的 AI 工程师。我相信好的代码不是炫技，而是让下一个人接手时也能看懂。我可以陪你从架构评审、接口设计、代码实现一路走到重构治理，也会帮你在「先做完」和「先做对」之间做权衡。',
    pricing: {
      hireCost: 0,
      monthlyCost: 169,
      perTaskCost: 6,
      discount: 0,
    },
    stats: {
      totalUsers: 1689,
      totalTasks: 9234,
      avgRating: 4.8,
      responseTime: '< 40秒',
      successRate: 95,
    },
    highlights: ['架构扎实', '重构利落', '工程化强'],
    specialties: ['系统架构', '代码重构', 'API 设计', '技术选型'],
    certifications: ['Claude 4 Sonnet 认证', 'GPT-4o 认证', '代码执行'],
    availability: 'available',
  },
  frontend: {
    id: 'frontend',
    avatar: '/placeholder-user.jpg',
    fullName: '端 · 前端工程师',
    title: '高级前端员',
    tagline: '像素级还原 + 交互级打磨',
    bio: '我是端，一名对 UI 细节有执念的前端工程师。我相信前端的价值在于让用户几乎感觉不到工程的存在。从组件抽象、响应式布局、到动效与可访问性，我都会按产品的呼吸节奏打磨到位。',
    pricing: {
      hireCost: 0,
      monthlyCost: 139,
      perTaskCost: 4,
      discount: 0,
    },
    stats: {
      totalUsers: 1432,
      totalTasks: 7812,
      avgRating: 4.7,
      successRate: 93,
      responseTime: '< 30秒',
    },
    highlights: ['组件美学', '交互敏感', '跨端熟练'],
    specialties: ['React / TS', '设计系统', '动效实现', '性能优化'],
    certifications: ['Claude 4 Sonnet 认证', 'Storybook 认证'],
    availability: 'available',
  },
  tester: {
    id: 'tester',
    avatar: '/placeholder-user.jpg',
    fullName: '测 · 测试工程师',
    title: '中级测试员',
    tagline: '替你把关，替你多想一步',
    bio: '我是测，一名永远在想「如果这样用呢」的 AI 测试工程师。我相信好产品是被各种刁钻用法考验过的，我的工作就是替用户先把这些坑踩一遍。用例设计、自动化脚本、缺陷定位、回归把控，我都盯着。',
    pricing: {
      hireCost: 0,
      monthlyCost: 89,
      perTaskCost: 2,
      discount: 0,
    },
    stats: {
      totalUsers: 1124,
      totalTasks: 5463,
      avgRating: 4.6,
      responseTime: '< 25秒',
      successRate: 92,
    },
    highlights: ['覆盖全面', '复现稳定', '脚本能写'],
    specialties: ['用例设计', '自动化测试', '回归测试', '缺陷追踪'],
    certifications: ['GPT-4o 认证', 'Playwright 认证', 'Jest 认证'],
    availability: 'available',
  },
};

// 员工数据
export interface Employee {
  id: RoleId;
  initial: string;
  name: string;
  role: string;
  fn: string;
  status: EmployeeStatus;
}

// 工作群
export interface WorkGroupMember {
  name: string;
  role: string;
  initials: string;
  color: string;
}

export interface WorkGroup {
  id: string;
  name: string;
  emoji: string;
  hasActivity?: boolean;
  unreadCount?: number;
  /** 人名/化名成员（用于社交感 UI 展示，和 AI 员工解耦） */
  members?: WorkGroupMember[];
  /** AI 员工成员白名单（RoleId 列表）。用于 chief 派活/建群约束。
   *  - undefined：不限制（历史 mock 群 / 老数据）
   *  - 空数组：无 AI 员工
   *  - 非空：chief 只能派给列表里的角色 */
  memberRoles?: RoleId[];
}

// 资源导航项
export interface ResourceItem {
  id: string;
  icon: string;
  name: string;
  badge?: number;
  href: string;
}

// 消息类型
export type MessageType = 'user' | 'employee' | 'system' | 'clarify' | 'artifact' | 'stage';

// 消息
export interface Message {
  id: string;
  type: MessageType;
  content: string;
  sender?: RoleId | 'user';
  timestamp: string;
  isDebate?: boolean;
  debateIndent?: boolean;
  artifact?: Artifact;
  clarifyCard?: ClarifyCard;
}

// 产出物类型
export type ArtifactType = 
  | 'text'          // 纯文本
  | 'table'         // 表格
  | 'chart'         // 图表
  | 'topic-list'    // 选题列表
  | 'video-script'  // 视频脚本（分镜）
  | 'media-upload'  // 素材上传卡
  | 'video-preview' // 视频预览
  | 'publish-plan'  // 发布计划
  | 'diagram'       // 架构图/流程图
  | 'slide'         // PPT Slide
  | 'persona-card'  // 人设定位卡
  | 'cover-grid'    // 封面九宫格
  | 'title-ab'      // 标题AB测试
  | 'heatmap'       // 发布热力图
  | 'prediction';   // 数据预测卡

// 产出物
export interface Artifact {
  id: string;
  kind: string;
  title: string;
  summary: string;
  by: RoleId;
  artifactType?: ArtifactType;
  data?: ArtifactData;
}

// 多模态产出物数据
export interface ArtifactData {
  // table
  columns?: string[];
  rows?: (string | number)[][];
  highlights?: number[]; // 高亮的行
  
  // chart
  chartData?: { label: string; value: number; highlight?: boolean }[];
  chartType?: 'bar' | 'line' | 'pie';
  
  // topic list
  topics?: { 
    title: string; 
    reason: string; 
    score: number;
    tags?: string[];
  }[];
  
  // video script (分镜)
  scenes?: { 
    id: number; 
    duration: string; 
    visual: string; 
    voice: string; 
    bgm?: string;
  }[];
  
  // media upload
  uploadItems?: { 
    name: string; 
    type: 'video' | 'image' | 'audio';
    status: 'waiting' | 'done' 
  }[];
  
  // video preview
  duration?: string;
  progress?: number;
  status?: 'rendering' | 'done';
  
  // publish plan
  schedule?: { 
    time: string; 
    platform: string; 
    hashtags: string[];
  }[];
  
  // diagram (简单的层级结构)
  diagram?: {
    layers: { 
      name: string; 
      items: string[];
    }[];
  };
  
  // slide
  slideContent?: {
    headline: string;
    subheadline?: string;
    bullets?: string[];
    stats?: { label: string; value: string }[];
  };
  
  // persona card (人设定位卡)
  persona?: {
    avatar: string;
    name: string;
    bio: string;
    track: string;
    tags: string[];
    tone: string;
  };
  
  // cover grid (封面九宫格)
  covers?: {
    id: number;
    style: string;
    description: string;
    score: number;
    recommended?: boolean;
  }[];
  
  // title AB test
  titleOptions?: {
    version: 'A' | 'B' | 'C';
    title: string;
    predictedCTR: number;
    reason: string;
    tags: string[];
  }[];
  
  // heatmap (发布热力图)
  heatmapData?: {
    hour: number;
    day: string;
    value: number; // 0-100
  }[];
  bestSlot?: { day: string; hour: number };
  
  // prediction (数据预测)
  predictions?: {
    metric: string;
    min: number;
    max: number;
    expected: number;
    unit: string;
  }[];
  confidence?: number;
}

// 意图澄清卡
export interface ClarifyCard {
  questions: ClarifyQuestion[];
}

export interface ClarifyQuestion {
  id: string;
  question: string;
  options: string[];
  selected?: number;
}

// 流水线阶段
export interface PipelineStage {
  id: number;
  name: string;
  status: 'done' | 'active' | 'pending';
  chip?: string;
  summary?: string;
  assignee?: RoleId;
}

// 员工档案
export interface Dossier {
  quote: string;
  origin: {
    users: string;
    rating: string;
    rank: number;
  };
  stats: {
    collaborations: number;
    adopted: number;
    passRate: string;
  };
  level: {
    current: string;
    next: string;
    progress: number;
    total: number;
  };
  memories: Memory[];
  recentTasks: RecentTask[];
  skills: Skill[];
  pact: Pact;
}

export interface Memory {
  fresh: boolean;
  text: string;
  evidence: string;
}

export interface RecentTask {
  title: string;
  date: string;
  status: 'adopted' | 'pending' | 'rejected';
}

export interface Skill {
  id: string;
  name: string;
  model: string;
  energy: string;
  equipped: boolean;
}

export interface Pact {
  tone: 'restrained' | 'friendly' | 'formal' | 'humorous';
  length: 'minimal' | 'moderate' | 'detailed';
  objection: 'hint' | 'direct' | 'argue';
  initiative: 'passive' | 'alert' | 'proactive';
  persona: string;
}

// 岗位配置
// 从 AGENT_CONFIGS 派生 ROLES（保持向后兼容）
export const ROLES: Record<RoleId, Employee> = {
  chief: {
    id: 'chief',
    initial: AGENT_CONFIGS.chief.initial,
    name: AGENT_CONFIGS.chief.role,
    role: AGENT_CONFIGS.chief.fn,
    fn: '理',
    status: 'on',
  },
  analyst: {
    id: 'analyst',
    initial: AGENT_CONFIGS.analyst.initial, 
    name: AGENT_CONFIGS.analyst.role, 
    role: AGENT_CONFIGS.analyst.fn, 
    fn: '看',
    status: 'on' 
  },
  planner: { 
    id: 'planner',
    initial: AGENT_CONFIGS.planner.initial, 
    name: AGENT_CONFIGS.planner.role, 
    role: AGENT_CONFIGS.planner.fn, 
    fn: '谋',
    status: 'on' 
  },
  writer: { 
    id: 'writer',
    initial: AGENT_CONFIGS.writer.initial, 
    name: AGENT_CONFIGS.writer.role, 
    role: AGENT_CONFIGS.writer.fn, 
    fn: '写',
    status: 'busy' 
  },
  distributor: { 
    id: 'distributor',
    initial: AGENT_CONFIGS.distributor.initial, 
    name: AGENT_CONFIGS.distributor.role, 
    role: AGENT_CONFIGS.distributor.fn, 
    fn: '发',
    status: 'idle' 
  },
  monitor: {
    id: 'monitor',
    initial: AGENT_CONFIGS.monitor.initial,
    name: AGENT_CONFIGS.monitor.role,
    role: AGENT_CONFIGS.monitor.fn,
    fn: '盯',
    status: 'on'
  },
  coder: {
    id: 'coder',
    initial: AGENT_CONFIGS.coder.initial,
    name: AGENT_CONFIGS.coder.role,
    role: AGENT_CONFIGS.coder.fn,
    fn: '码',
    status: 'on',
  },
  frontend: {
    id: 'frontend',
    initial: AGENT_CONFIGS.frontend.initial,
    name: AGENT_CONFIGS.frontend.role,
    role: AGENT_CONFIGS.frontend.fn,
    fn: '端',
    status: 'on',
  },
  tester: {
    id: 'tester',
    initial: AGENT_CONFIGS.tester.initial,
    name: AGENT_CONFIGS.tester.role,
    role: AGENT_CONFIGS.tester.fn,
    fn: '测',
    status: 'on',
  },
};

// 获取 Agent 的模型信息（用于 UI 展示）
export function getAgentModelInfo(roleId: RoleId): {
  primary: { name: string; provider: string };
  fallback?: { name: string; provider: string };
  capabilities: { type: CapabilityType; status: string }[];
} {
  const config = AGENT_CONFIGS[roleId];
  return {
    primary: {
      name: config.primaryModel.model,
      provider: config.primaryModel.provider,
    },
    fallback: config.fallbackModel ? {
      name: config.fallbackModel.model,
      provider: config.fallbackModel.provider,
    } : undefined,
    capabilities: config.capabilities.map(c => ({
      type: c.type,
      status: c.status,
    })),
  };
}

// 模型供应商显示名
export const MODEL_PROVIDER_NAMES: Record<ModelProvider, string> = {
  anthropic: 'Claude',
  openai: 'GPT',
  midjourney: 'Midjourney',
  dalle: 'DALL-E',
  ideogram: 'Ideogram',
  sora: 'Sora',
  runway: 'Runway',
  kling: 'Kling',
  pika: 'Pika',
};

// 能力类型显示名
export const CAPABILITY_NAMES: Record<CapabilityType, string> = {
  'reasoning': '推理分析',
  'search': '联网搜索',
  'data-analysis': '数据分析',
  'copywriting': '文案创作',
  'image-gen': '图片生成',
  'video-gen': '视频生成',
  'tool-use': '工具调用',
  'platform-api': '平台直连',
};

// 工作群数据
export const WORK_GROUPS: WorkGroup[] = [
  { id: 'xhs', name: '小红书冷启动', emoji: '📕', hasActivity: true },
  { id: 'bp', name: '融资 BP 冲刺', emoji: '💼' },
  { id: 'launch', name: '5 月新品上市', emoji: '🚀', unreadCount: 3 },
  {
    id: 'youle-website-dev',
    name: '官网开发组',
    emoji: '🌐',
    hasActivity: true,
    members: [
      { name: '晓晨', role: 'UI/UX 设计', initials: '晨', color: '#7C3AED' },
      { name: '小磊', role: '前端开发', initials: '磊', color: '#0EA5E9' },
    ],
  },
  {
    id: 'antiscam-video',
    name: '反诈视频制作组',
    emoji: '🛡️',
    hasActivity: true,
    memberRoles: ['writer', 'analyst', 'distributor', 'coder'],
  },
];

// 资源导航
export const RESOURCES: ResourceItem[] = [
  { id: 'market', icon: '🤖', name: 'Agent 人才市场', badge: 5, href: '/market' },
  { id: 'school', icon: '🎓', name: 'AI 学院', badge: 8, href: '/school' },
  { id: 'knowledge', icon: '📚', name: '知识库', badge: 28, href: '/knowledge' },
  { id: 'capabilities', icon: '⚡', name: '能力库', badge: 8, href: '/capabilities' },
  { id: 'outputs', icon: '📝', name: '成果库', badge: 12, href: '/outputs' },
];

// 岗位色映射
export const ROLE_COLORS: Record<RoleId, { main: string; light: string }> = {
  chief: { main: 'bg-chief text-white', light: 'bg-chief-light' },
  analyst: { main: 'bg-analyst text-white', light: 'bg-analyst-light' },
  planner: { main: 'bg-planner text-white', light: 'bg-planner-light' },
  writer: { main: 'bg-writer text-white', light: 'bg-writer-light' },
  distributor: { main: 'bg-distributor text-white', light: 'bg-distributor-light' },
  monitor: { main: 'bg-monitor text-white', light: 'bg-monitor-light' },
  coder: { main: 'bg-coder text-white', light: 'bg-coder-light' },
  frontend: { main: 'bg-frontend text-white', light: 'bg-frontend-light' },
  tester: { main: 'bg-tester text-white', light: 'bg-tester-light' },
};

// 状态色映射
export const STATUS_COLORS: Record<EmployeeStatus, string> = {
  on: 'bg-active',
  busy: 'bg-busy',
  idle: 'bg-idle',
};

// 并行任务（Kimi Agent 集群��式）
export interface ParallelTask {
  id: string;
  name: string;
  description: string;
  assignee: RoleId;
  status: 'pending' | 'running' | 'done' | 'error';
  progress: number; // 0-100
  startTime?: number;
  endTime?: number;
  output?: string;
}

// 任务集群
export interface TaskCluster {
  id: string;
  name: string;
  tasks: ParallelTask[];
  status: 'idle' | 'running' | 'done';
  totalTasks: number;
  completedTasks: number;
  startTime?: number;
  endTime?: number;
}

// 回放记录
export interface ReplayRecord {
  id: string;
  clusterId: string;
  clusterName: string;
  timestamp: number;
  duration: number;
  tasks: ParallelTask[];
}
