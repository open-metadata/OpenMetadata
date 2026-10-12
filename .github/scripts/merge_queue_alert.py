#!/usr/bin/env python3
"""Hourly merge-queue health alert — edge-triggered on how long the head entry has sat.

Alerts on ``head_entry_age``: an observed elapsed duration, not a projection. GitHub's
own ``estimatedTimeToMerge`` is reported alongside it but never decides anything —
measured at 4.2x optimistic while the queue was degraded, because its model assumes
every entry merges on its first pass.

**Edge-triggered, not level-triggered.** The 5h line sits on the healthy/broken
boundary (measured: 0% of merges breached it across three healthy days, 82-88% across
four degraded ones), so a level-triggered alert would fire every hour for as long as
the incident lasts. This fires once on entry to a worse tier and once on recovery.
While the queue is already broken, the recovery message is the valuable half: it says
when a CI fix actually landed.

Two tiers so resolution is not lost while breached — without the severe tier,
degrading from 5h to 40h is silent.

State is ~200 bytes of JSON carried between runs by the workflow's Actions cache; a
missing file is read as "ok", so the first run after a cache miss re-announces a
standing breach rather than staying silent about it.

Exits:
  0 — ran; `post` output says whether the workflow should send the Slack message
  1 — could not read the queue (bad token, API down, unknown branch)
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import merge_queue_metrics as mq


LEVELS = {"ok": 0, "degraded": 1, "severe": 2}
EMOJI = {"degraded": ":warning:", "severe": ":rotating_light:", "ok": ":white_check_mark:"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--owner", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--branch", default="main")
    parser.add_argument("--state-file", type=Path, required=True,
                        help="Carried between runs by the Actions cache.")
    parser.add_argument("--slack-file", type=Path, required=True,
                        help="chat.postMessage payload, written only when posting.")
    parser.add_argument("--channel", required=True)
    parser.add_argument("--degraded-hours", type=float, default=5.0,
                        help="Healthy p50 was ~1h, so 5h is ~5x headroom over normal.")
    parser.add_argument("--severe-hours", type=float, default=24.0,
                        help="No single pass exceeded 18.6h across the measured week.")
    parser.add_argument("--recover-runs", type=int, default=3,
                        help="Consecutive healthy runs before calling it recovered.")
    return parser.parse_args()


def classify(head_age_h: float | None, degraded_h: float, severe_h: float) -> str:
    # An empty queue is healthy, not unknown — nothing is waiting.
    if head_age_h is None:
        return "ok"
    if head_age_h >= severe_h:
        return "severe"
    if head_age_h >= degraded_h:
        return "degraded"
    return "ok"


def load_state(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"level": "ok", "since": None, "below_streak": 0}


def decide(observed: str, state: dict[str, Any], recover_runs: int,
           now: datetime) -> tuple[dict[str, Any], str | None]:
    """Return the next state and the transition to announce, if any.

    Escalation posts immediately; recovery waits for a streak so a single fast head
    entry cannot declare victory mid-incident. De-escalation (severe back to degraded)
    updates state silently — it is still broken, and announcing it would read as good
    news while the queue is still over the line.
    """
    previous = state.get("level", "ok")
    streak = int(state.get("below_streak", 0))

    if observed == "ok":
        streak += 1
        # `since` is the incident start, so it is meaningless once healthy — carrying a
        # recovery timestamp (or an old start) in the ok state leaves a stale value that
        # reads as an ongoing incident. Cleared here; the recovery message takes the
        # start from the *previous* state, so nothing is lost by dropping it.
        if previous == "ok":
            return {"level": "ok", "since": None, "below_streak": 0}, None
        if streak >= recover_runs:
            return {"level": "ok", "since": None, "below_streak": 0}, "recovered"
        # Still breached — the streak is counting, so the incident start is preserved.
        return {"level": previous, "since": state.get("since"), "below_streak": streak}, None

    # `since` marks when the incident began, not when the tier last moved. Stamping it
    # on any level change would reset it on escalation (degraded -> severe) and on
    # de-escalation (severe -> degraded) alike, so the recovery message would report
    # the last tier change instead of the true start and understate the outage.
    since = now.isoformat() if previous == "ok" else state.get("since")
    next_state = {"level": observed, "since": since, "below_streak": 0}
    if LEVELS[observed] > LEVELS[previous]:
        return next_state, "escalated"
    return next_state, None


def render(level: str, transition: str, metrics: dict[str, Any], realized: dict[str, Any],
           drain_h: float | None, args: argparse.Namespace, since: str | None) -> str:
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    queue_url = f"{server}/{args.owner}/{args.repo}/queue/{args.branch}"
    head = metrics.get("head_pr") or {}
    head_ref = (
        f"<{head.get('url')}|#{head.get('number')}>" if head.get("number") else "none"
    )

    if transition == "recovered":
        lines = [
            f"{EMOJI['ok']} *<{queue_url}|{args.branch} merge queue>* recovered — "
            f"head entry {mq.fmt_h(metrics['head_entry_age_h'])}, "
            f"back under the {args.degraded_hours:g}h line"
        ]
        if since:
            lines.append(f"• degraded since {since}")
    else:
        lines = [
            f"{EMOJI[level]} *<{queue_url}|{args.branch} merge queue>* {level} — "
            f"head entry has waited *{mq.fmt_h(metrics['head_entry_age_h'])}* "
            f"(threshold {args.degraded_hours:g}h"
            f"{f', severe {args.severe_hours:g}h' if level == 'severe' else ''})"
        ]

    lines += [
        f"• depth *{metrics['depth']}* · head {head_ref} · "
        f"oldest {mq.fmt_h(metrics['oldest_entry_age_h'])}",
        f"• realized throughput *{mq.fmt_rate(realized.get('throughput_per_h'))}* "
        f"→ drain *{mq.fmt_h(drain_h, 0)}*",
        f"• GitHub projects {mq.fmt_rate(metrics.get('github_rate_per_h'))} "
        f"→ {mq.fmt_h(metrics.get('next_entry_eta_h'))} for a PR enqueued now "
        f"(optimistic — first-pass model)",
    ]
    if metrics["stuck_states"]:
        stuck = ", ".join(f"{n}x {s}" for s, n in sorted(metrics["stuck_states"].items()))
        lines.append(f"• :lock: entries stuck: {stuck}")
    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    token = mq.env_token()
    now = mq.utcnow()
    args.channel = mq.require_channel(args.channel)

    try:
        queue = mq.live_queue(args.owner, args.repo, args.branch, token)
    except RuntimeError as exc:
        print(f"::error::could not read the merge queue: {exc}")
        return 1

    metrics = mq.queue_metrics(queue, now)
    observed = classify(metrics["head_entry_age_h"], args.degraded_hours, args.severe_hours)

    state = load_state(args.state_file)
    next_state, transition = decide(observed, state, args.recover_runs, now)

    # Throughput needs history, and history is what makes the drain estimate honest.
    # A failure here must not suppress the alert, so it degrades to "n/a".
    realized: dict[str, Any] = {}
    try:
        start, end = mq.window(now, 24)
        history, truncated = mq.fetch_history(
            args.owner, args.repo, args.branch, start, token
        )
        if truncated:
            print(f"::warning::PR search hit the {mq.MAX_SEARCH_PAGES}-page cap; "
                  "realized throughput is computed from a partial 24h window")
        realized = mq.realized_metrics(history, start, end)
    except RuntimeError as exc:
        print(f"::warning::realized throughput unavailable: {exc}")

    drain_h = mq.projected_drain_h(metrics["depth"], realized.get("throughput_per_h"))

    args.state_file.parent.mkdir(parents=True, exist_ok=True)
    args.state_file.write_text(json.dumps(next_state), encoding="utf-8")

    # Cache keys are immutable, so every save mints a new entry. The level is unchanged
    # on almost every run, so gating the save on a real change turns ~24 writes/day into
    # a handful a week. Restoring counts as an access, which keeps the surviving entry
    # alive indefinitely — so skipping the write cannot lose the state.
    changed = next_state != state

    step_s = metrics["service_step_s"]
    step_label = "n/a" if step_s is None else f"{step_s / 60:.1f} min"
    summary = [
        f"### Merge queue health — `{observed}`",
        "",
        "| | |",
        "|---|---|",
        f"| head entry age | {mq.fmt_h(metrics['head_entry_age_h'])} |",
        f"| depth | {metrics['depth']} |",
        f"| oldest entry | {mq.fmt_h(metrics['oldest_entry_age_h'])} |",
        f"| service step (GitHub) | {step_label} |",
        f"| realized throughput | {mq.fmt_rate(realized.get('throughput_per_h'))} |",
        f"| projected drain | {mq.fmt_h(drain_h, 0)} |",
        f"| previous level | {state.get('level')} |",
        f"| transition | {transition or 'none'} |",
    ]
    _write_summary("\n".join(summary))

    if transition:
        text = render(next_state["level"], transition, metrics, realized, drain_h,
                      args, state.get("since"))
        args.slack_file.write_text(
            json.dumps({"channel": args.channel, "text": text}), encoding="utf-8"
        )
        print(text)
    _set_output("post", "true" if transition else "false")
    _set_output("level", next_state["level"])
    _set_output("state_changed", "true" if changed else "false")
    return 0


def _set_output(name: str, value: str) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(f"{name}={value}\n")


def _write_summary(text: str) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(text + "\n")
    else:
        print(text)


if __name__ == "__main__":
    raise SystemExit(main())
