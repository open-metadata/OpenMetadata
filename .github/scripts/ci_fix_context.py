#!/usr/bin/env python3
"""The evidence a CI fix agent starts from, assembled without a model.

  --pr N      the PR's latest failed merge-queue run of ci.yml: its failing tests,
              their messages, the same-run verification table, and the exact
              command that reproduces each one (from verify_failures.py, the same
              commands the merge gate's verify job runs)
  --issue N   a `flaky-test` registry issue: the test, its fingerprint and the
              occurrences recorded in the issue's JSON block

Everything here came from CI artifacts or an issue body, which code under test and
issue authors control: it is size-capped and wrapped as untrusted data for the
prompt, and secrets are redacted before it is written.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import merge_gate_evidence as evidence_mod
import merge_gate_policy as gate
import merge_queue_metrics as mq
import verify_failures as verify

MAX_TESTS = 5
MAX_MESSAGE_CHARS = 1500
MAX_CONTEXT_CHARS = 40_000
SECRETS = re.compile(
    r"(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9]{20,}|"
    r"sk-ant-[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16}|(?i:bearer)\s+[A-Za-z0-9._~+/-]{16,}=*)"
)
INVISIBLE = re.compile("[​-‏‪-‮⁠-⁤﻿]")
JSON_BLOCK = re.compile(r"```json\s*(\{.*?\})\s*```", re.S)


def clean(text: str, limit: int = MAX_MESSAGE_CHARS) -> str:
    return SECRETS.sub("<redacted>", INVISIBLE.sub("", text or ""))[:limit]


def repro(test_id: str, outcome_context: dict | None) -> str:
    """The targeted command, built the way verify_failures.py builds it."""
    if " :: " in test_id:
        target = verify.playwright_target(test_id, "")
        return f"cd openmetadata-ui/src/main/resources/ui && npx playwright test {target.file} --project={target.project} -g {json.dumps(target.title.split(' › ')[-1])} --retries=0"
    if outcome_context and outcome_context.get("lane"):
        target = verify.java_target(test_id, "", outcome_context)
        return " ".join(verify.java_command([target]))
    return f"cd ingestion && python -m pytest {verify.python_nodeid(test_id, verify.INGESTION_DIR) or test_id}"


def latest_failed_queue_run(owner: str, repo: str, pr: int, token: str) -> dict | None:
    runs = mq.paginated_items(
        f"/repos/{owner}/{repo}/actions/workflows/ci.yml/runs?event=merge_group&status=failure",
        "workflow_runs",
        token,
        max_pages=3,
    )
    mine = [r for r in runs if f"/pr-{pr}-" in (r.get("head_branch") or "")]
    return max(mine, key=lambda r: r["id"]) if mine else None


def pr_context(owner: str, repo: str, pr: int, token: str) -> str:
    run = latest_failed_queue_run(owner, repo, pr, token)
    if run is None:
        return f"No failed merge-queue run of ci.yml was found for PR #{pr}."
    attempt = int(run.get("run_attempt") or 1)
    failed_jobs, verified, fingerprints = evidence_mod.run_evidence(owner, repo, run, attempt, token)
    by_id = {v.test_id: v for v in verified}
    lines = [f"Failed merge-queue run: {run['html_url']} (attempt {attempt})", ""]
    shown = 0
    for job in failed_jobs:
        lines.append(f"## Job `{clean(job.name, 200)}` — failed step `{clean(job.failed_step or '-', 200)}`")
        if job.reason:
            lines += ["<untrusted kind=\"log\">", clean(job.reason), "</untrusted>"]
        for test_id in job.failing_tests:
            if shown >= MAX_TESTS:
                break
            shown += 1
            record = by_id.get(test_id)
            verdict = gate.classify_test(record) if record else gate.NOT_VERIFIED
            lines += [
                f"### `{clean(test_id, 300)}`",
                f"- Verification: {verdict}"
                + (f" (entry {record.entry_failed}/{record.entry_runs} failed" if record else "")
                + (f", parent {record.parent_failed}/{record.parent_runs} failed)" if record and record.parent_runs else (")" if record else "")),
                f"- Fingerprint: {fingerprints.get(test_id, '')}",
                f"- Reproduce: `{repro(test_id, {'lane': job.name.split(' / ')[-1], 'profile': job.name.split(' / ')[1]} if job.name.startswith('it / ') else None)}`",
            ]
    return "\n".join(lines)


def issue_context(owner: str, repo: str, number: int, token: str) -> str:
    issue = mq.rest(f"/repos/{owner}/{repo}/issues/{number}", token)
    body = issue.get("body") or ""
    match = JSON_BLOCK.search(body)
    stats = json.loads(match.group(1)) if match else {}
    test_id = str(stats.get("testId") or stats.get("test") or issue.get("title", "")).removeprefix("Flaky: ")
    lines = [f"Flaky-test issue #{number}: `{clean(test_id, 300)}`", f"- Fingerprint: {clean(str(stats.get('fingerprint') or ''), 40)}"]
    for occurrence in (stats.get("occurrences") or [])[-MAX_TESTS:]:
        lines += ["<untrusted kind=\"log\">", clean(json.dumps(occurrence)), "</untrusted>"]
    lines.append(f"- Reproduce: `{repro(test_id, stats.get('context'))}`")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--owner", default="open-metadata")
    parser.add_argument("--repo", default="OpenMetadata")
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--pr", type=int)
    target.add_argument("--issue", type=int)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    token = mq.env_token()
    try:
        text = pr_context(args.owner, args.repo, args.pr, token) if args.pr else issue_context(args.owner, args.repo, args.issue, token)
    except (mq.ApiError, OSError, ValueError, KeyError) as exc:
        print(f"::error::could not assemble the fix context: {exc}", file=sys.stderr)
        return 1
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(text[:MAX_CONTEXT_CHARS], encoding="utf-8")
    print(text[:2000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
