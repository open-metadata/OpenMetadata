#!/usr/bin/env python3
"""Publish a merge-queue conflict resolution: check it, push it, say what happened.

Runs in ci-conflict-resolve.yml's publish job with main's code. Its inputs are the
resolve job's artifacts — the plan, the checks, the model's notes or reason for
declining, and the resolution: one merge commit into the PR head, as a git bundle.
Nothing in that workflow builds or runs the merged code; pushing it starts the PR's
own CI, which does.

The bundle is re-checked here rather than trusted:

  - it must be exactly the resolve job's merge commit, on top of the head it started
    from, and that job's checks must have passed;
  - merging the same two parents again (`git merge-tree`) must leave conflicted every
    file the resolution changed: a clean merge decides the rest, so a difference there
    is an edit outside the conflict.

Then it pushes fast-forward onto that head (if the branch moved, the push fails, which
is the right outcome), comments, and turns on auto-merge — the PR re-enters the queue
once its checks pass on the merge commit — only for a purely mechanical resolution
that dropped nothing and needs no regeneration. Anything else waits for a person,
because approvals survive pushes in this repository.

Env: STATE, PR, HEAD_SHA, HEAD_REPO, HEAD_REF, REPO, MODE, GH_TOKEN, PUSH_TOKEN
(publish App, may be empty).
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path

import merge_queue_metrics as mq
from merge_gate import post

MARKER = "<!-- ci-conflict-resolve: {head} -->"
MAX_NOTES_CHARS = 3000
MAX_LISTED = 10
AUTO_MERGE = """
mutation($id: ID!) { enablePullRequestAutoMerge(input: {pullRequestId: $id, mergeMethod: SQUASH}) { clientMutationId } }
"""


def read_artifacts(directory: Path) -> dict:
    def text(name: str) -> str:
        path = directory / name
        return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""

    def data(name: str) -> dict:
        raw = text(name)
        return json.loads(raw) if raw.strip() else {}

    plan = data("plan.json")
    return {
        "plan": plan.get("plan") or {},
        "regenerate": plan.get("regenerate") or [],
        "check": data("check.json"),
        "notes": text("notes.md")[:MAX_NOTES_CHARS],
        "abort": text("abort.md")[:MAX_NOTES_CHARS],
        "merge_commit": text("merge-commit.txt").strip(),
        "bundle": directory / "resolution.bundle",
    }


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True).stdout


def outside_conflicts(repo: Path, ours: str, theirs: str, resolved: str) -> list[str]:
    """Files `resolved` changed that merging `ours` and `theirs` does not leave conflicted."""
    merged = subprocess.run(
        ["git", "merge-tree", "--write-tree", "--name-only", "--no-messages", ours, theirs],
        cwd=repo,
        capture_output=True,
        text=True,
    )
    if merged.returncode not in (0, 1):
        raise subprocess.CalledProcessError(merged.returncode, "git merge-tree", merged.stdout, merged.stderr)
    tree, *conflicted = merged.stdout.splitlines()
    changed = git(repo, "diff", "--name-only", tree, resolved).splitlines()
    return sorted(set(changed) - set(conflicted))


def resolution_head(repo: Path, source: str, head_sha: str, merge_commit: str, bundle: Path) -> tuple[str, list[str]]:
    """The commit to push, and why it must not be pushed (empty when it may).
    `source` is the PR's repository (a URL, or a path in tests)."""
    repo.mkdir(parents=True, exist_ok=True)
    git(repo, "init", "-q")
    git(repo, "fetch", "-q", source, head_sha)
    git(repo, "fetch", "-q", str(bundle), "HEAD")
    head = git(repo, "rev-parse", "FETCH_HEAD").strip()
    if head != merge_commit:
        return head, ["the bundle is not the resolution's merge commit"]
    parents = git(repo, "rev-list", "--parents", "-n", "1", head).split()
    if len(parents) != 3 or parents[1] != head_sha:
        return head, ["the resolution is not a merge into the PR head it started from"]
    stray = outside_conflicts(repo, head_sha, parents[2], head)
    if stray:
        shown = ", ".join(stray[:MAX_LISTED])
        return head, [f"the resolution changed files merging main does not leave conflicted: {shown}"]
    return head, []


def requeue_policy(state: str, plan: dict, check: dict) -> str:
    if state != "resolved" or not check.get("ok"):
        return "none"
    return check.get("requeue") or "human"


def code(text: str) -> str:
    return f"`{mq.sanitize_external(text).replace('`', '')}`"


def render(state: str, art: dict, pushed: bool, requeue: str, problems: list[str], mode: str, head: str) -> str:
    plan, check = art["plan"], art["check"]
    title = {
        "resolved": "resolved by CI" if pushed else "resolution ready (not pushed)",
        "clean": "no longer conflicts with `main`",
        "human": "needs a person",
        "needs-model": "needs a person (AI resolution is off)",
        "declined": "Claude declined to resolve it",
        "agent-failed": "Claude did not finish, so nothing it edited is used",
        "failed-check": "the resolution failed its checks",
    }.get(state, state)
    lines = [f"### 🔀 Merge conflict with `main`: {title}", ""]
    mechanical = (plan.get("generated") or []) + (plan.get("lockfile") or []) + (plan.get("locale") or [])
    model = (plan.get("ai") or []) + (plan.get("sensitive") or [])
    if mechanical:
        lines.append("**Resolved mechanically:** " + ", ".join(code(p) for p in mechanical))
    if model:
        lines.append("**Resolved by Claude:** " + ", ".join(code(p) for p in model))
    if plan.get("human"):
        lines.append("**Left for a person** (CI never edits these): " + ", ".join(code(p) for p in plan["human"]))
    for path, sides in (check.get("dropped") or {}).items():
        for side, missing in sides.items():
            if missing:
                shown = "; ".join(code(line[:120]) for line in missing[:5])
                lines.append(f"⚠️ {code(path)}: lines {'this PR' if side == 'pr' else 'main'} added that the resolution no longer contains: {shown}")
    if state == "resolved" and art["regenerate"]:
        lines += [
            "",
            "**Regenerate before re-queueing.** Main's version of the generated files and lockfiles was taken;"
            " nothing here runs a generator, since that would run this PR's code. TypeScript types are"
            " regenerated on same-repo PRs by `typescript-type-generation.yml`; otherwise run:",
            "",
            "```sh",
            *(shlex.join(command) for command in art["regenerate"]),
            "```",
        ]
    if problems:
        lines += ["", "**Not pushed:** " + "; ".join(problems)]
    if art["abort"]:
        lines += ["", "<details><summary>Why Claude declined</summary>", "", mq.sanitize_external(art["abort"]), "", "</details>"]
    if art["notes"]:
        lines += ["", "<details><summary>Resolution notes</summary>", "", mq.sanitize_external(art["notes"]), "", "</details>"]
    lines.append("")
    if requeue == "auto" and pushed:
        lines.append(
            "Every conflict was mechanical and nothing was dropped, so auto-merge is on: the PR re-enters"
            " the queue once its checks pass on the merge commit."
        )
    elif state == "resolved":
        lines.append(
            "This PR's CI builds and tests the merge commit. Review it, then re-queue the PR;"
            " code a model edited is never re-queued automatically."
        )
    if mode != "on":
        lines.append(f"_Dry run (`CI_CONFLICT_MODE={mode}`): nothing was pushed._")
    lines.append(MARKER.format(head=head))
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--artifacts", type=Path, required=True)
    args = parser.parse_args(argv)
    env = os.environ
    state, mode = env.get("STATE", ""), env.get("MODE", "dry-run")
    head_sha, head_repo, head_ref = env["HEAD_SHA"], env["HEAD_REPO"], env["HEAD_REF"]
    repo, pr, token = env["REPO"], env["PR"], mq.env_token()
    art = read_artifacts(args.artifacts)

    pushed, problems = False, []
    requeue = requeue_policy(state, art["plan"], art["check"])
    if state == "resolved":
        if not art["check"].get("ok"):
            problems.append("the resolution's checks did not pass")
        elif not art["bundle"].exists() or not art["merge_commit"]:
            problems.append("the resolve job produced no merge commit")
        else:
            with tempfile.TemporaryDirectory() as scratch:
                head, found = resolution_head(
                    Path(scratch), f"https://github.com/{head_repo}.git", head_sha, art["merge_commit"], art["bundle"]
                )
                problems += found
                push_token = env.get("PUSH_TOKEN") or ""
                if not problems and mode == "on" and push_token:
                    subprocess.run(
                        ["git", "push", "-q", f"https://x-access-token:{push_token}@github.com/{head_repo}.git", f"{head}:refs/heads/{head_ref}"],
                        cwd=scratch, check=True, capture_output=True,
                    )
                    pushed = True
                elif not problems and mode == "on":
                    problems.append("no publish App is configured")
    if pushed and requeue == "auto":
        node = mq.rest(f"/repos/{repo}/pulls/{pr}", token)["node_id"]
        mq.graphql(AUTO_MERGE, {"id": node}, token)
    post(f"/repos/{repo}/issues/{pr}/comments", {"body": render(state, art, pushed, requeue, problems, mode, head_sha)}, token)
    print(json.dumps({"state": state, "pushed": pushed, "requeue": requeue, "problems": problems}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
