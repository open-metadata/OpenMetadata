#!/usr/bin/env python3
"""Explain why a PR left the merge queue from the queue commit's GitHub data.

Each independent failed job is compared with main. Known summary gates are listed
after their upstream failure. The script only reads GitHub; the workflow posts
what it writes.

ADR:2026-11-12-dequeue-alerts-compare-main-before-attributing-failures
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
# Test steps print application HTTP errors, so only other steps are read for symptoms.
TEST_STEP = re.compile(r"\btests\b|pytest", re.IGNORECASE)
# These repository jobs report upstream outcomes, rather than execute the tests.
SUMMARY_CHECKS = {
    "caip-playwright-summary",
    "playwright-summary",
    "py-run-tests",
    "python-tests / Verify Expected Jobs",
    "python / Verify Expected Jobs",
    "py-tests-status",
    "openmetadata-service-unit-tests-status",
}


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


def run_line(
    repo: str,
    run_url: str,
    checks: list[dict],
    evidence: diagnosis.Evidence,
    sha: str,
) -> tuple[list, diagnosis.Diagnosis]:
    """Describe a failed job and its related reporting checks, as text and links."""
    failed = [check for check in checks if check["conclusion"] in CAUSES]
    first = (failed or checks)[0]
    try:
        job = evidence.api(f"actions/jobs/{first['id']}")
        workflow = job["workflow_name"]
        if not isinstance(workflow, str):
            raise ValueError("Invalid workflow name")
        line = [(workflow, run_url), ": "]
        if not failed:
            return line + [", ".join(map(label, checks)) + "."], diagnosis.Diagnosis(
                "Unknown — no completed failing job to compare."
            )
        try:
            comparison = evidence.diagnose(
                int(run_url.rsplit("/", 1)[1]), first["id"], sha
            )
        except Exception as exc:
            print(
                f"::warning::Could not compare job {first['id']}: {type(exc).__name__}",
                file=sys.stderr,
            )
            comparison = diagnosis.Diagnosis(
                "Unknown — test or main comparison evidence could not be read."
            )
        also = ", ".join(label(check) for check in checks if check is not first)
        line += [(mq.shorten_check_name(first["name"]), first["html_url"])]
        return line + [
            f" {describe(repo, job)}" + (f". Also: {also}" if also else "") + "."
        ], comparison
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
        ], diagnosis.Diagnosis("Unknown — failing job details are unavailable.")


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
        print(
            f"::warning::Could not read required checks: {type(exc).__name__}",
            file=sys.stderr,
        )
        return "Required queue checks could not be read.", set()


def details(
    args: argparse.Namespace, token: str
) -> tuple[str, list[list], list[diagnosis.Diagnosis | None]]:
    """A summary line, and one entry per failed job or external check."""
    if not args.sha:
        return (
            "The entry left the queue before it was built, so no checks ran against it.",
            [],
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
                [],
            )
        runs = defaultdict(list)
        for check in checks:
            # Checks API reports (e.g. "Unit Test Report") belong to no job.
            if match := RUN_URL.match(check["html_url"]):
                runs[match[1]].append(check)
        evidence = diagnosis.Evidence(args.repo, args.branch, args.created, token)
        summary, required = blocked(args.repo, args.branch, checks, token)
        results = []
        for url, group in runs.items():
            if not any(
                check["name"] in required and check["conclusion"] in CAUSES
                for check in group
            ):
                parts = ["Other checks: "]
                for check in group:
                    if len(parts) > 1:
                        parts.append(", ")
                    parts.append((label(check), check["html_url"]))
                results.append((parts, None))
                continue
            causes = [
                check
                for check in group
                if check["conclusion"] in CAUSES and check["name"] not in SUMMARY_CHECKS
            ]
            if not causes:
                results.append(run_line(args.repo, url, group, evidence, args.sha))
            for index, cause in enumerate(causes):
                others = (
                    [check for check in group if check not in causes]
                    if index == 0
                    else []
                )
                results.append(
                    run_line(args.repo, url, [cause, *others], evidence, args.sha)
                )
        results += [
            (
                [(label(check), check["html_url"])],
                diagnosis.Diagnosis(
                    "Unknown — required check has no comparable Actions job."
                )
                if check["name"] in required
                else None,
            )
            for check in checks
            if not RUN_URL.match(check["html_url"])
        ]
        results.sort(key=lambda result: result[1] is None)
        return (
            summary,
            [entry for entry, _ in results],
            [comparison for _, comparison in results],
        )
    except Exception as exc:
        print(
            f"::warning::Could not read check runs: {type(exc).__name__}",
            file=sys.stderr,
        )
        return (
            f"Could not read the checks of merge-queue commit {args.sha[:7]}.",
            [],
            [],
        )


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
    summary, entries, comparisons = details(args, token)
    attributed = [comparison for comparison in comparisons if comparison is not None]
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    title = f"the {args.queue} — `{args.reason}`"
    main_failure = any(comparison.main for comparison in attributed)
    pr_failure = bool(attributed) and all(
        comparison.pr and len(comparison.pr) == len(comparison.failures)
        for comparison in attributed
    )
    icon = "🚨" if main_failure else "🔵" if pr_failure else "⚠️"
    rows = []
    if len(attributed) != 1:
        assessment = (
            "Main failures confirmed; see each workflow below."
            if main_failure
            else "Likely PR/merge-group error."
            if pr_failure
            else "Unknown — no single confirmed attribution."
        )
        rows.append([f"PR vs. main: {assessment}"])
    for index, entry in enumerate(entries):
        if index < len(comparisons) and comparisons[index] is not None:
            comparison = comparisons[index]
            line = [f"PR vs. main: {comparison.comparison}"]
            if comparison.baseline_url:
                line += [" ", ("Main baseline", comparison.baseline_url)]
            rows.append(line)
            rows += [
                [f"Failed test: {test.name[:500]}"] for test in comparison.failures[:5]
            ]
            if len(comparison.failures) > 5:
                rows.append(
                    [
                        f"{len(comparison.failures) - 5} additional failed tests in the linked report."
                    ]
                )
            for failure, (commit, note) in list(
                zip(comparison.main, comparison.introductions)
            )[:5]:
                rows.append([f"RCA: {failure.name[:500]} — {failure.symptom}"])
                if commit:
                    rows.append(
                        [
                            "Introduced by: ",
                            (commit[:7], f"{server}/{args.repo}/commit/{commit}"),
                            f" — {note}.",
                        ]
                    )
                else:
                    rows.append([f"Introducing commit: {note}."])
        rows.append(entry)
    if summary:
        rows.append([summary])
    shown_tests = {
        test.name for comparison in attributed for test in comparison.failures
    }
    annotation_tests = list(
        dict.fromkeys(test for test in tests if test not in shown_tests)
    )
    rows += [[f"Failed test: {test[:500]}"] for test in annotation_tests[:5]]
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
