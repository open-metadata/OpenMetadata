#!/usr/bin/env python3
"""Publish a CI fix agent's patch, after checking it against the patch policy.

Runs in ci-ai-fix.yml's publish job with main's code and the publish App token. The
agent only edited files, and nothing in that workflow runs the patched code: its
events run in main's context, where anything executed could write main's caches. The
CI of the PR the patch lands in tests it — unit tests on the PR, the integration and
Playwright suites in the merge queue once a person re-queues. This job decides
whether the patch may be published at all:

  - it may not touch CI, agent or build configuration, dependency manifests,
    migrations or generated files;
  - at most MAX_FILES files and MAX_LINES changed lines;
  - it may not delete a test or add a skip, fixme, xfail or quarantine marker;
  - raised timeouts and removed assertions are allowed but called out to the reviewer.

A PR fix (`/ci-fix` on an ejected PR) is pushed fast-forward onto the PR head it
started from; a flaky-test fix (from the registry) goes on a `ci-fix/flaky-<issue>`
branch with a new PR that says `Fixes #<issue>`. Nothing is re-queued: a person
reviews the change first (ADR:2026-10-13-ci-ai-output-is-advisory-and-never-decides-a-merge).

Env: TARGET (pr|issue), NUMBER, BASE_SHA, HEAD_REPO, HEAD_REF, REPO, MODE (CI_AI_MODE),
STATE (the fix job's), GH_TOKEN, PUSH_TOKEN.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import conflict_resolvers as resolvers
import merge_queue_metrics as mq
from merge_gate import post

MAX_FILES = 10
MAX_LINES = 300
DENIED = (
    ".github/**", ".claude/**", "skills/**", "AGENTS.md", "CLAUDE.md", ".mcp.json",
    "pom.xml", "**/pom.xml", "**/package.json", "package.json", "**/yarn.lock", "yarn.lock",
    "Makefile", "**/Makefile", "scripts/**", "docker/**", "bootstrap/sql/**",
    "ingestion/setup.py", "ingestion/pyproject.toml", "ingestion/noxfile.py",
) + resolvers.GENERATED
SKIP_MARKERS = re.compile(
    r"@Disabled\b|@Ignore\b|\btest\.(skip|fixme)\(|\.skip\(|@quarantine\b|pytest\.mark\.(skip|xfail)\b|\bxit\(|\bxdescribe\("
)
TEST_FILE = re.compile(r"(Test|IT)\.java$|\.spec\.ts$|\.test\.tsx?$|(^|/)test_[^/]+\.py$")
ASSERTION = re.compile(r"\bassert|\bexpect\(|\bverify\(")
TIMEOUT = re.compile(r"timeout", re.I)


@dataclass
class PolicyResult:
    violations: list[str] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)


def check_patch(numstat: str, patch: str) -> PolicyResult:
    """Apply the patch policy to `git diff --numstat` and `git diff -U0` output."""
    result = PolicyResult()
    files, lines = [], 0
    for row in numstat.splitlines():
        added, removed, path = row.split("\t", 2)
        files.append(path)
        lines += (int(added) if added.isdigit() else 0) + (int(removed) if removed.isdigit() else 0)
        if resolvers.matches(path, DENIED):
            result.violations.append(f"touches {path}, which a fix agent may not change")
    if len(files) > MAX_FILES:
        result.violations.append(f"changes {len(files)} files (limit {MAX_FILES})")
    if lines > MAX_LINES:
        result.violations.append(f"changes {lines} lines (limit {MAX_LINES})")
    current = ""
    # A rewritten line shows as one removal and one addition, so assertions are
    # compared per file: only a file that ends up with fewer is flagged.
    assertions: dict[str, list[int]] = {}
    for line in patch.splitlines():
        if line.startswith("+++ "):
            current = line[6:] if line.startswith("+++ b/") else line[4:]
            continue
        if line.startswith("--- "):
            continue
        if line.startswith("+") and SKIP_MARKERS.search(line):
            result.violations.append(f"adds a skip marker in {current}: {line[1:].strip()[:120]}")
        if line[:1] in "+-" and ASSERTION.search(line) and TEST_FILE.search(current or ""):
            counts = assertions.setdefault(current, [0, 0])
            counts[line[0] == "+"] += 1
        if line.startswith("+") and TIMEOUT.search(line):
            result.flags.append(f"changes a timeout in {current}: {line[1:].strip()[:120]}")
    for path, (removed, added) in assertions.items():
        if removed > added:
            result.flags.append(f"removes {removed - added} assertion line(s) in {path}")
    # A deleted file shows `+++ /dev/null`; catch deletions of tests by name too.
    for match in re.finditer(r"^diff --git a/(\S+) b/\S+\ndeleted file mode", patch, re.M):
        if TEST_FILE.search(match.group(1)):
            result.violations.append(f"deletes the test file {match.group(1)}")
    result.violations = list(dict.fromkeys(result.violations))
    return result


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True).stdout


def load_bundle(repo: Path, source: str, base_sha: str, bundle: Path) -> tuple[str, PolicyResult]:
    repo.mkdir(parents=True, exist_ok=True)
    git(repo, "init", "-q")
    git(repo, "fetch", "-q", source, base_sha)
    not_based = PolicyResult(violations=["the patch does not build on the commit it started from"])
    try:
        # A bundle whose prerequisite is not that commit cannot even be fetched.
        git(repo, "fetch", "-q", str(bundle), "HEAD")
    except subprocess.CalledProcessError:
        return "", not_based
    head = git(repo, "rev-parse", "FETCH_HEAD").strip()
    try:
        git(repo, "merge-base", "--is-ancestor", base_sha, head)
    except subprocess.CalledProcessError:
        return head, not_based
    numstat = git(repo, "diff", "--numstat", base_sha, head)
    patch = git(repo, "diff", "-U0", base_sha, head)
    return head, check_patch(numstat, patch)


UNPUBLISHED = {
    "agent-failed": "Claude did not finish, so nothing it edited is used.",
    "empty": "Claude changed no file.",
}


def render(
    target: str, number: str, policy: PolicyResult, notes: str, abort: str, published: str, mode: str, state: str = ""
) -> str:
    lines = ["### 🤖 CI fix " + ("published" if published else "not published"), ""]
    if state in UNPUBLISHED:
        lines.append(UNPUBLISHED[state])
    if abort:
        lines += ["Claude declined:", "", mq.sanitize_external(abort[:2000])]
    if published:
        lines.append(published)
        where = "this PR's" if target == "pr" else "the new PR's"
        lines.append(
            f"- Not run yet: {where} CI tests it (unit tests now; integration and Playwright in the merge queue)."
        )
    lines += [f"- ⛔ {mq.sanitize_external(v)}" for v in policy.violations]
    lines += [f"- ⚠️ {mq.sanitize_external(f)}" for f in policy.flags[:10]]
    if notes:
        lines += ["", "<details><summary>Notes from the agent</summary>", "", mq.sanitize_external(notes[:3000]), "", "</details>"]
    lines += ["", "Advisory: a person reviews and re-queues; nothing here affects merging by itself."]
    if mode != "on":
        lines.append(f"_`CI_AI_MODE={mode}`: nothing was pushed._")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--artifacts", type=Path, required=True)
    args = parser.parse_args(argv)
    env = os.environ
    target, number, repo = env["TARGET"], env["NUMBER"], env["REPO"]
    base_sha, head_repo, head_ref = env["BASE_SHA"], env["HEAD_REPO"], env.get("HEAD_REF", "")
    mode, token = env.get("MODE", "shadow"), mq.env_token()
    notes_path, abort_path = args.artifacts / "notes.md", args.artifacts / "abort.md"
    notes = notes_path.read_text(errors="replace") if notes_path.exists() else ""
    abort = abort_path.read_text(errors="replace") if abort_path.exists() else ""
    bundle = args.artifacts / "fix.bundle"
    policy, published = PolicyResult(), ""
    if not abort and bundle.exists():
        with tempfile.TemporaryDirectory() as scratch:
            head, policy = load_bundle(Path(scratch), f"https://github.com/{head_repo}.git", base_sha, bundle)
            push_token = env.get("PUSH_TOKEN") or ""
            if not policy.violations and mode == "on" and push_token:
                remote = f"https://x-access-token:{push_token}@github.com/{head_repo}.git"
                if target == "pr":
                    subprocess.run(["git", "push", "-q", remote, f"{head}:refs/heads/{head_ref}"], cwd=scratch, check=True, capture_output=True)
                    published = f"Pushed onto `{head_ref}` as {head[:12]}."
                else:
                    branch = f"ci-fix/flaky-{number}"
                    subprocess.run(["git", "push", "-q", remote, f"{head}:refs/heads/{branch}"], cwd=scratch, check=True, capture_output=True)
                    opened = post(
                        f"/repos/{repo}/pulls",
                        {"title": f"Fix flaky test from #{number}", "head": branch, "base": "main",
                         "body": f"Fixes #{number}\n\n{mq.sanitize_external(notes[:3000])}\n\n_Proposed by the CI fix agent; review before merging._"},
                        push_token,
                    )
                    post(f"/repos/{repo}/issues/{opened['number']}/labels", {"labels": ["ai-generated"]}, push_token)
                    published = f"Opened #{opened['number']} from `{branch}`."
    body = render(target, number, policy, notes, abort, published, mode, env.get("STATE", ""))
    post(f"/repos/{repo}/issues/{number}/comments", {"body": body}, token)
    print(json.dumps({"published": bool(published), "violations": policy.violations, "flags": policy.flags}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
