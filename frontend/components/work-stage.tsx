'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { PanelRightClose, PanelRightOpen, Send, Paperclip, BookOpen, PenTool, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLES, ROLE_COLORS, AGENT_MARKET_PROFILES, type RoleId, type Message, type PipelineStage, type Artifact } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { MentionSelector } from './mention-selector';

interface WorkStageProps {
  onToggleDossier: () => void;
  isDossierOpen: boolean;
}

export function WorkStage({ onToggleDossier, isDossierOpen }: WorkStageProps) {
  const { currentGroupId, groups, messagesByGroup, pipelineByGroup, isAiTyping, typingRoleId, activeAgents } = useAppStore();
  const group = groups.find(g => g.id === currentGroupId) || groups[0];
  const messages = messagesByGroup[currentGroupId] || [];
  const pipeline = pipelineByGroup[currentGroupId] || [];
  
  // 计算正在忙碌的员工数量
  const busyCount = activeAgents.length;

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* 顶栏 */}
      <header className="px-4 py-3 border-b border-line flex items-center justify-between bg-bg-panel">
        <div className="flex items-center gap-3">
          <span className="text-xl">{group.emoji}</span>
          <div>
            <h1 className="font-serif font-semibold text-ink">{group.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {/* 员工头像堆叠 */}
              <div className="flex -space-x-1.5">
                {Object.values(ROLES).filter(r => r.id !== 'chief').slice(0, 5).map((role) => {
                  const isActive = activeAgents.some(a => a.roleId === role.id);
                  const profile = AGENT_MARKET_PROFILES[role.id];
                  return (
                    <div
                      key={role.id}
                      className={cn(
                        'w-6 h-6 rounded-md overflow-hidden border-2 border-bg-panel relative transition-transform',
                        isActive && 'scale-110 ring-1 ring-busy/50'
                      )}
                    >
                      <Image
                        src={profile.avatar}
                        alt={role.name}
                        width={24}
                        height={24}
                        className="object-cover w-full h-full"
                      />
                      {isActive && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-busy rounded-full pulse-dot" />
                      )}
                    </div>
                  );
                })}
              </div>
              {busyCount > 0 ? (
                <span className="text-xs text-busy font-medium">{busyCount} 位工作中</span>
              ) : (
                <span className="text-xs text-ink-3">待命中</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleDossier}
            className={cn(
              "p-2 rounded-lg transition-colors",
              isDossierOpen ? "bg-bg-hover" : "hover:bg-bg-hover"
            )}
            title={isDossierOpen ? '收起侧栏' : '展开侧栏'}
          >
            {isDossierOpen ? (
              <PanelRightClose className="w-4 h-4 text-ink-3" />
            ) : (
              <PanelRightOpen className="w-4 h-4 text-ink-3" />
            )}
          </button>
        </div>
      </header>

      {/* 实时活动状态条 */}
      {activeAgents.length > 0 && (
        <ActivityBar agents={activeAgents} />
      )}

      {/* 阶段长廊 */}
      <PipelineBar stages={pipeline} />

      {/* 消息流 */}
      <MessageFlow messages={messages} isAiTyping={isAiTyping} typingRoleId={typingRoleId} />

      {/* 输入框 */}
      <Composer />
    </div>
  );
}

// 实时活动状态条
function ActivityBar({ agents }: { agents: { roleId: RoleId; action: string; progress?: number }[] }) {
  return (
    <div className="px-4 py-2 border-b border-line bg-busy/5 overflow-hidden">
      <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
        {agents.map((agent, i) => {
          const role = ROLES[agent.roleId];
          const profile = AGENT_MARKET_PROFILES[agent.roleId];
          return (
            <div key={i} className="flex items-center gap-2 flex-shrink-0 message-in" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0">
                <Image
                  src={profile.avatar}
                  alt={role.name}
                  width={24}
                  height={24}
                  className="object-cover w-full h-full"
                />
              </div>
              <span className="text-xs text-ink whitespace-nowrap">{agent.action}</span>
              {agent.progress !== undefined && (
                <div className="w-16 h-1 bg-bg-panel rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-busy rounded-full transition-all duration-300"
                    style={{ width: `${agent.progress}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PipelineBar({ stages }: { stages: PipelineStage[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const activeStage = stages.find(s => s.status === 'active');
  const doneCount = stages.filter(s => s.status === 'done').length;

  if (!isExpanded) {
    return (
      <div className="px-4 py-2 border-b border-line bg-bg-sunken/50">
        <button 
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-3 text-sm hover:bg-bg-hover px-2 py-1 rounded-lg transition-colors w-full"
        >
          <div className="flex gap-1">
            {stages.map((stage) => (
              <span
                key={stage.id}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  stage.status === 'done' && 'bg-ink',
                  stage.status === 'active' && 'bg-busy pulse-dot',
                  stage.status === 'pending' && 'bg-ink-4'
                )}
              />
            ))}
          </div>
          <span className="text-ink">{activeStage?.name || '准备中'}</span>
          <span className="text-ink-3">· {doneCount + 1}/{stages.length}</span>
          <ChevronDown className="w-3 h-3 text-ink-3 ml-auto" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 border-b border-line bg-bg-sunken/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-ink">工作流程</span>
        <button 
          onClick={() => setIsExpanded(false)}
          className="p-1 hover:bg-bg-hover rounded transition-colors"
        >
          <ChevronUp className="w-3 h-3 text-ink-3" />
        </button>
      </div>
      
      {/* 阶段节点 */}
      <div className="flex items-start justify-between relative">
        {/* 连接线 */}
        <div className="absolute top-3 left-0 right-0 h-0.5 bg-line-2 -z-0" />
        
        {stages.map((stage) => (
          <div key={stage.id} className="flex flex-col items-center z-10" style={{ width: `${100 / stages.length}%` }}>
            {/* 节点圆圈 */}
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-all',
              stage.status === 'done' && 'bg-ink text-white border-ink',
              stage.status === 'active' && 'bg-bg-panel text-busy border-busy pulse-dot',
              stage.status === 'pending' && 'bg-bg-panel text-ink-4 border-line-2 border-dashed'
            )}>
              {stage.id}
            </div>
            
            {/* 阶段名 */}
            <span className={cn(
              'text-[11px] mt-1.5 text-center',
              stage.status === 'active' ? 'text-ink font-medium' : 'text-ink-3'
            )}>
              {stage.name}
            </span>
            
            {/* chip */}
            {stage.chip && (
              <span className="text-[10px] px-1.5 py-0.5 bg-bg-hover rounded mt-1 text-ink-3">
                {stage.chip}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageFlow({ messages, isAiTyping, typingRoleId }: { messages: Message[]; isAiTyping: boolean; typingRoleId: RoleId | null }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message, index) => (
        <MessageItem key={message.id} message={message} isNew={index >= messages.length - 1} />
      ))}

      {/* AI 打字指示器 */}
      {isAiTyping && typingRoleId && (
        <TypingIndicator roleId={typingRoleId} />
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

function MessageItem({ message, isNew }: { message: Message; isNew: boolean }) {
  const { answerClarify } = useAppStore();

  switch (message.type) {
    case 'system':
      return (
        <div className={cn("flex justify-center py-2", isNew && "message-in")}>
          <span className="text-xs text-ink-4 bg-bg-sunken px-3 py-1 rounded-full">
            {message.content}
          </span>
        </div>
      );

    case 'user':
      return (
        <div className={cn("flex justify-end", isNew && "message-in")}>
          <div className="max-w-[70%]">
            <div className="bg-ink text-white px-4 py-2.5 rounded-xl rounded-tr-sm">
              <p className="text-sm leading-relaxed">{formatMentions(message.content)}</p>
            </div>
            <p className="text-[10px] text-ink-4 text-right mt-1">{message.timestamp}</p>
          </div>
        </div>
      );

    case 'employee':
      return (
        <EmployeeMessage 
          roleId={message.sender as RoleId}
          content={message.content}
          time={message.timestamp}
          isDebate={message.isDebate}
          debateIndent={message.debateIndent}
          isNew={isNew}
        />
      );

    case 'clarify':
      return (
        <div className={cn("ml-10", isNew && "message-in")}>
          <ClarifyCard 
            messageId={message.id}
            questions={message.clarifyCard?.questions || []}
            onAnswer={(questionId, optionIndex) => answerClarify(message.id, questionId, optionIndex)}
          />
        </div>
      );

    case 'artifact':
      return (
        <div className={cn("ml-10", isNew && "message-in")}>
          {message.artifact && (
            <ArtifactCard 
              {...message.artifact}
            />
          )}
        </div>
      );

    default:
      return null;
  }
}

function TypingIndicator({ roleId }: { roleId: RoleId }) {
  const role = ROLES[roleId];
  const profile = AGENT_MARKET_PROFILES[roleId];

  return (
    <div className="flex gap-2.5 message-in">
      <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
        <Image
          src={profile.avatar}
          alt={role.name}
          width={32}
          height={32}
          className="object-cover w-full h-full"
        />
      </div>
      <div className="flex items-center gap-1 px-4 py-3 bg-bg-sunken rounded-xl rounded-tl-sm">
        <span className="w-2 h-2 bg-ink-3 rounded-full typing-dot" />
        <span className="w-2 h-2 bg-ink-3 rounded-full typing-dot" />
        <span className="w-2 h-2 bg-ink-3 rounded-full typing-dot" />
      </div>
    </div>
  );
}

interface EmployeeMessageProps {
  roleId: RoleId;
  content: string;
  time: string;
  isDebate?: boolean;
  debateIndent?: boolean;
  isNew?: boolean;
}

function EmployeeMessage({ 
  roleId, 
  content, 
  time, 
  isDebate,
  debateIndent,
  isNew
}: EmployeeMessageProps) {
  const role = ROLES[roleId];
  const profile = AGENT_MARKET_PROFILES[roleId];
  const colorConfig = ROLE_COLORS[roleId];

  return (
    <div className={cn(
      "flex gap-2.5",
      debateIndent && "ml-14",
      isNew && "message-in"
    )}>
      {/* 头像 */}
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm">
          <Image
            src={profile.avatar}
            alt={role.name}
            width={32}
            height={32}
            className="object-cover w-full h-full"
          />
        </div>
        {/* 在线状态点 */}
        <div className={cn(
          'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg',
          profile.availability === 'available' ? 'bg-active' : 'bg-busy'
        )} />
      </div>

      <div className="flex-1 min-w-0">
        {/* 名字和时间 */}
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("text-sm font-medium", `text-${roleId}`)}>
            {role.name}
          </span>
          <span className="text-[10px] text-ink-4">{time}</span>
        </div>

        {/* 回复装饰 */}
        {debateIndent && (
          <div className="text-ink-4 text-xs mb-1 flex items-center gap-1">
            <span className="w-3 h-px bg-ink-4" />
            回复
          </div>
        )}

        {/* 消息内容 */}
        <div className={cn(
          'px-4 py-2.5 rounded-xl rounded-tl-sm max-w-[85%]',
          debateIndent ? 'bg-bg-panel border border-line' : colorConfig.light
        )}>
          <p className="text-sm text-ink leading-relaxed">{formatMentions(content)}</p>
        </div>
      </div>
    </div>
  );
}

interface ClarifyCardProps {
  messageId: string;
  questions: Array<{
    id: string;
    question: string;
    options: string[];
    selected?: number;
  }>;
  onAnswer: (questionId: string, optionIndex: number) => void;
}

function ClarifyCard({ messageId, questions, onAnswer }: ClarifyCardProps) {
  return (
    <div className="w-[360px] bg-bg-panel border border-line rounded-xl p-4 shadow-sm">
      <div className="space-y-3">
        {questions.map((q) => (
          <div key={q.id}>
            <p className="text-sm text-ink mb-2">{q.question}</p>
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => onAnswer(q.id, i)}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-full border transition-all option-card',
                    q.selected === i 
                      ? 'bg-ink text-white border-ink' 
                      : 'bg-bg-panel text-ink-2 border-line hover:border-ink-4'
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArtifactCard({ 
  id, 
  kind, 
  title, 
  summary, 
  by, 
  artifactType,
  data 
}: Artifact) {
  const { adoptArtifact } = useAppStore();
  const [adopted, setAdopted] = useState(false);

  const handleAdopt = () => {
    setAdopted(true);
    adoptArtifact(id);
  };

  // 根据产出物类型选择宽度
  const getWidth = () => {
    switch (artifactType) {
      case 'table':
      case 'chart':
      case 'video-script':
      case 'diagram':
      case 'slide':
        return 'w-[460px]';
      case 'topic-list':
      case 'publish-plan':
      case 'media-upload':
      case 'video-preview':
        return 'w-[420px]';
      default:
        return 'w-[360px]';
    }
  };

  return (
    <div className={cn(
      "mt-2 bg-bg-panel border border-line rounded-xl overflow-hidden shadow-sm",
      getWidth()
    )}>
      {/* 标题区 */}
      <div className="p-3 border-b border-line">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="px-1.5 py-0.5 bg-bg-sunken text-ink-3 text-[10px] font-mono rounded">
            {kind}
          </span>
          <span className="font-serif font-medium text-sm text-ink">{title}</span>
        </div>
        <p className="text-xs text-ink-3 leading-relaxed">{summary}</p>
      </div>

      {/* 内容区 - 根据类型渲染 */}
      <div className="p-3 bg-bg-sunken/30">
        <ArtifactContent artifactType={artifactType} data={data} />
      </div>

      {/* 操作区 */}
      <div className="px-3 py-2 border-t border-line flex gap-2 bg-bg-panel">
        <button className="text-xs text-ink-3 hover:text-ink transition-colors">
          查看完整
        </button>
        <button 
          onClick={handleAdopt}
          disabled={adopted}
          className={cn(
            "text-xs px-2 py-1 rounded transition-colors ml-auto",
            adopted 
              ? "bg-active text-white cursor-default" 
              : "bg-ink text-white hover:bg-ink-2"
          )}
        >
          {adopted ? '已采纳' : '采纳'}
        </button>
      </div>
    </div>
  );
}

// 根据产出物类型渲染不同内容
function ArtifactContent({ 
  artifactType, 
  data 
}: { 
  artifactType?: Artifact['artifactType']; 
  data?: Artifact['data'] 
}) {
  if (!artifactType || artifactType === 'text' || !data) {
    return null;
  }

  if (artifactType === 'table') {
    return <TableView columns={data.columns} rows={data.rows} highlights={data.highlights} />;
  }

  if (artifactType === 'chart') {
    return <ChartView chartData={data.chartData} chartType={data.chartType} />;
  }

  if (artifactType === 'topic-list') {
    return <TopicListView topics={data.topics} />;
  }

  if (artifactType === 'video-script') {
    return <VideoScriptView scenes={data.scenes} />;
  }

  if (artifactType === 'media-upload') {
    return <MediaUploadView uploadItems={data.uploadItems} />;
  }

  if (artifactType === 'video-preview') {
    return <VideoPreviewView duration={data.duration} progress={data.progress} status={data.status} />;
  }

  if (artifactType === 'publish-plan') {
    return <PublishPlanView schedule={data.schedule} />;
  }

  if (artifactType === 'diagram') {
    return <DiagramView diagram={data.diagram} />;
  }

  if (artifactType === 'slide') {
    return <SlideView slideContent={data.slideContent} />;
  }

  if (artifactType === 'persona-card') {
    return <PersonaCardView persona={data.persona} />;
  }

  if (artifactType === 'cover-grid') {
    return <CoverGridView covers={data.covers} />;
  }

  if (artifactType === 'title-ab') {
    return <TitleABView titleOptions={data.titleOptions} />;
  }

  if (artifactType === 'heatmap') {
    return <HeatmapView heatmapData={data.heatmapData} bestSlot={data.bestSlot} />;
  }

  if (artifactType === 'prediction') {
    return <PredictionView predictions={data.predictions} confidence={data.confidence} />;
  }

  return null;
}

// 表格视图
function TableView({ 
  columns, 
  rows, 
  highlights 
}: { 
  columns?: string[]; 
  rows?: (string | number)[][];
  highlights?: number[];
}) {
  if (!columns || !rows) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-bg-panel">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-line bg-bg-sunken/50">
            {columns.map((col, i) => (
              <th key={i} className="px-2.5 py-2 text-left font-medium text-ink-2">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr 
              key={i} 
              className={cn(
                'border-b border-line last:border-0',
                highlights?.includes(i) && 'bg-analyst-light/40'
              )}
            >
              {row.map((cell, j) => (
                <td key={j} className="px-2.5 py-2 text-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 图表视图（柱状图）
function ChartView({ 
  chartData, 
  chartType = 'bar' 
}: { 
  chartData?: { label: string; value: number; highlight?: boolean }[];
  chartType?: 'bar' | 'line' | 'pie';
}) {
  if (!chartData || chartData.length === 0) return null;

  const maxValue = Math.max(...chartData.map(d => d.value));

  return (
    <div className="bg-bg-panel rounded-lg border border-line p-3">
      <div className="flex items-end gap-2 h-32">
        {chartData.map((item, i) => {
          const heightPercent = (item.value / maxValue) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <span className="text-[10px] font-mono text-ink-2 font-medium">
                {item.value}
              </span>
              <div 
                className={cn(
                  'w-full rounded-t transition-all',
                  item.highlight ? 'bg-analyst' : 'bg-analyst/50'
                )}
                style={{ height: `${heightPercent}%`, minHeight: '4px' }}
              />
              <span className="text-[10px] text-ink-3 text-center">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 选题列表视图
function TopicListView({ 
  topics 
}: { 
  topics?: { title: string; reason: string; score: number; tags?: string[] }[] 
}) {
  if (!topics) return null;

  return (
    <div className="space-y-2">
      {topics.map((topic, i) => (
        <div 
          key={i} 
          className="bg-bg-panel rounded-lg border border-line p-2.5 hover:border-ink-4 transition-colors cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-[10px] font-mono text-ink-4 flex-shrink-0">
                0{i + 1}
              </span>
              <span className="text-xs font-medium text-ink truncate">
                {topic.title}
              </span>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <span className="text-[10px] font-mono text-planner font-semibold">
                {topic.score}
              </span>
              <span className="text-[10px] text-ink-4">分</span>
            </div>
          </div>
          <p className="text-[10px] text-ink-3 mb-1.5 leading-relaxed">
            {topic.reason}
          </p>
          {topic.tags && (
            <div className="flex gap-1">
              {topic.tags.map((tag, j) => (
                <span 
                  key={j} 
                  className="px-1.5 py-0.5 bg-bg-sunken text-[10px] text-ink-3 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// 视频脚本视图（分镜）
function VideoScriptView({ 
  scenes 
}: { 
  scenes?: { id: number; duration: string; visual: string; voice: string; bgm?: string }[] 
}) {
  if (!scenes) return null;

  return (
    <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
      {scenes.map((scene) => (
        <div key={scene.id} className="bg-bg-panel rounded-lg border border-line overflow-hidden">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-bg-sunken/50 border-b border-line">
            <span className="w-5 h-5 rounded bg-writer text-white flex items-center justify-center text-[10px] font-mono font-semibold">
              {scene.id}
            </span>
            <span className="text-[10px] font-mono text-ink-2">{scene.duration}</span>
            {scene.bgm && (
              <span className="ml-auto text-[10px] text-ink-3 italic">&#9834; {scene.bgm}</span>
            )}
          </div>
          <div className="p-2.5 space-y-1">
            <div className="flex gap-1.5">
              <span className="text-[10px] text-ink-4 font-mono flex-shrink-0 mt-0.5">画面</span>
              <p className="text-xs text-ink leading-relaxed">{scene.visual}</p>
            </div>
            <div className="flex gap-1.5">
              <span className="text-[10px] text-ink-4 font-mono flex-shrink-0 mt-0.5">台词</span>
              <p className="text-xs text-ink-2 leading-relaxed italic">&ldquo;{scene.voice}&rdquo;</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 素材上传视图
function MediaUploadView({ 
  uploadItems 
}: { 
  uploadItems?: { name: string; type: 'video' | 'image' | 'audio'; status: 'waiting' | 'done' }[] 
}) {
  if (!uploadItems) return null;

  const doneCount = uploadItems.filter(item => item.status === 'done').length;
  const total = uploadItems.length;
  const progress = (doneCount / total) * 100;

  const typeIcon = (type: string) => {
    if (type === 'video') return '▶';
    if (type === 'image') return '▦';
    return '♪';
  };

  return (
    <div className="space-y-2">
      {/* 进度条 */}
      <div className="bg-bg-panel rounded-lg border border-line p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-ink-2">上传进度</span>
          <span className="text-xs font-mono text-ink font-medium">
            {doneCount} / {total}
          </span>
        </div>
        <div className="h-1.5 bg-bg-sunken rounded-full overflow-hidden">
          <div 
            className="h-full bg-active rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 素材列表 */}
      <div className="space-y-1">
        {uploadItems.map((item, i) => (
          <div 
            key={i} 
            className="flex items-center gap-2 px-2.5 py-1.5 bg-bg-panel rounded-lg border border-line"
          >
            <span className="text-writer font-mono text-xs flex-shrink-0 w-4">
              {typeIcon(item.type)}
            </span>
            <span className="text-xs text-ink flex-1 truncate">{item.name}</span>
            {item.status === 'done' ? (
              <span className="text-[10px] text-active font-medium flex-shrink-0">已上传</span>
            ) : (
              <button className="text-[10px] text-ink px-2 py-0.5 bg-bg-sunken rounded hover:bg-ink hover:text-white transition-colors flex-shrink-0">
                上传
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 视频预览视图
function VideoPreviewView({ 
  duration, 
  progress, 
  status 
}: { 
  duration?: string; 
  progress?: number; 
  status?: 'rendering' | 'done' 
}) {
  return (
    <div className="bg-bg-panel rounded-lg border border-line overflow-hidden">
      {/* 视频预览区 */}
      <div className="relative aspect-video bg-gradient-to-br from-ink via-ink-2 to-ink flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <button className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-ink ml-0.5" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          <span className="text-[10px] font-mono text-white bg-ink/60 px-1.5 py-0.5 rounded">
            {duration || '00:00'}
          </span>
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded",
            status === 'done' 
              ? "bg-active/80 text-white" 
              : "bg-busy/80 text-white"
          )}>
            {status === 'done' ? '已完成' : '渲染中'}
          </span>
        </div>
      </div>

      {/* 渲染进度 */}
      {status === 'rendering' && progress !== undefined && (
        <div className="px-3 py-2 border-t border-line">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-bg-sunken rounded-full overflow-hidden">
              <div 
                className="h-full bg-busy rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-ink-2">{progress}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// 发布计划视图
function PublishPlanView({ 
  schedule 
}: { 
  schedule?: { time: string; platform: string; hashtags: string[] }[] 
}) {
  if (!schedule) return null;

  return (
    <div className="space-y-2">
      {schedule.map((item, i) => (
        <div key={i} className="bg-bg-panel rounded-lg border border-line p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-distributor" />
              <span className="text-xs font-medium text-ink">{item.platform}</span>
            </div>
            <span className="text-[10px] font-mono text-ink-3">{item.time}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {item.hashtags.map((tag, j) => (
              <span 
                key={j} 
                className="text-[10px] text-distributor bg-distributor-light px-1.5 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// 架构图视图（简单的层级结构）
function DiagramView({ 
  diagram 
}: { 
  diagram?: { layers: { name: string; items: string[] }[] } 
}) {
  if (!diagram) return null;

  const layerColors = ['bg-analyst-light', 'bg-planner-light', 'bg-writer-light', 'bg-monitor-light'];
  const layerBorders = ['border-analyst/30', 'border-planner/30', 'border-writer/30', 'border-monitor/30'];

  return (
    <div className="space-y-1.5">
      {diagram.layers.map((layer, i) => (
        <div 
          key={i} 
          className={cn(
            'rounded-lg border p-2',
            layerColors[i % 4],
            layerBorders[i % 4]
          )}
        >
          <div className="text-[10px] font-medium text-ink-2 mb-1.5 font-mono">
            {layer.name}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {layer.items.map((item, j) => (
              <span 
                key={j} 
                className="text-xs px-2 py-1 bg-bg-panel rounded border border-line text-ink"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Slide 视图（PPT 页）
function SlideView({ 
  slideContent 
}: { 
  slideContent?: { 
    headline: string; 
    subheadline?: string; 
    bullets?: string[];
    stats?: { label: string; value: string }[];
  }
}) {
  if (!slideContent) return null;

  return (
    <div className="bg-gradient-to-br from-bg-panel to-bg-sunken rounded-lg border border-line aspect-video flex flex-col justify-center p-5">
      <h3 className="font-serif text-lg font-bold text-ink mb-1">
        {slideContent.headline}
      </h3>
      {slideContent.subheadline && (
        <p className="text-xs text-ink-2 mb-3 leading-relaxed">
          {slideContent.subheadline}
        </p>
      )}
      {slideContent.stats && (
        <div className="flex items-center gap-3 mt-2 pt-3 border-t border-line">
          {slideContent.stats.map((stat, i) => (
            <div key={i} className="flex-1">
              <div className="text-lg font-mono font-bold text-ink">
                {stat.value}
              </div>
              <div className="text-[10px] text-ink-3 mt-0.5">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}
      {slideContent.bullets && (
        <ul className="space-y-1 mt-2">
          {slideContent.bullets.map((b, i) => (
            <li key={i} className="text-xs text-ink-2 flex gap-2">
              <span className="text-ink-4">&bull;</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 人设定位卡
function PersonaCardView({ 
  persona 
}: { 
  persona?: {
    avatar: string;
    name: string;
    bio: string;
    track: string;
    tags: string[];
    tone: string;
  }
}) {
  if (!persona) return null;

  return (
    <div className="bg-bg-panel rounded-lg border border-line overflow-hidden">
      {/* 头像 + 基本信息 */}
      <div className="flex items-start gap-3 p-3 border-b border-line">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-planner/20 to-writer/20 flex items-center justify-center text-2xl">
          <span className="text-planner">&#128100;</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-ink">{persona.name}</span>
            <span className="px-1.5 py-0.5 bg-planner-light text-planner text-[10px] rounded">
              {persona.track}
            </span>
          </div>
          <p className="text-xs text-ink-2 leading-relaxed">{persona.bio}</p>
        </div>
      </div>
      
      {/* 标签 */}
      <div className="px-3 py-2 border-b border-line">
        <div className="flex flex-wrap gap-1.5">
          {persona.tags.map((tag, i) => (
            <span 
              key={i} 
              className="px-2 py-1 bg-bg-sunken text-xs text-ink-2 rounded-md"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
      
      {/* 调性 */}
      <div className="px-3 py-2 flex items-center gap-2">
        <span className="text-[10px] text-ink-4">内容调性</span>
        <span className="text-xs text-ink font-medium">{persona.tone}</span>
      </div>
    </div>
  );
}

// 封面九宫格
function CoverGridView({ 
  covers 
}: { 
  covers?: {
    id: number;
    style: string;
    description: string;
    score: number;
    recommended?: boolean;
  }[]
}) {
  if (!covers) return null;

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {covers.map((cover) => (
        <div 
          key={cover.id} 
          className={cn(
            'relative bg-bg-panel rounded-lg border overflow-hidden cursor-pointer group transition-all',
            cover.recommended 
              ? 'border-planner ring-1 ring-planner/30' 
              : 'border-line hover:border-ink-4'
          )}
        >
          {/* 封面预览区 */}
          <div className="aspect-[3/4] bg-gradient-to-br from-bg-sunken to-bg-panel flex items-center justify-center p-2">
            <span className="text-[10px] text-ink-3 text-center leading-relaxed">
              {cover.style}
            </span>
          </div>
          
          {/* 推荐标记 */}
          {cover.recommended && (
            <div className="absolute top-1 right-1 px-1 py-0.5 bg-planner text-white text-[8px] rounded font-medium">
              推荐
            </div>
          )}
          
          {/* 分数 */}
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-ink/70 text-white text-[10px] font-mono rounded">
            {cover.score}
          </div>
          
          {/* Hover 说明 */}
          <div className="absolute inset-0 bg-ink/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
            <p className="text-[10px] text-white text-center leading-relaxed">
              {cover.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// 标题 AB 测试
function TitleABView({ 
  titleOptions 
}: { 
  titleOptions?: {
    version: 'A' | 'B' | 'C';
    title: string;
    predictedCTR: number;
    reason: string;
    tags: string[];
  }[]
}) {
  if (!titleOptions) return null;

  const versionColors = {
    'A': 'bg-analyst text-white',
    'B': 'bg-planner text-white',
    'C': 'bg-writer text-white',
  };

  return (
    <div className="space-y-2">
      {titleOptions.map((opt, i) => (
        <div 
          key={i} 
          className={cn(
            'bg-bg-panel rounded-lg border overflow-hidden',
            i === 0 ? 'border-analyst' : 'border-line'
          )}
        >
          {/* 标题 + 版本 */}
          <div className="p-2.5 border-b border-line">
            <div className="flex items-start gap-2">
              <span className={cn(
                'flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold',
                versionColors[opt.version]
              )}>
                {opt.version}
              </span>
              <p className="text-sm text-ink font-medium leading-relaxed flex-1">
                {opt.title}
              </p>
            </div>
          </div>
          
          {/* 预测 CTR + 原因 */}
          <div className="px-2.5 py-2 flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-mono font-bold text-ink">
                {opt.predictedCTR}
              </span>
              <span className="text-[10px] text-ink-4">% CTR</span>
            </div>
            <div className="flex-1 text-[10px] text-ink-3 leading-relaxed">
              {opt.reason}
            </div>
          </div>
          
          {/* 标签 */}
          <div className="px-2.5 pb-2 flex gap-1">
            {opt.tags.map((tag, j) => (
              <span 
                key={j} 
                className="px-1.5 py-0.5 bg-bg-sunken text-[10px] text-ink-3 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// 发布热力图
function HeatmapView({ 
  heatmapData,
  bestSlot
}: { 
  heatmapData?: { hour: number; day: string; value: number }[];
  bestSlot?: { day: string; hour: number };
}) {
  if (!heatmapData) return null;

  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const hours = [7, 12, 20];

  const getValue = (day: string, hour: number) => {
    const item = heatmapData.find(d => d.day === day && d.hour === hour);
    return item?.value || 0;
  };

  const getColor = (value: number) => {
    if (value >= 90) return 'bg-distributor';
    if (value >= 70) return 'bg-distributor/70';
    if (value >= 50) return 'bg-distributor/40';
    return 'bg-distributor/20';
  };

  return (
    <div className="bg-bg-panel rounded-lg border border-line p-3">
      {/* 图例 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-ink-3">深色 = 高流量时段</span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-ink-4">低</span>
          <div className="flex gap-0.5">
            <span className="w-3 h-2 bg-distributor/20 rounded-sm" />
            <span className="w-3 h-2 bg-distributor/40 rounded-sm" />
            <span className="w-3 h-2 bg-distributor/70 rounded-sm" />
            <span className="w-3 h-2 bg-distributor rounded-sm" />
          </div>
          <span className="text-[10px] text-ink-4">高</span>
        </div>
      </div>

      {/* 热力图网格 */}
      <div className="overflow-x-auto">
        <div className="flex gap-1">
          {/* 时间列 */}
          <div className="flex flex-col gap-1 pt-5">
            {hours.map(h => (
              <div key={h} className="h-6 flex items-center text-[10px] text-ink-4 font-mono">
                {h}:00
              </div>
            ))}
          </div>
          
          {/* 数据列 */}
          {days.map(day => (
            <div key={day} className="flex flex-col gap-1 items-center">
              <span className="text-[10px] text-ink-3 h-5 flex items-center">{day}</span>
              {hours.map(hour => {
                const value = getValue(day, hour);
                const isBest = bestSlot?.day === day && bestSlot?.hour === hour;
                return (
                  <div 
                    key={hour}
                    className={cn(
                      'w-8 h-6 rounded flex items-center justify-center text-[10px] font-mono transition-all',
                      getColor(value),
                      isBest && 'ring-2 ring-ink ring-offset-1'
                    )}
                  >
                    {isBest && <span className="text-white font-bold">!</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 最佳时段提示 */}
      {bestSlot && (
        <div className="mt-3 pt-2 border-t border-line flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-distributor text-white flex items-center justify-center text-[10px] font-bold">!</span>
          <span className="text-xs text-ink">
            最佳发布时间：<strong>{bestSlot.day} {bestSlot.hour}:00</strong>
          </span>
        </div>
      )}
    </div>
  );
}

// 数据预测卡
function PredictionView({ 
  predictions,
  confidence
}: { 
  predictions?: { metric: string; min: number; max: number; expected: number; unit: string }[];
  confidence?: number;
}) {
  if (!predictions) return null;

  return (
    <div className="bg-bg-panel rounded-lg border border-line overflow-hidden">
      {/* 预测指标 */}
      <div className="divide-y divide-line">
        {predictions.map((pred, i) => {
          const range = pred.max - pred.min;
          const expectedPos = range > 0 ? ((pred.expected - pred.min) / range) * 100 : 50;
          
          return (
            <div key={i} className="px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-ink-2">{pred.metric}</span>
                <span className="text-sm font-mono font-bold text-ink">
                  {pred.expected.toLocaleString()}{pred.unit}
                </span>
              </div>
              
              {/* 范围条 */}
              <div className="relative h-2 bg-bg-sunken rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-analyst/30 rounded-full"
                  style={{ width: '100%' }}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-analyst rounded-full shadow-sm border-2 border-white"
                  style={{ left: `calc(${expectedPos}% - 5px)` }}
                />
              </div>
              
              {/* 范围标签 */}
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-ink-4 font-mono">
                  {pred.min.toLocaleString()}{pred.unit}
                </span>
                <span className="text-[10px] text-ink-4 font-mono">
                  {pred.max.toLocaleString()}{pred.unit}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 置信度 */}
      {confidence !== undefined && (
        <div className="px-3 py-2 bg-bg-sunken/50 border-t border-line flex items-center gap-2">
          <span className="text-[10px] text-ink-4">模型置信度</span>
          <div className="flex-1 h-1.5 bg-bg-sunken rounded-full overflow-hidden">
            <div 
              className="h-full bg-analyst rounded-full"
              style={{ width: `${confidence}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-ink font-medium">{confidence}%</span>
        </div>
      )}
    </div>
  );
}

function Composer() {
  const [value, setValue] = useState('');
  const [showMentionSelector, setShowMentionSelector] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage } = useAppStore();

  const handleSend = () => {
    if (!value.trim()) return;
    sendMessage(value.trim());
    setValue('');
    setShowMentionSelector(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 如果提及选择器打开，不处理 Enter
    if (showMentionSelector && (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      return; // 让 MentionSelector 处理
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    
    if (e.key === 'Escape') {
      setShowMentionSelector(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    setValue(newValue);

    // 检测 @ 触发
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);
    
    if (atMatch) {
      setShowMentionSelector(true);
      setMentionQuery(atMatch[1]);
      setMentionStartPos(cursorPos - atMatch[0].length);
    } else {
      setShowMentionSelector(false);
      setMentionQuery('');
    }
  };

  const handleMentionSelect = (roleId: RoleId, displayName: string) => {
    // 替换 @xxx 为 @角色名
    const beforeMention = value.slice(0, mentionStartPos);
    const afterMention = value.slice(mentionStartPos + mentionQuery.length + 1);
    const newValue = `${beforeMention}@${displayName} ${afterMention}`;
    setValue(newValue);
    setShowMentionSelector(false);
    
    // 聚焦回输入框
    setTimeout(() => {
      textareaRef.current?.focus();
      const newPos = mentionStartPos + displayName.length + 2;
      textareaRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  };

  return (
    <div className="p-4 border-t border-line bg-bg-panel">
      <div className="relative bg-bg-sunken rounded-xl border border-line focus-within:border-ink-4 focus-within:shadow-sm transition-all">
        {/* @ 提及选择器 */}
        <MentionSelector
          isOpen={showMentionSelector}
          searchQuery={mentionQuery}
          onSelect={handleMentionSelect}
          onClose={() => setShowMentionSelector(false)}
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="给团队派活，或输入 @ 召唤员工..."
          className="w-full px-4 py-3 bg-transparent text-sm text-ink placeholder:text-ink-4 resize-none focus:outline-none"
          rows={2}
        />
        
        {/* 工具栏 */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-line">
          <div className="flex items-center gap-1">
            <button className="p-1.5 hover:bg-bg-hover rounded-md transition-colors" title="知识库">
              <BookOpen className="w-4 h-4 text-ink-3" />
            </button>
            <button className="p-1.5 hover:bg-bg-hover rounded-md transition-colors" title="上传">
              <Paperclip className="w-4 h-4 text-ink-3" />
            </button>
            <button className="p-1.5 hover:bg-bg-hover rounded-md transition-colors" title="成果库">
              <PenTool className="w-4 h-4 text-ink-3" />
            </button>
          </div>
          <button 
            onClick={handleSend}
            disabled={!value.trim()}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors",
              value.trim() 
                ? "bg-ink text-white hover:bg-ink-2" 
                : "bg-ink-4 text-ink-3 cursor-not-allowed"
            )}
          >
            <Send className="w-3.5 h-3.5" />
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

// 格式化 @ 提及 - 支持多种角色名称匹配
function formatMentions(text: string): React.ReactNode {
  // 匹配 @角色名 的模式
  const mentionPattern = /(@(?:首席助理|分析员|策划员|创作员|播报员|观测员|代码员|前端员|测试员|老板|理|析|策|创|播|观|码|端|测))/g;
  const parts = text.split(mentionPattern);

  const roleNameMap: Record<string, RoleId> = {
    '首席助理': 'chief',
    '分析员': 'analyst',
    '策划员': 'planner',
    '创作员': 'writer',
    '播报员': 'distributor',
    '观测员': 'monitor',
    '代码员': 'coder',
    '前端员': 'frontend',
    '测试员': 'tester',
    '理': 'chief',
    '析': 'analyst',
    '策': 'planner',
    '创': 'writer',
    '播': 'distributor',
    '观': 'monitor',
    '码': 'coder',
    '端': 'frontend',
    '测': 'tester',
  };
  
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const roleName = part.slice(1);
      const roleId = roleNameMap[roleName];
      
      if (roleId) {
        const colorConfig = ROLE_COLORS[roleId];
        return (
          <span 
            key={i} 
            className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium mx-0.5",
              colorConfig.light
            )}
          >
            <span className={cn("w-3 h-3 rounded-sm flex items-center justify-center text-[8px]", colorConfig.main)}>
              {ROLES[roleId].initial}
            </span>
            {part}
          </span>
        );
      }
      
      // @老板 特殊处理
      if (roleName === '老板') {
        return (
          <span 
            key={i} 
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium mx-0.5 bg-ink/10 text-ink"
          >
            {part}
          </span>
        );
      }
    }
    return part;
  });
}
