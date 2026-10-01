#!/usr/bin/env python3
"""Daily merge-queue Playwright report for #pw-health: hard failures and flakes.

Replaces the one-Slack-post-per-queue-run flaky alert, which buried the channel.
For every merge-group run of playwright-postgresql-e2e.yml in the window it reads:
  * flaky tests — each shard's "Retry pass in merge queue" annotation, fetched for
    the whole run with one GraphQL check-suite query;
  * failed tests and their errors — the failed shards' `playwright-results-json-*`
    artifacts, which the queue uploads only on failure;
  * for a failed run that names no failed test (a shard killed by its timeout, a
    job that never got a runner) — the failed jobs and their failure annotations.
It writes an HTML report (the workflow prints it to PDF), a markdown job summary,
and a Slack `files.uploadV2` payload.

Counting rules, taken from triaging the queue by hand:
  * A dequeued PR is re-queued and re-runs the same tests, so one stall can
    triple every count. Tests are ranked by distinct PRs; raw runs sit beside it.
  * Flaky hits in runs that passed are the clean signal; hits in runs that failed
    (ejected batches) are counted separately.
  * A flaky test is "new" when it was not flaky in the `--lookback-hours` before
    `--since` and is not in main's flake baseline. The PR of the first run that
    hit it is the suspect.

Exits:
  0 — report written
  1 — could not list the runs (bad token, API down)
"""

from __future__ import annotations

import argparse
import base64
import html
import io
import json
import os
import re
import subprocess
import zipfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import merge_queue_metrics as mq

WORKFLOW = "playwright-postgresql-e2e.yml"
RETRY_PASS = "Retry pass in merge queue"
RESULTS_ARTIFACT = "playwright-results-json-"
SUMMARY_JOB = "playwright-summary"
BASELINE_REF = "ci/playwright-timing"
TEST_RE = re.compile(r"^(?P<file>.+?):(?P<line>\d+) › (?P<title>.+)$")
ANSI = re.compile(r"[\x1b\ufffd]\[[0-9;]*m")
TOP = 10
MAX_ERRORS_SHOWN = 3
# A passing run costs one GraphQL query; a failed run adds an artifact listing and
# one download per failed shard. Both caps keep a run far inside GITHUB_TOKEN's
# hourly budget on any plan.
MAX_WINDOW_HOURS = 48
MAX_LOOKBACK_HOURS = 24
# Every job of a run in one query. ponytail: 50 annotations per job, and the usual
# two are runner notices; a shard with more than that loses the rest.
ANNOTATIONS_QUERY = """query($id: ID!) { node(id: $id) { ... on CheckSuite {
  checkRuns(first: 100) { nodes { annotations(first: 50) { nodes { title message } } } }
} } }"""


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--owner", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument(
        "--since", default="", help="UTC ISO date or time; default 24h before --until"
    )
    parser.add_argument("--until", default="", help="UTC ISO date or time; default now")
    parser.add_argument("--lookback-hours", type=float, default=24)
    parser.add_argument("--channel", required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    return parser.parse_args(argv)


def parse_when(value: str, default: datetime) -> datetime:
    if not value.strip():
        return default
    parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M")


def split_test(name: str) -> tuple[str, int, str]:
    match = TEST_RE.match(name)
    return (
        (match["file"], int(match["line"]), match["title"]) if match else (name, 0, "")
    )


def first_line(error: str) -> str:
    line = next(
        (value for value in ANSI.sub("", error).splitlines() if value.strip()), ""
    )
    return line.strip()[:300]


# --------------------------------------------------------------------- reading


def list_runs(
    owner: str, repo: str, start: datetime, end: datetime, token: str
) -> list[dict]:
    stamp = "%Y-%m-%dT%H:%M:%SZ"
    query = urlencode(
        {
            "event": "merge_group",
            "status": "completed",
            "created": f"{start.astimezone(timezone.utc):{stamp}}..{end.astimezone(timezone.utc):{stamp}}",
        }
    )
    return mq.paginated_items(
        f"/repos/{owner}/{repo}/actions/workflows/{WORKFLOW}/runs?{query}",
        "workflow_runs",
        token,
    )


def read_flaky(run: dict, token: str) -> dict[tuple[str, str], int]:
    """(file, title) -> line of every retry pass the run's shards annotated."""
    data = mq.graphql(ANNOTATIONS_QUERY, {"id": run["check_suite_node_id"]}, token)
    jobs = (data.get("node") or {}).get("checkRuns", {}).get("nodes")
    if not isinstance(jobs, list):
        raise mq.ApiError(f"No check suite for run {run['id']}")
    flaky = {}
    for job in jobs:
        for note in (job.get("annotations") or {}).get("nodes") or []:
            if note.get("title") != RETRY_PASS:
                continue
            for name in str(note.get("message") or "").splitlines():
                if name.strip():
                    file, line, title = split_test(name.strip())
                    flaky[(file, title)] = line
    return flaky


def download_zip(owner: str, repo: str, artifact: dict, token: str) -> bytes:
    if artifact.get("size_in_bytes", 0) > 20 * 1024 * 1024:
        raise mq.ApiError(f"Oversized artifact {artifact['name']}")
    # gh follows the API -> signed blob redirect without exposing the token.
    completed = subprocess.run(
        ["gh", "api", f"repos/{owner}/{repo}/actions/artifacts/{artifact['id']}/zip"],
        env={**os.environ, "GH_TOKEN": token},
        capture_output=True,
        timeout=120,
        check=False,
    )
    if completed.returncode:
        raise mq.ApiError(f"Download failed for {artifact['name']}")
    return completed.stdout


def results_tests(results: dict) -> tuple[dict, dict]:
    """(failed, flaky) from one Playwright results.json, keyed by (file, title)."""
    failed, flaky = {}, {}

    def walk(suite: dict) -> None:
        for spec in suite.get("specs") or []:
            key = (str(spec.get("file") or ""), str(spec.get("title") or ""))
            line = int(spec.get("line") or 0)
            for test in spec.get("tests") or []:
                if test.get("status") == "flaky":
                    flaky[key] = line
                if test.get("status") == "unexpected":
                    last = (test.get("results") or [{}])[-1]
                    error = first_line(
                        str((last.get("error") or {}).get("message") or "")
                    )
                    failed[key] = (line, failed.get(key, (line, ""))[1] or error)
        for child in suite.get("suites") or []:
            walk(child)

    for suite in results.get("suites") or []:
        walk(suite)
    return failed, flaky


def read_failures(owner: str, repo: str, run: dict, token: str) -> tuple[dict, dict]:
    """Failed and flaky tests from the failed shards of the run's latest attempt."""
    attempt = re.compile(rf"-a{run.get('run_attempt', 1)}(?!\d)")
    artifacts = mq.paginated_items(
        f"/repos/{owner}/{repo}/actions/runs/{run['id']}/artifacts", "artifacts", token
    )
    failed, flaky = {}, {}
    for artifact in artifacts:
        name = artifact["name"]
        if (
            artifact.get("expired")
            or not name.startswith(RESULTS_ARTIFACT)
            or not attempt.search(name)
        ):
            continue
        with zipfile.ZipFile(
            io.BytesIO(download_zip(owner, repo, artifact, token))
        ) as archive:
            for member in archive.namelist():
                if member.endswith("results.json"):
                    shard_failed, shard_flaky = results_tests(
                        json.loads(archive.read(member))
                    )
                    failed.update(shard_failed)
                    flaky.update(shard_flaky)
    return failed, flaky


def failed_jobs(owner: str, repo: str, run: dict, token: str) -> list[dict]:
    """Why a failed run with no failed test failed: its failed jobs' error annotations."""
    jobs = mq.paginated_items(
        f"/repos/{owner}/{repo}/actions/runs/{run['id']}/attempts/{run.get('run_attempt', 1)}/jobs",
        "jobs",
        token,
    )
    failed = [job for job in jobs if job.get("conclusion") in ("failure", "timed_out")]
    # playwright-summary fails whenever anything upstream does; it is the cause
    # only when it failed alone.
    own = [job for job in failed if job["name"] != SUMMARY_JOB] or failed
    reasons = []
    for job in own:
        notes = mq.rest(
            f"/repos/{owner}/{repo}/check-runs/{job['id']}/annotations", token
        )
        messages = dict.fromkeys(
            str(note.get("message") or "")
            .strip()
            .replace("exit code 124.", "exit code 124 (timed out).")
            for note in notes
            if note.get("annotation_level") == "failure"
        )
        messages.pop("", None)
        messages.pop("Process completed with exit code 1.", None)
        fallback = "Timed out." if job.get("conclusion") == "timed_out" else "Failed."
        reasons.append(
            {
                "name": mq.shorten_check_name(job["name"]),
                "url": job["html_url"],
                "reason": " ".join(messages) or fallback,
            }
        )
    return reasons


READ_ERRORS = (
    mq.ApiError,
    RuntimeError,
    OSError,
    ValueError,
    KeyError,
    TypeError,
    zipfile.BadZipFile,
    subprocess.TimeoutExpired,
)


def collect(owner: str, repo: str, run: dict, token: str, failures: bool) -> dict:
    """One run's tests. `failures` False (lookback runs) reads the flakes only."""
    record = {
        "runId": run["id"],
        "url": run["html_url"],
        "createdAt": mq.parse_ts(run["created_at"]),
        "conclusion": run.get("conclusion") or "unknown",
        "prs": sorted(
            {int(pr) for pr in re.findall(r"pr-(\d+)", run.get("head_branch") or "")}
        ),
        "flaky": None,
        "failed": {},
        "broken": [],
    }
    try:
        record["flaky"] = read_flaky(run, token)
        if failures and record["conclusion"] == "failure":
            failed, flaky = read_failures(owner, repo, run, token)
            record["failed"] = failed
            # A shard that failed before writing its annotation still reports its flakes here.
            record["flaky"] = {**flaky, **record["flaky"]}
            if not failed:
                record["broken"] = failed_jobs(owner, repo, run, token)
    except READ_ERRORS as exc:
        print(f"::warning::Run {run['id']}: {exc}")
        record["flaky"] = None
    return record


def main_flaky(owner: str, repo: str, token: str) -> set[tuple[str, str]]:
    """(file, title) of every test main itself flaked on, from refresh_flake_baseline.py."""
    query = urlencode({"ref": BASELINE_REF})
    try:
        payload = mq.rest(
            f"/repos/{owner}/{repo}/contents/flake-baseline.json?{query}", token
        )
        entries = json.loads(base64.b64decode(payload["content"]))["entries"].values()
        return {(entry["file"], entry["title"]) for entry in entries}
    except (
        mq.ApiError,
        OSError,
        ValueError,
        KeyError,
        TypeError,
        AttributeError,
    ) as exc:
        print(
            f"::warning::Main flake baseline unreadable, no tests tagged as main: {exc}"
        )
        return set()


# ----------------------------------------------------------------- aggregating


def tally(
    tests: dict, key: tuple[str, str], line: int, run: dict, **fields: Any
) -> dict:
    test = tests.get(key)
    if test is None:
        test = tests[key] = {
            "file": key[0],
            "title": key[1],
            "runs": 0,
            "passedRuns": 0,
            "prs": set(),
            "errors": Counter(),
            "firstRun": run,
            **fields,
        }
    test["line"] = line
    test["runs"] += 1
    test["passedRuns"] += run["conclusion"] == "success"
    test["prs"].update(run["prs"])
    test["lastRun"] = run
    return test


def ranked(tests: dict) -> list[dict]:
    return sorted(
        tests.values(),
        key=lambda test: (
            -len(test["prs"]),
            -test["runs"],
            test["file"],
            test["title"],
        ),
    )


def aggregate(
    records: list[dict], since: datetime, on_main: set[tuple[str, str]]
) -> dict[str, Any]:
    prior = [record for record in records if record["createdAt"] < since]
    window = sorted(
        (record for record in records if record["createdAt"] >= since),
        key=lambda record: record["createdAt"],
    )
    # Without readable history every test would look new, so "new" is not claimed.
    has_history = any(record["flaky"] is not None for record in prior)
    seen_before = {key for record in prior for key in record["flaky"] or {}}
    flaky: dict[tuple[str, str], dict] = {}
    failed: dict[tuple[str, str], dict] = {}
    for run in window:
        for key, line in (run["flaky"] or {}).items():
            tally(
                flaky,
                key,
                line,
                run,
                onMain=key in on_main,
                new=has_history and key not in seen_before and key not in on_main,
            )
        for key, (line, error) in run["failed"].items():
            test = tally(failed, key, line, run)
            if error:
                test["errors"][error] += 1
    flaky_tests = ranked(flaky)
    specs: dict[str, dict] = {}
    for test in flaky_tests:
        spec = specs.setdefault(
            test["file"], {"file": test["file"], "tests": 0, "runs": 0}
        )
        spec["tests"] += 1
        spec["runs"] += test["runs"]
    conclusions = Counter(run["conclusion"] for run in window)
    return {
        "flaky": flaky_tests,
        "failed": ranked(failed),
        "broken": [run for run in window if run["broken"]],
        "specs": sorted(
            (spec for spec in specs.values() if spec["tests"] > 1),
            key=lambda spec: (-spec["tests"], -spec["runs"], spec["file"]),
        ),
        "hasHistory": has_history,
        "runs": len(window),
        "passed": conclusions["success"],
        "failedRuns": conclusions["failure"],
        "other": len(window) - conclusions["success"] - conclusions["failure"],
        "unreadable": sum(run["flaky"] is None for run in window),
        "prs": len({pr for run in window for pr in run["prs"]}),
    }


# ------------------------------------------------------------------- rendering


def test_name(test: dict) -> str:
    return (
        f"{test['file']}:{test['line']} › {test['title']}"
        if test["title"]
        else test["file"]
    )


def run_label(run: dict) -> str:
    return f"{utc(run['createdAt'])}" + (f" · #{run['prs'][0]}" if run["prs"] else "")


def first_seen(test: dict, repo_url: str) -> tuple[str, str]:
    run = test["firstRun"]
    return run_label(run), f"{repo_url}/pull/{run['prs'][0]}" if run["prs"] else run[
        "url"
    ]


def latest_run(test: dict) -> tuple[str, str]:
    return utc(test["lastRun"]["createdAt"]), test["lastRun"]["url"]


def errors_cell(test: dict) -> str:
    shown = test["errors"].most_common(MAX_ERRORS_SHOWN)
    lines = [
        f"{error} (×{count})" if len(test["errors"]) > 1 else error
        for error, count in shown
    ]
    if len(test["errors"]) > MAX_ERRORS_SHOWN:
        lines.append(f"+{len(test['errors']) - MAX_ERRORS_SHOWN} more distinct errors")
    return "\n".join(lines)


def tag(test: dict) -> str:
    return "NEW" if test["new"] else "main" if test["onMain"] else ""


def tables(report: dict, repo_url: str) -> list[tuple[str, str, list, list]]:
    failed_rows = [
        [
            str(index),
            test_name(test),
            str(len(test["prs"])),
            str(test["runs"]),
            errors_cell(test),
            first_seen(test, repo_url),
            latest_run(test),
        ]
        for index, test in enumerate(report["failed"], 1)
    ]
    flaky_rows = [
        [
            str(index),
            test_name(test),
            str(len(test["prs"])),
            f"{test['runs']} ({test['passedRuns']} / {test['runs'] - test['passedRuns']})",
            first_seen(test, repo_url),
            tag(test),
            latest_run(test),
        ]
        for index, test in enumerate(report["flaky"], 1)
    ]
    broken_rows = [
        [
            str(index),
            (run_label(run), run["url"]),
            "\n".join(f"{job['name']}: {job['reason']}" for job in run["broken"]),
        ]
        for index, run in enumerate(report["broken"], 1)
    ]
    sections = [
        (
            f"Failed tests ({len(failed_rows)})",
            "Failed every attempt in a queue run, so the run was ejected. Ranked by distinct PRs.",
            [
                "#",
                "Test",
                "PRs",
                "Failed runs",
                "Error",
                "First seen",
                "Latest run (trace)",
            ],
            failed_rows,
        ),
        (
            f"Flaky tests ({len(flaky_rows)})",
            "Failed, then passed on retry. Ranked by distinct PRs, so a re-queued PR counts once. "
            "Tag NEW = not flaky the day before and not on main; main = also flaky on main.",
            [
                "#",
                "Test",
                "PRs",
                "Runs (passed / failed)",
                "First seen",
                "Tag",
                "Latest run (trace)",
            ],
            flaky_rows,
        ),
    ]
    if broken_rows:
        sections.append(
            (
                f"Failed runs with no failing test ({len(broken_rows)})",
                "Ejected without a test to blame: a shard killed by its timeout, "
                "a job that never got a runner, a failed build.",
                ["#", "Run", "Failed jobs"],
                broken_rows,
            )
        )
    if report["specs"]:
        sections.append(
            (
                "Specs with several flaky tests",
                "Several flaky tests in one spec often share one cause, such as setup.",
                ["Spec", "Flaky tests", "Runs"],
                [
                    [spec["file"], str(spec["tests"]), str(spec["runs"])]
                    for spec in report["specs"]
                ],
            )
        )
    return sections


def headline(report: dict) -> list[str]:
    lines = [
        f"{report['runs']} merge-queue runs ({report['passed']} passed, {report['failedRuns']} failed"
        + (f", {report['other']} other" if report["other"] else "")
        + f") for {report['prs']} PRs",
        f"{len(report['failed'])} failed tests · {len(report['flaky'])} flaky tests"
        + (
            f" · {len(report['broken'])} failed runs with no failing test"
            if report["broken"]
            else ""
        ),
    ]
    if report["unreadable"]:
        lines.append(
            f"{report['unreadable']} runs could not be read and are not counted"
        )
    if not report["hasHistory"]:
        lines.append("No readable history before this window, so no test is marked NEW")
    return lines


def cell_html(cell: str | tuple[str, str]) -> str:
    if isinstance(cell, tuple):
        return f'<a href="{html.escape(cell[1])}">{html.escape(cell[0])}</a>'
    return html.escape(cell).replace("\n", "<br>")


def cell_md(cell: str | tuple[str, str]) -> str:
    text = (
        f"[{html.escape(cell[0])}]({cell[1]})"
        if isinstance(cell, tuple)
        else html.escape(cell)
    )
    return text.replace("|", "\\|").replace("\n", "<br>")


def render_html(report: dict, title: str, repo_url: str) -> str:
    body = [f"<h1>{html.escape(title)}</h1>", "<ul>"]
    body += [f"<li>{html.escape(line)}</li>" for line in headline(report)]
    body.append("</ul>")
    for heading, note, columns, rows in tables(report, repo_url):
        body += [
            f"<h2>{html.escape(heading)}</h2>",
            f"<p class='note'>{html.escape(note)}</p>",
        ]
        if not rows:
            body.append("<p>None.</p>")
            continue
        body.append(
            "<table><tr>"
            + "".join(f"<th>{html.escape(c)}</th>" for c in columns)
            + "</tr>"
        )
        body += [
            "<tr>" + "".join(f"<td>{cell_html(c)}</td>" for c in row) + "</tr>"
            for row in rows
        ]
        body.append("</table>")
    style = """
      @page { size: A4 landscape; margin: 10mm; }
      body { font: 10px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1f2328; }
      h1 { font-size: 18px; margin: 0 0 6px; } h2 { font-size: 14px; margin: 16px 0 2px; }
      .note { color: #59636e; margin: 0 0 6px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d1d9e0; padding: 3px 5px; text-align: left; vertical-align: top; }
      th { background: #f6f8fa; } tr { break-inside: avoid; }
      td { word-break: break-word; }
      a { color: #0969da; text-decoration: none; }
    """
    return (
        f"<!doctype html><html><head><meta charset='utf-8'><title>{html.escape(title)}</title>"
        f"<style>{style}</style></head><body>{''.join(body)}</body></html>"
    )


def render_md(report: dict, title: str, repo_url: str) -> str:
    lines = [f"## {title}", ""] + [f"- {line}" for line in headline(report)]
    for heading, note, columns, rows in tables(report, repo_url):
        lines += ["", f"### {heading}", "", note, ""]
        if not rows:
            lines.append("None.")
            continue
        lines += ["| " + " | ".join(columns) + " |", "|" + "---|" * len(columns)]
        lines += ["| " + " | ".join(cell_md(c) for c in row) + " |" for row in rows]
    return "\n".join(lines) + "\n"


def slack_text(report: dict, title: str, repo_url: str, lookback: float) -> str:
    lines = [f":bar_chart: *{title}*"] + headline(report)
    if report["unreadable"] == report["runs"]:
        return "\n".join(lines + [":warning: No run in this window could be read."])
    if not report["failed"] and not report["flaky"] and not report["broken"]:
        return "\n".join(
            lines
            + [":large_green_circle: No failed or flaky tests in the merge queue."]
        )

    def line(test, unit):
        label, url = first_seen(test, repo_url)
        return (
            f"`{mq.sanitize_external(test_name(test))}` — {len(test['prs'])} PRs, "
            f"{test['runs']} {unit}, first <{url}|{label}>"
        )

    if report["failed"]:
        lines.append(":red_circle: *Failed* (by distinct PRs):")
        lines += [f"• {line(test, 'failed runs')}" for test in report["failed"][:5]]
    new = [test for test in report["flaky"] if test["new"]]
    if new:
        lines.append(
            f":new: *New flaky* (not in the prior {lookback:g}h, not flaky on main):"
        )
        lines += [f"• {line(test, 'runs')}" for test in new[:5]]
    if report["flaky"]:
        lines.append(":large_yellow_circle: *Top flaky* (by distinct PRs):")
        lines += [
            f"{index}. {line(test, 'runs')}"
            for index, test in enumerate(report["flaky"][:TOP], 1)
        ]
    lines.append("Full report in the attached PDF.")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    token = mq.env_token()
    until = parse_when(args.until, mq.utcnow())
    since = parse_when(args.since, until - timedelta(hours=24))
    if since >= until:
        raise SystemExit("--since must be before --until")
    if until - since > timedelta(hours=MAX_WINDOW_HOURS):
        raise SystemExit(f"The window may be at most {MAX_WINDOW_HOURS}h")
    if args.lookback_hours > MAX_LOOKBACK_HOURS:
        raise SystemExit(f"--lookback-hours may be at most {MAX_LOOKBACK_HOURS}")
    try:
        runs = list_runs(
            args.owner,
            args.repo,
            since - timedelta(hours=args.lookback_hours),
            until,
            token,
        )
    except (mq.ApiError, OSError) as exc:
        print(f"::error::Could not list merge-queue runs: {exc}")
        return 1
    with ThreadPoolExecutor(max_workers=6) as pool:
        records = list(
            pool.map(
                lambda run: collect(
                    args.owner,
                    args.repo,
                    run,
                    token,
                    mq.parse_ts(run["created_at"]) >= since,
                ),
                runs,
            )
        )
    report = aggregate(records, since, main_flaky(args.owner, args.repo, token))

    repo_url = f"https://github.com/{args.owner}/{args.repo}"
    title = f"Merge-queue Playwright report, {utc(since)} to {utc(until)} UTC"
    out = args.out_dir
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.html").write_text(render_html(report, title, repo_url))
    markdown = render_md(report, title, repo_url)
    (out / "report.md").write_text(markdown)
    if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write(markdown)
    stamp = "-to-".join(
        f"{value.astimezone(timezone.utc):%Y-%m-%d-%H%M}" for value in (since, until)
    )
    (out / "slack.json").write_text(
        json.dumps(
            {
                "channel_id": args.channel,
                "initial_comment": slack_text(
                    report, title, repo_url, args.lookback_hours
                ),
                "file": str((out / "report.pdf").resolve()),
                "filename": f"merge-queue-{stamp}.pdf",
                "title": title,
            }
        )
    )
    print(
        f"{report['runs']} runs, {len(report['failed'])} failed tests, "
        f"{len(report['flaky'])} flaky tests"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
