import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { RoleId, Message, PipelineStage, WorkGroup, ClarifyQuestion, ParallelTask, TaskCluster, ReplayRecord } from './types';
import { WORK_GROUPS } from './types';

// AI 回复模拟数据
const AI_RESPONSES: Record<string, { roleId: RoleId; content: string; delay: number }[]> = {
  default: [
    { roleId: 'analyst', content: '收到！让我先分析一下您的需求...', delay: 800 },
    { roleId: 'analyst', content: '根据我的分析，这个任务涉及到市场调研和内容创作两个方面。我建议先从竞品分析开始。', delay: 2000 },
    { roleId: 'planner', content: '我来补充一下策略方向：我们可以采用差异化定位，突出品牌独特价值。', delay: 3500 },
  ],
  coffee: [
    { roleId: 'analyst', content: '精品咖啡市场目前增长迅速，主要竞争者包括三顿半、永璞等品牌。我来梳理一下他们的内容策略特点...', delay: 1000 },
    { roleId: 'planner', content: '基于析的分析，我建议我们走「咖啡师文化」路线，强调手冲工艺和产地故事。', delay: 2500 },
  ],
  marketing: [
    { roleId: 'analyst', content: '让我看看最近的营销趋势数据...', delay: 800 },
    { roleId: 'writer', content: '根据趋势，我可以准备几个不同风格的文案方向供您选择。', delay: 2000 },
  ],
};

// 澄清问题模板
const CLARIFY_TEMPLATES: ClarifyQuestion[] = [
  { id: 'audience', question: '目标受众是？', options: ['年轻白领', '学生群体', '家庭主妇', '商务人士'] },
  { id: 'tone', question: '内容调性偏好？', options: ['专业严谨', '轻松活泼', '文艺清新', '直接有力'] },
  { id: 'platform', question: '主要发布平台？', options: ['小红书', '抖音', '微信公众号', '微博'] },
  { id: 'length', question: '内容篇幅？', options: ['短平快', '中等长度', '深度长文', '你来定'] },
];

// 初始消息 - 展示完整的 Agent 协作流程，核心是 @ 互动
const getInitialMessages = (groupId: string): Message[] => {
  // ============ 小红书冷启动 · 美妆新号第一条爆款 ============
  if (groupId === 'xhs') {
    return [
      {
        id: 'xhs-1',
        type: 'system',
        content: '工作群已创建',
        timestamp: '09:00',
      },
      // 用户发起任务 - 极具吸引力的目标
      {
        id: 'xhs-2',
        type: 'user',
        content: '我想做一个美妆博主，从零开始，目标是第一条笔记就冲 10w+ 点赞。帮我全流程搞定！',
        sender: 'user',
        timestamp: '09:01',
      },
      // 析 意图识别 - 带专业判断
      {
        id: 'xhs-3',
        type: 'employee',
        content: '收到老板！10w+ 点赞确实是个有挑战的目标。让我先看看数据：近 30 天美妆类目新号破 10w 的概率是 2.3%，但有方法论可以大幅提升。在开始之前，我需要确认几个关键点：',
        sender: 'analyst',
        timestamp: '09:01',
      },
      // 意图澄清卡
      {
        id: 'xhs-4',
        type: 'clarify',
        content: '',
        sender: 'analyst',
        timestamp: '09:02',
        clarifyCard: {
          questions: [
            { id: 'niche', question: '细分赛道？', options: ['平价彩妆', '护肤测评', '仿妆教程', '成分党'], selected: 0 },
            { id: 'face', question: '露脸意愿？', options: ['愿意露脸', '只露手/局部', '纯图文不露', '都可以'], selected: 0 },
            { id: 'resource', question: '现有资源？', options: ['有产品可拍', '需要采购', '有合作品牌', '从零开始'], selected: 0 },
          ],
        },
      },
      // 析 确认后分发任务
      {
        id: 'xhs-5',
        type: 'employee',
        content: '好的，锁定方向：平价彩妆 + 愿意露脸 + 有产品可拍。这个组合很适合走「真实测评 + 反差对比」路线！@策划员 你来定人设框架，我同步扒爆款数据。',
        sender: 'analyst',
        timestamp: '09:03',
      },
      // 策 响应 - 人设思考
      {
        id: 'xhs-6',
        type: 'employee',
        content: '收到 @分析员！平价彩妆赛道最吃的是「信任感」。我先给老板搭一个人设框架：',
        sender: 'planner',
        timestamp: '09:04',
      },
      // 策 输出人设定位卡
      {
        id: 'xhs-7',
        type: 'artifact',
        content: '',
        sender: 'planner',
        timestamp: '09:04',
        artifact: {
          id: 'xhs-artifact-1',
          kind: '人设定位',
          title: '博主人设卡 · 平价彩妆测评',
          summary: '定位为「学生党的化妆包」，主打「真实不装 + 穷学生视角」',
          by: 'planner',
          artifactType: 'persona-card',
          data: {
            persona: {
              avatar: 'avatar-student',
              name: '待定（建议用真名/昵称）',
              bio: '大三学生 | 化妆 2 年踩坑无数 | 只推真正好用的平价',
              track: '平价彩妆测评',
              tags: ['学生党', '平价', '真实测评', '踩坑避雷'],
              tone: '闺蜜式吐槽、真诚不端着',
            },
          },
        },
      },
      // 析 完成数据扫描
      {
        id: 'xhs-8',
        type: 'employee',
        content: '爆款数据扫描完成！扫了近 7 天平价彩妆 TOP 200 笔记，发现 3 个规律：',
        sender: 'analyst',
        timestamp: '09:08',
      },
      {
        id: 'xhs-9',
        type: 'artifact',
        content: '',
        sender: 'analyst',
        timestamp: '09:08',
        artifact: {
          id: 'xhs-artifact-2',
          kind: '爆款规律',
          title: '平价彩妆 · 近 7 天爆款要素分析',
          summary: '扫描 TOP 200，提取 3 个高频爆款元素',
          by: 'analyst',
          artifactType: 'chart',
          data: {
            chartType: 'bar',
            chartData: [
              { label: '前后对比', value: 156, highlight: true },
              { label: '价格对比', value: 134 },
              { label: '踩雷吐槽', value: 98 },
              { label: '成分解析', value: 67 },
              { label: '仿妆教程', value: 52 },
            ],
          },
        },
      },
      // 析 给出关键洞察
      {
        id: 'xhs-10',
        type: 'employee',
        content: '关键洞察：「前后对比」出现在 78% 的爆款笔记中！而且数据显示，对比越「反差」、越「意外」，互动率越高。@策划员 这个方向你怎么看？',
        sender: 'analyst',
        timestamp: '09:09',
      },
      // 策 和 析 产生辩论
      {
        id: 'xhs-11',
        type: 'employee',
        content: '数据没问题，但我有担忧——纯对比图容易「同质化」，大家都在做。我建议加一层：「反差 + 故事」。比如「室友说我化完妆像换了个人」，这样有场景、有人物、有冲突。',
        sender: 'planner',
        timestamp: '09:10',
        isDebate: true,
      },
      {
        id: 'xhs-12',
        type: 'employee',
        content: '@策划员 同意！我再补一个数据点：带「室友/男友/妈妈」等第三人视角的笔记，评论区互动量高 2.4 倍。这种「社交反馈」角度确实更有戏剧张力。',
        sender: 'analyst',
        timestamp: '09:10',
        isDebate: true,
        debateIndent: true,
      },
      // 策 确认方向
      {
        id: 'xhs-13',
        type: 'employee',
        content: '那方向就定了：「前后对比 + 第三人反馈 + 平价震惊」。@老板 我们现在帮你想选题，你有什么产品可以用来拍第一条？',
        sender: 'planner',
        timestamp: '09:11',
      },
      // 用户参与
      {
        id: 'xhs-14',
        type: 'user',
        content: '我手上有一堆平价口红，还有几个 9.9 包邮的眼影盘',
        sender: 'user',
        timestamp: '09:12',
      },
      // 策 快速响应
      {
        id: 'xhs-15',
        type: 'employee',
        content: '9.9 眼影盘太完美了！这种「低价+高质感」的反差最能引爆！我来出 3 个选题方向，@分析员 你帮我预估一下各个方向的数据潜力：',
        sender: 'planner',
        timestamp: '09:13',
      },
      // 策 输出选题池
      {
        id: 'xhs-16',
        type: 'artifact',
        content: '',
        sender: 'planner',
        timestamp: '09:13',
        artifact: {
          id: 'xhs-artifact-3',
          kind: '选题方案',
          title: '3 个爆款选题方向',
          summary: '基于「反差对比 + 第三人反馈」策略，产出 3 个选题备选',
          by: 'planner',
          artifactType: 'topic-list',
          data: {
            topics: [
              {
                title: '9.9 眼影盘 vs 大牌眼影，室友居然猜错了',
                reason: '价格反差 + 第三人证言 + 悬念设置，命中 3 个爆款要素',
                score: 94,
                tags: ['对比', '反差', '室友'],
              },
              {
                title: '用一盘 9.9 眼影画全妆，出门被问是不是化妆师',
                reason: '低价高效果 + 第三人惊讶反馈',
                score: 88,
                tags: ['挑战', '低价', '反馈'],
              },
              {
                title: '学生党穷鬼眼影合集，总价不到一杯奶茶',
                reason: '学生党共鸣 + 超高性价比，但反差感稍弱',
                score: 76,
                tags: ['合集', '学生党', '省钱'],
              },
            ],
          },
        },
      },
      // 析 补充数据预测
      {
        id: 'xhs-17',
        type: 'employee',
        content: '@策划员 数据预估来了！方向 1 的爆款潜力最高，我跑了相似选题的历史数据：',
        sender: 'analyst',
        timestamp: '09:15',
      },
      {
        id: 'xhs-18',
        type: 'artifact',
        content: '',
        sender: 'analyst',
        timestamp: '09:15',
        artifact: {
          id: 'xhs-artifact-4',
          kind: '数据预测',
          title: '选题 1 数据潜力预测',
          summary: '基于历史相似选题数据建模预测',
          by: 'analyst',
          artifactType: 'prediction',
          data: {
            predictions: [
              { metric: '点赞', min: 8000, max: 150000, expected: 45000, unit: '' },
              { metric: '收藏', min: 3000, max: 80000, expected: 22000, unit: '' },
              { metric: '评论', min: 500, max: 8000, expected: 2800, unit: '' },
              { metric: '涨粉', min: 1000, max: 15000, expected: 5500, unit: '' },
            ],
            confidence: 78,
          },
        },
      },
      // 用户选择
      {
        id: 'xhs-19',
        type: 'user',
        content: '就选第一个！「9.9 眼影盘 vs 大牌眼影，室友居然猜错了」',
        sender: 'user',
        timestamp: '09:16',
      },
      // 策 @ 创 开始创作
      {
        id: 'xhs-20',
        type: 'employee',
        content: '选题确定！@创作员 开始写标题和正文。重点抓住「悬念」和「反转」两个点。',
        sender: 'planner',
        timestamp: '09:16',
      },
      // 创 响应
      {
        id: 'xhs-21',
        type: 'employee',
        content: '收到 @策划员！标题是成败关键，我先出 3 个版本做 AB 测试：',
        sender: 'writer',
        timestamp: '09:18',
      },
      // 创 输出标题 AB 测试
      {
        id: 'xhs-22',
        type: 'artifact',
        content: '',
        sender: 'writer',
        timestamp: '09:18',
        artifact: {
          id: 'xhs-artifact-5',
          kind: '标题测试',
          title: '标题 AB 测试 · 3 个版本对比',
          summary: '3 个标题变体 + 预测点击率',
          by: 'writer',
          artifactType: 'title-ab',
          data: {
            titleOptions: [
              {
                version: 'A',
                title: '9.9 眼影 vs 大牌眼影，让室友盲猜，结果她选了...',
                predictedCTR: 12.8,
                reason: '悬念最强，留白引发好奇',
                tags: ['悬念', '省略号', '盲猜'],
              },
              {
                version: 'B',
                title: '9块9的眼影能有多绝？室友以为我用的是大牌',
                predictedCTR: 10.2,
                reason: '直接点明价格反差，但悬念稍弱',
                tags: ['反差', '室友', '直接'],
              },
              {
                version: 'C',
                title: '穷学生眼影挑战｜室友震惊了',
                predictedCTR: 7.6,
                reason: '信息量不足，缺少价格锚点',
                tags: ['学生', '挑战'],
              },
            ],
          },
        },
      },
      // 策 参与讨论
      {
        id: 'xhs-23',
        type: 'employee',
        content: '版本 A 悬念最强！但我建议在结尾补一句 emoji，增加点击欲：「9.9 眼影 vs 大牌眼影，让室友盲猜，结果她选了...」后面加个「!?」会更有冲击力。',
        sender: 'planner',
        timestamp: '09:19',
        isDebate: true,
      },
      // 创 确认
      {
        id: 'xhs-24',
        type: 'employee',
        content: '采纳！标题定了。正文结构我按「钩子开头 → 过程悬念 → 结果反转 → CTA」来写。初稿在这里：',
        sender: 'writer',
        timestamp: '09:22',
      },
      {
        id: 'xhs-25',
        type: 'artifact',
        content: '',
        sender: 'writer',
        timestamp: '09:22',
        artifact: {
          id: 'xhs-artifact-6',
          kind: '正文初稿',
          title: '小红书正文 · 结构化初稿',
          summary: '【钩子】一盘眼影9块9，能好用吗？我决定整个大活...【过程】瞒着室友，左眼用9.9眼影，右眼用3XX大牌，让她盲猜【反转】她居然指着9块9说"这个更好看"【CTA】评论区猜猜是哪盘，猜对私你链接',
          by: 'writer',
        },
      },
      // 创 @ 播 准备视觉
      {
        id: 'xhs-26',
        type: 'employee',
        content: '正文 OK 了！@播报员 现在需要封面图。这条笔记封面是重中之重，对比图要做得够「吸睛」！',
        sender: 'writer',
        timestamp: '09:23',
      },
      // 播 响应
      {
        id: 'xhs-27',
        type: 'employee',
        content: '收到 @创作员！封面是点击率的命门。我出 9 个备选方案，老板你选一个最顺眼的：',
        sender: 'distributor',
        timestamp: '09:25',
      },
      // 播 输出封面九宫格
      {
        id: 'xhs-28',
        type: 'artifact',
        content: '',
        sender: 'distributor',
        timestamp: '09:25',
        artifact: {
          id: 'xhs-artifact-7',
          kind: '封面方案',
          title: '封面备选 · 九宫格',
          summary: '9 种视觉风格，点击选择你最喜欢的',
          by: 'distributor',
          artifactType: 'cover-grid',
          data: {
            covers: [
              { id: 1, style: '左右对比', description: '左半脸大牌 / 右半脸平价 · 大字标注价格', score: 95, recommended: true },
              { id: 2, style: '眼部特写', description: '两只眼睛不同眼影 · 干净背景', score: 88 },
              { id: 3, style: '产品并排', description: '两盘眼影 + 问号 + 挑战感', score: 82 },
              { id: 4, style: '表情包式', description: '本人震惊表情 + 文字梗', score: 79 },
              { id: 5, style: '过程截图', description: '分镜拼图 · 有故事感', score: 75 },
              { id: 6, style: '纯文字', description: '大字报 · 冲击力强但略土', score: 68 },
              { id: 7, style: '拼贴杂志', description: '剪贴画风格 · 小众但吸睛', score: 72 },
              { id: 8, style: '极简风', description: '白底 + 产品 · 高级但不够吸睛', score: 60 },
              { id: 9, style: '手写涂鸦', description: '手写文字 + 箭头 · 亲切但不专业', score: 65 },
            ],
          },
        },
      },
      // 用户选择
      {
        id: 'xhs-29',
        type: 'user',
        content: '第 1 个，左右对比那个',
        sender: 'user',
        timestamp: '09:27',
      },
      // 播 确认并 @ 观 安排发布
      {
        id: 'xhs-30',
        type: 'employee',
        content: '好的！封面确定。接下来安排发布时间。@分析员 你有没有美妆类目的发布热力图？',
        sender: 'distributor',
        timestamp: '09:27',
      },
      // 析 输出热力图
      {
        id: 'xhs-31',
        type: 'employee',
        content: '有的！美妆类目最佳发布时间数据如下：',
        sender: 'analyst',
        timestamp: '09:28',
      },
      {
        id: 'xhs-32',
        type: 'artifact',
        content: '',
        sender: 'analyst',
        timestamp: '09:28',
        artifact: {
          id: 'xhs-artifact-8',
          kind: '发布热力',
          title: '美妆类目 · 小红书发布时间热力图',
          summary: '深色 = 高流量时段 · 最佳发布窗口：周四晚 20:00',
          by: 'analyst',
          artifactType: 'heatmap',
          data: {
            heatmapData: [
              { hour: 7, day: '周一', value: 30 }, { hour: 12, day: '周一', value: 55 }, { hour: 20, day: '周一', value: 75 },
              { hour: 7, day: '周二', value: 28 }, { hour: 12, day: '周二', value: 52 }, { hour: 20, day: '周二', value: 72 },
              { hour: 7, day: '周三', value: 32 }, { hour: 12, day: '周三', value: 58 }, { hour: 20, day: '周三', value: 78 },
              { hour: 7, day: '周四', value: 35 }, { hour: 12, day: '周四', value: 62 }, { hour: 20, day: '周四', value: 95 },
              { hour: 7, day: '周五', value: 38 }, { hour: 12, day: '周五', value: 65 }, { hour: 20, day: '周五', value: 88 },
              { hour: 7, day: '周六', value: 25 }, { hour: 12, day: '周六', value: 48 }, { hour: 20, day: '周六', value: 68 },
              { hour: 7, day: '周日', value: 22 }, { hour: 12, day: '周日', value: 45 }, { hour: 20, day: '周日', value: 62 },
            ],
            bestSlot: { day: '周四', hour: 20 },
          },
        },
      },
      // 播 输出发布计划
      {
        id: 'xhs-33',
        type: 'employee',
        content: '结合热力图，建议本周四晚 8 点发布。完整发布 checklist 我整理好了：',
        sender: 'distributor',
        timestamp: '09:29',
      },
      {
        id: 'xhs-34',
        type: 'artifact',
        content: '',
        sender: 'distributor',
        timestamp: '09:29',
        artifact: {
          id: 'xhs-artifact-9',
          kind: '发布计划',
          title: '发布 Checklist',
          summary: '一条龙发布准备，确保万无一失',
          by: 'distributor',
          artifactType: 'publish-plan',
          data: {
            schedule: [
              {
                time: '周四 19:30',
                platform: '预热检查',
                hashtags: ['检查封面', '检查文案', '检查@', '准备评论区互动话术'],
              },
              {
                time: '周四 20:00',
                platform: '小红书发布',
                hashtags: ['#平价眼影', '#学生党彩妆', '#化妆对比', '#眼影测评'],
              },
              {
                time: '周四 20:30',
                platform: '评论区运营',
                hashtags: ['回复前10条评论', '引导互动', '置顶精选评论'],
              },
            ],
          },
        },
      },
      // 观 @ 后响应
      {
        id: 'xhs-35',
        type: 'employee',
        content: '@播报员 收到！我已设置 3 个监测节点：发布后 2h/24h/72h。关注的核心指标是「5 分钟完播率」和「互动率」，这两个是判断能否进入更大流量池的关键。有异常会第一时间汇报！',
        sender: 'monitor',
        timestamp: '09:30',
      },
      // 最终预测
      {
        id: 'xhs-36',
        type: 'employee',
        content: '最后给老板一个综合预测。基于选题、封面、发布时间的组合，这条笔记的爆款概率是：',
        sender: 'analyst',
        timestamp: '09:31',
      },
      {
        id: 'xhs-37',
        type: 'artifact',
        content: '',
        sender: 'analyst',
        timestamp: '09:31',
        artifact: {
          id: 'xhs-artifact-10',
          kind: '爆款预测',
          title: '第一条笔记 · 爆款概率评估',
          summary: '基于选题质量 + 封面得分 + 发布时间的综合预测模型',
          by: 'analyst',
          artifactType: 'prediction',
          data: {
            predictions: [
              { metric: '进入热门流量池', min: 0, max: 100, expected: 68, unit: '%' },
              { metric: '达成 1w+ 点赞', min: 0, max: 100, expected: 52, unit: '%' },
              { metric: '达成 10w+ 点赞', min: 0, max: 100, expected: 18, unit: '%' },
            ],
            confidence: 82,
          },
        },
      },
      // 系统总结
      {
        id: 'xhs-38',
        type: 'system',
        content: '第一条爆款筹备完成 · 人设/选题/标题/封面/发布计划全部就绪',
        timestamp: '09:32',
      },
      // 用户感叹
      {
        id: 'xhs-39',
        type: 'user',
        content: '太强了！感觉像有了一整个内容团队',
        sender: 'user',
        timestamp: '09:33',
      },
      // 策 回应
      {
        id: 'xhs-40',
        type: 'employee',
        content: '@老板 这就是「有了」的意义：@一下，你就有了整个团队。接下来你负责拍素材，我们负责后续所有环节。第一条只是开始，我们会持续迭代帮你涨粉！',
        sender: 'planner',
        timestamp: '09:33',
      },
    ];
  }
  
  // ============ 融资 BP 冲刺群 ============
  if (groupId === 'bp') {
    return [
      {
        id: 'bp-1',
        type: 'system',
        content: '工作群已创建',
        timestamp: '14:00',
      },
      {
        id: 'bp-2',
        type: 'user',
        content: '我们是AI员工协作平台"有了"，准备启动A轮融资，目标金额2000万。帮我准备一份完整的BP',
        sender: 'user',
        timestamp: '14:01',
      },
      {
        id: 'bp-3',
        type: 'employee',
        content: '收到老板！A轮融资是个大任务，我来拆解一下：需要市场分析、竞品对比、产品架构、财务预测、团队介绍等模块。我先确认几个关键信息：',
        sender: 'analyst',
        timestamp: '14:01',
      },
      {
        id: 'bp-4',
        type: 'clarify',
        content: '',
        sender: 'analyst',
        timestamp: '14:01',
        clarifyCard: {
          questions: [
            { id: 'stage', question: '融资阶段？', options: ['Pre-A', 'A轮', 'A+轮', 'B轮'], selected: 1 },
            { id: 'target', question: '主要目标投资人？', options: ['财务VC', '战略投资人', '产业资本', '全都要'], selected: 0 },
            { id: 'focus', question: '重点突出什么？', options: ['增长数据', '技术壁垒', '商业模式', '团队背景'], selected: 0 },
          ],
        },
      },
      {
        id: 'bp-5',
        type: 'employee',
        content: '明确了：A轮、主要面向财务VC、重点突出增长数据。@观测员 你先去扒一下近半年投资AI协作赛道的VC数据。@策划员 同步开始搭BP框架。',
        sender: 'analyst',
        timestamp: '14:02',
      },
      {
        id: 'bp-6',
        type: 'employee',
        content: '收到 @分析员！我马上整理目标VC清单。',
        sender: 'monitor',
        timestamp: '14:02',
      },
      {
        id: 'bp-7',
        type: 'employee',
        content: '收到 @分析员！我先列一个A轮BP标准框架，等你的数据出来再填充。',
        sender: 'planner',
        timestamp: '14:03',
      },
      {
        id: 'bp-8',
        type: 'employee',
        content: '投资人数据整理完成，@分析员 @策划员 这是重点目标清单：',
        sender: 'monitor',
        timestamp: '14:08',
      },
      {
        id: 'bp-9',
        type: 'artifact',
        content: '',
        sender: 'monitor',
        timestamp: '14:08',
        artifact: {
          id: 'bp-artifact-1',
          kind: '投资人清单',
          title: 'A轮重点目标VC（近6个月活跃）',
          summary: '扫描了87家VC，筛选出12家在AI协作/SaaS赛道活跃的目标',
          by: 'monitor',
          artifactType: 'table',
          data: {
            columns: ['机构名', '近期案例', '出手频次', '匹配度'],
            rows: [
              ['红杉中国', 'Monica.im / A轮', '月均2-3', '★★★★★'],
              ['高瓴创投', 'Manus / A+轮', '月均1-2', '★★★★★'],
              ['源码资本', 'Dify / 种子轮', '月均3-4', '★★★★☆'],
              ['蓝驰创投', 'MiniMax / B轮', '月均1', '★★★★☆'],
              ['真格基金', 'Monica / 种子轮', '月均4-5', '★★★☆☆'],
            ],
            highlights: [0, 1],
          },
        },
      },
      {
        id: 'bp-10',
        type: 'employee',
        content: '市场数据也出来了，AI协作市场增长非常快，这是核心数据：',
        sender: 'analyst',
        timestamp: '14:12',
      },
      {
        id: 'bp-11',
        type: 'artifact',
        content: '',
        sender: 'analyst',
        timestamp: '14:12',
        artifact: {
          id: 'bp-artifact-2',
          kind: '市场数据',
          title: '全球AI协作平台市场规模（亿美元）',
          summary: '三年CAGR 67%，2027年预计达到580亿美元。中国市场占比从12%提升至23%',
          by: 'analyst',
          artifactType: 'chart',
          data: {
            chartType: 'bar',
            chartData: [
              { label: '2023', value: 84 },
              { label: '2024', value: 156 },
              { label: '2025', value: 248, highlight: true },
              { label: '2026E', value: 392 },
              { label: '2027E', value: 580 },
            ],
          },
        },
      },
      {
        id: 'bp-12',
        type: 'employee',
        content: '再看一下竞品对比，我们的定位很清晰：',
        sender: 'analyst',
        timestamp: '14:14',
      },
      {
        id: 'bp-13',
        type: 'artifact',
        content: '',
        sender: 'analyst',
        timestamp: '14:14',
        artifact: {
          id: 'bp-artifact-3',
          kind: '竞品对比',
          title: '主流AI协作平台对比矩阵',
          summary: '在「多Agent协作 + 人格化 + 记忆系统」三个维度，有了 是唯一同时具备的产品',
          by: 'analyst',
          artifactType: 'table',
          data: {
            columns: ['产品', '多Agent协作', '人格化', '长期记忆', '定价'],
            rows: [
              ['有了', '✓ 5人团队', '✓ 深度', '✓ 可追溯', '免费+能量'],
              ['Monica', '✓ 单Agent', '—', '部分', '$10/月'],
              ['Manus', '✓ 任务Agent', '—', '会话级', '$39/月'],
              ['Dify', '工作流', '—', '—', '开源'],
              ['ChatGPT', '—', '部分', '会话级', '$20/月'],
            ],
            highlights: [0],
          },
        },
      },
      {
        id: 'bp-14',
        type: 'employee',
        content: '@策划员 数据都给你了，可以开始填BP框架了。我的判断是：把「多Agent协作+人格化」作为核心卖点，这是我们的护城河。',
        sender: 'analyst',
        timestamp: '14:15',
      },
      {
        id: 'bp-15',
        type: 'employee',
        content: '收到 @分析员！数据很漂亮。我不太同意把「人格化」放在第一位，投资人更关注的是「商业化路径」。建议调整重点顺序为：① 市场机会 → ② 产品差异化 → ③ 商业模式 → ④ 增长数据。',
        sender: 'planner',
        timestamp: '14:16',
        isDebate: true,
      },
      {
        id: 'bp-16',
        type: 'employee',
        content: '@策划员 有道理，商业化确实更打动VC。那差异化这部分我们怎么讲？纯技术讲容易干，我觉得还是要结合"人格化"这个故事点，让投资人有记忆点。',
        sender: 'analyst',
        timestamp: '14:16',
        isDebate: true,
        debateIndent: true,
      },
      {
        id: 'bp-17',
        type: 'employee',
        content: '同意！那就这样：技术差异化做到能立住，故事差异化做到能记住。BP大纲我整理好了：',
        sender: 'planner',
        timestamp: '14:17',
      },
      {
        id: 'bp-18',
        type: 'artifact',
        content: '',
        sender: 'planner',
        timestamp: '14:17',
        artifact: {
          id: 'bp-artifact-4',
          kind: 'BP大纲',
          title: 'A轮BP整体框架（14页）',
          summary: '按照「机会→产品→数据→壁垒→团队→融资」的逻辑推进，关键页重点设计',
          by: 'planner',
          artifactType: 'text',
        },
      },
      {
        id: 'bp-19',
        type: 'employee',
        content: '@创作员 大纲给你，开始写具体内容。先从封面和核心slide入手。',
        sender: 'planner',
        timestamp: '14:18',
      },
      {
        id: 'bp-20',
        type: 'employee',
        content: '收到 @策划员！封面slide我来：',
        sender: 'writer',
        timestamp: '14:18',
      },
      {
        id: 'bp-21',
        type: 'artifact',
        content: '',
        sender: 'writer',
        timestamp: '14:20',
        artifact: {
          id: 'bp-artifact-5',
          kind: '核心Slide',
          title: '封面 · 用一句话讲清楚我们',
          summary: '标题+副标题+三个关键数字，30秒内让投资人抓住重点',
          by: 'writer',
          artifactType: 'slide',
          data: {
            slideContent: {
              headline: '有了 · @一下，你就有了',
              subheadline: '第一个真正像"团队"一样协作的 AI 员工平台',
              stats: [
                { label: '付费用户', value: '1.2万+' },
                { label: 'MoM增长', value: '42%' },
                { label: '续费率', value: '89%' },
              ],
            },
          },
        },
      },
      {
        id: 'bp-22',
        type: 'employee',
        content: '还需要一个产品架构图来解释技术，@创作员 你能画一下吗？',
        sender: 'planner',
        timestamp: '14:21',
      },
      {
        id: 'bp-23',
        type: 'employee',
        content: '收到！产品架构图来了：',
        sender: 'writer',
        timestamp: '14:24',
      },
      {
        id: 'bp-24',
        type: 'artifact',
        content: '',
        sender: 'writer',
        timestamp: '14:24',
        artifact: {
          id: 'bp-artifact-6',
          kind: '产品架构',
          title: '有了 · 技术架构图',
          summary: '四层架构：交互层 → 协作编排层 → Agent能力层 ��� 基础模型层',
          by: 'writer',
          artifactType: 'diagram',
          data: {
            diagram: {
              layers: [
                { name: '交互层', items: ['工作群 UI', 'Agent 档案', '成果库'] },
                { name: '协作编排', items: ['@ 调度', '意图识别', '任务流水线', '记忆系统'] },
                { name: 'Agent 能力', items: ['析 · 分析', '策 · 策划', '创 · 创作', '播 · 传播', '观 · 监测'] },
                { name: '基础模型', items: ['LLM', 'Vision', 'Voice', 'Video'] },
              ],
            },
          },
        },
      },
      {
        id: 'bp-25',
        type: 'employee',
        content: '财务预测表也做好了，未来3年的关键指标预测：',
        sender: 'writer',
        timestamp: '14:28',
      },
      {
        id: 'bp-26',
        type: 'artifact',
        content: '',
        sender: 'writer',
        timestamp: '14:28',
        artifact: {
          id: 'bp-artifact-7',
          kind: '财务预测',
          title: '3年财务预测（万元）',
          summary: '预计2027年GMV突破5亿，实现经营性盈利',
          by: 'writer',
          artifactType: 'table',
          data: {
            columns: ['指标', '2025', '2026E', '2027E'],
            rows: [
              ['付费用户数', '1.2万', '8.5万', '32万'],
              ['GMV (万元)', '480', '6800', '51200'],
              ['毛利率', '62%', '71%', '78%'],
              ['净利润 (万元)', '-1200', '-800', '4200'],
            ],
            highlights: [1, 3],
          },
        },
      },
      {
        id: 'bp-27',
        type: 'employee',
        content: '@创作员 内容整体不错，但财务预测这块我建议保守一些，2027年GMV直接跳到5亿有点激进。改成3亿会更可信。',
        sender: 'planner',
        timestamp: '14:29',
        isDebate: true,
      },
      {
        id: 'bp-28',
        type: 'employee',
        content: '@策划员 同意，投资人会做DD的，数字要能扛得住。已调整。@观测员 最后请你做一下投资人Q&A预测，帮老板准备应对。',
        sender: 'writer',
        timestamp: '14:30',
      },
      {
        id: 'bp-29',
        type: 'artifact',
        content: '',
        sender: 'monitor',
        timestamp: '14:35',
        artifact: {
          id: 'bp-artifact-8',
          kind: '投资人问答',
          title: '预测VC可能会问的高频问题（TOP 8）',
          summary: '根据目标VC近期投资案例和访谈记录，预测8个高概率会被问到的问题及建议回答方向',
          by: 'monitor',
          artifactType: 'table',
          data: {
            columns: ['问题', '频次', '应对要点'],
            rows: [
              ['为什么是你们做？', '95%', '团队背景 + 独特认知'],
              ['壁垒在哪里？', '88%', '协作编排层技术细节'],
              ['商业化节奏？', '82%', '付费转化数据 + 客单价'],
              ['增长成本？', '71%', 'CAC / LTV 比例'],
              ['对标哪家？', '65%', 'Notion AI + Slack + Character.ai'],
              ['团队配置？', '58%', '技术背景 + 行业经验'],
            ],
            highlights: [0, 1],
          },
        },
      },
      {
        id: 'bp-30',
        type: 'employee',
        content: '问答预测已整理完毕。@分析员 这些问题里，"壁垒在哪里"和"商业化节奏"是红杉和高瓴最常问的，建议准备更详细的回答。',
        sender: 'monitor',
        timestamp: '14:36',
      },
      {
        id: 'bp-31',
        type: 'employee',
        content: '@观测员 收到！我补充一下壁垒部分的论据。@创作员 你同步把壁垒那页slide加厚一点，用技术架构图+数据支撑。',
        sender: 'analyst',
        timestamp: '14:37',
      },
      {
        id: 'bp-32',
        type: 'employee',
        content: '收到 @分析员！我重新设计壁垒那页：',
        sender: 'writer',
        timestamp: '14:40',
      },
      {
        id: 'bp-33',
        type: 'artifact',
        content: '',
        sender: 'writer',
        timestamp: '14:40',
        artifact: {
          id: 'bp-artifact-9',
          kind: '核心Slide',
          title: '壁垒页 · 为什么是我们',
          summary: '三层壁垒：技术壁垒（协作编排）+ 数据壁垒（记忆系统）+ 网络壁垒（Agent生态）',
          by: 'writer',
          artifactType: 'slide',
          data: {
            slideContent: {
              headline: '三层护城河',
              subheadline: '不是做一个AI，是做一个会协作的团队',
              bullets: [
                '技术壁垒：多Agent协作编排引擎，2年研发，8项专利申请中',
                '数据壁垒：用户偏好记忆系统，越用越懂你，迁移成本高',
                '网络壁垒：开放Agent市场，第三方开发者入驻形成生态',
              ],
            },
          },
        },
      },
      {
        id: 'bp-34',
        type: 'employee',
        content: '壁垒页不错！但我觉得"8项专利申请中"这个说法有点虚，投资人会追问进度。@观测员 能不能查一下专利申请的真实状态？',
        sender: 'planner',
        timestamp: '14:41',
        isDebate: true,
      },
      {
        id: 'bp-35',
        type: 'employee',
        content: '@策划员 好问题！我查了一下，目前3项已进入实审，5项在初审。建议改成"3项实审+5项初审"更准确。',
        sender: 'monitor',
        timestamp: '14:42',
        isDebate: true,
        debateIndent: true,
      },
      {
        id: 'bp-36',
        type: 'employee',
        content: '已修改。@播报员 BP内容基本定稿了，你来准备一下发送版本。需要PDF和可编辑的PPT两个版本。',
        sender: 'writer',
        timestamp: '14:43',
      },
      {
        id: 'bp-37',
        type: 'employee',
        content: '收到 @创作员！我来打包：PDF用于初次投递，PPT留给路演现场。@老板 你确认一下最终版本，我就准备分发了。',
        sender: 'distributor',
        timestamp: '14:44',
      },
      {
        id: 'bp-38',
        type: 'user',
        content: '内容OK，可以发了。先发给红杉和高瓴的负责人。',
        sender: 'user',
        timestamp: '14:45',
      },
      {
        id: 'bp-39',
        type: 'employee',
        content: '收到老板！@观测员 你有这两家的对接人信息吗？',
        sender: 'distributor',
        timestamp: '14:45',
      },
      {
        id: 'bp-40',
        type: 'employee',
        content: '@播报员 有的！红杉是郑xx（投资副总裁），负责AI赛道；高瓴是李xx（投资总监），之前投过Manus。我把联系方式私发给老板。',
        sender: 'monitor',
        timestamp: '14:46',
      },
      {
        id: 'bp-41',
        type: 'artifact',
        content: '',
        sender: 'distributor',
        timestamp: '14:48',
        artifact: {
          id: 'bp-artifact-10',
          kind: '发送计划',
          title: 'BP 投递时间表',
          summary: '按优先级分批投递，首批2家，二批5家，三批5家',
          by: 'distributor',
          artifactType: 'publish-plan',
          data: {
            schedule: [
              {
                time: '今日 15:00',
                platform: '首批投递',
                hashtags: ['红杉中国', '高瓴创投'],
              },
              {
                time: '明日 10:00',
                platform: '二批投递',
                hashtags: ['源码资本', '蓝驰创投', '真格基金', '经纬中国', 'GGV'],
              },
              {
                time: '后日 10:00',
                platform: '三批投递',
                hashtags: ['IDG', '北极光', '顺为资本', '晨兴资本', '启明创投'],
              },
            ],
          },
        },
      },
      {
        id: 'bp-42',
        type: 'employee',
        content: '投递计划已就绪。@观测员 发出后请追踪反馈：已读率、回复率、约见率。有任何动态第一时间汇报。',
        sender: 'distributor',
        timestamp: '14:49',
      },
      {
        id: 'bp-43',
        type: 'employee',
        content: '收到 @播报员！监测任务已设置。我会在48小时、7天两个节点汇报进展。如果有投资人回复约见，会立刻通知老板。',
        sender: 'monitor',
        timestamp: '14:50',
      },
      {
        id: 'bp-44',
        type: 'employee',
        content: '@老板 BP项目总结：从启动到定稿用时50分钟，产出14页BP+投资人Q&A+投递计划。接下来就是等反馈了，我们随时待命准备路演材料。',
        sender: 'planner',
        timestamp: '14:51',
      },
      {
        id: 'bp-45',
        type: 'user',
        content: '太快了！这效率相当于有了一个3人投融资团队',
        sender: 'user',
        timestamp: '14:52',
      },
      {
        id: 'bp-46',
        type: 'employee',
        content: '@老板 这就是「有了」的价值：@一下，你就有了整个团队。融资顺利！',
        sender: 'analyst',
        timestamp: '14:52',
      },
      {
        id: 'bp-47',
        type: 'system',
        content: 'A轮融资筹备完成 · 14页BP + 投资人问答 + 投递计划全部就绪',
        timestamp: '14:53',
      },
    ];
  }
  
  // ============ 5月新品上市群 ============
  if (groupId === 'launch') {
    return [
      {
        id: 'la-1',
        type: 'system',
        content: '工作群已创建',
        timestamp: '09:30',
      },
      {
        id: 'la-2',
        type: 'user',
        content: '我们5月要上市一款补水面膜"水光源"，客单价59元。帮我做一个抖音爆款短视频，从选题到成片都要',
        sender: 'user',
        timestamp: '09:31',
      },
      {
        id: 'la-3',
        type: 'employee',
        content: '收到老板！抖音短视频是系统性工程：选题 → 脚本 → 素材 → 剪辑 → 发布，我来牵头。先确认几个关键信息：',
        sender: 'analyst',
        timestamp: '09:31',
      },
      {
        id: 'la-4',
        type: 'clarify',
        content: '',
        sender: 'analyst',
        timestamp: '09:31',
        clarifyCard: {
          questions: [
            { id: 'target', question: '目标人群？', options: ['18-25岁学生', '25-35岁白领', '35+轻熟龄', '泛人群'], selected: 1 },
            { id: 'pain', question: '核心卖点？', options: ['深层补水', '24小时保湿', '敏感肌可用', '成分党'], selected: 0 },
            { id: 'style', question: '视频风格？', options: ['测评种草', '剧情短片', '成分科普', '达人口播'], selected: 1 },
          ],
        },
      },
      {
        id: 'la-5',
        type: 'employee',
        content: '明确了：25-35岁白领、主打深层补水、走剧情短片路线。这个组合很有戏，@策划员 你先想选题方向，我去扒一下抖音面膜爆款数据。',
        sender: 'analyst',
        timestamp: '09:32',
      },
      {
        id: 'la-6',
        type: 'employee',
        content: '收到 @分析员！我同步列选题，等你的数据验证。',
        sender: 'planner',
        timestamp: '09:32',
      },
      {
        id: 'la-7',
        type: 'employee',
        content: '数据出来了，@策划员 你看看这个：',
        sender: 'analyst',
        timestamp: '09:36',
      },
      {
        id: 'la-8',
        type: 'artifact',
        content: '',
        sender: 'analyst',
        timestamp: '09:36',
        artifact: {
          id: 'la-artifact-1',
          kind: '爆款分析',
          title: '抖音面膜类目 · 近30天爆款要素',
          summary: '扫描了近30天面膜类目播放量TOP 500的视频，总结出3个高频要素',
          by: 'analyst',
          artifactType: 'chart',
          data: {
            chartType: 'bar',
            chartData: [
              { label: '反差剧情', value: 89, highlight: true },
              { label: '测评对比', value: 72 },
              { label: '职场场景', value: 68 },
              { label: '成分科普', value: 54 },
              { label: '达人口播', value: 42 },
            ],
          },
        },
      },
      {
        id: 'la-9',
        type: 'employee',
        content: '基于老板的需求和析的数据，我想了3个选题方向，@老板 你挑一个：',
        sender: 'planner',
        timestamp: '09:40',
      },
      {
        id: 'la-10',
        type: 'artifact',
        content: '',
        sender: 'planner',
        timestamp: '09:40',
        artifact: {
          id: 'la-artifact-2',
          kind: '选题方案',
          title: '3个爆款选题方向',
          summary: '基于反差剧情+职场场景两大爆款要素，产出3个差异化选题',
          by: 'planner',
          artifactType: 'topic-list',
          data: {
            topics: [
              {
                title: '加班到凌晨2点的我，靠这片面膜续命',
                reason: '职场共鸣 + 反差惊喜，命中25-35白领痛点',
                score: 92,
                tags: ['职场', '反差', '深夜'],
              },
              {
                title: '相亲前1小时急救，面膜敷出神仙皮',
                reason: '剧情冲突强，前5秒留人率预估85%+',
                score: 88,
                tags: ['剧情', '急救', '相亲'],
              },
              {
                title: '去见前男友的婚礼，我要美到让他后悔',
                reason: '情绪钩子深，但争议性较大',
                score: 76,
                tags: ['剧情', '情绪', '争议'],
              },
            ],
          },
        },
      },
      {
        id: 'la-11',
        type: 'user',
        content: '选第1个，职场加班场景更贴合品牌调性',
        sender: 'user',
        timestamp: '09:42',
      },
      {
        id: 'la-12',
        type: 'employee',
        content: '明白！@创作员 选题定了，就是「加班到凌晨2点的我，靠这片面膜续命」。你来写脚本。',
        sender: 'planner',
        timestamp: '09:42',
      },
      {
        id: 'la-13',
        type: 'employee',
        content: '收到 @策划员！我开始写分镜脚本，预计3分钟。',
        sender: 'writer',
        timestamp: '09:43',
      },
      {
        id: 'la-14',
        type: 'artifact',
        content: '',
        sender: 'writer',
        timestamp: '09:47',
        artifact: {
          id: 'la-artifact-3',
          kind: '视频脚本',
          title: '加班续命篇 · 分镜脚本 v1（总时长45秒）',
          summary: '6个分镜，前3秒用电脑屏幕特写抓住注意力，中段反差，结尾留悬念',
          by: 'writer',
          artifactType: 'video-script',
          data: {
            scenes: [
              {
                id: 1,
                duration: '0-3s',
                visual: '电脑屏幕特写，时间显示02:17，打字声急促',
                voice: '（无旁白）键盘声 + 叹气声',
                bgm: '紧张节奏',
              },
              {
                id: 2,
                duration: '3-8s',
                visual: '女主崩溃瘫在椅子上，镜头拉远显示满桌咖啡杯',
                voice: '又是一个凌晨两点…',
                bgm: '情绪铺垫',
              },
              {
                id: 3,
                duration: '8-18s',
                visual: '女主走到梳妆镜前，发现暗沉疲惫的脸',
                voice: '这张脸，明天怎么见甲方？',
                bgm: '转折音效',
              },
              {
                id: 4,
                duration: '18-28s',
                visual: '拿出水光源面膜敷上，特写成分渗透效果',
                voice: '我的深夜续命神器 · 水光源补水面膜',
                bgm: '清新音乐',
              },
              {
                id: 5,
                duration: '28-40s',
                visual: '第二天早晨，女主精神满满走进会议室',
                voice: '一夜好皮，硬气开会',
                bgm: '高昂节奏',
              },
              {
                id: 6,
                duration: '40-45s',
                visual: '产品大图 + 购物车闪动',
                voice: '点击下方小黄车，59元抢购',
                bgm: '转化CTA',
              },
            ],
          },
        },
      },
      {
        id: 'la-15',
        type: 'employee',
        content: '@创作员 脚本结构很好！但第2个分镜"崩溃瘫在椅子上"可能不够有共鸣，建议改成"揉眼睛+瞄了一眼朋友圈"，这种小动作更真实。',
        sender: 'planner',
        timestamp: '09:48',
        isDebate: true,
      },
      {
        id: 'la-16',
        type: 'employee',
        content: '@策划员 好建议！已修改。另外我把第4个分镜的旁白从"深夜续命神器"改成了"打工人的最后一道防线"，更有记忆点。',
        sender: 'writer',
        timestamp: '09:49',
        isDebate: true,
        debateIndent: true,
      },
      {
        id: 'la-17',
        type: 'employee',
        content: '@老板 脚本定稿了！请您检查后上传素材，我需要的素材清单如下：',
        sender: 'writer',
        timestamp: '09:50',
      },
      {
        id: 'la-18',
        type: 'artifact',
        content: '',
        sender: 'writer',
        timestamp: '09:50',
        artifact: {
          id: 'la-artifact-4',
          kind: '素材清单',
          title: '��上传拍摄素材（6组）',
          summary: '按照分镜需要的素材清单，可直接拖拽上传',
          by: 'writer',
          artifactType: 'media-upload',
          data: {
            uploadItems: [
              { name: '电脑屏幕特写（夜晚）', type: 'video', status: 'done' },
              { name: '办公桌+咖啡杯空镜', type: 'video', status: 'done' },
              { name: '女主梳妆镜前特写', type: 'video', status: 'done' },
              { name: '敷面膜过程（30s+）', type: 'video', status: 'done' },
              { name: '会议室场景（早晨）', type: 'video', status: 'waiting' },
              { name: '产品大图+包装', type: 'image', status: 'done' },
            ],
          },
        },
      },
      {
        id: 'la-19',
        type: 'user',
        content: '[已上传5个素材，会议室场景还在补拍中]',
        sender: 'user',
        timestamp: '10:15',
      },
      {
        id: 'la-20',
        type: 'employee',
        content: '收到5个素材，缺会议室的我先用AI生成一个过渡镜头，等老板补拍后替换。开始剪辑！',
        sender: 'writer',
        timestamp: '10:16',
      },
      {
        id: 'la-21',
        type: 'artifact',
        content: '',
        sender: 'writer',
        timestamp: '10:22',
        artifact: {
          id: 'la-artifact-5',
          kind: '成片预览',
          title: '水光源面膜 · 加班续命篇 v1',
          summary: '45秒成片，已完成调色、配乐、字幕、转场',
          by: 'writer',
          artifactType: 'video-preview',
          data: {
            duration: '00:45',
            status: 'done',
            progress: 100,
          },
        },
      },
      {
        id: 'la-22',
        type: 'employee',
        content: '@创作员 成片整体很棒！但我觉得第5秒的转场有点硬，建议加一个"淡黑过渡"会更丝滑。还有结尾的小黄车CTA停留时间太短，延长到2秒。',
        sender: 'planner',
        timestamp: '10:23',
        isDebate: true,
      },
      {
        id: 'la-23',
        type: 'employee',
        content: '收到 @策划员！已调整转场和CTA时长。成片定稿，@播报员 可以准备发布了。',
        sender: 'writer',
        timestamp: '10:26',
      },
      {
        id: 'la-24',
        type: 'employee',
        content: '收到 @创作员！我已经准备好发布计划，覆盖抖音+小红书+视频号三平台：',
        sender: 'distributor',
        timestamp: '10:27',
      },
      {
        id: 'la-25',
        type: 'artifact',
        content: '',
        sender: 'distributor',
        timestamp: '10:27',
        artifact: {
          id: 'la-artifact-6',
          kind: '发布计划',
          title: '多平台发布时间表',
          summary: '抖音主推，小红书+视频号同步分发，错峰发布最大化曝光',
          by: 'distributor',
          artifactType: 'publish-plan',
          data: {
            schedule: [
              {
                time: '今晚 20:30',
                platform: '抖音',
                hashtags: ['#打工人续命', '#深夜护肤', '#水光源面膜'],
              },
              {
                time: '今晚 21:00',
                platform: '小红书',
                hashtags: ['#加班护肤', '#补水面膜推荐', '#职场女性'],
              },
              {
                time: '明早 08:00',
                platform: '视频号',
                hashtags: ['#职场护肤', '#精致生活'],
              },
            ],
          },
        },
      },
      {
        id: 'la-26',
        type: 'employee',
        content: '@观测员 发布后你接手监测，关注前2小时互动率和转化数据。',
        sender: 'distributor',
        timestamp: '10:28',
      },
      {
        id: 'la-27',
        type: 'employee',
        content: '收到 @播报员！已设置3个监测节点：发布后2h/24h/72h，异常会实时通知老板。',
        sender: 'monitor',
        timestamp: '10:28',
      },
      {
        id: 'la-28',
        type: 'employee',
        content: '@分析员 发布前我还想确认一下：抖音现在对护肤品类的流量倾斜怎么样？会不会被限流？',
        sender: 'distributor',
        timestamp: '10:29',
      },
      {
        id: 'la-29',
        type: 'employee',
        content: '@播报员 好问题！我查了一下近期政策：面膜类目没有明显限流，但要注意两点：①不能出现"医美""换肤"等敏感词；②成分宣称要有备案支撑。我们脚本里没有这些问题，可以放心发。',
        sender: 'analyst',
        timestamp: '10:30',
      },
      {
        id: 'la-30',
        type: 'employee',
        content: '收到 @分析员！那我再检查一下字幕和文案有没有敏感词。@创作员 你那边有没有用"美白""淡斑"这类词？',
        sender: 'distributor',
        timestamp: '10:31',
      },
      {
        id: 'la-31',
        type: 'employee',
        content: '@播报员 没有！我特意避开了。用的是"补水""透亮""好气色"这类安全词。字幕我再过一遍确认。',
        sender: 'writer',
        timestamp: '10:31',
      },
      {
        id: 'la-32',
        type: 'employee',
        content: '字幕检查完毕，没有敏感词。@播报员 可以发了！',
        sender: 'writer',
        timestamp: '10:33',
      },
      {
        id: 'la-33',
        type: 'employee',
        content: '收到！@老板 一切准备就绪。今晚20:30准时发布抖音，21:00发小红书。你要不要提前看一下最终版？',
        sender: 'distributor',
        timestamp: '10:34',
      },
      {
        id: 'la-34',
        type: 'user',
        content: '看过了，可以发。另外，能不能同步准备2-3条备用视频？万一这条数据不好，可以快速迭代',
        sender: 'user',
        timestamp: '10:36',
      },
      {
        id: 'la-35',
        type: 'employee',
        content: '@老板 备用方案是对的！@策划员 你来牵头，基于同一个选题做2个变体：一个换女主角年龄（改成应届生），一个换场景（居家熬夜改成出差酒店）。',
        sender: 'analyst',
        timestamp: '10:37',
      },
      {
        id: 'la-36',
        type: 'employee',
        content: '收到 @分析员！两个变体方案我来列：',
        sender: 'planner',
        timestamp: '10:38',
      },
      {
        id: 'la-37',
        type: 'artifact',
        content: '',
        sender: 'planner',
        timestamp: '10:38',
        artifact: {
          id: 'la-artifact-7',
          kind: '备用方案',
          title: '视频变体计划（A/B/C 测试）',
          summary: '主版本+2个变体，覆盖不同人群和场景',
          by: 'planner',
          artifactType: 'table',
          data: {
            columns: ['版本', '主角', '场景', '核心钩子', '排期'],
            rows: [
              ['A（主推）', '职场女性 28岁', '加班深夜', '凌晨2点续命', '今晚 20:30'],
              ['B（备用1）', '应届生 22岁', '求职季', '面试前一晚', '明晚 20:30'],
              ['C（备用2）', '出差党 30岁', '酒店房间', '异地出差救急', '后天 20:30'],
            ],
            highlights: [0],
          },
        },
      },
      {
        id: 'la-38',
        type: 'employee',
        content: '@创作员 你先专注A版本发布，B和C的脚本我来写初稿，写完发给你润色。',
        sender: 'planner',
        timestamp: '10:39',
      },
      {
        id: 'la-39',
        type: 'employee',
        content: '收到 @策划员！分工明确。@观测员 今晚A版本发布后，重点关注「完播率」和「点赞率」。如果2小时内完播率低于30%，我们就需要调整B版本的开头节奏。',
        sender: 'writer',
        timestamp: '10:40',
      },
      {
        id: 'la-40',
        type: 'employee',
        content: '收到 @创作员！我设置了智能预警：完播率<30%或点赞率<3%时自动通知。另外我会同步监测竞品「薇诺娜」和「润百颜」今晚的发布动态，有对标数据可以参考。',
        sender: 'monitor',
        timestamp: '10:41',
      },
      {
        id: 'la-41',
        type: 'employee',
        content: '@老板 总结一下当前进度：主视频已就绪，今晚发布；2个备用视频明天中午前完成；监测机制已部署。整个项目从启动到发布准备用时70分钟。',
        sender: 'analyst',
        timestamp: '10:42',
      },
      {
        id: 'la-42',
        type: 'user',
        content: '效率惊人！相当于有了一个5人视频团队',
        sender: 'user',
        timestamp: '10:43',
      },
      {
        id: 'la-43',
        type: 'employee',
        content: '@老板 这就是「有了」：从选题到发布，@一下就全搞定。期待今晚爆！',
        sender: 'planner',
        timestamp: '10:43',
      },
      {
        id: 'la-44',
        type: 'system',
        content: '完整创作闭环已完成 · 主视频+2备用+监测机制全部就绪',
        timestamp: '10:44',
      },
    ];
  }

  // ============ 反诈视频制作组 ============
  if (groupId === 'antiscam-video') {
    return [
      {
        id: 'av-1',
        type: 'system',
        content: '反诈视频制作组已创建 · 流水线：脚本→画面→配音→合成',
        timestamp: '10:00',
      },
      {
        id: 'av-2',
        type: 'user',
        content: '帮我制作一个反诈宣传短视频，主题是"网络刷单诈骗"，目标受众是大学生群体，时长 30 秒左右。',
        sender: 'user',
        timestamp: '10:01',
      },
      {
        id: 'av-3',
        type: 'employee',
        content: '收到老板！反诈视频制作是我们的核心能力。这个任务会经过四个环节：\n\n1. **脚本撰写** → @创作员 负责\n2. **画面准备** → @分析员 负责素材采集\n3. **配音生成** → @播报员 负责 TTS\n4. **视频合成** → @剪辑师 负责最终成片\n\n我来分派，大家接力完成。',
        sender: 'chief',
        timestamp: '10:01',
      },
      {
        id: 'av-4',
        type: 'employee',
        content: '收到 @理！"网络刷单诈骗"这个主题我用「真实案例 + 反转揭露」的结构来写，30 秒大约 360 字，分 5 个分镜。给我 2 分钟出初稿。',
        sender: 'writer',
        timestamp: '10:02',
      },
      {
        id: 'av-5',
        type: 'artifact',
        content: '',
        sender: 'writer',
        timestamp: '10:04',
        artifact: {
          id: 'av-artifact-1',
          kind: '视频脚本',
          title: '反诈短视频脚本 · 网络刷单篇（30s）',
          summary: '【Hook】"动动手指就能日赚 500？"——大学生小李信了…\n【正文】第一单赚了 5 块，第二单要垫 100，第三单要垫 2000…\n【警示】刷单就是诈骗！遇到请拨打 96110',
          by: 'writer',
          artifactType: 'video-script',
          data: {
            hook: '动动手指就能日赚 500？大学生小李看到了一条兼职广告…',
            body: [
              '第一单，佣金 5 块，秒到账。小李觉得靠谱。',
              '第二单，要先垫付 100。"做完就返"，小李照做了。',
              '第三单，垫付涨到 2000。小李犹豫了，但想着前面的钱还没拿回来…',
              '等他反应过来，8000 块已经没了，对方也拉黑了。',
            ],
            closing: '天上不会掉馅饼，刷单就是诈骗！遇到请拨打 96110。',
            estimated_duration_seconds: 30,
          },
        },
      },
      {
        id: 'av-6',
        type: 'employee',
        content: '脚本写好了，5 个分镜结构清晰。@分析员 你来准备每个分镜对应的画面素材。',
        sender: 'writer',
        timestamp: '10:05',
      },
      {
        id: 'av-7',
        type: 'employee',
        content: '收到 @创作员！我根据脚本的 5 个分镜准备画面：\n- 分镜 1：手机屏幕特写，"日赚 500"广告\n- 分镜 2：学生宿舍，小李操作手机\n- 分镜 3：金额递增动画 100→500→2000→8000\n- 分镜 4：聊天界面显示"已被拉黑"\n- 分镜 5：反诈标语 + 96110\n\n开始生成，预计 3 分钟。',
        sender: 'analyst',
        timestamp: '10:06',
      },
      {
        id: 'av-8',
        type: 'employee',
        content: '5 组分镜画面已全部就绪！@播报员 你来生成配音。',
        sender: 'analyst',
        timestamp: '10:10',
      },
      {
        id: 'av-9',
        type: 'employee',
        content: '收到 @分析员！我根据脚本旁白生成配音：前半段用轻松好奇的语气，中段切换到紧张急促，最后用严肃播音腔读警示语。速度 1.05x，总时长控制在 29 秒。',
        sender: 'distributor',
        timestamp: '10:11',
      },
      {
        id: 'av-10',
        type: 'employee',
        content: '配音 + 背景音乐已生成完毕！语音 29 秒，BGM 已匹配"严肃警示"风格。@剪辑师 你来做最终合成。',
        sender: 'distributor',
        timestamp: '10:14',
      },
      {
        id: 'av-11',
        type: 'employee',
        content: '收到 @播报员！我把脚本、5 组画面、配音、BGM 合成为最终视频。加上 SRT 字幕、转场效果，输出 1024×1024 MP4。',
        sender: 'coder',
        timestamp: '10:15',
      },
      {
        id: 'av-12',
        type: 'artifact',
        content: '',
        sender: 'coder',
        timestamp: '10:20',
        artifact: {
          id: 'av-artifact-2',
          kind: '成片',
          title: '反诈短视频成片 · 网络刷单篇 v1',
          summary: '30 秒成片已完成：画面合成 + 配音对齐 + SRT 字幕 + 转场 + BGM 混音',
          by: 'coder',
          artifactType: 'video-preview',
          data: {
            duration: '00:30',
            resolution: '1024x1024',
            format: 'MP4',
          },
        },
      },
      {
        id: 'av-13',
        type: 'employee',
        content: '全流程完成！从脚本到成片，四个环节接力产出：\n\n- **创作员**：30 秒脚本（5 分镜）\n- **分析员**：5 组画面素材\n- **播报员**：配音 + BGM\n- **剪辑师**：最终成片 MP4\n\n老板可以在成果库查看和下载。如果需要调整，随时说。',
        sender: 'chief',
        timestamp: '10:21',
      },
    ];
  }
  
  return [
    {
      id: '1',
      type: 'system',
      content: '新对话已开始，给团队派活吧',
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    },
  ];
};

// 初始流水线
const getInitialPipeline = (groupId?: string): PipelineStage[] => {
  if (groupId === 'xhs') {
    return [
      { id: 1, name: '意图澄清', status: 'done', assignee: 'analyst', chip: '已完成' },
      { id: 2, name: '人设定位', status: 'done', assignee: 'planner', chip: '已完成' },
      { id: 3, name: '爆款分析', status: 'done', assignee: 'analyst', chip: '已完成' },
      { id: 4, name: '选题策划', status: 'done', assignee: 'planner', chip: '已完成' },
      { id: 5, name: '标题文案', status: 'done', assignee: 'writer', chip: '已完成' },
      { id: 6, name: '封面设计', status: 'done', assignee: 'distributor', chip: '已完成' },
      { id: 7, name: '发布排期', status: 'active', assignee: 'distributor', chip: '进行中' },
    ];
  }
  if (groupId === 'bp') {
    return [
      { id: 1, name: '意图澄清', status: 'done', assignee: 'analyst', chip: '已完成' },
      { id: 2, name: '投资人调研', status: 'done', assignee: 'monitor', chip: '已完成' },
      { id: 3, name: '数据分析', status: 'done', assignee: 'analyst', chip: '已完成' },
      { id: 4, name: 'BP框架', status: 'done', assignee: 'planner', chip: '已完成' },
      { id: 5, name: '内容撰写', status: 'active', assignee: 'writer', chip: '进行中' },
      { id: 6, name: '最终审校', status: 'pending', assignee: 'monitor' },
    ];
  }
  if (groupId === 'launch') {
    return [
      { id: 1, name: '意图澄清', status: 'done', assignee: 'analyst', chip: '已完成' },
      { id: 2, name: '爆款分析', status: 'done', assignee: 'analyst', chip: '已完成' },
      { id: 3, name: '选题确定', status: 'done', assignee: 'planner', chip: '已完成' },
      { id: 4, name: '脚本创作', status: 'done', assignee: 'writer', chip: '已完成' },
      { id: 5, name: '素材剪辑', status: 'done', assignee: 'writer', chip: '已完成' },
      { id: 6, name: '发布打包', status: 'active', assignee: 'distributor', chip: '进行中' },
    ];
  }
  if (groupId === 'antiscam-video') {
    return [
      { id: 1, name: '脚本撰写', status: 'done', assignee: 'writer', chip: '已完成' },
      { id: 2, name: '画面准备', status: 'done', assignee: 'analyst', chip: '已完成' },
      { id: 3, name: '配音生成', status: 'done', assignee: 'distributor', chip: '已完成' },
      { id: 4, name: '视频合成', status: 'active', assignee: 'coder', chip: '进行中' },
    ];
  }
  return [
    { id: 1, name: '意图澄清', status: 'active', assignee: 'analyst', chip: '进行中' },
    { id: 2, name: '市场洞察', status: 'pending', assignee: 'analyst' },
    { id: 3, name: '策略方向', status: 'pending', assignee: 'planner' },
    { id: 4, name: '内容创作', status: 'pending', assignee: 'writer' },
    { id: 5, name: '发布打包', status: 'pending', assignee: 'distributor' },
  ];
};

interface AppState {
  // 当前状态
  currentGroupId: string;
  selectedEmployeeId: RoleId | null;
  isDossierOpen: boolean;
  
  // 工作群
  groups: WorkGroup[];
  
  // 消息流（按工作群存储）
  messagesByGroup: Record<string, Message[]>;
  
  // 流水线（按工作群存储）
  pipelineByGroup: Record<string, PipelineStage[]>;
  
  // AI 响应状态
  isAiTyping: boolean;
  typingRoleId: RoleId | null;
  
  // 实时活动状态（多员工同时工作）
  activeAgents: { roleId: RoleId; action: string; progress?: number; sessionId?: string }[];
  /** 标记某员工忙碌中（同 roleId 替换）。sessionId 用于 tooltip 显示"忙在哪"。 */
  markAgentBusy: (roleId: RoleId, action: string, sessionId?: string) => void;
  /** 标记某员工空闲（从 activeAgents 移除）。 */
  markAgentFree: (roleId: RoleId) => void;
  
  // 并行任务集群（Kimi 模式）
  activeCluster: TaskCluster | null;
  replays: ReplayRecord[];
  showClusterPanel: boolean;
  
  // Actions
  setCurrentGroup: (groupId: string) => void;
  setSelectedEmployee: (roleId: RoleId | null) => void;
  toggleDossier: () => void;
  
  // 消息操作
  sendMessage: (content: string) => void;
  addMessage: (message: Message) => void;
  answerClarify: (messageId: string, questionId: string, optionIndex: number) => void;
  
  // 流水线操作
  advancePipeline: () => void;
  
  // 产出物操作
  adoptArtifact: (artifactId: string) => void;
  
  // 工作群操作
  createGroup: (name: string, emoji: string, memberRoles?: RoleId[]) => string;
  
  // 演示模式
  startDemo: () => void;
  
  // 并行任务集群操作
  startCluster: (name: string, tasks: Omit<ParallelTask, 'id' | 'status' | 'progress'>[]) => void;
  updateTaskProgress: (taskId: string, progress: number) => void;
  completeTask: (taskId: string, output?: string) => void;
  toggleClusterPanel: () => void;
  saveReplay: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
  // 初始状态
  currentGroupId: 'xhs',
  selectedEmployeeId: 'chief',
  isDossierOpen: true,
  
  groups: WORK_GROUPS,
  
  messagesByGroup: {
    xhs: getInitialMessages('xhs'),
    bp: getInitialMessages('bp'),
    launch: getInitialMessages('launch'),
    'antiscam-video': getInitialMessages('antiscam-video'),
  },

  pipelineByGroup: {
    xhs: getInitialPipeline('xhs'),
    bp: getInitialPipeline('bp'),
    launch: getInitialPipeline('launch'),
    'antiscam-video': getInitialPipeline('antiscam-video'),
  },
  
  isAiTyping: false,
  typingRoleId: null,
  activeAgents: [],

  // 把某员工标忙：若已在 activeAgents 则替换 action/sessionId，否则追加
  markAgentBusy: (roleId, action, sessionId) =>
    set((state) => {
      const others = state.activeAgents.filter((a) => a.roleId !== roleId);
      return { activeAgents: [...others, { roleId, action, sessionId }] };
    }),
  markAgentFree: (roleId) =>
    set((state) => ({
      activeAgents: state.activeAgents.filter((a) => a.roleId !== roleId),
    })),

  activeCluster: null,
  replays: [],
  showClusterPanel: false,

  // Actions
  setCurrentGroup: (groupId) => {
    set({ currentGroupId: groupId });
    // 清除该群的未读计数
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, unreadCount: undefined, hasActivity: false } : g
      ),
    }));
  },
  
  setSelectedEmployee: (roleId) => set({ selectedEmployeeId: roleId }),
  
  toggleDossier: () => set((state) => ({ isDossierOpen: !state.isDossierOpen })),
  
  sendMessage: (content) => {
    const { currentGroupId, messagesByGroup } = get();
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      type: 'user',
      content,
      sender: 'user',
      timestamp,
    };
    
    // 添加用户消息
    set({
      messagesByGroup: {
        ...messagesByGroup,
        [currentGroupId]: [...(messagesByGroup[currentGroupId] || []), newMessage],
      },
    });
    
    // 触发 AI 响应
    get().triggerAiResponse(content);
  },
  
  addMessage: (message) => {
    const { currentGroupId, messagesByGroup } = get();
    set({
      messagesByGroup: {
        ...messagesByGroup,
        [currentGroupId]: [...(messagesByGroup[currentGroupId] || []), message],
      },
    });
  },
  
  answerClarify: (messageId, questionId, optionIndex) => {
    const { currentGroupId, messagesByGroup } = get();
    const messages = messagesByGroup[currentGroupId] || [];
    
    // 更新澄清卡选择
    const updatedMessages = messages.map((msg) => {
      if (msg.id === messageId && msg.clarifyCard) {
        return {
          ...msg,
          clarifyCard: {
            ...msg.clarifyCard,
            questions: msg.clarifyCard.questions.map((q) =>
              q.id === questionId ? { ...q, selected: optionIndex } : q
            ),
          },
        };
      }
      return msg;
    });
    
    set({
      messagesByGroup: {
        ...messagesByGroup,
        [currentGroupId]: updatedMessages,
      },
    });
    
    // 检查是否所有问题都已回答
    const clarifyMsg = updatedMessages.find((m) => m.id === messageId);
    if (clarifyMsg?.clarifyCard) {
      const allAnswered = clarifyMsg.clarifyCard.questions.every((q) => q.selected !== undefined);
      if (allAnswered) {
        // 发送确认消息并推进流水线
        setTimeout(() => {
          const timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
          get().addMessage({
            id: `msg-${Date.now()}`,
            type: 'employee',
            content: '好的，需求已明确！我这就开始市场调研，稍后给您洞察报告。',
            sender: 'analyst',
            timestamp,
          });
          get().advancePipeline();
          
          // 模拟后续 AI 工作
          setTimeout(() => {
            get().addMessage({
              id: `msg-${Date.now()}`,
              type: 'artifact',
              content: '',
              sender: 'analyst',
              timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
              artifact: {
                id: 'artifact-1',
                kind: '洞察报告',
                title: '精品咖啡小红书竞品分析',
                summary: '分析了三顿半、永璞、隅田川三家品牌的内容策略，发现「咖啡师人设」和「产地故事」是高互动内容的共同特征...',
                by: 'analyst',
              },
            });
          }, 3000);
        }, 800);
      }
    }
  },
  
  advancePipeline: () => {
    const { currentGroupId, pipelineByGroup } = get();
    const pipeline = pipelineByGroup[currentGroupId] || [];
    
    const activeIndex = pipeline.findIndex((s) => s.status === 'active');
    if (activeIndex === -1 || activeIndex >= pipeline.length - 1) return;
    
    const updatedPipeline = pipeline.map((stage, index) => {
      if (index === activeIndex) {
        return { ...stage, status: 'done' as const, chip: '已完成' };
      }
      if (index === activeIndex + 1) {
        return { ...stage, status: 'active' as const, chip: '进行中' };
      }
      return stage;
    });
    
    set({
      pipelineByGroup: {
        ...pipelineByGroup,
        [currentGroupId]: updatedPipeline,
      },
    });
  },
  
  adoptArtifact: (artifactId) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    // 标记产出物为已采纳
    get().addMessage({
      id: `msg-${Date.now()}`,
      type: 'system',
      content: `产出物已采纳，已存入成果库`,
      timestamp,
    });
    
    // 推进流水线
    get().advancePipeline();
    
    // 下一阶段员工开始工作
    setTimeout(() => {
      const { pipelineByGroup, currentGroupId } = get();
      const pipeline = pipelineByGroup[currentGroupId] || [];
      const activeStage = pipeline.find(s => s.status === 'active');
      
      if (activeStage) {
        set({
          activeAgents: [
            { roleId: activeStage.assignee, action: `开始${activeStage.name}...`, progress: 15 },
          ],
        });
        
        // 模拟工作进度
        setTimeout(() => {
          set({
            activeAgents: [
              { roleId: activeStage.assignee, action: `${activeStage.name}进行中...`, progress: 65 },
            ],
          });
        }, 1500);
        
        setTimeout(() => {
          set({ activeAgents: [] });
          get().addMessage({
            id: `msg-${Date.now()}`,
            type: 'employee',
            content: `${activeStage.name}阶段已准备就绪，等待您的下一步指示。`,
            sender: activeStage.assignee,
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          });
        }, 3500);
      }
    }, 500);
  },
  
  createGroup: (name, emoji, memberRoles) => {
    const newGroup: WorkGroup = {
      id: `group-${Date.now()}`,
      name,
      emoji,
      memberRoles: memberRoles ?? [],
    };
    const newId = newGroup.id;

    set((state) => ({
      groups: [...state.groups, newGroup],
      messagesByGroup: {
        ...state.messagesByGroup,
        [newGroup.id]: getInitialMessages(newGroup.id),
      },
      pipelineByGroup: {
        ...state.pipelineByGroup,
        [newGroup.id]: getInitialPipeline(),
      },
      currentGroupId: newGroup.id,
    }));
    return newId;
  },

  // 演示模式：展示完整的 AI 协作流程
  startDemo: () => {
    const { currentGroupId, messagesByGroup, pipelineByGroup } = get();
    const timestamp = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    // 重置当前群的消息和流水线
    set({
      messagesByGroup: {
        ...messagesByGroup,
        [currentGroupId]: [
          { id: 'demo-1', type: 'system', content: '演示模式已启动', timestamp: timestamp() },
        ],
      },
      pipelineByGroup: {
        ...pipelineByGroup,
        [currentGroupId]: getInitialPipeline(),
      },
    });
    
    // 步骤 1: 用户发送任务 (1s)
    setTimeout(() => {
      get().addMessage({
        id: 'demo-2',
        type: 'user',
        content: '帮我写一篇咖啡店的小红书推广文案，要突出手冲特色',
        sender: 'user',
        timestamp: timestamp(),
      });
    }, 1000);
    
    // 步骤 2: 分析员开始打字 (2s)
    setTimeout(() => {
      set({ isAiTyping: true, typingRoleId: 'analyst' });
    }, 2000);
    
    // 步骤 3: 分析员发送澄清卡 (3s)
    setTimeout(() => {
      set({ isAiTyping: false, typingRoleId: null });
      get().addMessage({
        id: 'demo-3',
        type: 'employee',
        content: '收到！在开始之前，我需要确认几个关键信息：',
        sender: 'analyst',
        timestamp: timestamp(),
      });
    }, 3000);
    
    // 步骤 4: 显示澄清卡片 (3.5s)
    setTimeout(() => {
      get().addMessage({
        id: 'demo-4',
        type: 'clarify',
        content: '',
        sender: 'analyst',
        timestamp: timestamp(),
        clarifyCard: {
          questions: [
            { id: 'q1', question: '目标人群？', options: ['年轻白领', '咖啡爱好者', '学生党', '泛人群'] },
            { id: 'q2', question: '内容调性？', options: ['专业深度', '轻松有趣', '文艺小众', '直接带货'] },
          ],
        },
      });
    }, 3500);
    
    // 步骤 5: 模拟用户选择 (5s)
    setTimeout(() => {
      const { messagesByGroup: msgs, currentGroupId: gid } = get();
      const messages = msgs[gid] || [];
      const updatedMessages = messages.map((msg) => {
        if (msg.id === 'demo-4' && msg.clarifyCard) {
          return {
            ...msg,
            clarifyCard: {
              ...msg.clarifyCard,
              questions: msg.clarifyCard.questions.map((q, i) => ({ ...q, selected: i === 0 ? 1 : 2 })),
            },
          };
        }
        return msg;
      });
      set({
        messagesByGroup: { ...msgs, [gid]: updatedMessages },
      });
    }, 5000);
    
    // 步骤 6: 分析员确认并推进 (6s)
    setTimeout(() => {
      set({ isAiTyping: true, typingRoleId: 'analyst' });
    }, 5500);
    
    setTimeout(() => {
      set({ isAiTyping: false, typingRoleId: null });
      get().addMessage({
        id: 'demo-5',
        type: 'employee',
        content: '明白了！面向咖啡爱好者，文艺小众风格。我先调研一下竞品...',
        sender: 'analyst',
        timestamp: timestamp(),
      });
      get().advancePipeline();
    }, 6500);
    
    // 步骤 7: 策划员加入讨论 (8s)
    setTimeout(() => {
      set({ isAiTyping: true, typingRoleId: 'planner' });
    }, 7500);
    
    setTimeout(() => {
      set({ isAiTyping: false, typingRoleId: null });
      get().addMessage({
        id: 'demo-6',
        type: 'employee',
        content: '我来补充一下策略方向：建议用「咖啡师的一天」这个角度切入，更有故事感。',
        sender: 'planner',
        timestamp: timestamp(),
        isDebate: true,
      });
    }, 8500);
    
    // 步骤 8: 分析员回应 (10s)
    setTimeout(() => {
      get().addMessage({
        id: 'demo-7',
        type: 'employee',
        content: '同意策的思路。我看到竞品数据显示，带「咖啡师」人设的内容互动率高出 47%。',
        sender: 'analyst',
        timestamp: timestamp(),
        isDebate: true,
        debateIndent: true,
      });
    }, 10000);
    
    // 步�� 9: 创作员准备产出 (12s)
    setTimeout(() => {
      set({ isAiTyping: true, typingRoleId: 'writer' });
    }, 11500);
    
    setTimeout(() => {
      set({ isAiTyping: false, typingRoleId: null });
      get().addMessage({
        id: 'demo-8',
        type: 'employee',
        content: '好的，基于以上讨论，我来产出文案初稿：',
        sender: 'writer',
        timestamp: timestamp(),
      });
      get().advancePipeline();
    }, 12500);
    
    // 步骤 10: 输出产出物 (14s)
    setTimeout(() => {
      get().addMessage({
        id: 'demo-9',
        type: 'artifact',
        content: '',
        sender: 'writer',
        timestamp: timestamp(),
        artifact: {
          id: 'demo-artifact-1',
          kind: '小红书文案',
          title: '在这杯手冲里，藏着咖啡师的秘密',
          summary: '清晨 7 点，当第一缕阳光穿过玻璃瓶，我已经开始了今天的第一次萃取。这不是工作，是仪式...',
          by: 'writer',
        },
      });
      get().advancePipeline();
    }, 14000);
    
    // 步骤 11: 完成提示 (15s)
    setTimeout(() => {
      get().addMessage({
        id: 'demo-10',
        type: 'system',
        content: '演示结束 - 这就是 AI 团队协作的流程',
        timestamp: timestamp(),
      });
    }, 15500);
  },
  
  // 并行任务集群方法
  startCluster: (name, tasks) => {
    const cluster: TaskCluster = {
      id: `cluster-${Date.now()}`,
      name,
      tasks: tasks.map((t, i) => ({
        ...t,
        id: `task-${Date.now()}-${i}`,
        status: 'pending',
        progress: 0,
      })),
      status: 'running',
      totalTasks: tasks.length,
      completedTasks: 0,
      startTime: Date.now(),
    };
    
    set({ activeCluster: cluster, showClusterPanel: true });
    
    // 模拟并行任务执行
    cluster.tasks.forEach((task, index) => {
      const delay = Math.random() * 1000 + 500;
      
      setTimeout(() => {
        // 开始执行
        set((state) => {
          if (!state.activeCluster) return state;
          const tasks = state.activeCluster.tasks.map((t) =>
            t.id === task.id ? { ...t, status: 'running' as const, startTime: Date.now() } : t
          );
          return { activeCluster: { ...state.activeCluster, tasks } };
        });
        
        // 模拟进度更新
        const progressInterval = setInterval(() => {
          set((state) => {
            if (!state.activeCluster) {
              clearInterval(progressInterval);
              return state;
            }
            const currentTask = state.activeCluster.tasks.find((t) => t.id === task.id);
            if (!currentTask || currentTask.status === 'done') {
              clearInterval(progressInterval);
              return state;
            }
            const newProgress = Math.min(currentTask.progress + Math.random() * 15 + 5, 95);
            const tasks = state.activeCluster.tasks.map((t) =>
              t.id === task.id ? { ...t, progress: newProgress } : t
            );
            return { activeCluster: { ...state.activeCluster, tasks } };
          });
        }, 300);
        
        // 完成任务
        const duration = Math.random() * 3000 + 2000;
        setTimeout(() => {
          clearInterval(progressInterval);
          get().completeTask(task.id, `${task.name} 完成`);
        }, duration);
      }, delay + index * 200);
    });
  },
  
  updateTaskProgress: (taskId, progress) => {
    set((state) => {
      if (!state.activeCluster) return state;
      const tasks = state.activeCluster.tasks.map((t) =>
        t.id === taskId ? { ...t, progress } : t
      );
      return { activeCluster: { ...state.activeCluster, tasks } };
    });
  },
  
  completeTask: (taskId, output) => {
    set((state) => {
      if (!state.activeCluster) return state;
      
      const tasks = state.activeCluster.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'done' as const, progress: 100, endTime: Date.now(), output } : t
      );
      
      const completedTasks = tasks.filter((t) => t.status === 'done').length;
      const allDone = completedTasks === tasks.length;
      
      const updatedCluster = {
        ...state.activeCluster,
        tasks,
        completedTasks,
        status: allDone ? 'done' as const : 'running' as const,
        endTime: allDone ? Date.now() : undefined,
      };
      
      // 全部完成时自动保存回放
      if (allDone) {
        const replay: ReplayRecord = {
          id: `replay-${Date.now()}`,
          clusterId: updatedCluster.id,
          clusterName: updatedCluster.name,
          timestamp: Date.now(),
          duration: (updatedCluster.endTime || Date.now()) - (updatedCluster.startTime || Date.now()),
          tasks: updatedCluster.tasks,
        };
        return { 
          activeCluster: updatedCluster,
          replays: [...state.replays, replay],
        };
      }
      
      return { activeCluster: updatedCluster };
    });
  },
  
  toggleClusterPanel: () => {
    set((state) => ({ showClusterPanel: !state.showClusterPanel }));
  },
  
  saveReplay: () => {
    const { activeCluster, replays } = get();
    if (!activeCluster) return;
    
    const replay: ReplayRecord = {
      id: `replay-${Date.now()}`,
      clusterId: activeCluster.id,
      clusterName: activeCluster.name,
      timestamp: Date.now(),
      duration: (activeCluster.endTime || Date.now()) - (activeCluster.startTime || Date.now()),
      tasks: activeCluster.tasks,
    };
    
    set({ replays: [...replays, replay] });
  },
  
  // 内部方法：触发 AI 响应（完整版 - Agent之间通过@协作）
  triggerAiResponse: (userContent: string) => {
    const timestamp = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    // 立即显示分析员开始工作
    set({
      activeAgents: [
        { roleId: 'analyst', action: '识别任务意图...', progress: 10 },
      ],
    });
    
    // 模拟进度
    let progress1 = 10;
    const progressInterval = setInterval(() => {
      progress1 = Math.min(progress1 + Math.random() * 12, 85);
      set({
        activeAgents: [
          { roleId: 'analyst', action: '识别任务意图...', progress: Math.round(progress1) },
        ],
      });
    }, 300);
    
    // 第1步：分析员识别意图 (1.5s)
    setTimeout(() => {
      clearInterval(progressInterval);
      set({ isAiTyping: true, typingRoleId: 'analyst' });
    }, 1200);
    
    setTimeout(() => {
      set({ isAiTyping: false, typingRoleId: null });
      get().addMessage({
        id: `msg-${Date.now()}`,
        type: 'employee',
        content: '收到老板！让我来梳理一下任务：' + (userContent.length > 20 ? userContent.slice(0, 20) + '...' : userContent) + '。在开始之前，我需要确认几个关键信息：',
        sender: 'analyst',
        timestamp: timestamp(),
      });
    }, 2000);
    
    // 第2步：显示澄清卡 (2.5s)
    setTimeout(() => {
      get().addMessage({
        id: `msg-clarify-${Date.now()}`,
        type: 'clarify',
        content: '',
        sender: 'analyst',
        timestamp: timestamp(),
        clarifyCard: {
          questions: [
            { id: 'q1', question: '核心目标是？', options: ['品牌曝光', '用户增长', '销售转化', '口碑传播'] },
            { id: 'q2', question: '预算范围？', options: ['低成本', '中等投入', '大预算', '你来建议'] },
          ],
        },
      });
      set({
        activeAgents: [
          { roleId: 'analyst', action: '等待老板确认...', progress: 100 },
        ],
      });
    }, 2800);
    
    // 第3步：模拟用户已选择，分析员@ 策划员 (5s)
    setTimeout(() => {
      set({
        activeAgents: [
          { roleId: 'analyst', action: '整理需求，@ 策划员...', progress: 50 },
          { roleId: 'planner', action: '准备接收任务...', progress: 10 },
        ],
        isAiTyping: true, 
        typingRoleId: 'analyst',
      });
    }, 5000);
    
    setTimeout(() => {
      set({ isAiTyping: false, typingRoleId: null });
      get().addMessage({
        id: `msg-${Date.now()}`,
        type: 'employee',
        content: '好的，需求已明确。@策划员 你可以开始制定策略框架了，关键词是：' + (userContent.includes('咖啡') ? '精品咖啡、手冲、小红书' : '内容营销、用户增长'),
        sender: 'analyst',
        timestamp: timestamp(),
      });
      
      set({
        activeAgents: [
          { roleId: 'planner', action: '收到@，制定策略中...', progress: 30 },
        ],
      });
    }, 6000);
    
    // 第4步：策划员响应并@ 分析员 确认 (8s)
    setTimeout(() => {
      set({ isAiTyping: true, typingRoleId: 'planner' });
      set({
        activeAgents: [
          { roleId: 'planner', action: '输出策略方案...', progress: 80 },
        ],
      });
    }, 7500);
    
    setTimeout(() => {
      set({ isAiTyping: false, typingRoleId: null });
      get().addMessage({
        id: `msg-${Date.now()}`,
        type: 'employee',
        content: '收到 @分析员！我初步有两个策略方向：方向A「专业深度」- 突出专业度；方向B「情感共鸣」- 走故事路线。@老板 您倾向哪个？或者 @分析员 你有什么数据支持？',
        sender: 'planner',
        timestamp: timestamp(),
      });
      
      set({
        activeAgents: [
          { roleId: 'analyst', action: '查找相关数据...', progress: 20 },
          { roleId: 'planner', action: '等待反馈...', progress: 100 },
        ],
      });
    }, 8500);
    
    // 第5步：分析员补充数据 (10s)
    setTimeout(() => {
      set({ isAiTyping: true, typingRoleId: 'analyst' });
      set({
        activeAgents: [
          { roleId: 'analyst', action: '分析数据中...', progress: 70 },
        ],
      });
    }, 9500);
    
    setTimeout(() => {
      set({ isAiTyping: false, typingRoleId: null });
      get().addMessage({
        id: `msg-${Date.now()}`,
        type: 'employee',
        content: '@策划员 补充一下数据：根据近期趋势，「情感共鸣」类内容互动率高出35%。建议走方向B，@老板 您看呢？',
        sender: 'analyst',
        timestamp: timestamp(),
        isDebate: true,
      });
      
      set({
        activeAgents: [
          { roleId: 'planner', action: '等待老板决策...', progress: 100 },
          { roleId: 'writer', action: '待命中...', progress: 5 },
        ],
      });
    }, 10500);
    
    // 第6步：策划员确认并@ 创作员 (13s)
    setTimeout(() => {
      set({ isAiTyping: true, typingRoleId: 'planner' });
    }, 12500);
    
    setTimeout(() => {
      set({ isAiTyping: false, typingRoleId: null });
      get().addMessage({
        id: `msg-${Date.now()}`,
        type: 'employee',
        content: '好，那就定方向B「情感共鸣」！@创作员 你可以开始准备内容了。我把策略要点发给你。',
        sender: 'planner',
        timestamp: timestamp(),
      });
      
      set({
        activeAgents: [
          { roleId: 'writer', action: '收到任务，构思中...', progress: 25 },
        ],
      });
      
      // 推进流水线
      get().advancePipeline();
    }, 13500);
    
    // 第7步：创作员响应 (15s)
    setTimeout(() => {
      set({ isAiTyping: true, typingRoleId: 'writer' });
      set({
        activeAgents: [
          { roleId: 'writer', action: '创作初稿...', progress: 60 },
        ],
      });
    }, 14500);
    
    setTimeout(() => {
      set({ isAiTyping: false, typingRoleId: null, activeAgents: [] });
      get().addMessage({
        id: `msg-${Date.now()}`,
        type: 'employee',
        content: '收到 @策划员！明白策略方向了。我开始创作初稿，预计3分钟后给老板看第一版。@播报员 你也可以先准备发布渠道了。',
        sender: 'writer',
        timestamp: timestamp(),
      });
    }, 16000);
    
    // 第8步：播报员响应 (17s)  
    setTimeout(() => {
      set({ isAiTyping: true, typingRoleId: 'distributor' });
    }, 17000);
    
    setTimeout(() => {
      set({ isAiTyping: false, typingRoleId: null });
      get().addMessage({
        id: `msg-${Date.now()}`,
        type: 'employee',
        content: '收到 @创作员！我先准备好发布模板和最佳发布时间。@观测员 等内容发布后记得设置数据监测。',
        sender: 'distributor',
        timestamp: timestamp(),
      });
    }, 18000);
    
    // 第9步：观测员响应 (19s)
    setTimeout(() => {
      set({ isAiTyping: true, typingRoleId: 'monitor' });
    }, 18500);
    
    setTimeout(() => {
      set({ isAiTyping: false, typingRoleId: null });
      get().addMessage({
        id: `msg-${Date.now()}`,
        type: 'employee',
        content: '收到 @播报员！监测任务已就位。发布后24小时会给老板第一次数据汇报。',
        sender: 'monitor',
        timestamp: timestamp(),
      });
    }, 19500);
    
    // 系统提示
    setTimeout(() => {
      get().addMessage({
        id: `msg-${Date.now()}`,
        type: 'system',
        content: '团队协作进行中，所有 Agent 已就位',
        timestamp: timestamp(),
      });
    }, 20500);
  },
    }),
    {
      name: 'youle-app-v1',
      // 只持久化"用户创建/修改不希望刷新丢失"的字段。mock 聊天记录、
      // 进行时的忙碌状态、演示数据等都不进 localStorage。
      partialize: (state) => ({
        groups: state.groups,
        currentGroupId: state.currentGroupId,
        selectedEmployeeId: state.selectedEmployeeId,
        isDossierOpen: state.isDossierOpen,
      }),
      storage: createJSONStorage(() => localStorage),
      version: 2,
    },
  ),
);

// 扩展 store 类型以包含内部方法
declare module './store' {
  interface AppState {
    triggerAiResponse: (userContent: string) => void;
  }
}
