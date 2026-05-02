"""跑 backend/evals/golden_cases.yaml，输出 pass rate。

用法：
  cd backend
  uv run python scripts/run_evals.py
  uv run python scripts/run_evals.py --filter skill_   # 只跑 skill_* 用例

退出码：
  0  全部通过
  1  有失败用例（CI 应当 fail）
  2  解析 / 加载错误
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
from typing import Any

import yaml


# 让脚本能从任意目录跑
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


CASES_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "evals", "golden_cases.yaml")


async def run_case(case: dict) -> tuple[bool, str]:
    """跑单条 case，返回 (passed, reason)。"""
    kind = case.get("kind", "")
    inp = case.get("input", "")

    if kind == "skill_match":
        from app.skills.registry import load_all, match
        load_all()
        spec = match(inp)
        actual = spec.id if spec else None
        expect = case.get("expect_skill_id")
        return (actual == expect,
                f"got {actual!r}, want {expect!r}")

    if kind == "intent_parse":
        from app.conductor.intent import parse_intent
        intent = await parse_intent(inp)
        if case.get("expect_low_confidence"):
            ok = intent.confidence < 0.7
            return ok, f"confidence={intent.confidence}"
        if case.get("expect_has_missing_slots"):
            ok = len(intent.missing_slots) > 0
            return ok, f"missing={intent.missing_slots}"
        expect = case.get("expect", {}) or {}
        for k, v in expect.items():
            actual = getattr(intent, k, None)
            if actual != v:
                return False, f"intent.{k}={actual!r}, want {v!r}"
        return True, "all expectations matched"

    if kind == "conduct_smoke":
        from app.skills.registry import load_all
        from app.conductor import conduct
        load_all()
        seen: list[str] = []
        async for ev in conduct(inp, session_id=f"eval:{case.get('id', '?')}"):
            seen.append(ev.get("type", ""))
            if len(seen) > 100:
                break
        expect = case.get("expect_event_types", []) or []
        expect_any = case.get("expect_event_types_any", []) or []
        if expect_any:
            ok = any(e in seen for e in expect_any)
            return ok, f"saw {seen[:8]}, want any of {expect_any}"
        missing = [e for e in expect if e not in seen]
        if missing:
            return False, f"missing events {missing}, saw {seen[:8]}"
        return True, f"saw {len(seen)} events incl. all expected"

    return False, f"unknown kind: {kind!r}"


async def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--filter", default="", help="只跑 id 含此前缀的用例")
    p.add_argument("--cases", default=CASES_FILE)
    args = p.parse_args()

    try:
        with open(args.cases, encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
    except OSError as e:
        print(f"[ERROR] cannot read {args.cases}: {e}")
        return 2

    cases = data.get("cases", [])
    if args.filter:
        cases = [c for c in cases if args.filter in (c.get("id") or "")]

    if not cases:
        print("[WARN] no cases to run")
        return 0

    passed = 0
    failed: list[tuple[str, str]] = []
    t0 = time.monotonic()

    for c in cases:
        cid = c.get("id", "?")
        try:
            ok, reason = await run_case(c)
        except Exception as e:  # noqa: BLE001
            ok, reason = False, f"EXCEPTION: {e}"
        flag = "[ PASS ]" if ok else "[ FAIL ]"
        print(f"  {flag}  {cid:14s}  {reason}")
        if ok:
            passed += 1
        else:
            failed.append((cid, reason))

    total = len(cases)
    rate = passed / total * 100
    elapsed = time.monotonic() - t0
    print()
    print(f"=== {passed}/{total} passed ({rate:.0f}%), {elapsed:.1f}s ===")
    if failed:
        print(f"failed:")
        for cid, reason in failed:
            print(f"  - {cid}: {reason}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
