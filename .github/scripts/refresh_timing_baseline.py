#!/usr/bin/env python3
"""Refresh `.github/playwright/timing-baseline.json` from a fresh merged
history artifact produced by a full-mode merge_group run.

Called from the workflow's `refresh-timing-baseline` job. Normalises the
reporter's raw schema to the baseline schema the planner reads, preserves
curated fields on the current baseline (retention pointers and the
unstable-test-id allowlist), and prints a diff summary for the commit body.

Exits:
  0 — new baseline written OR identical to current (workflow will skip
      the commit)
  1 — invalid input (missing file, malformed JSON, mode != 'full', etc.)
  2 — drift exceeds --max-drift-percent (safety valve; workflow fails the
      job so a human refreshes manually)
  3 — change is below --min-materiality-percent (nothing written; the
      workflow skips the commit). Ordinary run-to-run duration jitter must
      not produce a main commit per merge_group run — every push to main
      resets the merge queue, so refreshes have to be rare and meaningful.
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any


BASELINE_TEST_FIELDS = ("id", "project", "file", "title", "durationMs",
                        "attempts", "retries", "outcome")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--history", type=Path, required=True,
                        help="Merged playwright-timing-history.json from a "
                             "successful full-mode run.")
    parser.add_argument("--current", type=Path, required=True,
                        help="Current .github/playwright/timing-baseline.json.")
    parser.add_argument("--output", type=Path, required=True,
                        help="Where to write the refreshed baseline.")
    parser.add_argument("--source-run-id", type=int, required=True,
                        help="Run ID that produced the history artifact.")
    parser.add_argument("--max-drift-percent", type=float, default=40.0,
                        help="Refuse the refresh (exit 2) if more than N%% "
                             "of test-id entries would change. Guards against "
                             "an accidental capture of a broken run.")
    parser.add_argument("--min-materiality-percent", type=float, default=0.0,
                        help="Skip the refresh (exit 3) unless the change is "
                             "material: at least N%% of entries added/removed, "
                             "or at least N%% with a significant duration "
                             "shift (>30%% and >5 s). Structural changes "
                             "(files gained/lost, zero-duration entries "
                             "recovering) are always material. 0 disables "
                             "the check.")
    parser.add_argument("--summary", type=Path,
                        help="Optional path to write a human-readable summary "
                             "for the commit/log output.")
    return parser.parse_args()


def normalize_test(t: dict[str, Any]) -> dict[str, Any]:
    """Reporter output uses `title` for the full ` › project › file › describe
    › leaf` breadcrumb and `leafTitle` for the short name; the checked-in
    baseline uses `title` for the short name. Normalise on the baseline's
    schema so the planner's identity-fallback lookup by (file, title) keeps
    working, and drop `retryDurationMs` which the planner doesn't consume.
    """
    return {
        "id": t.get("id"),
        "project": t.get("project"),
        "file": t.get("file"),
        "title": t.get("leafTitle", t.get("title", "")),
        "durationMs": int(t.get("durationMs", 0)),
        "attempts": int(t.get("attempts", 1)),
        "retries": int(t.get("retries", 0)),
        "outcome": t.get("outcome", "expected"),
    }


def build_baseline(fresh: dict[str, Any], current: dict[str, Any],
                   source_run_id: int) -> dict[str, Any]:
    return {
        "version": 1,
        "mode": "full",
        "sourceRunId": source_run_id,
        "sourceSha": fresh.get("sourceSha", ""),
        # Retention pointers + unstable-test-id allowlist are curated and
        # must survive an auto-refresh. If a human wants to bump either,
        # they do it in a follow-up commit.
        "retainedSourceRunId": current.get("retainedSourceRunId"),
        "retainedSourceSha": current.get("retainedSourceSha"),
        "retainedUnstableTestIds": current.get("retainedUnstableTestIds", []),
        "tests": [normalize_test(t) for t in fresh.get("tests", [])],
    }


def compute_diff(current: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    def key(t: dict[str, Any]) -> tuple[str, str]:
        return (t.get("file", ""), t.get("title", ""))

    cur_by_key = {key(t): t for t in current.get("tests", [])}
    new_by_key = {key(t): t for t in new.get("tests", [])}
    cur_keys, new_keys = set(cur_by_key), set(new_by_key)

    added = new_keys - cur_keys
    removed = cur_keys - new_keys
    common = cur_keys & new_keys
    changed_duration = sum(
        1 for k in common
        if abs(cur_by_key[k]["durationMs"] - new_by_key[k]["durationMs"]) > 500
    )
    # A "significant" shift is one large enough to change how the planner
    # packs shards: both relatively (>30 %) and absolutely (>5 s) — the
    # 500 ms `changed_duration` counter above is run-to-run jitter and is
    # deliberately excluded from materiality.
    significant_duration_changes = sum(
        1 for k in common
        if abs(cur_by_key[k]["durationMs"] - new_by_key[k]["durationMs"])
        > max(5000, 0.3 * cur_by_key[k]["durationMs"])
    )
    recovered = sum(
        1 for k in common
        if cur_by_key[k]["durationMs"] == 0 and new_by_key[k]["durationMs"] > 0
    )

    # File-level delta
    cur_files = set(t["file"] for t in current.get("tests", []))
    new_files = set(t["file"] for t in new.get("tests", []))
    gained_files = sorted(new_files - cur_files)
    lost_files = sorted(cur_files - new_files)

    total_entries = max(len(cur_keys), 1)
    drift_percent = 100.0 * (len(added) + len(removed)) / total_entries

    return {
        "current_entries": len(cur_keys),
        "new_entries": len(new_keys),
        "added": len(added),
        "removed": len(removed),
        "changed_duration": changed_duration,
        "significant_duration_changes": significant_duration_changes,
        "significant_percent": 100.0 * significant_duration_changes / total_entries,
        "recovered": recovered,
        "gained_files": gained_files,
        "lost_files": lost_files,
        "drift_percent": drift_percent,
    }


def render_summary(diff: dict[str, Any]) -> str:
    lines = [
        "Timing baseline auto-refresh summary",
        "",
        f"- entries: {diff['current_entries']} → {diff['new_entries']} "
        f"(+{diff['added']} added, -{diff['removed']} removed)",
        f"- durations changed by > 500 ms: {diff['changed_duration']}",
        f"- significant shifts (>30% and >5 s): "
        f"{diff['significant_duration_changes']} "
        f"({diff['significant_percent']:.1f}%)",
        f"- previously zero → now real: {diff['recovered']}",
        f"- drift: {diff['drift_percent']:.1f}% of test-id entries",
    ]
    if diff["gained_files"]:
        lines.append("")
        lines.append(f"Files newly covered ({len(diff['gained_files'])}):")
        for f in diff["gained_files"][:20]:
            lines.append(f"  + {f}")
        if len(diff["gained_files"]) > 20:
            lines.append(f"  ...and {len(diff['gained_files']) - 20} more")
    if diff["lost_files"]:
        lines.append("")
        lines.append(f"Files no longer covered ({len(diff['lost_files'])}):")
        for f in diff["lost_files"][:20]:
            lines.append(f"  - {f}")
        if len(diff["lost_files"]) > 20:
            lines.append(f"  ...and {len(diff['lost_files']) - 20} more")
    return "\n".join(lines) + "\n"


def main() -> int:
    args = parse_args()
    if not args.history.exists():
        print(f"history file not found: {args.history}")
        return 1
    if not args.current.exists():
        print(f"current baseline not found: {args.current}")
        return 1

    fresh = json.loads(args.history.read_text(encoding="utf-8"))
    if fresh.get("mode") != "full":
        print(f"history mode is {fresh.get('mode')!r}; only 'full' is accepted")
        return 1
    current = json.loads(args.current.read_text(encoding="utf-8"))

    new_baseline = build_baseline(fresh, current, args.source_run_id)
    diff = compute_diff(current, new_baseline)

    summary = render_summary(diff)
    print(summary)

    if diff["drift_percent"] > args.max_drift_percent:
        print(f"drift {diff['drift_percent']:.1f}% exceeds "
              f"--max-drift-percent={args.max_drift_percent}; refusing to "
              "auto-refresh. A human should regenerate manually and review.")
        return 2

    if args.min_materiality_percent > 0:
        structurally_material = (
            diff["recovered"] > 0
            or diff["gained_files"]
            or diff["lost_files"]
        )
        percent_material = (
            diff["drift_percent"] >= args.min_materiality_percent
            or diff["significant_percent"] >= args.min_materiality_percent
        )
        if not structurally_material and not percent_material:
            skip_note = (
                f"change below materiality threshold "
                f"({args.min_materiality_percent:.1f}%): drift "
                f"{diff['drift_percent']:.1f}%, significant shifts "
                f"{diff['significant_percent']:.1f}%, nothing structural — "
                "skipping refresh."
            )
            print(skip_note)
            if args.summary:
                args.summary.parent.mkdir(parents=True, exist_ok=True)
                args.summary.write_text(summary + skip_note + "\n",
                                        encoding="utf-8")
            return 3

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as fh:
        # Compact JSON — matches the checked-in file's format so the diff
        # stays a single-line reserialization of the payload.
        json.dump(new_baseline, fh, separators=(",", ":"))

    if args.summary:
        args.summary.parent.mkdir(parents=True, exist_ok=True)
        args.summary.write_text(summary, encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
