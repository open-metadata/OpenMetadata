#!/usr/bin/env python3
"""Publish a merge-queue conflict resolution: check it, push it, say what happened.

Runs in ci-conflict-resolve.yml's publish job with main's code. Its inputs are the
resolve job's artifacts — the plan, the checks, the model's notes or reason for
declining, and the id of the merge commit made before any PR code ran — and the
verify job's bundle. Verify ran PR code to regenerate files, so its result is
checked here rather than trusted:

  - it must build on the resolve job's merge commit;
  - every commit after that may touch only generated output, lockfiles and locale
    files.

Then it pushes fast-forward onto the head it started from (if the branch moved, the
push fails, which is the right outcome), comments, and turns on auto-merge — the PR
re-enters the queue once its checks pass — only for a purely mechanical resolution
that dropped nothing. Anything a model edited waits for a person, because
approvals survive pushes in this repository.

Env: STATE, VERIFY_RESULT, PR, HEAD_SHA, HEAD_REPO, HEAD_REF, REPO, MODE, GH_TOKEN,
PUSH_TOKEN (publish App, may be empty).
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import conflict_resolvers as resolvers
import merge_queue_metrics as mq
from merge_gate import post

MARKER = "<!-- ci-conflict-resolve: {head} -->"
MAX_NOTES_CHARS = 3000
AUTO_MERGE = """
mutation($id: ID!) { enablePullRequestAutoMerge(input: {pullRequestId: $id, mergeMethod: SQUASH}) { clientMutationId } }
"""
REGENERATED = resolvers.GENERATED + resolvers.LOCKFILES + resolvers.LOCALES


def read_artifacts(directory: Path) -> dict:
    def text(name: str) -> str:
        path = directory / name
        return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""

    def data(name: str) -> dict:
        raw = text(name)
        return json.loads(raw) if raw.strip() else {}

    return {
        "plan": data("plan.json").get("plan") or {},
        "check": data("check.json"),
        "notes": text("notes.md")[:MAX_NOTES_CHARS],
        "abort": text("abort.md")[:MAX_NOTES_CHARS],
        "merge_commit": text("merge-commit.txt").strip(),
        "verified": directory / "verified.bundle",
    }


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True).stdout


def verified_head(repo: Path, source: str, head_sha: str, merge_commit: str, bundle: Path) -> tuple[str, list[str]]:
    """The commit to push, and why it must not be pushed (empty when it may).
    `source` is the PR's repository (a URL, or a path in tests)."""
    repo.mkdir(parents=True, exist_ok=True)
    git(repo, "init", "-q")
    git(repo, "fetch", "-q", source, head_sha)
    git(repo, "fetch", "-q", str(bundle), "HEAD")
    head = git(repo, "rev-parse", "FETCH_HEAD").strip()
    problems = []
    try:
        git(repo, "merge-base", "--is-ancestor", merge_commit, head)
    except subprocess.CalledProcessError:
        return head, ["verify's result does not build on the resolution's merge commit"]
    parents = git(repo, "rev-list", "--parents", "-n", "1", merge_commit).split()
    if len(parents) != 3 or parents[1] != head_sha:
        problems.append("the resolution is not a merge into the PR head it started from")
    after = [p for p in git(repo, "diff", "--name-only", merge_commit, head).splitlines() if p]
    stray = [p for p in after if not resolvers.matches(p, REGENERATED)]
    if stray:
        problems.append("verify changed files that are not generated output: " + ", ".join(stray[:10]))
    return head, problems


def requeue_policy(state: str, plan: dict, check: dict) -> str:
    if state != "resolved" or not check.get("ok"):
        return "none"
    return check.get("requeue") or "human"


def render(state: str, art: dict, pushed: bool, requeue: str, problems: list[str], mode: str, head: str) -> str:
    plan, check = art["plan"], art["check"]
    title = {
        "resolved": "resolved by CI" if pushed else "resolution ready (not pushed)",
        "clean": "no longer conflicts with `main`",
        "human": "needs a person",
        "needs-model": "needs a person (AI resolution is off)",
        "declined": "Claude declined to resolve it",
        "failed-check": "the resolution failed its checks",
    }.get(state, state)
    lines = [f"### 🔀 Merge conflict with `main`: {title}", ""]
    mechanical = (plan.get("generated") or []) + (plan.get("lockfile") or []) + (plan.get("locale") or [])
    model = (plan.get("ai") or []) + (plan.get("sensitive") or [])
    if mechanical:
        lines.append("**Resolved mechanically:** " + ", ".join(f"`{mq.sanitize_external(p)}`" for p in mechanical))
    if model:
        lines.append("**Resolved by Claude:** " + ", ".join(f"`{mq.sanitize_external(p)}`" for p in model))
    if plan.get("human"):
        lines.append("**Left for a person** (CI never edits these): " + ", ".join(f"`{p}`" for p in plan["human"]))
    for path, sides in (check.get("dropped") or {}).items():
        for side, missing in sides.items():
            if missing:
                shown = "; ".join(f"`{mq.sanitize_external(line)[:120]}`" for line in missing[:5])
                lines.append(f"⚠️ `{path}`: lines {'this PR' if side == 'pr' else 'main'} added that the resolution no longer contains: {shown}")
    if problems:
        lines += ["", "**Not pushed:** " + "; ".join(problems)]
    if art["abort"]:
        lines += ["", "<details><summary>Why Claude declined</summary>", "", mq.sanitize_external(art["abort"]), "", "</details>"]
    if art["notes"]:
        lines += ["", "<details><summary>Resolution notes</summary>", "", mq.sanitize_external(art["notes"]), "", "</details>"]
    lines.append("")
    if requeue == "auto" and pushed:
        lines.append("Every conflict was mechanical and nothing was dropped, so auto-merge is on: the PR re-enters the queue once its checks pass.")
    elif state == "resolved":
        lines.append("Review the merge commit, then re-queue the PR. Code a model edited is never re-queued automatically.")
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
        if env.get("VERIFY_RESULT") != "success":
            problems.append("the verify job did not pass")
        elif not art["verified"].exists() or not art["merge_commit"]:
            problems.append("verify produced no result")
        else:
            with tempfile.TemporaryDirectory() as scratch:
                head, found = verified_head(
                    Path(scratch), f"https://github.com/{head_repo}.git", head_sha, art["merge_commit"], art["verified"]
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
