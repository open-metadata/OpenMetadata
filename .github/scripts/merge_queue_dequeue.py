#!/usr/bin/env python3
"""Explain why a PR left the merge queue from the queue commit's GitHub data.

Each failed workflow run that blocked the queue gets one verdict comparing its failures
with runs that lack the PR. Known summary gates are listed after their upstream failure.
The script only reads GitHub; the workflow posts what it writes.

ADR:2026-11-13-dequeue-alerts-compare-runs-without-the-pr
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import subprocess
import tempfile
from collections import defaultdict
from collections.abc import Sequence
from datetime import timedelta
from pathlib import Path

import merge_queue_diagnosis as diagnosis
import merge_queue_metrics as mq

MAX_LOG_BYTES = 2 * 1024 * 1024
CAUSES = {"failure", "timed_out"}
PASSING = {None, "success", "neutral", "skipped"}
NOT_REQUIRED = (
    "No required check failed — the entry may have timed out, or been dequeued "
    "while a required check was still pending."
)
RUN_URL = re.compile(r"^(.*/actions/runs/\d+)/job/\d+$")
# These jobs report upstream outcomes rather than run tests, in Collate and OpenMetadata.
SUMMARY_CHECKS = {
    "caip-playwright-summary",
    "integration-tests-mysql-elasticsearch",
    "integration-tests-postgres-elasticsearch-redis",
    "integration-tests-postgres-opensearch",
    "openmetadata-service-unit-tests-status",
    "playwright-summary",
    "py-run-tests",
    "py-tests-status",
    "python / Verify Expected Jobs",
    "python-tests / Verify Expected Jobs",
}


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


def infrastructure(repo: str, job: dict) -> str:
    """A download or network error in the job's failed non-test steps, if logged."""
    # Test steps print application HTTP errors, so only other steps are read.
    if any(diagnosis.TEST_STEP.search(step) for step in diagnosis.failed_steps(job)):
        return ""
    try:
        return network_failure(failed_logs(repo, job))
    except (OSError, ValueError, subprocess.SubprocessError):
        return ""  # Logs can expire or lag the job conclusion.


def describe(job: dict, symptom: str) -> str:
    verb = "timed out" if job["conclusion"] == "timed_out" else "failed"
    steps = ", ".join(diagnosis.failed_steps(job)) or "an unrecorded step"
    text = f"{verb} at {steps}"
    return f"{text}; {symptom}" if symptom else text


def label(check: dict) -> str:
    name = mq.shorten_check_name(check["name"])
    return (
        name if check["conclusion"] == "failure" else f"{name} ({check['conclusion']})"
    )


def run_block(
    repo: str, run_url: str, checks: list[dict], evidence: diagnosis.Evidence
) -> tuple[list, diagnosis.Verdict]:
    """One line per failed job of a run that blocked the queue, and the run's verdict."""
    run_id = int(run_url.rsplit("/", 1)[1])
    failed = [check for check in checks if check["conclusion"] in CAUSES]
    causes = [
        check for check in failed if check["name"] not in SUMMARY_CHECKS
    ] or failed
    try:
        workflow = evidence.api(f"actions/runs/{run_id}")["name"]
        jobs = evidence.jobs(run_id)
        if not isinstance(workflow, str):
            raise ValueError("Invalid workflow name")
    except Exception as exc:
        # Auxiliary API reads and payload decoding must not suppress the alert.
        diagnosis.warn(f"Could not read run {run_id}", exc)
        names = ", ".join(map(label, checks))
        return [[(f"run {run_id}", run_url), f": {names} (details unavailable)."]], (
            diagnosis.Verdict("unknown", ("Unknown — the failed run is unreadable.",))
        )
    rows, symptoms = [], {}
    for index, cause in enumerate(causes):
        others = (
            [check for check in checks if check not in causes] if index == 0 else []
        )
        also = ", ".join(map(label, others))
        job = jobs.get(
            cause["name"], {"id": cause["id"], "conclusion": cause["conclusion"]}
        )
        if symptom := infrastructure(repo, job):
            symptoms[cause["name"]] = symptom
        text = f" {describe(job, symptom)}" + (f". Also: {also}" if also else "") + "."
        name = (mq.shorten_check_name(cause["name"]), cause["html_url"])
        rows.append([(workflow, run_url), ": ", name, text])
    # A summary gate also passes when its upstream jobs skip, so it is never evidence.
    cause_jobs = [
        jobs[cause["name"]]
        for cause in causes
        if cause["name"] in jobs and cause["name"] not in SUMMARY_CHECKS
    ]
    return rows, evidence.diagnose(run_id, cause_jobs, symptoms)


def blocked(
    repo: str, branch: str, checks: list[dict], token: str
) -> tuple[str, set[str]]:
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
        return (
            f"Required queue gate: {', '.join(names)}" if names else NOT_REQUIRED
        ), required
    except Exception as exc:
        diagnosis.warn("Could not read required checks", exc)
        return "Required queue checks could not be read.", set()


def details(
    args: argparse.Namespace, token: str
) -> tuple[str, list[tuple[list, diagnosis.Verdict | None]]]:
    """A summary line, and per failed run or external check its lines and verdict."""
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
        runs = defaultdict(list)
        for check in checks:
            # Checks API reports (e.g. "Unit Test Report") belong to no job.
            if match := RUN_URL.match(check["html_url"]):
                runs[match[1]].append(check)
        evidence = diagnosis.Evidence(
            args.repo, args.branch, int(args.pr), args.created, token
        )
        summary, required = blocked(args.repo, args.branch, checks, token)
        blocks = []
        for url, group in runs.items():
            if any(
                check["name"] in required and check["conclusion"] in CAUSES
                for check in group
            ):
                blocks.append(run_block(args.repo, url, group, evidence))
                continue
            parts = ["Other checks: "]
            for check in group:
                parts += [", "] if len(parts) > 1 else []
                parts.append((label(check), check["html_url"]))
            blocks.append(([parts], None))
        unknown = ("Unknown — this required check has no Actions job to compare.",)
        blocks += [
            (
                [[(label(check), check["html_url"])]],
                diagnosis.Verdict("unknown", unknown)
                if check["name"] in required
                else None,
            )
            for check in checks
            if not RUN_URL.match(check["html_url"])
        ]
        blocks.sort(key=lambda block: block[1] is None)
        return summary, blocks
    except Exception as exc:
        diagnosis.warn("Could not read check runs", exc)
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
    """The PR comment in Markdown and the same report in Slack mrkdwn."""
    summary, blocks = details(args, token)
    # A gate whose upstream jobs were cancelled says nothing about the PR or main.
    kinds = {verdict.kind for _, verdict in blocks if verdict} - {"gate"}
    icon = "🚨" if "main" in kinds else "🔵" if kinds == {"pr"} else "⚠️"
    rows, shown = [], set()
    for entries, verdict in blocks:
        if verdict:
            rows.append(["PR vs. main: ", *verdict.text])
            for index, test in enumerate(verdict.failures[:5]):
                tag = f" — {verdict.tags[index]}" if verdict.tags else ""
                rows.append([f"Failed test: {test[:500]}{tag}"])
            if len(verdict.failures) > 5:
                extra = len(verdict.failures) - 5
                rows.append([f"{extra} additional failed tests in the linked report."])
            shown.update(verdict.failures)
            rows += [list(row) for row in verdict.rca]
        rows += entries
    if summary:
        rows.append([summary])
    annotated = [test for test in dict.fromkeys(tests) if test not in shown]
    rows += [[f"Failed test: {test[:500]}"] for test in annotated[:5]]
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    title = f"the {args.queue} — `{args.reason}`"
    markdown = [
        f"### {icon} Removed from {title} ({args.created})",
        *[
            render(row, markdown_text, lambda text, url: f"[{text}]({url})")
            for row in rows
        ],
    ]
    slack = [
        f"{icon} *<{server}/{args.repo}/pull/{args.pr}|PR #{args.pr}>* removed from {title}",
        *[render(row, slack_text, lambda text, url: f"<{url}|{text}>") for row in rows],
    ]
    return "\n\n".join(markdown), "\n".join(slack)


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
