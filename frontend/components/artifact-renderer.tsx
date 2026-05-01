'use client';

/**
 * Artifact 渲染器 —— 按 artifact_type 分发到不同预览组件。
 *
 * 文本类（content 可用）：
 *   markdown → MessageContent（react-markdown + gfm）
 *   code     → 单色 fenced pre
 *   json     → pretty JSON，失败 fallback 到 code
 *   csv      → 表格（极简 CSV 解析）
 *   html     → 沙箱 iframe
 *
 * 二进制类（走 downloadUrl）：
 *   image       → <img src={downloadUrl}>
 *   pdf         → <iframe src={downloadUrl}>（大多浏览器原生预览）
 *   spreadsheet → 下载卡（"用 Excel 打开"）
 *   document    → 下载卡（"用 Word 打开"）
 *   other       → 下载卡（兜底）
 *
 * downloadUrl 未提供时，二进制类会回退成 Markdown 渲染（用于本地文件或测试）。
 * 扩展新类型：只需在 switch 加一条 case，不必改 group-dashboard。
 */

import { useMemo } from 'react';
import { Download, FileSpreadsheet, FileText as FileTextIcon, FileType2, ExternalLink } from 'lucide-react';
import type { ArtifactTypeId } from '@/lib/api';
import { MessageContent } from '@/components/message-content';

interface Props {
  /** artifact 的文本内容（文本类必需；二进制类传空字符串） */
  content: string;
  /** artifact 类型（markdown / code / html / ...）。不传走 markdown */
  artifactType?: ArtifactTypeId;
  /** 可选：文件名，用于 CodeView 语言检测 + 下载卡标题 */
  filename?: string;
  /** 二进制 artifact 的下载 URL（后端 /download 端点）。
   *  image/pdf/spreadsheet/document 必须提供，否则降级成 markdown 渲染。 */
  downloadUrl?: string;
  /** 可选：文件字节数，下载卡展示用 */
  size?: number;
}

export function ArtifactRenderer({
  content, artifactType, filename, downloadUrl, size,
}: Props) {
  const type = artifactType ?? 'markdown';

  switch (type) {
    case 'markdown':
      return <MessageContent content={content} />;

    case 'code':
      return <CodeView content={content} filename={filename} />;

    case 'json':
      return <JsonView content={content} />;

    case 'csv':
      return <CsvView content={content} />;

    case 'html':
      return <HtmlView content={content} />;

    case 'image':
      return downloadUrl
        ? <ImageView url={downloadUrl} filename={filename} size={size} />
        : <MessageContent content={content} />;

    case 'pdf':
      return downloadUrl
        ? <PdfView url={downloadUrl} filename={filename} size={size} />
        : <MessageContent content={content} />;

    case 'spreadsheet':
      return downloadUrl
        ? <BinaryDownloadCard
            url={downloadUrl} filename={filename} size={size}
            icon={<FileSpreadsheet className="w-8 h-8" />}
            hint="用 Excel / WPS / Numbers 打开"
          />
        : <MessageContent content={content} />;

    case 'document':
      return downloadUrl
        ? <BinaryDownloadCard
            url={downloadUrl} filename={filename} size={size}
            icon={<FileTextIcon className="w-8 h-8" />}
            hint="用 Word / WPS / Pages 打开"
          />
        : <MessageContent content={content} />;

    case 'other':
    default:
      // 未知二进制：有 URL 就给下载卡，没有就走 markdown
      return downloadUrl
        ? <BinaryDownloadCard
            url={downloadUrl} filename={filename} size={size}
            icon={<FileType2 className="w-8 h-8" />}
            hint="按文件类型选择合适的应用打开"
          />
        : <MessageContent content={content} />;
  }
}

/* ---------------------------- 子渲染器 ---------------------------- */

function CodeView({ content, filename }: { content: string; filename?: string }) {
  const lang = filename?.split('.').pop()?.toLowerCase() ?? '';
  return (
    <pre className="bg-bg-sunken rounded-md p-3 overflow-x-auto text-[12px] leading-relaxed">
      {lang && (
        <div className="text-[10px] text-ink-4 mb-2 uppercase tracking-wide">
          {lang}
        </div>
      )}
      <code className="font-mono text-ink whitespace-pre">{content}</code>
    </pre>
  );
}

function JsonView({ content }: { content: string }) {
  const pretty = useMemo(() => {
    try {
      const obj = JSON.parse(content);
      return JSON.stringify(obj, null, 2);
    } catch {
      return null;
    }
  }, [content]);

  if (pretty === null) {
    // 不是合法 JSON → 走 code view 展示原文
    return <CodeView content={content} filename="file.json" />;
  }
  return (
    <pre className="bg-bg-sunken rounded-md p-3 overflow-x-auto text-[12px] leading-relaxed">
      <code className="font-mono text-ink whitespace-pre">{pretty}</code>
    </pre>
  );
}

function CsvView({ content }: { content: string }) {
  const rows = useMemo(() => parseCsv(content), [content]);
  if (!rows.length) {
    return <p className="text-sm text-ink-3">（空 CSV）</p>;
  }
  const [head, ...body] = rows;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className="border border-line bg-bg-sunken px-2 py-1 font-medium text-left"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="border border-line px-2 py-1 align-top"
                >
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

/** 极简 CSV 解析：支持逗号分隔 + 双引号转义。不处理嵌套换行等边缘情况。 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuote = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

function HtmlView({ content }: { content: string }) {
  // sandbox="" 表示禁用所有能力（脚本/表单/弹窗），只渲染静态 HTML
  return (
    <iframe
      srcDoc={content}
      sandbox=""
      className="w-full min-h-[60vh] bg-white rounded-md border border-line"
      title="HTML 预览"
    />
  );
}

/* ---------------------------- 二进制渲染器 ---------------------------- */

function ImageView({
  url, filename, size,
}: { url: string; filename?: string; size?: number }) {
  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={filename ?? '图片产出'}
        className="max-w-full max-h-[70vh] rounded-md border border-line bg-bg-sunken"
      />
      <div className="flex items-center gap-2 text-[11px] text-ink-4">
        {filename && <span className="font-mono truncate">{filename}</span>}
        {size !== undefined && <span>· {(size / 1024).toFixed(1)} KB</span>}
        <a
          href={url}
          download={filename}
          className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-bg-hover text-ink-3 hover:text-ink"
        >
          <Download className="w-3 h-3" />
          下载原图
        </a>
      </div>
    </div>
  );
}

function PdfView({
  url, filename, size,
}: { url: string; filename?: string; size?: number }) {
  return (
    <div className="space-y-2">
      <iframe
        src={url}
        className="w-full min-h-[70vh] rounded-md border border-line bg-white"
        title={filename ?? 'PDF 预览'}
      />
      <div className="flex items-center gap-2 text-[11px] text-ink-4">
        {filename && <span className="font-mono truncate">{filename}</span>}
        {size !== undefined && <span>· {(size / 1024).toFixed(1)} KB</span>}
        <a
          href={url}
          download={filename}
          className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-bg-hover text-ink-3 hover:text-ink"
        >
          <Download className="w-3 h-3" />
          下载 PDF
        </a>
      </div>
    </div>
  );
}

function BinaryDownloadCard({
  url, filename, size, icon, hint,
}: {
  url: string;
  filename?: string;
  size?: number;
  icon: React.ReactNode;
  hint: string;
}) {
  return (
    <a
      href={url}
      download={filename}
      className="flex items-center gap-3 px-4 py-3 rounded-lg border border-line bg-bg-sunken/40 hover:bg-bg-sunken hover:border-ink-4 transition-all group"
    >
      <div className="text-ink-3 group-hover:text-ink flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink truncate">
          {filename ?? '未命名产出'}
        </div>
        <div className="text-[11px] text-ink-4 mt-0.5 flex items-center gap-2">
          {size !== undefined && <span>{(size / 1024).toFixed(1)} KB</span>}
          <span>· {hint}</span>
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center gap-1 text-[11px] text-active group-hover:underline">
        <ExternalLink className="w-3 h-3" />
        下载
      </div>
    </a>
  );
}
