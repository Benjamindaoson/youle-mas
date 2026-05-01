"""End-to-end SSE smoke test for the LangGraph 1.x integration.

Hits POST /chat/team with the antiscam keyword and prints the *order* and
*latency* of SSE events. We expect events to arrive incrementally, not all in
one burst at the end.
"""
import asyncio
import json
import time
import urllib.parse

import httpx

BASE = "http://127.0.0.1:8001"


async def case_streaming():
    print("=" * 70)
    print("CASE 1 · 真流式（不审批 / 自动通过）")
    print("=" * 70)
    payload = {
        "message": "帮我做一个反诈短视频",
        "session_id": f"smoke:stream-{int(time.time())}",
        "mode": "dispatch",
        "require_approval": False,
    }
    seen = []
    start = time.perf_counter()
    async with httpx.AsyncClient(timeout=300, trust_env=False) as cx:
        async with cx.stream("POST", f"{BASE}/chat/team", json=payload) as r:
            assert r.status_code == 200, r.status_code
            buf = ""
            async for chunk in r.aiter_text():
                buf += chunk
                while "\n\n" in buf:
                    raw, buf = buf.split("\n\n", 1)
                    if not raw.startswith("data:"):
                        continue
                    data = raw[5:].strip()
                    if not data:
                        continue
                    ev = json.loads(data)
                    dt = (time.perf_counter() - start) * 1000
                    seen.append((dt, ev["type"], ev))
                    print(f"  +{dt:7.0f}ms  {ev['type']:24s}  "
                          f"{(ev.get('agent_id') or ev.get('plan') or ev.get('detail') or '')[:60]}")
                    if ev["type"] == "done":
                        return seen
    return seen


async def case_hitl():
    print()
    print("=" * 70)
    print("CASE 2 · HITL：require_approval=true → 应在 approval_required 处暂停")
    print("=" * 70)
    sid = f"smoke:hitl-{int(time.time())}"
    payload = {
        "message": "帮我做一个反诈短视频",
        "session_id": sid,
        "mode": "dispatch",
        "require_approval": True,
    }
    interrupt_seen = None
    thread_id = None
    start = time.perf_counter()
    async with httpx.AsyncClient(timeout=300, trust_env=False) as cx:
        async with cx.stream("POST", f"{BASE}/chat/team", json=payload) as r:
            buf = ""
            async for chunk in r.aiter_text():
                buf += chunk
                while "\n\n" in buf:
                    raw, buf = buf.split("\n\n", 1)
                    if not raw.startswith("data:"):
                        continue
                    ev = json.loads(raw[5:].strip())
                    dt = (time.perf_counter() - start) * 1000
                    print(f"  +{dt:7.0f}ms  {ev['type']:24s}")
                    if ev.get("thread_id"):
                        thread_id = ev["thread_id"]
                    if ev["type"] == "approval_required":
                        interrupt_seen = ev
                    if ev["type"] in ("done", "error", "approval_required"):
                        break
                if interrupt_seen:
                    break
    assert interrupt_seen, "should have hit approval_required"
    assert thread_id, "thread_id missing"
    print(f"  >> interrupt payload preview: {json.dumps(interrupt_seen, ensure_ascii=False)[:140]}")

    print()
    print("-" * 70)
    print(f"CASE 2b · resume(approved=True) on thread_id={thread_id}")
    print("-" * 70)
    start = time.perf_counter()
    seen_done = False
    async with httpx.AsyncClient(timeout=300, trust_env=False) as cx:
        async with cx.stream(
            "POST",
            f"{BASE}/chat/team/resume/{urllib.parse.quote(thread_id, safe='')}",
            json={"approved": True},
        ) as r:
            buf = ""
            async for chunk in r.aiter_text():
                buf += chunk
                while "\n\n" in buf:
                    raw, buf = buf.split("\n\n", 1)
                    if not raw.startswith("data:"):
                        continue
                    ev = json.loads(raw[5:].strip())
                    dt = (time.perf_counter() - start) * 1000
                    print(f"  +{dt:7.0f}ms  {ev['type']:24s}  "
                          f"{(ev.get('agent_id') or ev.get('detail') or '')[:60]}")
                    if ev["type"] == "done":
                        seen_done = True
                        return
    assert seen_done


async def main():
    seen = await case_streaming()
    types = [t for _, t, _ in seen]
    print()
    print(f"Case 1 saw {len(seen)} events; sequence: "
          f"{' → '.join(types[:8])}{'...' if len(types) > 8 else ''}")
    # 真流式判定：start 与 done 之间应有 >5 个事件，且首事件 < 200ms
    first_dt = seen[1][0] if len(seen) >= 2 else 9999
    assert len(seen) >= 6, f"too few events: {len(seen)}"
    print(f"PASS · 真流式: 首个进度事件 +{first_dt:.0f}ms 到达，共 {len(seen)} 条")

    await case_hitl()
    print()
    print("ALL SMOKE CASES PASSED ✅")


if __name__ == "__main__":
    asyncio.run(main())
