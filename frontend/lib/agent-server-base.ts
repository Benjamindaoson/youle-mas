/**
 * 规范化 NEXT_PUBLIC_AGENT_SERVER_URL：
 * - **mock**：既不配 URL、又不要求本地兜底 → 不走真实后端
 * - **同源转发**：浏览器打开本机前端 + 配置的也是本环回后端 → `/api/youle-backend`（绕开 Cursor 等环境下的 Failed to fetch）
 *
 * Rewrites：`next.config.mjs` 把 `/api/youle-backend/*` → `YOULE_BACKEND_INTERNAL_URL`。
 */
const ENV_RAW =
  typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_AGENT_SERVER_URL ?? '').trim() : '';

/** 仅在 pnpm dev 下：未配置则默认连本机 8001，避免忘写 .env 一直 mock。量产构建(NODE_ENV=production)仍可无 env→mock */
const RAW_AGENT =
  ENV_RAW ||
  (typeof process !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_AGENT_MOCK_ONLY !== '1'
    ? 'http://127.0.0.1:8001'
    : '');

const DEV_BROWSER_PROXY_PREFIX = '/api/youle-backend';

function proxyOptOut(): boolean {
  const v = process.env.NEXT_PUBLIC_AGENT_SERVER_PROXY;
  return v === '0' || (typeof v === 'string' && v.toLowerCase() === 'false');
}

/** 与 next.config `YOULE_BACKEND_INTERNAL_URL` 对齐，默认 8001 */
function devBackendListenPort(): string {
  try {
    const internal = process.env.YOULE_BACKEND_INTERNAL_URL ?? '';
    if (internal.includes('://')) {
      const u = new URL(internal);
      return u.port || (u.protocol === 'https:' ? '443' : '80');
    }
  } catch {
    /* ignore */
  }
  return (
    process.env.NEXT_PUBLIC_YOULE_BACKEND_PORT ??
    process.env.YOULE_BACKEND_INTERNAL_PORT ??
    '8001'
  );
}

function frontendIsBrowserLoopback(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

/**
 * **每次发起 fetch 前应调用**：根据当前运行环境决定是否走同源 `/api/youle-backend`。
 * 常量形式在 SSR/客户端分包下容易与浏览器实际 Origin 脱节。
 */
export function getAgentApiBase(): string {
  if (!RAW_AGENT) return '';

  const raw = RAW_AGENT.replace(/\/+$/, '');
  if (raw.startsWith('/')) return raw.replace(/\/+$/, '') || raw;

  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`http://${raw}`);
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    const want = devBackendListenPort();
    const loop =
      url.hostname.toLowerCase() === 'localhost' || url.hostname === '127.0.0.1';
    const portOk = String(port) === String(want);
    const origin = `${url.origin}`.replace(/\/+$/, '');

    if (!proxyOptOut() && loop && portOk && frontendIsBrowserLoopback()) {
      return DEV_BROWSER_PROXY_PREFIX;
    }

    return origin;
  } catch {
    return raw;
  }
}

/** 仅环境变量原始值（未声明则为空）；与「是否有有效后端 base」区分用 USE_REAL_AGENT_BACKEND。 */
export const ENV_NEXT_PUBLIC_AGENT_SERVER_URL = ENV_RAW;

/** 若 RAW_AGENT 非空则走真实 HTTP（含开发默认 localhost:8001） */
export const USE_REAL_AGENT_BACKEND = RAW_AGENT.length > 0;

export const IS_REAL_AGENT_SERVER_BACKEND = USE_REAL_AGENT_BACKEND;
