#!/usr/bin/env python3
"""Merge-queue conflicts: re-queue the ones that resolved themselves, and pick the
ones that need resolving.

merge-queue-dequeue-report.yml labels every MERGE_CONFLICT dequeue by what the PR
conflicts with (ADR 2026-10-13):

  queue conflict  applies cleanly to main; it clashed only with an entry ahead.
                  Once that entry has left the queue the PR is re-queued here with
                  its head unchanged, so there is nothing new to review. At most
                  MAX_REQUEUES_PER_DAY times a day, so two PRs that conflict with
                  each other cannot ping-pong forever.
  merge conflict  conflicts with main. `candidates` lists the PRs the resolver
                  (ci-conflict-resolve.yml) should attempt: same-repo or
                  maintainer-editable, not attempted yet for their current head.

Labels added with the default token trigger no workflow, so this runs on a
schedule and on pushes to main rather than on the label.

Mode (CI_CONFLICT_MODE): off | dry-run (default) | on.

Exits 0 after acting, 1 when GitHub could not be read.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import timedelta
from pathlib import Path

import merge_queue_metrics as mq

QUEUE_CONFLICT = "queue conflict"
MERGE_CONFLICT = "merge conflict"
MAX_REQUEUES_PER_DAY = 3
MAX_CANDIDATES = 20
ATTEMPT_MARKER = "<!-- ci-conflict-resolve:"

PRS_QUERY = """
query($q: String!, $events: Int!) {
  search(query: $q, type: ISSUE, first: 50) {
    nodes {
      ... on PullRequest {
        id
        number
        headRefName
        headRefOid
        isDraft
        mergeable
        maintainerCanModify
        isCrossRepository
        mergeQueueEntry { id }
        adds: timelineItems(last: $events, itemTypes: [ADDED_TO_MERGE_QUEUE_EVENT]) {
          nodes { ... on AddedToMergeQueueEvent { createdAt } }
        }
        comments(last: 30) { nodes { body } }
      }
    }
  }
}
"""

ENQUEUE = """
mutation($id: ID!) { enqueuePullRequest(input: {pullRequestId: $id}) { mergeQueueEntry { id } } }
"""


def labelled(owner: str, repo: str, label: str, token: str) -> list[dict]:
    query = f'repo:{owner}/{repo} is:pr is:open label:"{label}"'
    data = mq.graphql(PRS_QUERY, {"q": query, "events": 20}, token)
    return [node for node in data["search"]["nodes"] if node]


def requeues_today(pr: dict) -> int:
    since = mq.utcnow() - timedelta(hours=24)
    return sum(
        1 for event in (pr.get("adds") or {}).get("nodes") or [] if mq.parse_ts(event["createdAt"]) >= since
    )


def requeue_decision(pr: dict) -> tuple[bool, str]:
    """Whether a `queue conflict` PR goes back in the queue now, and why (not)."""
    if pr.get("mergeQueueEntry"):
        return False, "already queued"
    if pr.get("isDraft"):
        return False, "draft"
    if pr.get("mergeable") != "MERGEABLE":
        # CONFLICTING now means the entry ahead merged: it is a main conflict for
        # the resolver; UNKNOWN is GitHub still computing, so try again next run.
        return False, f"mergeable is {pr.get('mergeable')}"
    if requeues_today(pr) >= MAX_REQUEUES_PER_DAY:
        return False, f"re-queued {MAX_REQUEUES_PER_DAY} times in 24 h already"
    return True, "clean against main, head unchanged"


def attempted(pr: dict) -> bool:
    marker = f"{ATTEMPT_MARKER} {pr['headRefOid']} -->"
    return any(marker in (c.get("body") or "") for c in (pr.get("comments") or {}).get("nodes") or [])


def candidate_decision(pr: dict) -> tuple[bool, str]:
    """Whether the resolver should attempt a `merge conflict` PR now."""
    if pr.get("mergeQueueEntry"):
        return False, "queued"
    if pr.get("isDraft"):
        return False, "draft"
    if pr.get("mergeable") != "CONFLICTING":
        return False, f"mergeable is {pr.get('mergeable')}"
    if pr.get("isCrossRepository") and not pr.get("maintainerCanModify"):
        return False, "fork without maintainer edits: a patch comment is the most the resolver can do"
    if attempted(pr):
        return False, "already attempted for this head"
    return True, "conflicts with main"


def cmd_requeue(args: argparse.Namespace, token: str) -> int:
    report = []
    for pr in labelled(args.owner, args.repo, QUEUE_CONFLICT, token):
        go, why = requeue_decision(pr)
        acted = False
        if go and args.mode == "on":
            mq.graphql(ENQUEUE, {"id": pr["id"]}, token)
            acted = True
        report.append({"pr": pr["number"], "requeue": go, "why": why, "acted": acted})
    print(json.dumps(report, indent=1))
    return 0


def cmd_candidates(args: argparse.Namespace, token: str) -> int:
    chosen, skipped = [], []
    for pr in labelled(args.owner, args.repo, MERGE_CONFLICT, token):
        go, why = candidate_decision(pr)
        (chosen if go else skipped).append({"pr": pr["number"], "head": pr["headRefOid"], "why": why})
    chosen = chosen[: min(MAX_CANDIDATES, args.limit)]
    payload = {"candidates": chosen, "skipped": skipped}
    if args.out:
        args.out.write_text(json.dumps(payload, indent=1))
    print(json.dumps(payload, indent=1))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--owner", default="open-metadata")
    parser.add_argument("--repo", default="OpenMetadata")
    parser.add_argument("--mode", default=os.environ.get("CI_CONFLICT_MODE") or "dry-run", choices=("off", "dry-run", "on"))
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("requeue")
    candidates = commands.add_parser("candidates")
    candidates.add_argument("--limit", type=int, default=8, help="the day's remaining resolver budget")
    candidates.add_argument("--out", type=Path)
    args = parser.parse_args(argv)
    if args.mode == "off":
        print("CI_CONFLICT_MODE=off: nothing to do")
        return 0
    token = mq.env_token()
    try:
        return {"requeue": cmd_requeue, "candidates": cmd_candidates}[args.command](args, token)
    except (mq.ApiError, RuntimeError, OSError) as exc:
        print(f"::error::queue conflicts: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
