/**
 * 输入框附件模型 —— 文件 / 引用产出（artifact）
 *
 * 策略：
 *   - 文件（任意类型）：上传到后端 server/uploads/ 下，prompt 里只放"路径"，
 *     让 Claude Code 的 Read 工具真去读（Read 支持文本/图片/PDF 等）。
 *   - Artifact：内容 inline 拼进 prompt（本来就是文本）。
 *
 * 好处：不需要前端解析 PDF/图片，二进制走文件系统，agent 用它自己的
 * 工具链看。上传走 multipart，后端只负责存盘 + 返回绝对路径。
 */

export type Attachment =
  | {
      kind: 'file';
      /** 原始文件名（给用户看） */
      name: string;
      size: number;
      /** mime，仅用于展示 */
      mime?: string;
      /** 后端存盘后的**绝对路径** —— 给 Claude Code Read 工具用 */
      filePath: string;
    }
  | {
      kind: 'artifact';
      /** manifest id，用作去重键 */
      id: string;
      title: string;
      agentName: string;
      /** 从后端拉下来的全文 */
      content: string;
    };

const API_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_AGENT_SERVER_URL) || '';

const USE_REAL_BACKEND = API_BASE.length > 0;

/** 把任意类型的文件上传到后端，返回 Attachment；失败返回 null。
 *  Mock 模式（部署 demo）下不真实落盘，返回伪路径让 UI 可继续走。 */
export async function uploadFile(
  sessionId: string,
  file: File,
): Promise<Attachment | null> {
  if (!USE_REAL_BACKEND) {
    return {
      kind: 'file',
      name: file.name,
      size: file.size,
      mime: file.type,
      filePath: `mock-uploads/${sessionId}/${file.name}`,
    };
  }
  const form = new FormData();
  form.append('file', file);
  form.append('session_id', sessionId);
  try {
    const resp = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: form,
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.path) return null;
    return {
      kind: 'file',
      name: data.name ?? file.name,
      size: data.size ?? file.size,
      mime: data.mime ?? file.type,
      filePath: data.path,
    };
  } catch {
    return null;
  }
}

/**
 * 拼成前置段，插在用户消息最前。
 *   - file 类型：只给路径 + 提示 agent 用 Read 工具
 *   - artifact 类型：直接 inline 全文（本来就是文本）
 */
export function buildAttachmentPrefix(attachments: Attachment[]): string {
  if (!attachments.length) return '';
  const blocks = attachments.map((a) => {
    if (a.kind === 'file') {
      return (
        `### 文件：${a.name}${a.mime ? `（${a.mime}）` : ''}\n` +
        `- 本地路径：${a.filePath}\n` +
        `- 请**必须**用 Read 工具读这个文件的完整内容后再回复。Read 支持文本、图片、PDF 等常见类型。`
      );
    }
    return `### 引用产出：${a.title}（来自 @${a.agentName}）\n\n\`\`\`\n${a.content}\n\`\`\``;
  });
  return (
    '【用户附上的参考材料，请当作上下文来看，不要照抄】\n\n' +
    blocks.join('\n\n') +
    '\n\n---\n\n【以下是用户的真正消息】\n\n'
  );
}
