#!/usr/bin/env python3
"""Soft time-budget check for CI jobs.

A hard ``timeout-minutes`` cancels the job and reports it red. Sometimes what
we actually want is a signal: this job took longer than it should have, but
completing is more valuable than failing. This script is that signal.

Given a job's wall-clock start (POSIX seconds) and a budget in minutes, it
writes a Slack ``chat.postMessage`` payload to ``--output`` if the observed
duration exceeded the budget, and nothing otherwise. It exits 0 either way;
the caller conditionally posts the file (``if hashFiles(...) != ''``).

Kept deliberately dependency-free so it can be invoked from any job without a
pip install.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

DEFAULT_CHANNEL = "C0C008ZAK0V"  # #pw-health


def _human_duration(seconds: int) -> str:
    minutes, secs = divmod(max(0, seconds), 60)
    if minutes < 60:
        return f"{minutes}m {secs:02d}s"
    hours, minutes = divmod(minutes, 60)
    return f"{hours}h {minutes:02d}m"


def build_payload(
    *,
    job: str,
    started_at: int,
    now: int,
    budget_minutes: int,
    channel: str,
    run_url: str,
    commit_url: str,
    commit_sha: str,
    event_name: str,
    ref: str,
    pr_number: str,
) -> dict | None:
    """Return a Slack payload dict if over budget, else None."""
    duration_s = max(0, now - started_at)
    budget_s = budget_minutes * 60
    if duration_s <= budget_s:
        return None

    over_by_s = duration_s - budget_s
    sha = (commit_sha or "")[:7]

    scope = f"PR #{pr_number}" if pr_number else f"`{ref or event_name or 'unknown'}`"
    header = (
        f":hourglass_flowing_sand: *{job}* on {scope} took"
        f" *{_human_duration(duration_s)}*, budget *{budget_minutes}m*"
        f" (over by {_human_duration(over_by_s)})."
    )
    location = (
        f"<{commit_url}|{sha}>" if commit_url and sha else (commit_url or sha)
    )
    lines = [header]
    if location:
        lines.append(f"Commit: {location}")
    if run_url:
        lines.append(f"<{run_url}|run>")

    return {"channel": channel, "text": "\n".join(lines)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--job", required=True, help="Human-readable job label")
    parser.add_argument("--started-at", required=True, type=int, help="Job start (POSIX seconds)")
    parser.add_argument("--budget-minutes", required=True, type=int)
    parser.add_argument("--now", type=int, default=None, help="POSIX seconds (default: time.time())")
    parser.add_argument("--channel", default=DEFAULT_CHANNEL)
    parser.add_argument("--run-url", default="")
    parser.add_argument("--commit-url", default="")
    parser.add_argument("--commit-sha", default="")
    parser.add_argument("--event-name", default="")
    parser.add_argument("--ref", default="")
    parser.add_argument("--pr-number", default="")
    parser.add_argument("--output", required=True, help="Path to write slack.json (only if over budget)")
    args = parser.parse_args(argv)

    now = args.now if args.now is not None else int(time.time())

    payload = build_payload(
        job=args.job,
        started_at=args.started_at,
        now=now,
        budget_minutes=args.budget_minutes,
        channel=args.channel,
        run_url=args.run_url,
        commit_url=args.commit_url,
        commit_sha=args.commit_sha,
        event_name=args.event_name,
        ref=args.ref,
        pr_number=args.pr_number,
    )

    out = Path(args.output)
    if payload is None:
        # Under budget: leave no file so the caller's hashFiles() gate skips posting.
        if out.exists():
            out.unlink()
        print(f"under budget: observed <= {args.budget_minutes}m", file=sys.stderr)
        return 0

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload))
    print(f"over budget: wrote {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
