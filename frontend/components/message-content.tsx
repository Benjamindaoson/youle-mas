'use client';

/**
 * Agent 消息的 Markdown 渲染器。
 *
 * 除了标准 markdown，还识别 @mention：
 *   遇到 `@分析员` / `@析` / `@analyst` 等已知员工名 → 渲染成 MentionTag
 *   （蓝胶囊 + 小头像），跟未知的 `@张三` 这种普通文本区分开。
 *
 * 设计原则：
 * - 专注"消息气泡"语境 —— 元素间距紧凑，大小适配气泡
 * - 不注入外部 CSS，用 tailwind 任意选择器（[&_…]）把样式锁在本组件
 * - 用户消息（右侧深色气泡）不走这里，保持纯文本
 * - 依赖最小：react-markdown + remark-gfm
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { RoleId } from '@/lib/types';
import { MentionTag, ROLE_DISPLAY_NAMES } from '@/components/mention-selector';

interface Props {
  content: string;
  className?: string;
}

/* ---------------------------- @mention 预处理 ---------------------------- */

// 所有可识别的员工称呼 → roleId：全名 / 单字 / 英文 id
const MENTION_NAME_TO_ROLE: Record<string, RoleId> = {
  // 全名
  首席助理: 'chief',
  分析员: 'analyst',
  策划员: 'planner',
  创作员: 'writer',
  播报员: 'distributor',
  观测员: 'monitor',
  代码员: 'coder',
  前端员: 'frontend',
  测试员: 'tester',
  // 单字
  理: 'chief',
  析: 'analyst',
  策: 'planner',
  创: 'writer',
  播: 'distributor',
  观: 'monitor',
  工: 'coder',
  端: 'frontend',
  测: 'tester',
  // 英文 id
  chief: 'chief',
  analyst: 'analyst',
  planner: 'planner',
  writer: 'writer',
  distributor: 'distributor',
  monitor: 'monitor',
  coder: 'coder',
  frontend: 'frontend',
  tester: 'tester',
};

// 为了正则按"最长匹配优先"，名字按长度降序
const MENTION_NAMES_SORTED = Object.keys(MENTION_NAME_TO_ROLE).sort(
  (a, b) => b.length - a.length,
);
const MENTION_ALTERNATION = MENTION_NAMES_SORTED.map((n) =>
  n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
).join('|');
// 只匹配 @<已知名>；未匹配的 `@XXX` 原样保留为普通文本
const MENTION_RE = new RegExp(`@(${MENTION_ALTERNATION})`, 'g');

const PLACEHOLDER_PREFIX = 'yl-mention:';

/** 把 `@<已知名>` 替换成 markdown link `[@<已知名>](yl-mention:<roleId>)`，
 *  交给 react-markdown 解析，随后在 components.a 里拦截成 MentionTag。 */
function preprocessMentions(content: string): string {
  return content.replace(MENTION_RE, (match, name: string) => {
    const roleId = MENTION_NAME_TO_ROLE[name];
    if (!roleId) return match;
    // 用 link 语法规避 html 转义 + 兼容 skipHtml
    return `[${match}](${PLACEHOLDER_PREFIX}${roleId})`;
  });
}

/* ---------------------------- 组件 ---------------------------- */

export function MessageContent({ content, className }: Props) {
  if (!content) return null;
  const processed = preprocessMentions(content);

  return (
    <div
      className={cn(
        'text-sm text-ink leading-relaxed break-words',
        // —— 段落与标题 ——
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        '[&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-2 [&_h1]:mb-1',
        '[&_h2]:text-sm  [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1',
        '[&_h3]:text-sm  [&_h3]:font-medium  [&_h3]:mt-1.5 [&_h3]:mb-0.5',
        '[&_h4]:text-sm  [&_h4]:font-medium  [&_h4]:mt-1 [&_h4]:mb-0.5',
        '[&_p]:my-1.5',
        // —— 强调 / 行内 ——
        '[&_strong]:font-semibold',
        '[&_em]:italic',
        '[&_del]:line-through [&_del]:text-ink-3',
        '[&_code]:px-1 [&_code]:py-0.5 [&_code]:bg-bg-sunken [&_code]:rounded [&_code]:text-[12px] [&_code]:font-mono',
        // —— 代码块 ——
        '[&_pre]:bg-bg-sunken [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:my-1.5 [&_pre]:overflow-x-auto',
        '[&_pre>code]:bg-transparent [&_pre>code]:p-0 [&_pre>code]:text-[12px]',
        // —— 列表 ——
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5',
        '[&_li]:my-0.5',
        '[&_li>p]:my-0',
        // GFM 任务列表
        '[&_input[type=checkbox]]:mr-1.5 [&_input[type=checkbox]]:align-middle',
        // —— 引用 ——
        '[&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-2 [&_blockquote]:text-ink-3 [&_blockquote]:my-1.5',
        // —— 链接 / 分隔线 ——
        '[&_a]:text-active [&_a]:underline [&_a]:decoration-active/40 hover:[&_a]:decoration-active',
        '[&_hr]:my-2 [&_hr]:border-line',
        // —— 表格（GFM 提供） ——
        '[&_table]:border-collapse [&_table]:my-1.5 [&_table]:text-xs [&_table]:block [&_table]:overflow-x-auto [&_table]:max-w-full',
        '[&_th]:border [&_th]:border-line [&_th]:px-2 [&_th]:py-1 [&_th]:bg-bg-sunken [&_th]:font-medium [&_th]:text-left',
        '[&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_td]:align-top',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ node, href, children, ...rest }) => {
            // @mention 占位链接：渲染成 MentionTag
            if (typeof href === 'string' && href.startsWith(PLACEHOLDER_PREFIX)) {
              const roleId = href.slice(PLACEHOLDER_PREFIX.length) as RoleId;
              if (roleId in ROLE_DISPLAY_NAMES) {
                return <MentionTag roleId={roleId} />;
              }
            }
            // 普通外链新窗口打开
            return (
              <a href={href} {...rest} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
