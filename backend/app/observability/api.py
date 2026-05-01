"""可观测性 API + 内嵌 dashboard。

路由：
  GET  /observability                   → HTML dashboard
  GET  /api/observability/stats         → 全局统计
  GET  /api/observability/runs          → 最近的 thread 列表
  GET  /api/observability/runs/{tid}    → 单个 thread 的 timeline
  GET  /api/observability/nodes         → 节点维度聚合
  GET  /api/observability/metric        → 指标查询（cost / token）
  POST /api/observability/purge         → 清理 N 天前的 trace
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse

router = APIRouter()


def _store(request: Request):
    store = getattr(request.app.state, "trace_store", None)
    if store is None:
        raise HTTPException(503, "trace store not initialized")
    return store


@router.get("/api/observability/stats")
async def stats(request: Request):
    return _store(request).overall_stats()


@router.get("/api/observability/runs")
async def runs(request: Request,
               limit: int = Query(50, ge=1, le=500),
               offset: int = Query(0, ge=0)):
    items = _store(request).list_threads(limit=limit, offset=offset)
    return {"count": len(items), "items": items}


@router.get("/api/observability/runs/{thread_id}")
async def run_timeline(thread_id: str, request: Request):
    store = _store(request)
    return {
        "thread_id": thread_id,
        "timeline": store.thread_timeline(thread_id),
        "metrics": store.thread_metrics(thread_id),
    }


@router.get("/api/observability/nodes")
async def nodes(request: Request):
    return {"items": _store(request).node_breakdown()}


@router.post("/api/observability/purge")
async def purge(request: Request, days: int = Query(7, ge=0, le=365)):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    deleted = _store(request).purge_older_than(cutoff)
    return {"deleted": deleted, "before": cutoff}


_DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Youle · Observability</title>
<style>
  :root {
    --bg: #0b0d12; --panel: #161922; --line: #232734;
    --text: #e6e8ef; --muted: #8b91a3; --accent: #6ea3ff;
    --ok: #4ade80; --err: #f87171; --warn: #fbbf24; --interrupt: #a78bfa;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
  }
  header {
    padding: 14px 22px; border-bottom: 1px solid var(--line);
    display: flex; align-items: center; gap: 16px;
  }
  header h1 { margin: 0; font-size: 16px; font-weight: 600; }
  header .sub { color: var(--muted); font-size: 12px; }
  header .spacer { flex: 1; }
  header button {
    background: var(--panel); color: var(--text); border: 1px solid var(--line);
    padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;
  }
  header button:hover { border-color: var(--accent); }

  .grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
    gap: 12px; padding: 16px 22px;
  }
  .card {
    background: var(--panel); border: 1px solid var(--line);
    border-radius: 8px; padding: 14px;
  }
  .card .label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
  .card .value { font-size: 22px; font-weight: 600; margin-top: 4px; }
  .card .delta { color: var(--muted); font-size: 11px; margin-top: 2px; }

  main { display: grid; grid-template-columns: 360px 1fr; gap: 12px; padding: 0 22px 22px; }
  .panel {
    background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
    overflow: hidden; min-height: 420px;
  }
  .panel h2 {
    margin: 0; padding: 10px 14px; border-bottom: 1px solid var(--line);
    font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px;
  }
  .runs-list { max-height: 70vh; overflow-y: auto; }
  .run-item {
    padding: 10px 14px; border-bottom: 1px solid var(--line); cursor: pointer;
    display: flex; flex-direction: column; gap: 2px;
  }
  .run-item:hover { background: #1d2230; }
  .run-item.active { background: #1d2230; border-left: 2px solid var(--accent); }
  .run-item .tid { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; }
  .run-item .meta { color: var(--muted); font-size: 11px; display: flex; gap: 8px; }
  .pill {
    display: inline-block; padding: 1px 6px; border-radius: 3px;
    font-size: 10px; line-height: 14px;
  }
  .pill.ok { background: rgba(74, 222, 128, 0.15); color: var(--ok); }
  .pill.err { background: rgba(248, 113, 113, 0.15); color: var(--err); }
  .pill.run { background: rgba(110, 163, 255, 0.15); color: var(--accent); }
  .pill.int { background: rgba(167, 139, 250, 0.15); color: var(--interrupt); }

  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { padding: 8px 14px; border-bottom: 1px solid var(--line); text-align: left; }
  th { color: var(--muted); font-weight: 500; font-size: 11px; }
  tbody tr:hover { background: #1d2230; }
  td.mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; }
  td.preview {
    max-width: 380px; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; color: var(--muted); font-size: 11px;
  }

  .timeline-bar {
    height: 6px; background: var(--accent); border-radius: 3px;
    position: relative; min-width: 1px;
  }
  .timeline-bar.err { background: var(--err); }
  .timeline-bar.int { background: var(--interrupt); }
  .timeline-row td:first-child { padding-left: 14px; }

  .empty { color: var(--muted); padding: 40px; text-align: center; font-size: 12px; }

  details summary {
    cursor: pointer; color: var(--muted); font-size: 11px; padding: 4px 0;
  }
  details pre {
    background: #0b0d12; border: 1px solid var(--line); border-radius: 4px;
    padding: 8px; overflow: auto; font-size: 11px; color: var(--text);
    max-height: 200px; white-space: pre-wrap; word-break: break-word;
  }
</style>
</head>
<body>
  <header>
    <h1>Youle · Observability</h1>
    <span class="sub" id="ts">—</span>
    <span class="spacer"></span>
    <button onclick="refresh()">⟳ 刷新</button>
    <label class="sub"><input type="checkbox" id="autoRefresh" checked> 自动刷新 5s</label>
  </header>

  <div class="grid" id="stats">
    <div class="card"><div class="label">Threads</div><div class="value" id="s_threads">—</div></div>
    <div class="card"><div class="label">Total runs</div><div class="value" id="s_runs">—</div></div>
    <div class="card"><div class="label">Errors</div><div class="value" id="s_err">—</div></div>
    <div class="card"><div class="label">Avg latency</div><div class="value" id="s_avg">—</div></div>
    <div class="card"><div class="label">Cost (USD)</div><div class="value" id="s_cost">—</div></div>
  </div>

  <main>
    <div class="panel">
      <h2>Recent threads</h2>
      <div class="runs-list" id="runs"></div>
    </div>
    <div class="panel">
      <h2 id="timelineTitle">Select a thread on the left</h2>
      <div id="timeline"><div class="empty">还没选中任何 thread</div></div>
    </div>
  </main>

  <div style="padding: 0 22px 22px;">
    <div class="panel">
      <h2>Node breakdown (count / avg ms / max ms / errors)</h2>
      <table id="nodesTable">
        <thead><tr><th>Node</th><th>Calls</th><th>Avg ms</th><th>Max ms</th><th>Errors</th><th>Bar</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </div>

<script>
let activeTid = null;
let timer = null;

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + " " + r.status);
  return r.json();
}

function fmt(n, d = 0) {
  if (n === null || n === undefined) return "—";
  return Number(n).toFixed(d);
}

function pillFor(status) {
  switch (status) {
    case "ok": return '<span class="pill ok">ok</span>';
    case "error": return '<span class="pill err">err</span>';
    case "running": return '<span class="pill run">running</span>';
    case "interrupted": return '<span class="pill int">int</span>';
    default: return '<span class="pill">' + status + '</span>';
  }
}

async function loadStats() {
  const s = await fetchJSON("/api/observability/stats");
  document.getElementById("s_threads").textContent = s.thread_count ?? 0;
  document.getElementById("s_runs").textContent = s.run_count ?? 0;
  document.getElementById("s_err").textContent = s.error_count ?? 0;
  document.getElementById("s_avg").textContent = s.avg_duration_ms != null
    ? fmt(s.avg_duration_ms, 0) + " ms" : "—";
  document.getElementById("s_cost").textContent = "$" + fmt(s.cost_usd ?? 0, 4);
}

async function loadRuns() {
  const data = await fetchJSON("/api/observability/runs?limit=50");
  const el = document.getElementById("runs");
  if (!data.items.length) {
    el.innerHTML = '<div class="empty">还没有任何 trace<br><br>触发一次反诈视频对话试试</div>';
    return;
  }
  el.innerHTML = data.items.map(r => {
    const cls = r.thread_id === activeTid ? "active" : "";
    const errBadge = r.error_count > 0
      ? '<span class="pill err">' + r.error_count + ' err</span>' : "";
    const runningBadge = r.running_count > 0
      ? '<span class="pill run">running</span>' : "";
    return `
      <div class="run-item ${cls}" onclick="selectThread('${r.thread_id}')">
        <div class="tid">${r.thread_id}</div>
        <div class="meta">
          <span>${r.node_count} runs</span>
          <span>·</span>
          <span>${fmt(r.total_duration_ms, 0)} ms</span>
          ${errBadge ? '<span>·</span>' + errBadge : ''}
          ${runningBadge ? '<span>·</span>' + runningBadge : ''}
        </div>
        <div class="meta">${new Date(r.started_at).toLocaleString()}</div>
      </div>`;
  }).join("");
}

async function selectThread(tid) {
  activeTid = tid;
  document.querySelectorAll(".run-item").forEach(el => el.classList.remove("active"));
  await loadRuns();
  const data = await fetchJSON("/api/observability/runs/" + encodeURIComponent(tid));
  document.getElementById("timelineTitle").textContent = "Timeline · " + tid;

  const tl = data.timeline;
  if (!tl.length) {
    document.getElementById("timeline").innerHTML = '<div class="empty">no events</div>';
    return;
  }

  const t0 = new Date(tl[0].started_at).getTime();
  const tEnd = Math.max(...tl.map(r => new Date(r.ended_at || r.started_at).getTime()));
  const total = Math.max(tEnd - t0, 1);

  const rows = tl.map(r => {
    const start = new Date(r.started_at).getTime() - t0;
    const dur = r.duration_ms || 1;
    const leftPct = (start / total) * 100;
    const widthPct = Math.max((dur / total) * 100, 0.4);
    const cls = r.status === "error" ? "err"
      : r.status === "interrupted" ? "int" : "";
    const prev = r.input_preview || "";
    const out = r.output_preview || "";
    const err = r.error || "";
    return `
      <tr class="timeline-row">
        <td>${pillFor(r.status)} <span class="mono">${r.kind || ''}</span></td>
        <td><b>${r.node_name || '—'}</b><div class="meta" style="color:var(--muted);font-size:11px">+${start}ms</div></td>
        <td>${r.duration_ms ?? '—'} ms</td>
        <td style="width:40%">
          <div style="position:relative;height:6px;background:#222;border-radius:3px;">
            <div class="timeline-bar ${cls}" style="position:absolute;left:${leftPct}%;width:${widthPct}%;"></div>
          </div>
        </td>
        <td>
          ${prev ? `<details><summary>input</summary><pre>${escapeHtml(prev)}</pre></details>` : ''}
          ${out ? `<details><summary>output</summary><pre>${escapeHtml(out)}</pre></details>` : ''}
          ${err ? `<details open><summary style="color:var(--err)">error</summary><pre>${escapeHtml(err)}</pre></details>` : ''}
        </td>
      </tr>`;
  }).join("");

  const metrics = data.metrics || {};
  const metricsRow = Object.keys(metrics).length
    ? `<tr><td colspan="5"><b>Metrics:</b> ${
        Object.entries(metrics).map(([k,v]) => `${k}=${v}`).join(' · ')
      }</td></tr>`
    : '';

  document.getElementById("timeline").innerHTML = `
    <table>
      <thead><tr><th>Status</th><th>Node</th><th>Duration</th><th>Timeline</th><th>Detail</th></tr></thead>
      <tbody>${rows}${metricsRow}</tbody>
    </table>`;
}

async function loadNodes() {
  const data = await fetchJSON("/api/observability/nodes");
  const tbody = document.querySelector("#nodesTable tbody");
  if (!data.items.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">no nodes yet</td></tr>'; return; }
  const max = Math.max(...data.items.map(r => r.avg_ms || 0), 1);
  tbody.innerHTML = data.items.map(r => {
    const widthPct = ((r.avg_ms || 0) / max) * 100;
    return `
      <tr>
        <td><b>${r.node_name}</b></td>
        <td>${r.calls}</td>
        <td>${fmt(r.avg_ms, 1)}</td>
        <td>${fmt(r.max_ms, 0)}</td>
        <td>${r.errors > 0 ? `<span class="pill err">${r.errors}</span>` : '0'}</td>
        <td style="width:50%">
          <div style="position:relative;height:6px;background:#222;border-radius:3px;">
            <div class="timeline-bar" style="position:absolute;left:0;width:${widthPct}%;"></div>
          </div>
        </td>
      </tr>`;
  }).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function refresh() {
  document.getElementById("ts").textContent = "updated " + new Date().toLocaleTimeString();
  try {
    await Promise.all([loadStats(), loadRuns(), loadNodes()]);
    if (activeTid) await selectThread(activeTid);
  } catch (e) { console.error(e); }
}

function setupAutoRefresh() {
  if (timer) clearInterval(timer);
  if (document.getElementById("autoRefresh").checked) {
    timer = setInterval(refresh, 5000);
  }
}
document.getElementById("autoRefresh").addEventListener("change", setupAutoRefresh);

refresh();
setupAutoRefresh();
</script>
</body>
</html>
"""


@router.get("/observability", response_class=HTMLResponse)
async def dashboard():
    return HTMLResponse(_DASHBOARD_HTML)
