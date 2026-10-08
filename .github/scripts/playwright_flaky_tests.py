#!/usr/bin/env python3
"""List the tests of one Playwright run that failed and then passed on retry.

Playwright gives such a test the status `flaky`. With one retry the shard exits
0 and the run goes green, so these tests are invisible unless something lists
them. This reads the run's JSON reports (the merged report the summary job
builds from every shard's blob, and the per-shard results JSON where they were
uploaded), and writes:

  * `--output`  — `playwright-flaky-tests.json`, one entry per (spec, title);
                  the daily CI health report aggregates these across runs;
  * `--summary` — a markdown section, appended (pass `$GITHUB_STEP_SUMMARY`).

`spec` is relative to `playwright/e2e/` and `title` is the describe › test
path, the same keys a `.github/playwright/quarantine.json` entry uses.

Reporting only: it exits 0 whatever it finds, and 1 only on bad arguments.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from classify_playwright_outcome import _expand_globs, _read_reports

SPEC_ROOT = "playwright/e2e/"
MAX_SUMMARY_TESTS = 50


def spec_path(file_name: str) -> str:
    """Normalise a report's file path to the part below `playwright/e2e/`."""
    normalized = str(file_name or "").replace("\\", "/")
    index = normalized.rfind(SPEC_ROOT)
    return normalized[index + len(SPEC_ROOT) :] if index >= 0 else normalized


def flaky_tests(records: list[dict[str, object]]) -> list[dict[str, Any]]:
    """Collapse flaky test records to one entry per (spec, title).

    The merged report and a shard's own report describe the same execution, and
    one test can run under several projects, so both are folded together.
    """
    by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for record in records:
        if record.get("status") != "flaky":
            continue
        spec = spec_path(str(record.get("file", "")))
        title = str(record.get("title", ""))
        entry = by_key.setdefault(
            (spec, title),
            {
                "spec": spec,
                "title": title,
                "projects": set(),
                "shards": set(),
                "lifecycle": bool(record.get("lifecycle")),
                "firstError": "",
            },
        )
        entry["projects"].add(str(record.get("project", "")))
        if record.get("shard"):
            entry["shards"].add(str(record["shard"]))
        if not entry["firstError"] and record.get("firstError"):
            entry["firstError"] = str(record["firstError"])[:500]
    return [
        {
            **entry,
            "projects": sorted(entry["projects"]),
            "shards": sorted(entry["shards"]),
        }
        for _, entry in sorted(by_key.items())
    ]


def build_payload(
    tests: list[dict[str, Any]], reports: int, parse_errors: list[str]
) -> dict[str, Any]:
    return {
        "version": 1,
        "runId": os.environ.get("GITHUB_RUN_ID", ""),
        "runAttempt": os.environ.get("GITHUB_RUN_ATTEMPT", ""),
        "event": os.environ.get("GITHUB_EVENT_NAME", ""),
        "sourceSha": os.environ.get("GITHUB_SHA", ""),
        "reports": reports,
        "parseErrors": parse_errors,
        "count": len(tests),
        "tests": tests,
    }


def render_summary(payload: dict[str, Any]) -> str:
    tests = payload["tests"]
    lines = ["### Flaky Playwright tests (failed, then passed on retry)", ""]
    if payload["reports"] == 0:
        lines.append("No Playwright JSON report was available, so flaky tests were not listed.")
    elif not tests:
        lines.append("No test needed a retry to pass.")
    else:
        lines.append(f"{len(tests)} test(s) passed only on retry:")
        lines.append("")
        for test in tests[:MAX_SUMMARY_TESTS]:
            projects = ", ".join(test["projects"])
            lines.append(f"- `{test['spec']}` › {test['title']} ({projects})")
        if len(tests) > MAX_SUMMARY_TESTS:
            lines.append(
                f"- …and {len(tests) - MAX_SUMMARY_TESTS} more in the "
                "`playwright-flaky-tests` artifact"
            )
    return "\n".join(lines) + "\n\n"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--report-glob",
        action="append",
        required=True,
        help="Playwright JSON report glob; repeatable.",
    )
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--summary", type=Path)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    report_files = _expand_globs(args.report_glob)
    records, parse_errors, _ = _read_reports(report_files)
    tests = flaky_tests(records)
    payload = build_payload(tests, len(report_files) - len(parse_errors), parse_errors)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    if args.summary:
        with args.summary.open("a", encoding="utf-8") as summary:
            summary.write(render_summary(payload))
    print(f"{len(tests)} flaky test(s) across {payload['reports']} report(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
