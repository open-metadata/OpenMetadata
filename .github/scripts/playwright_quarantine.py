#!/usr/bin/env python3
"""The checked-in Playwright quarantine: `.github/playwright/quarantine.json`.

Each entry names one test by `spec` (relative to `playwright/e2e/`) and `title`
(the describe › test path, as `playwright-flaky-tests.json` lists it), and must
carry the GitHub `issue` that tracks its fix and the date it was `added`.

The shard planner drops quarantined tests from pull-request and merge-queue
plans, so a known flake cannot fail a PR or eject a queue entry. The nightly
schedule still runs them, and render_playwright_summary.cjs reports their
failures there without failing the check, so the issue keeps getting evidence.

Run directly to validate the file: `python3 .github/scripts/playwright_quarantine.py`.
"""

from __future__ import annotations

import argparse
import copy
import json
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from playwright_flaky_tests import spec_path

QUARANTINE_FILE = Path(".github/playwright/quarantine.json")
ISSUE_URL = re.compile(r"^https://github\.com/[\w.-]+/[\w.-]+/issues/\d+$")
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
REQUIRED_FIELDS = ("spec", "title", "issue", "added")


class QuarantineError(ValueError):
    """The quarantine file is malformed; the message lists every problem."""


@dataclass(frozen=True)
class Entry:
    spec: str
    title: str
    issue: str
    added: str

    @property
    def key(self) -> tuple[str, str]:
        return (self.spec, self.title)


def _entry_problems(index: int, raw: object) -> list[str]:
    if not isinstance(raw, dict):
        return [f"tests[{index}] is not an object"]
    problems = [
        f"tests[{index}] is missing `{name}`"
        for name in REQUIRED_FIELDS
        if not isinstance(raw.get(name), str) or not raw[name].strip()
    ]
    if problems:
        return problems
    if not raw["spec"].endswith(".spec.ts"):
        problems.append(f"tests[{index}].spec must name a .spec.ts file")
    if not ISSUE_URL.match(raw["issue"]):
        problems.append(
            f"tests[{index}].issue must be a GitHub issue URL "
            "(https://github.com/<owner>/<repo>/issues/<number>)"
        )
    if not ISO_DATE.match(raw["added"]):
        problems.append(f"tests[{index}].added must be a YYYY-MM-DD date")
    else:
        try:
            date.fromisoformat(raw["added"])
        except ValueError:
            problems.append(f"tests[{index}].added is not a real date")
    return problems


def parse_quarantine(payload: object) -> list[Entry]:
    if not isinstance(payload, dict) or not isinstance(payload.get("tests"), list):
        raise QuarantineError("the file must be an object with a `tests` list")
    problems: list[str] = []
    entries: list[Entry] = []
    seen: set[tuple[str, str]] = set()
    for index, raw in enumerate(payload["tests"]):
        entry_problems = _entry_problems(index, raw)
        if entry_problems:
            problems.extend(entry_problems)
            continue
        entry = Entry(
            spec=spec_path(raw["spec"].strip()),
            title=raw["title"].strip(),
            issue=raw["issue"].strip(),
            added=raw["added"].strip(),
        )
        if entry.key in seen:
            problems.append(f"tests[{index}] duplicates {entry.spec} › {entry.title}")
            continue
        seen.add(entry.key)
        entries.append(entry)
    if problems:
        raise QuarantineError("; ".join(problems))
    return entries


def load_quarantine(path: Path) -> list[Entry]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise QuarantineError(f"cannot read {path}: {error}") from error
    return parse_quarantine(payload)


def _strip_suite(
    suite: dict[str, Any],
    spec: str,
    titles: tuple[str, ...],
    keys: set[tuple[str, str]],
    removed: list[dict[str, Any]],
) -> None:
    if isinstance(suite.get("specs"), list):
        kept = []
        for test_spec in suite["specs"]:
            title = " › ".join((*titles, str(test_spec.get("title", ""))))
            if (spec, title) not in keys:
                kept.append(test_spec)
                continue
            removed.append(
                {
                    "spec": spec,
                    "title": title,
                    "projects": sorted(
                        {
                            str(test.get("projectName", ""))
                            for test in test_spec.get("tests", [])
                        }
                    ),
                }
            )
        suite["specs"] = kept
    for child in suite.get("suites", []):
        _strip_suite(child, spec, (*titles, str(child.get("title", ""))), keys, removed)


def strip_quarantined(
    report: dict[str, Any], entries: list[Entry]
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Return a copy of a `playwright test --list --reporter=json` report
    without the quarantined tests, and the tests it removed.

    Title paths are built the way the shard planner builds them: the file
    suite's own title is skipped, every describe below it is kept.
    """
    stripped = copy.deepcopy(report)
    keys = {entry.key for entry in entries}
    removed: list[dict[str, Any]] = []
    if keys:
        for file_suite in stripped.get("suites", []):
            _strip_suite(
                file_suite, spec_path(str(file_suite.get("file", ""))), (), keys, removed
            )
    return stripped, removed


def unmatched_entries(entries: list[Entry], removed: list[dict[str, Any]]) -> list[Entry]:
    """Entries that matched no listed test: renamed, moved or deleted tests."""
    matched = {(test["spec"], test["title"]) for test in removed}
    return [entry for entry in entries if entry.key not in matched]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", type=Path, default=QUARANTINE_FILE)
    args = parser.parse_args(argv)
    try:
        entries = load_quarantine(args.path)
    except QuarantineError as error:
        print(f"::error file={args.path}::{error}")
        return 1
    print(f"{args.path}: {len(entries)} quarantined test(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
