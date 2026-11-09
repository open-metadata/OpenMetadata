#!/usr/bin/env python3
"""Explain why a PR left the merge queue from the queue commit's GitHub data.

Each workflow run is reported by its first failed job. Jobs that gate or summarise
other jobs need them, so they finish later: they are listed after the cause, never
as it. The script only reads GitHub; the workflow posts what it writes.

ADR:2026-11-09-dequeue-alerts-separate-observed-causes-from-attribution
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import subprocess
import sys
import tempfile
from collections import defaultdict
from collections.abc import Sequence
from datetime import timedelta
from pathlib import Path

import merge_queue_metrics as mq

MAX_LOG_BYTES = 2 * 1024 * 1024
CAUSES = {"failure", "timed_out"}
PASSING = {None, "success", "neutral", "skipped"}
RUN_URL = re.compile(r"^(.*/actions/runs/\d+)/job/\d+$")
# Test steps print application HTTP errors, so only other steps are read for symptoms.
TEST_STEP = re.compile(r"\btests\b|pytest", re.IGNORECASE)
NOT_REQUIRED = (
    "No required check failed — the entry may have timed out, or been dequeued "
    "while a required check was still pending."
)


def failed_steps(job: dict) -> list[str]:
    return [
        step["name"]
        for step in job.get("steps", [])
        if step.get("conclusion") == "failure"
    ]


def failed_logs(repo: str, job: dict) -> str:
    # Job logs are available independently of sibling jobs still running.
    with tempfile.TemporaryFile() as output:
        subprocess.run(
            ["gh", "api", f"repos/{repo}/actions/jobs/{job['id']}/logs"],
            check=True,
            stdout=output,
            stderr=subprocess.DEVNULL,
            timeout=60,
        )
        output.seek(0, 2)
        output.seek(max(0, output.tell() - MAX_LOG_BYTES))
        logs = output.read(MAX_LOG_BYTES).decode("utf-8", errors="replace")
    intervals = [
        (
            mq.parse_ts(step["started_at"]),
            mq.parse_ts(step["completed_at"]) + timedelta(seconds=1),
        )
        for step in job.get("steps", [])
        if step.get("conclusion") == "failure"
        and step.get("started_at")
        and step.get("completed_at")
    ]
    # Step timestamps have second precision; include the completed second in full.
    return "\n".join(
        line
        for line in logs.splitlines()
        if (match := re.match(r"(\d{4}-\d\d-\d\dT[\d:.]+Z)\s", line))
        and any(start <= mq.parse_ts(match[1]) < end for start, end in intervals)
    )


def network_failure(logs: str) -> str:
    # Never copy raw logs, credentials or download URLs into a notification.
    # curl -f names no protocol: "The requested URL returned error: 504".
    status = re.search(
        r"(?:HTTP[^\n]{0,70}?\b|status(?:\s+code)?[\s:=(]*|returned error:\s*)(429|5\d\d)\b",
        logs,
        re.IGNORECASE,
    )
    if status and re.search(
        r"download|fetch",
        logs[max(0, status.start() - 1500) : status.end() + 1500],
        re.IGNORECASE,
    ):
        return f"dependency download failed with HTTP {status[1]}"
    if re.search(
        r"Could not resolve host|Temporary failure in name resolution|EAI_AGAIN|ECONNRESET",
        logs,
    ):
        return "network error"
    return ""


def describe(repo: str, job: dict) -> str:
    steps = failed_steps(job)
    verb = "timed out" if job["conclusion"] == "timed_out" else "failed"
    text = f"{verb} at {', '.join(steps) or 'an unrecorded step'}"
    if any(TEST_STEP.search(step) for step in steps):
        return text
    try:
        symptom = network_failure(failed_logs(repo, job))
    except (OSError, ValueError, subprocess.SubprocessError):
        symptom = ""  # Logs can expire or lag the job conclusion.
    return f"{text}; {symptom}" if symptom else text


def label(check: dict) -> str:
    name = mq.shorten_check_name(check["name"])
    return (
        name if check["conclusion"] == "failure" else f"{name} ({check['conclusion']})"
    )


def run_line(repo: str, run_url: str, checks: list[dict], token: str) -> list:
    """The run's first failed job and what failed after it, as text and links."""
    failed = [check for check in checks if check["conclusion"] in CAUSES]
    first = (failed or checks)[0]
    try:
        job = mq.rest(f"/repos/{repo}/actions/jobs/{first['id']}", token)
        workflow = job["workflow_name"]
        if not isinstance(workflow, str):
            raise ValueError("Invalid workflow name")
        line = [(workflow, run_url), ": "]
        if not failed:
            return line + [", ".join(map(label, checks)) + "."]
        also = ", ".join(label(check) for check in checks if check is not first)
        line += [(mq.shorten_check_name(first["name"]), first["html_url"])]
        return line + [
            f" {describe(repo, job)}" + (f". Also: {also}" if also else "") + "."
        ]
    except Exception as exc:
        # Auxiliary API reads and payload decoding must not suppress the alert.
        print(
            f"::warning::Could not read job {first['id']}: {type(exc).__name__}",
            file=sys.stderr,
        )
        names = ", ".join(map(label, checks))
        return [
            (f"run {run_url.rsplit('/', 1)[1]}", run_url),
            f": {names} (details unavailable).",
        ]


def blocked(repo: str, branch: str, checks: list[dict], token: str) -> str:
    try:
        rules = mq.rest(f"/repos/{repo}/rules/branches/{branch}", token)
        required = {
            check["context"]
            for rule in rules
            if rule["type"] == "required_status_checks"
            for check in rule["parameters"]["required_status_checks"]
        }
        names = dict.fromkeys(
            label(check) for check in checks if check["name"] in required
        )
        return f"Blocked the queue: {', '.join(names)}" if names else NOT_REQUIRED
    except Exception as exc:
        print(
            f"::warning::Could not read required checks: {type(exc).__name__}",
            file=sys.stderr,
        )
        return "Required checks could not be read."


def details(args: argparse.Namespace, token: str) -> tuple[str, list[list]]:
    """A summary line, and one entry per workflow run or external check that failed."""
    if not args.sha:
        return (
            "The entry left the queue before it was built, so no checks ran against it.",
            [],
        )
    owner, name = args.repo.split("/")
    try:
        checks = mq.commit_checks(args.sha, owner, name, token)
        checks = sorted(
            (check for check in checks if check["conclusion"] not in PASSING),
            key=lambda check: (check["completed_at"] or "", check["id"]),
        )
        if not checks:
            return (
                f"No failing check on merge-queue commit {args.sha[:7]} — invalidated by an "
                "entry ahead in the queue, or a required check timed out.",
                [],
            )
        runs, external = defaultdict(list), []
        for check in checks:
            # Checks API reports (e.g. "Unit Test Report") belong to no job.
            if match := RUN_URL.match(check["html_url"]):
                runs[match[1]].append(check)
            else:
                external.append([(label(check), check["html_url"])])
        entries = [
            run_line(args.repo, url, group, token) for url, group in runs.items()
        ]
        return blocked(args.repo, args.branch, checks, token), entries + external
    except Exception as exc:
        print(
            f"::warning::Could not read check runs: {type(exc).__name__}",
            file=sys.stderr,
        )
        return f"Could not read the checks of merge-queue commit {args.sha[:7]}.", []


def markdown_text(text: str) -> str:
    text = html.escape(re.sub(r"\s+", " ", text), quote=False)
    return re.sub(r"([\\`*_\[\]])", r"\\\1", text).replace("@", "&#64;")


def slack_text(text: str) -> str:
    return mq.sanitize_external(re.sub(r"\s+", " ", text))


def render(parts: list, escape, link) -> str:
    return "".join(
        escape(part) if isinstance(part, str) else link(escape(part[0]), part[1])
        for part in parts
    )


def report(
    args: argparse.Namespace, token: str, tests: Sequence[str] = ()
) -> tuple[str, str]:
    """The PR comment in Markdown and the same report in Slack mrkdwn.

    `tests` are failed test names a workflow published elsewhere, listed as given.
    """
    summary, entries = details(args, token)
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    title = f"the {args.queue} — `{args.reason}`"
    markdown = [
        f"### 🚦 Removed from {title} ({args.created})",
        "",
        markdown_text(summary),
    ]
    if entries:
        markdown.append("")
    markdown += [
        "- " + render(entry, markdown_text, lambda text, url: f"[{text}]({url})")
        for entry in entries
    ]
    slack = [
        f":rotating_light: *<{server}/{args.repo}/pull/{args.pr}|PR #{args.pr}>* removed from {title}",
        slack_text(summary),
    ] + [
        "• " + render(entry, slack_text, lambda text, url: f"<{url}|{text}>")
        for entry in entries
    ]
    if tests:
        markdown += ["", "Failed tests:"] + [f"- {markdown_text(t)}" for t in tests]
        slack += ["Failed tests:"] + [f"• {slack_text(t)}" for t in tests]
    return "\n".join(markdown), "\n".join(slack)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in (
        "--repo",
        "--pr",
        "--branch",
        "--queue",
        "--reason",
        "--created",
        "--channel",
    ):
        parser.add_argument(flag, required=True)
    parser.add_argument("--sha", default="")
    parser.add_argument("--body", type=Path, required=True)
    parser.add_argument("--slack", type=Path, required=True)
    parser.add_argument("--failed-tests", type=Path, help="one test name per line")
    args = parser.parse_args()
    lines = args.failed_tests.read_text(encoding="utf-8") if args.failed_tests else ""
    tests = [line for line in lines.splitlines() if line.strip()]
    markdown, slack = report(args, mq.env_token(), tests)
    args.body.write_text(markdown + "\n", encoding="utf-8")
    args.slack.write_text(
        json.dumps({"channel": args.channel, "text": slack}), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
