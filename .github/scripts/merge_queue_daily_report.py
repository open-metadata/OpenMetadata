#!/usr/bin/env python3
"""Daily merge-queue digest — trailing 24h against the trailing 7d and a pinned
healthy reference window.

Fully stateless: every window is recomputed from PR timeline history, which survives
the merge. Nothing is carried between runs.

Why a pinned healthy window exists: a trailing-7d baseline normalises a sustained
regression away. Measured over one week the daily p50 for a single clean pass rose
0.97h → 17.49h, strictly increasing on all seven days; a rolling mean chasing that
drift reports "flat" while the queue is 18x worse than it was. ``--healthy-since`` /
``--healthy-until`` pin a known-good period so the digest keeps comparing against what
good actually looked like. Drop the flags once the queue has recovered and the
trailing 7d is trustworthy again.

The digest always posts — there is no fire/don't-fire decision and therefore no
threshold to miscalibrate. Deltas are shown; the reader judges.

Exits:
  0 — report written
  1 — could not read history (bad token, API down)
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import merge_queue_metrics as mq


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--owner", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--branch", default="main")
    parser.add_argument("--slack-file", type=Path, required=True)
    parser.add_argument("--channel", required=True)
    parser.add_argument("--healthy-since", default="",
                        help="ISO date starting a known-good reference window.")
    parser.add_argument("--healthy-until", default="",
                        help="ISO date ending the known-good reference window.")
    parser.add_argument("--top-checks", type=int, default=5)
    return parser.parse_args()


def _date(value: str, end_of_day: bool = False) -> datetime | None:
    """Parse a `YYYY-MM-DD` bound, treating the end date as inclusive.

    Both bounds would otherwise land on midnight UTC, so `2026-08-28..2026-08-31`
    would end *at the start* of the 31st and silently drop that day — measured as
    n=17 against the n=26 the same written range is read to mean.
    """
    if not value:
        return None
    start = mq.parse_ts(f"{value}T00:00:00Z")
    return start + timedelta(days=1, microseconds=-1) if end_of_day else start


def main() -> int:
    args = parse_args()
    token = mq.env_token()
    now = mq.utcnow()
    args.channel = mq.require_channel(args.channel)

    healthy_start = _date(args.healthy_since)
    healthy_end = _date(args.healthy_until, end_of_day=True)
    week_start = now - timedelta(days=7)
    # One paginated read covers every window; the earliest bound decides how far back.
    fetch_since = min(filter(None, [week_start, healthy_start]))

    try:
        history, truncated = mq.fetch_history(
            args.owner, args.repo, args.branch, fetch_since, token
        )
    except RuntimeError as exc:
        print(f"::error::could not read merge-queue history: {exc}")
        return 1
    if truncated:
        # The digest still posts — it is documented to always post — but a partial
        # window must never be presented as a complete one.
        print(f"::warning::PR search hit the {mq.MAX_SEARCH_PAGES}-page cap; "
              "the reported windows are partial")

    day = mq.realized_metrics(history, now - timedelta(hours=24), now)
    week = mq.realized_metrics(history, week_start, now)
    healthy = (
        mq.realized_metrics(history, healthy_start, healthy_end)
        if healthy_start and healthy_end else None
    )

    depth = None
    try:
        depth = mq.queue_metrics(
            mq.live_queue(args.owner, args.repo, args.branch, token), now
        )["depth"]
    except RuntimeError as exc:
        print(f"::warning::live queue unreadable, drain estimate skipped: {exc}")

    drain_h = mq.projected_drain_h(depth, day.get("throughput_per_h"))
    checks: list[tuple[str, int]] = []
    checks_error: str | None = None
    try:
        checks = mq.top_failing_checks(
            day["failed_commits"], args.owner, args.repo, token, args.top_checks
        )
    except mq.CheckAccessError as exc:
        # Reported, never silently empty: "no failing checks" and "could not look"
        # read identically to a human but mean opposite things.
        checks_error = str(exc)
        print(f"::error::{exc}")

    report = _render(args, now, day, week, healthy, depth, drain_h, checks,
                     checks_error, truncated)
    _write_summary(report["markdown"])
    args.slack_file.write_text(
        json.dumps({"channel": args.channel, "text": report["slack"]}), encoding="utf-8"
    )
    print(report["slack"])
    return 0


def _render(args: argparse.Namespace, now: datetime, day: dict[str, Any],
            week: dict[str, Any], healthy: dict[str, Any] | None, depth: int | None,
            drain_h: float | None, checks: list[tuple[str, int]],
            checks_error: str | None = None,
            truncated: bool = False) -> dict[str, str]:
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    queue_url = f"{server}/{args.owner}/{args.repo}/queue/{args.branch}"
    ref = healthy or week
    ref_label = "healthy ref" if healthy else "7d"

    # p90 is deliberately absent from the 24h column. At ~15 merges/day it is the
    # second-worst sample and swings hard enough to read as a regression on noise.
    rows = [
        ("merged via queue", str(day["merged_via_queue"]), str(week["merged_via_queue"]), ""),
        ("bypassed queue", str(day["merged_bypassing"]), str(week["merged_bypassing"]), ""),
        ("total wait p50", mq.fmt_h(day["total_p50_h"]), mq.fmt_h(week["total_p50_h"]),
         mq.delta_marker(day["total_p50_h"], ref["total_p50_h"])),
        ("first-pass p50", mq.fmt_h(day["first_pass_p50_h"]),
         mq.fmt_h(week["first_pass_p50_h"]),
         mq.delta_marker(day["first_pass_p50_h"], ref["first_pass_p50_h"])),
        ("first-pass p90", "—", mq.fmt_h(week["first_pass_p90_h"]), ""),
        ("re-queue penalty", mq.fmt_h(day["requeue_penalty_h"]),
         mq.fmt_h(week["requeue_penalty_h"]), ""),
        ("first-pass rate", mq.fmt_pct(day["first_pass_rate"]),
         mq.fmt_pct(week["first_pass_rate"]),
         mq.delta_marker(day["first_pass_rate"], ref["first_pass_rate"],
                         lower_is_better=False)),
        ("enqueues / merge", f"{day['enqueues_per_merge']:.2f}"
         if day["enqueues_per_merge"] else "n/a",
         f"{week['enqueues_per_merge']:.2f}" if week["enqueues_per_merge"] else "n/a", ""),
        ("wasted passes", str(day["wasted_passes"]), str(week["wasted_passes"]), ""),
        ("throughput", mq.fmt_rate(day["throughput_per_h"]),
         mq.fmt_rate(week["throughput_per_h"]),
         mq.delta_marker(day["throughput_per_h"], ref["throughput_per_h"],
                         lower_is_better=False)),
    ]

    md = [
        f"### Merge queue daily digest — `{args.branch}` — {now:%Y-%m-%d}",
        "",
        f"Queue depth **{depth if depth is not None else 'n/a'}**, "
        f"projected drain **{mq.fmt_h(drain_h, 0)}** at the realized rate "
        f"(24h sample n={day['sample_size']}).",
        "",
        f"| metric | 24h | 7d | vs {ref_label} |",
        "|---|---|---|---|",
    ]
    if truncated:
        md.insert(3, "> ⚠️ **Partial data** — the PR search hit its page cap, so "
                     "every window below undercounts.\n")
    md += [f"| {name} | {d} | {w} | {marker.strip() or '—'} |"
           for name, d, w, marker in rows]

    dequeues = day["dequeue_reasons"]
    non_merge = {r: n for r, n in dequeues.items() if r != mq.MERGE_REASON}
    md += ["", f"**Dequeues (24h)** — {day['non_merge_dequeues']} non-merge: " +
           (", ".join(f"`{r}` {n}" for r, n in sorted(non_merge.items())) or "none")]

    if checks_error:
        md += ["", f"> ⚠️ **Failing-check breakdown unavailable** — {checks_error}"]
    elif checks:
        md += ["", "**Checks behind those dequeues**", ""]
        md += [f"- `{name}` — {count}" for name, count in checks]
    else:
        md += ["", "_No failing check runs resolved for the 24h dequeues._"]

    if healthy:
        md += ["", f"_Comparing against pinned healthy window "
                   f"{args.healthy_since}..{args.healthy_until}; a trailing baseline "
                   f"would absorb a sustained regression instead of flagging it._"]

    slack = [
        f":bar_chart: *<{queue_url}|{args.branch} merge queue>* daily digest — "
        f"{now:%Y-%m-%d}"
        + (" :warning: _partial data, windows undercount_" if truncated else ""),
        f"• depth *{depth if depth is not None else 'n/a'}* · drain *{mq.fmt_h(drain_h, 0)}* "
        f"· throughput *{mq.fmt_rate(day['throughput_per_h'])}*"
        f"{mq.delta_marker(day['throughput_per_h'], ref['throughput_per_h'], False)}",
        f"• total wait p50 *{mq.fmt_h(day['total_p50_h'])}*"
        f"{mq.delta_marker(day['total_p50_h'], ref['total_p50_h'])} "
        f"· first-pass p50 *{mq.fmt_h(day['first_pass_p50_h'])}*"
        f"{mq.delta_marker(day['first_pass_p50_h'], ref['first_pass_p50_h'])}",
        f"• first-pass rate *{mq.fmt_pct(day['first_pass_rate'])}*"
        f"{mq.delta_marker(day['first_pass_rate'], ref['first_pass_rate'], False)} "
        f"· {day['merged_via_queue']} merged, {day['merged_bypassing']} bypassed, "
        f"{day['wasted_passes']} wasted passes",
        f"• {day['non_merge_dequeues']} non-merge dequeues: " +
        (", ".join(f"`{r}` {n}" for r, n in sorted(non_merge.items())) or "none"),
    ]
    if checks_error:
        slack.append(":warning: failing-check breakdown unavailable — "
                     "the workflow may be missing `checks: read`")
    elif checks:
        # Slack gets the top 3 only; the full list stays in the job summary.
        slack.append("• top failing checks: " +
                     ", ".join(f"`{n}` ({c})" for n, c in checks[:3]))
    return {"markdown": "\n".join(md), "slack": "\n".join(slack)}


def _write_summary(text: str) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(text + "\n")
    else:
        print(text)


if __name__ == "__main__":
    raise SystemExit(main())
