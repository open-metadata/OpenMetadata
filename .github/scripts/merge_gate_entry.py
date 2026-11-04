#!/usr/bin/env python3
"""Who is in a merge-queue entry, and what it changed.

GitHub builds each queue entry on main plus every entry ahead of it, under a ref
named `gh-readonly-queue/<base>/pr-<N>-<parentSha>`. The ref names only the entry's
own PR; the PRs ahead are recovered from the squash commits between main and the
entry head, whose titles end in `(#N)`.

The PR set matters because entries are cumulative: a test that fails in M+A and in
M+A+B says nothing about B, since both contain A. A failure elsewhere is evidence
about this entry only when the two share no PR.
"""

from __future__ import annotations

import fnmatch
import re
from collections.abc import Iterable
from dataclasses import dataclass

import merge_queue_metrics as mq
import plan_local_java_tests as planner

QUEUE_REF = re.compile(
    r"^(?:refs/heads/)?gh-readonly-queue/(?P<base>.+)/pr-(?P<pr>\d+)-(?P<parent>[0-9a-f]{40})$"
)
PR_SUFFIX = re.compile(r"\(#(\d+)\)")
# The compare API lists at most 300 files and 250 commits; past that the entry is
# treated as if it touched everything.
COMPARE_FILE_LIMIT = 300
COMPARE_COMMIT_LIMIT = 250


@dataclass(frozen=True)
class QueueRef:
    base: str
    pr: int
    parent_sha: str


@dataclass(frozen=True)
class Entry:
    ref: QueueRef
    head_sha: str
    prs: frozenset[int]
    changed_files: tuple[str, ...]
    truncated: bool


def parse_queue_ref(ref: str) -> QueueRef | None:
    match = QUEUE_REF.match(ref or "")
    if not match:
        return None
    return QueueRef(match["base"], int(match["pr"]), match["parent"])


def pr_from_title(title: str) -> int | None:
    """The squash merge's own PR is the last `(#N)`: titles such as
    `Fixes #1: … (#34644) (#34677)` carry the PR they reference first."""
    numbers = PR_SUFFIX.findall(title or "")
    return int(numbers[-1]) if numbers else None


def entry_from_compare(ref: QueueRef, head_sha: str, compare: dict) -> Entry:
    titles = [
        (commit.get("commit") or {}).get("message", "").split("\n", 1)[0]
        for commit in compare.get("commits") or []
    ]
    prs = {pr for pr in map(pr_from_title, titles) if pr is not None}
    prs.add(ref.pr)
    files = tuple(f["filename"] for f in compare.get("files") or [] if f.get("filename"))
    truncated = (
        len(files) >= COMPARE_FILE_LIMIT
        or int(compare.get("total_commits") or 0) > COMPARE_COMMIT_LIMIT
    )
    return Entry(ref, head_sha, frozenset(prs), files, truncated)


def load_entry(owner: str, repo: str, ref: QueueRef, head_sha: str, token: str) -> Entry:
    """Three-dot compare against the base branch: GitHub diffs from the merge base,
    which is the latest main commit the entry contains."""
    compare = mq.rest(
        f"/repos/{owner}/{repo}/compare/{ref.base}...{head_sha}?per_page=100", token
    )
    return entry_from_compare(ref, head_sha, compare)


def independent(observed_prs: frozenset[int], entry_prs: frozenset[int]) -> bool:
    """A run on main has no PR set and is always independent evidence."""
    return not (observed_prs & entry_prs)


def _it_file(test_id: str) -> tuple[str, str]:
    """(path under the IT source root, simple class name) of a `Class#method` test id."""
    outer = test_id.partition("#")[0].split("$", 1)[0]
    return outer.replace(".", "/") + ".java", outer.rsplit(".", 1)[-1]


def impact_related(test_ids: Iterable[str], changed_files: Iterable[str], impact_map: dict) -> frozenset[str]:
    """The tests `.github/java-tests/impact-map.json` links to the changed files, by the
    rules plan_local_java_tests.py applies without reading code: the test's own file, an
    area that owns a changed file and names the test, an entity name (`TableRepository`
    → `Table…IT`), and every test for shared infrastructure, a full-suite area, or
    production code no rule places (which the planner answers with the full suite).
    The links it finds by reading code (references, callers) are not applied here."""
    tests = {test_id: _it_file(test_id) for test_id in test_ids}
    it_root = impact_map["maven"]["integrationTestSourceRoot"].rstrip("/") + "/"
    related: set[str] = set()
    for path in changed_files:
        if planner.matches(path, impact_map["ignore"]):
            continue
        if planner.matches(path, impact_map["sharedInfrastructure"]):
            return frozenset(tests)
        areas = [area for area in impact_map["areas"] if planner.matches(path, area["sources"])]
        if any(area.get("fullSuite") for area in areas):
            return frozenset(tests)
        stem = planner.convention_stem(path)
        named = {test_id for test_id, (_, name) in tests.items() if stem and planner.stem_matches(stem, name)}
        if not areas and not named and "/src/test/" not in path:
            return frozenset(tests)
        for test_id, (relative, name) in tests.items():
            # As the planner reads an area's pattern: a path when it has a slash, else a class name.
            owned = any(
                fnmatch.fnmatchcase(relative if "/" in pattern else name, pattern)
                for area in areas
                for pattern in area["tests"]
            )
            if owned or test_id in named or path == it_root + relative:
                related.add(test_id)
    return frozenset(related)
