#!/usr/bin/env python3
"""Explain dequeued jobs using existing GitHub metadata and logs only.

ADR:2026-11-09-dequeue-alerts-separate-observed-causes-from-attribution
"""

from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import sys
import tempfile
from datetime import timedelta
from pathlib import Path

import merge_queue_metrics as mq

MAX_LOG_BYTES = 2 * 1024 * 1024


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
    status = re.search(
        r"(?:HTTP[^\n]{0,70}?\b|status(?:\s+code)?[\s:=(]*)(429|5\d\d)\b",
        logs,
        re.IGNORECASE,
    )
    if status and re.search(
        r"download|fetch",
        logs[max(0, status.start() - 1500) : status.end() + 1500],
        re.IGNORECASE,
    ):
        return f"Dependency download failed with HTTP {status[1]}; PR causation unconfirmed."
    if re.search(
        r"Could not resolve host|Temporary failure in name resolution|EAI_AGAIN|ECONNRESET",
        logs,
    ):
        return "Network error; PR causation unconfirmed."
    return ""


def main_context(
    repo: str, sha: str, branch: str, run: dict, name: str, token: str
) -> str:
    # Git ancestry supplies the base without a producer-side artifact or branch-name parsing.
    base = mq.rest(f"/repos/{repo}/compare/{sha}...{branch}", token)[
        "merge_base_commit"
    ]["sha"]
    runs = mq.paginated_items(
        f"/repos/{repo}/actions/workflows/{run['workflow_id']}/runs?head_sha={base}&status=completed",
        "workflow_runs",
        token,
        max_pages=1,
    )
    for baseline in runs:
        event, head_branch = baseline["event"], baseline.get("head_branch", "")
        target = (event in {"push", "workflow_dispatch"} and head_branch == branch) or (
            event == "merge_group"
            and head_branch.startswith(f"gh-readonly-queue/{branch}/")
        )
        if (
            baseline["head_sha"] != base
            or not target
            or baseline["conclusion"] not in {"success", "failure"}
        ):
            continue
        jobs = mq.paginated_items(
            f"/repos/{repo}/actions/runs/{baseline['id']}/attempts/{baseline['run_attempt']}/jobs",
            "jobs",
            token,
        )
        job = next(
            (
                job
                for job in jobs
                if job["name"] == name and job["conclusion"] in {"success", "failure"}
            ),
            None,
        )
        if job is None:
            continue
        link = f"https://github.com/{repo}/actions/runs/{baseline['id']}"
        if job["conclusion"] == "success":
            return f"Job passed on main at {base[:7]}; possible PR/merge-group regression or flake. {link}"
        steps = ", ".join(failed_steps(job)) or "unrecorded step"
        return f"Main also failed this job at {base[:7]} ({steps}); matching cause unconfirmed. {link}"
    return f"No completed matching main job at {base[:7]}; origin unconfirmed."


def diagnose(repo: str, sha: str, url: str, name: str, branch: str, token: str) -> str:
    match = re.search(r"/actions/runs/(\d+)/job/(\d+)$", url)
    if match is None:
        return "No Actions job reference."
    run_id, job_id = match.groups()
    run = mq.rest(f"/repos/{repo}/actions/runs/{run_id}", token)
    jobs = mq.paginated_items(
        f"/repos/{repo}/actions/runs/{run_id}/attempts/{run['run_attempt']}/jobs",
        "jobs",
        token,
    )
    job = next(
        (job for job in jobs if str(job["id"]) == job_id and job["name"] == name), None
    )
    if run["head_sha"] != sha or run["event"] != "merge_group" or job is None:
        return "Job is not from the current queue-run attempt."
    if job["conclusion"] != "failure":
        return f"Job conclusion: {job['conclusion'] or 'pending'}; origin unconfirmed."
    others = [
        other["name"]
        for other in jobs
        if other["id"] != job["id"] and other.get("conclusion") == "failure"
    ]
    if name.endswith("-summary") and others:
        return "Summary check; failed jobs in this run: " + ", ".join(others) + "."
    steps = failed_steps(job)
    detail = "Failed step: " + (", ".join(steps) or "not recorded") + "."
    if not any(re.search(r"\btests\b|pytest", step, re.IGNORECASE) for step in steps):
        try:
            network = network_failure(failed_logs(repo, job))
        except (OSError, ValueError, subprocess.SubprocessError):
            network = ""  # Logs can expire or lag the job conclusion.
        if network:
            return f"{detail} {network}"
    try:
        context = main_context(repo, sha, branch, run, name, token)
    except Exception as exc:
        # GitHub reads are auxiliary: keep the observed cause if comparison fails.
        print(
            f"::warning::Main comparison unavailable: {type(exc).__name__}",
            file=sys.stderr,
        )
        context = "Main comparison unavailable; origin unconfirmed."
    return f"{detail} {context}"


def report(args: argparse.Namespace) -> None:
    token = mq.env_token()
    markdown, slack = [], []
    for line in args.failures.read_text(encoding="utf-8").splitlines():
        url, separator, name = line.partition("\t")
        if not separator:
            name, reason = "", "Malformed Actions job reference."
        else:
            try:
                reason = diagnose(args.repo, args.sha, url, name, args.branch, token)
            except Exception as exc:
                print(
                    f"::warning::Could not read job details: {type(exc).__name__}",
                    file=sys.stderr,
                )
                reason = "Job details unavailable; inspect the linked run."
        name, reason = " ".join(name.split()), " ".join(reason.split())
        literal = re.sub(
            r"([\\`*_\[\]])",
            r"\\\1",
            html.escape(f"{name}: {reason}" if name else reason, quote=False),
        ).replace("@", "&#64;")
        markdown.append(f"Cause: {literal}")
        slack.append(
            "Cause: " + mq.sanitize_external(f"{name}: {reason}" if name else reason)
        )
    print(json.dumps({"markdown": "\n".join(markdown), "slack": "\n".join(slack)}))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--branch", required=True)
    parser.add_argument("--failures", type=Path, required=True)
    report(parser.parse_args())


if __name__ == "__main__":
    main()
