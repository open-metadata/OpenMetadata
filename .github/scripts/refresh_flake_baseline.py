#!/usr/bin/env python3
"""Maintain `flake-baseline.json`: what `main` itself does not reliably pass.

The merge queue has no way to tell "this PR broke it" from "main was already
broken", because every merge_group run tests `main` + up to three PRs and
nothing tests `main` on its own. This baseline is that missing statement.

Input is one outcome ledger from `classify_playwright_outcome.py`, produced by
the main lane (`playwright-main-lane.yml`). Each run contributes one
observation per test that failed its FIRST attempt — whether a retry rescued
it (`retryPassStableIds`) or not (`failureStableIds`). A test enters the
baseline only after `--threshold` observations inside a `--window` of runs, so
one unlucky run cannot excuse a test, and an entry ages out on its own once
`main` starts passing it again.

`stableIds` is the flat list `classify_playwright_outcome.py --retry-baseline`
reads, so the output is consumable without a translation step.

DELIBERATELY NOT A COMMITTED FILE. `refresh-timing-baseline` commits to `main`
and notes why that has to stay rare: every push to `main` resets the merge
queue. A baseline that refreshes on every main run cannot pay that cost, so it
lives in a `refs/heads/main`-scoped Actions cache instead — the one scope
merge_group and PR runs can restore from (#32605). A cache miss degrades to
today's behaviour: no baseline, no differential signal, nothing breaks.

Exits:
  0 — baseline written (or unchanged)
  1 — invalid input
  3 — the ledger carries no usable observations (cancelled run, no results);
      the caller skips the save rather than recording a false all-green
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1

# A run that never produced results tells us nothing about main. Recording it
# as "no test failed its first attempt" would silently decay real entries out
# of the window, which is exactly how a mask gets built.
UNUSABLE_CLASSIFICATIONS = frozenset({"cancelled", "missing_results"})


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ledger", type=Path, required=True,
                        help="outcome.json from classify_playwright_outcome.py")
    parser.add_argument("--current", type=Path,
                        help="Existing baseline; absent or unreadable starts a "
                             "fresh window.")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--window", type=int, default=10,
                        help="How many main-lane runs the baseline remembers.")
    parser.add_argument("--threshold", type=int, default=2,
                        help="First-attempt failures inside the window before a "
                             "test counts as 'main does not pass this'.")
    parser.add_argument("--run-id", default="")
    parser.add_argument("--source-sha", default="")
    parser.add_argument("--summary", type=Path,
                        help="Write a markdown summary here (job summary / "
                             "Slack body).")
    return parser.parse_args()


def _load_json(path: Path | None) -> dict[str, Any] | None:
    if path is None or not path.is_file():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def _string_list(value: Any) -> list[str]:
    return [str(item) for item in value] if isinstance(value, list) else []


def _record_index(records: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """stableId -> the ledger's own record, for project/file/title metadata."""
    index: dict[str, dict[str, Any]] = {}
    for record in records:
        if isinstance(record, dict) and record.get("stableId"):
            index.setdefault(str(record["stableId"]), record)
    return index


def refresh(
    ledger: dict[str, Any],
    current: dict[str, Any] | None,
    window: int,
    threshold: int,
    run_id: str,
    source_sha: str,
    now: str,
) -> dict[str, Any] | None:
    if str(ledger.get("classification", "")) in UNUSABLE_CLASSIFICATIONS:
        return None

    retry_passes = _string_list(ledger.get("retryPassStableIds"))
    hard_failures = _string_list(ledger.get("failureStableIds"))
    # Both mean the same thing for this baseline: the first attempt did not
    # pass on main. The distinction is kept in the output so a later gate can
    # treat "broken on main" differently from "flaky on main".
    observed = sorted(set(retry_passes) | set(hard_failures))

    metadata = _record_index(
        list(ledger.get("retryPasses") or []) + list(ledger.get("failures") or [])
    )

    previous = current if isinstance(current, dict) else {}
    runs = [run for run in _string_list_of_runs(previous.get("runs"))]
    run_key = run_id or source_sha or now
    runs = [run for run in runs if run.get("runId") != run_key]
    runs.append({"runId": run_key, "sourceSha": source_sha, "recordedAt": now})
    runs = runs[-window:]
    live_run_ids = {run["runId"] for run in runs}

    entries: dict[str, dict[str, Any]] = {}
    for stable_id, entry in (previous.get("entries") or {}).items():
        if not isinstance(entry, dict):
            continue
        kept = [
            run for run in _string_list(entry.get("observations"))
            if run in live_run_ids
        ]
        if kept:
            entries[str(stable_id)] = {**entry, "observations": kept}

    for stable_id in observed:
        entry = entries.setdefault(
            stable_id,
            {"observations": [], "project": "", "file": "", "title": ""},
        )
        if run_key not in entry["observations"]:
            entry["observations"] = [*entry["observations"], run_key]
        entry["lastSeenSha"] = source_sha
        entry["hardFailure"] = stable_id in set(hard_failures)
        record = metadata.get(stable_id, {})
        for field in ("project", "file", "title"):
            if record.get(field):
                entry[field] = str(record[field])

    baselined = sorted(
        stable_id for stable_id, entry in entries.items()
        if len(entry["observations"]) >= threshold
    )

    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": now,
        "window": window,
        "threshold": threshold,
        "runs": runs,
        "entries": dict(sorted(entries.items())),
        # Consumed verbatim by classify_playwright_outcome.py --retry-baseline.
        "stableIds": baselined,
        "hardFailureStableIds": sorted(
            stable_id for stable_id in baselined
            if entries[stable_id].get("hardFailure")
        ),
    }


def _string_list_of_runs(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [
        {
            "runId": str(run.get("runId", "")),
            "sourceSha": str(run.get("sourceSha", "")),
            "recordedAt": str(run.get("recordedAt", "")),
        }
        for run in value
        if isinstance(run, dict) and run.get("runId")
    ]


def render_summary(baseline: dict[str, Any], previous: dict[str, Any] | None) -> str:
    before = set(_string_list((previous or {}).get("stableIds")))
    after = set(baseline["stableIds"])
    added = sorted(after - before)
    removed = sorted(before - after)
    entries = baseline["entries"]

    lines = [
        "### Playwright flake baseline (main)",
        "",
        f"- Window: last {len(baseline['runs'])} of {baseline['window']} main-lane runs",
        f"- Tests main does not reliably pass: **{len(after)}** "
        f"({len(baseline['hardFailureStableIds'])} failing outright)",
        f"- Entered this run: {len(added)} · left: {len(removed)}",
    ]
    if added:
        lines += ["", "**Entered the baseline**", ""]
        lines += [
            f"- `{stable_id}` — {len(entries[stable_id]['observations'])} "
            f"of the last {len(baseline['runs'])} runs"
            for stable_id in added[:20]
        ]
    if removed:
        lines += ["", "**Left the baseline** (main passes them again)", ""]
        lines += [f"- `{stable_id}`" for stable_id in removed[:20]]
    return "\n".join(lines) + "\n"


def main() -> int:
    args = parse_args()

    ledger = _load_json(args.ledger)
    if ledger is None:
        print(f"Unreadable or non-object ledger: {args.ledger}")
        return 1
    if args.window < 1 or args.threshold < 1:
        print("--window and --threshold must both be >= 1")
        return 1

    previous = _load_json(args.current)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    baseline = refresh(
        ledger=ledger,
        current=previous,
        window=args.window,
        threshold=args.threshold,
        run_id=args.run_id,
        source_sha=args.source_sha,
        now=now,
    )
    if baseline is None:
        print(
            "Ledger classification "
            f"'{ledger.get('classification')}' carries no usable observations; "
            "leaving the baseline untouched."
        )
        return 3

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(baseline, indent=2, sort_keys=False) + "\n", encoding="utf-8"
    )
    summary = render_summary(baseline, previous)
    if args.summary:
        args.summary.parent.mkdir(parents=True, exist_ok=True)
        args.summary.write_text(summary, encoding="utf-8")
    print(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
