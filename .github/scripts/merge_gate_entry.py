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

import re
from dataclasses import dataclass

import merge_queue_metrics as mq

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
