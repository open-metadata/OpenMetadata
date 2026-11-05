#!/usr/bin/env python3
"""Decision-record bookkeeping: the format of docs/decisions/ and every ADR citation in the tree.

Whether a change needed a record is a reviewer's call and is not checked here
(ADR:2026-10-08-a-decision-is-recorded-in-the-tree-not-in-the-pr-body).

Run with ``python3 scripts/harness/check_decision_records.py``; exits 1 on any problem. Also runs
as a pre-commit hook and as check 9 of ``make harness-check``. Stdlib only.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DECISIONS = "docs/decisions"
THIS_REPO = "OpenMetadata"
# Records in these repos are cited as ADR:<repo>/<date>-<slug>. Their trees are not on disk, so
# only the citation's shape is checked.
OTHER_REPOS = ("ai-platform", "openmetadata-collate")

RECORD_NAME = re.compile(r"(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*")
LOCAL_CITATION = re.compile(r"\bADR:([0-9a-z][\w-]*)(?![\w/-])")
QUALIFIED_CITATION = re.compile(r"\bADR:([A-Za-z][\w.-]*)/([0-9a-z][\w-]*)")
RETIRED_NUMBER = re.compile(r"\bADR-\d{4}\b")
# Only a path that starts its token: ai-platform/docs/decisions/... and URLs name another tree.
RECORD_PATH = re.compile(r"(?<![\w./-])docs/decisions/([0-9a-z][0-9a-z.-]*\.md)")
HEADER_LINES = 14
# The guard's own tests are made of broken citations.
SELF_TEST = "scripts/harness/test_check_decision_records.py"
REQUIRED_FIELDS = ("Status", "Revisions", "Guard")

Problem = tuple[str, int, str]


def check(root: Path) -> list[Problem]:
    records, problems = check_records(root)
    return sorted(problems + check_citations(root, records))


def check_records(root: Path) -> tuple[set[str], list[Problem]]:
    records: set[str] = set()
    problems: list[Problem] = []
    for path in sorted((root / DECISIONS).glob("*.md")):
        if path.name == "README.md":
            continue
        rel = f"{DECISIONS}/{path.name}"
        name = RECORD_NAME.fullmatch(path.stem)
        if name is None:
            problems.append((rel, 1, "name a record YYYY-MM-DD-short-kebab-slug.md; the filename is "
                                     "its identity and ADR:<date>-<slug> resolves straight to it"))
            continue
        records.add(path.stem)
        problems.extend(header_problems(rel, path.read_text(encoding="utf-8"), name.group(1)))
    return records, problems


def header_problems(rel: str, text: str, born: str) -> list[Problem]:
    lines = text.splitlines()
    problems: list[Problem] = []
    if not lines or not lines[0].startswith("# ") or lines[0].startswith("# ADR"):
        problems.append((rel, 1, "the first line is '# <the decision, stated as a sentence>'"))
    head = "\n".join(lines[:HEADER_LINES])
    for field in REQUIRED_FIELDS:
        if not re.search(rf"^- \*\*{field}:\*\* *\S", head, re.M):
            problems.append((rel, 1, f"the header has no '- **{field}:**' line"))
    v1 = re.search(r"^- \*\*Revisions:\*\* *v1 (\d{4}-\d{2}-\d{2})", head, re.M)
    if v1 is None:
        problems.append((rel, 1, "Revisions starts 'v1 YYYY-MM-DD (initial)'"))
    elif v1.group(1) != born:
        problems.append((rel, line_of(head, v1.start()),
                         f"v1 is dated {v1.group(1)} but the filename says {born}; the date never moves"))
    return problems


def check_citations(root: Path, records: set[str]) -> list[Problem]:
    problems: list[Problem] = []
    for rel in candidate_files(root):
        try:
            text = (root / rel).read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for match in RETIRED_NUMBER.finditer(text):
            problems.append((rel, line_of(text, match.start()),
                             f"{match.group(0)} is ai-platform's retired numbering; cite the record "
                             "as ADR:ai-platform/<date>-<slug>"))
        for match in LOCAL_CITATION.finditer(text):
            if match.group(1) not in records:
                problems.append((rel, line_of(text, match.start()),
                                 f"ADR:{match.group(1)} resolves to no record under {DECISIONS}/; a "
                                 "record in another repo is cited as ADR:<repo>/<date>-<slug>"))
        for match in QUALIFIED_CITATION.finditer(text):
            message = qualified_problem(match.group(1), match.group(2))
            if message:
                problems.append((rel, line_of(text, match.start()), message))
        for match in RECORD_PATH.finditer(text):
            if not (root / DECISIONS / match.group(1)).is_file():
                problems.append((rel, line_of(text, match.start()),
                                 f"{DECISIONS}/{match.group(1)} does not exist"))
    return problems


def qualified_problem(repo: str, slug: str) -> str | None:
    if repo == THIS_REPO:
        return f"ADR:{repo}/{slug} is a record in this repo; cite it as ADR:{slug}"
    if repo not in OTHER_REPOS:
        return f"ADR:{repo}/{slug} names no known repo (one of: {', '.join(OTHER_REPOS)})"
    if RECORD_NAME.fullmatch(slug) is None:
        return f"ADR:{repo}/{slug} is not a <date>-<slug> record name"
    return None


def candidate_files(root: Path) -> list[str]:
    """Tracked files that could hold a citation; `git grep` skips binaries and submodules."""
    found = subprocess.run(["git", "grep", "-l", "-I", "-z", "-F", "-e", "ADR:", "-e", "ADR-",
                            "-e", "docs/decisions/"],
                           cwd=root, capture_output=True, text=True, check=False)
    if found.returncode > 1:
        raise RuntimeError(found.stderr.strip())
    return sorted(rel for rel in found.stdout.split("\0") if rel and rel != SELF_TEST)


def line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def main() -> int:
    problems = check(REPO)
    annotate = os.environ.get("GITHUB_ACTIONS") == "true"
    for file, line, message in problems:
        print(f"::error file={file},line={line}::{message}" if annotate else f"{file}:{line}: {message}",
              file=sys.stderr)
    if problems:
        print(f"{len(problems)} decision-record problem(s); the rules are in {DECISIONS}/README.md",
              file=sys.stderr)
        return 1
    print("Decision records clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
