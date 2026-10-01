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
It writes a self-contained HTML report (one collapsible entry per test, listing
every run that hit it), a markdown job summary, and a Slack `files.uploadV2`
payload that attaches the HTML.

A dequeued PR is re-queued and re-runs the same tests, so one stall can triple
every count. Tests are ranked by distinct PRs, with raw runs beside it, and flaky
hits in passing runs are counted apart from hits in failed (ejected) runs.

Exits:
  0 — report written
  1 — could not list the runs (bad token, API down)
"""

from __future__ import annotations

import argparse
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
TEST_RE = re.compile(r"^(?P<file>.+?):(?P<line>\d+) › (?P<title>.+)$")
ANSI = re.compile(r"[\x1b\ufffd]\[[0-9;]*m")
TOP = 10
MAX_ERRORS_SHOWN = 3
# A passing run costs one GraphQL query; a failed run adds an artifact listing and
# one download per failed shard. The cap keeps a run far inside GITHUB_TOKEN's
# hourly budget on any plan.
MAX_WINDOW_HOURS = 48
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


def collect(owner: str, repo: str, run: dict, token: str) -> dict:
    record = {
        "runId": run["id"],
        "attempt": run.get("run_attempt", 1),
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
        if record["conclusion"] == "failure":
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


# ----------------------------------------------------------------- aggregating


def tally(
    tests: dict, key: tuple[str, str], line: int, run: dict, error: str = ""
) -> None:
    test = tests.setdefault(
        key,
        {
            "file": key[0],
            "title": key[1],
            "passedRuns": 0,
            "prs": set(),
            "errors": Counter(),
            "hits": [],
        },
    )
    test["line"] = line
    test["passedRuns"] += run["conclusion"] == "success"
    test["prs"].update(run["prs"])
    test["hits"].append((run, error))
    if error:
        test["errors"][error] += 1


def ranked(tests: dict) -> list[dict]:
    for test in tests.values():
        test["runs"] = len(test["hits"])
        test["hits"].reverse()  # newest first
    return sorted(
        tests.values(),
        key=lambda test: (
            -len(test["prs"]),
            -test["runs"],
            test["file"],
            test["title"],
        ),
    )


def aggregate(records: list[dict]) -> dict[str, Any]:
    window = sorted(records, key=lambda record: record["createdAt"])
    flaky: dict[tuple[str, str], dict] = {}
    failed: dict[tuple[str, str], dict] = {}
    for run in window:
        for key, line in (run["flaky"] or {}).items():
            tally(flaky, key, line, run)
        for key, (line, error) in run["failed"].items():
            tally(failed, key, line, run, error)
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
        "broken": [run for run in reversed(window) if run["broken"]],
        "specs": sorted(
            (spec for spec in specs.values() if spec["tests"] > 1),
            key=lambda spec: (-spec["tests"], -spec["runs"], spec["file"]),
        ),
        "runs": len(window),
        "passed": conclusions["success"],
        "failedRuns": conclusions["failure"],
        "other": len(window) - conclusions["success"] - conclusions["failure"],
        "unreadable": sum(run["flaky"] is None for run in window),
        "prs": len({pr for run in window for pr in run["prs"]}),
    }


# ------------------------------------------------------------------- rendering

FAILED_NOTE = "Failed every attempt in a queue run, so the run was ejected. Ranked by distinct PRs."
FLAKY_NOTE = (
    "Failed, then passed on retry. Ranked by distinct PRs, so a re-queued PR counts once; "
    "runs are split into passed and failed (ejected) queue runs."
)
BROKEN_NOTE = (
    "Ejected without a test to blame: a shard killed by its timeout, "
    "a job that never got a runner, a failed build."
)
SPECS_NOTE = "Several flaky tests in one spec often share one cause, such as setup."


def test_name(test: dict) -> str:
    return (
        f"{test['file']}:{test['line']} › {test['title']}"
        if test["title"]
        else test["file"]
    )


def run_label(run: dict) -> str:
    pr = f"PR #{run['prs'][0]} · " if run["prs"] else ""
    attempt = f" (attempt {run['attempt']})" if run["attempt"] > 1 else ""
    return f"{pr}run {run['runId']}{attempt}"


def plural(count: int, word: str) -> str:
    return f"{count} {word}" if count == 1 else f"{count} {word}s"


def counts(test: dict, failed: bool) -> str:
    prs = plural(len(test["prs"]), "PR")
    if failed:
        return f"{prs} · {plural(test['runs'], 'failed run')}"
    return f"{prs} · {plural(test['runs'], 'run')} ({test['passedRuns']} passed, {test['runs'] - test['passedRuns']} failed)"


def headline(report: dict) -> list[str]:
    lines = [
        f"{plural(report['runs'], 'merge-queue run')} ({report['passed']} passed, {report['failedRuns']} failed"
        + (f", {report['other']} other" if report["other"] else "")
        + f") for {plural(report['prs'], 'PR')}",
        f"{plural(len(report['failed']), 'failed test')} · {plural(len(report['flaky']), 'flaky test')}"
        + (
            f" · {plural(len(report['broken']), 'failed run')} with no failing test"
            if report["broken"]
            else ""
        ),
    ]
    if report["unreadable"]:
        lines.append(
            f"{plural(report['unreadable'], 'run')} could not be read and are not counted"
        )
    return lines


def e(text: Any) -> str:
    return html.escape(str(text))


def link(label: str, url: str) -> str:
    return f'<a href="{e(url)}" target="_blank" rel="noreferrer">{e(label)}</a>'


def test_entry(test: dict, failed: bool) -> str:
    errors = "".join(
        f"<li>{e(error)}{f' <span class=n>×{count}</span>' if len(test['errors']) > 1 else ''}</li>"
        for error, count in test["errors"].most_common()
    )
    hits = "".join(
        f"<li>{link(run_label(run), run['url'])} <span class=muted>{e(utc(run['createdAt']))}</span> "
        f"<span class='tag {'ok' if run['conclusion'] == 'success' else 'bad'}'>"
        f"{'passed' if run['conclusion'] == 'success' else e(run['conclusion'])}</span>"
        f"{f' <span class=err>{e(error)}</span>' if error and len(test['errors']) > 1 else ''}</li>"
        for run, error in test["hits"]
    )
    return (
        f"<details><summary><span class='count {'bad' if failed else 'warn'}'>{test['runs']}</span>"
        f"<span class=name>{e(test_name(test))}</span><span class=muted>{e(counts(test, failed))}</span></summary>"
        f"<div class=body>{f'<ul class=errors>{errors}</ul>' if errors else ''}<ol class=runs>{hits}</ol></div></details>"
    )


def section(title: str, note: str, entries: list[str]) -> str:
    body = "".join(entries) or "<p class=muted>None.</p>"
    return f"<h2>{e(title)}</h2><p class=note>{e(note)}</p>{body}"


def render_html(report: dict, title: str) -> str:
    broken = "".join(
        f"<tr><td>{link(run_label(run), run['url'])}<br><span class=muted>{e(utc(run['createdAt']))}</span></td>"
        f"<td>{'<br>'.join(link(job['name'], job['url']) + ' — ' + e(job['reason']) for job in run['broken'])}</td></tr>"
        for run in report["broken"]
    )
    specs = "".join(
        f"<tr><td>{e(spec['file'])}</td><td>{spec['tests']}</td><td>{spec['runs']}</td></tr>"
        for spec in report["specs"]
    )
    parts = [
        f"<h1>{e(title)}</h1>",
        "<p class=meta>" + "<br>".join(e(line) for line in headline(report)) + "</p>",
        "<p class=tools><button onclick=\"document.querySelectorAll('details').forEach(d=>d.open=true)\">Expand all</button>"
        "<button onclick=\"document.querySelectorAll('details').forEach(d=>d.open=false)\">Collapse all</button></p>",
        section(
            f"Failed tests ({len(report['failed'])})",
            FAILED_NOTE,
            [test_entry(t, True) for t in report["failed"]],
        ),
        section(
            f"Flaky tests ({len(report['flaky'])})",
            FLAKY_NOTE,
            [test_entry(t, False) for t in report["flaky"]],
        ),
    ]
    if broken:
        parts.append(
            f"<h2>Failed runs with no failing test ({len(report['broken'])})</h2><p class=note>{e(BROKEN_NOTE)}</p>"
            f"<table><tr><th>Run</th><th>Failed jobs</th></tr>{broken}</table>"
        )
    if specs:
        parts.append(
            f"<h2>Specs with several flaky tests</h2><p class=note>{e(SPECS_NOTE)}</p>"
            f"<table><tr><th>Spec</th><th>Flaky tests</th><th>Runs</th></tr>{specs}</table>"
        )
    style = """
      :root { --fg: #1f2328; --muted: #59636e; --line: #d1d9e0; --bg: #fff; --head: #f6f8fa;
              --link: #0969da; --bad: #cf222e; --warn: #9a6700; --ok: #1a7f37; }
      @media (prefers-color-scheme: dark) {
        :root { --fg: #e6edf3; --muted: #9198a1; --line: #3d444d; --bg: #0d1117; --head: #151b23;
                --link: #4493f8; --bad: #f85149; --warn: #d29922; --ok: #3fb950; } }
      body { font: 14px/1.45 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: var(--fg);
             background: var(--bg); max-width: 1200px; margin: 24px auto; padding: 0 16px; }
      h1 { font-size: 22px; margin: 0 0 8px; } h2 { font-size: 17px; margin: 28px 0 4px; }
      .meta, .note, .muted { color: var(--muted); } .note { margin: 0 0 8px; }
      a { color: var(--link); text-decoration: none; } a:hover { text-decoration: underline; }
      button { font: inherit; margin-right: 8px; padding: 3px 10px; border: 1px solid var(--line);
               border-radius: 6px; background: var(--head); color: var(--fg); cursor: pointer; }
      details { border: 1px solid var(--line); border-radius: 6px; margin: 4px 0; }
      summary { display: flex; gap: 10px; align-items: baseline; padding: 6px 10px; cursor: pointer; }
      summary .name { flex: 1; word-break: break-word; }
      summary .muted { white-space: nowrap; font-size: 12px; }
      .count { min-width: 28px; text-align: right; font-weight: 600; }
      .count.bad, .tag.bad { color: var(--bad); } .count.warn { color: var(--warn); } .tag.ok { color: var(--ok); }
      .body { border-top: 1px solid var(--line); padding: 6px 12px 8px 48px; background: var(--head); }
      .errors { margin: 4px 0 8px; padding-left: 18px; font-family: ui-monospace, monospace; font-size: 12px; }
      .runs { margin: 0; padding-left: 18px; } .runs li { margin: 2px 0; }
      .tag, .n { font-size: 12px; } .err { font-family: ui-monospace, monospace; font-size: 12px; color: var(--muted); }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid var(--line); padding: 4px 8px; text-align: left; vertical-align: top; }
      th { background: var(--head); } td { word-break: break-word; }
    """
    return (
        f"<!doctype html><html><head><meta charset='utf-8'>"
        f"<meta name='viewport' content='width=device-width, initial-scale=1'><title>{e(title)}</title>"
        f"<style>{style}</style></head><body>{''.join(parts)}</body></html>"
    )


def render_md(report: dict, title: str) -> str:
    def cell(text: str) -> str:
        return html.escape(text).replace("|", "\\|").replace("\n", "<br>")

    def latest(test: dict) -> str:
        run = test["hits"][0][0]
        return f"[{utc(run['createdAt'])}]({run['url']})"

    lines = [f"## {title}", ""] + [f"- {line}" for line in headline(report)]
    tables = [
        (
            f"Failed tests ({len(report['failed'])})",
            FAILED_NOTE,
            ["#", "Test", "PRs", "Failed runs", "Error", "Latest run"],
            [
                [
                    str(i),
                    cell(test_name(t)),
                    str(len(t["prs"])),
                    str(t["runs"]),
                    cell("\n".join(error for error, _ in t["errors"].most_common(3))),
                    latest(t),
                ]
                for i, t in enumerate(report["failed"], 1)
            ],
        ),
        (
            f"Flaky tests ({len(report['flaky'])})",
            FLAKY_NOTE,
            ["#", "Test", "PRs", "Runs (passed / failed)", "Latest run"],
            [
                [
                    str(i),
                    cell(test_name(t)),
                    str(len(t["prs"])),
                    f"{t['runs']} ({t['passedRuns']} / {t['runs'] - t['passedRuns']})",
                    latest(t),
                ]
                for i, t in enumerate(report["flaky"], 1)
            ],
        ),
        (
            f"Failed runs with no failing test ({len(report['broken'])})",
            BROKEN_NOTE,
            ["Run", "Failed jobs"],
            [
                [
                    f"[{run_label(run)}]({run['url']})",
                    cell(
                        "\n".join(
                            f"{job['name']}: {job['reason']}" for job in run["broken"]
                        )
                    ),
                ]
                for run in report["broken"]
            ],
        ),
    ]
    for heading, note, columns, rows in tables:
        lines += ["", f"### {heading}", "", note, ""]
        if not rows:
            lines.append("None.")
            continue
        lines += ["| " + " | ".join(columns) + " |", "|" + "---|" * len(columns)]
        lines += ["| " + " | ".join(row) + " |" for row in rows]
    return "\n".join(lines) + "\n"


def slack_text(report: dict, title: str) -> str:
    lines = [f":bar_chart: *{title}*"] + headline(report)
    if report["unreadable"] == report["runs"]:
        return "\n".join(lines + [":warning: No run in this window could be read."])
    if not report["failed"] and not report["flaky"] and not report["broken"]:
        return "\n".join(
            lines
            + [":large_green_circle: No failed or flaky tests in the merge queue."]
        )

    def line(test: dict, failed: bool) -> str:
        run = test["hits"][0][0]
        return (
            f"`{mq.sanitize_external(test_name(test))}` — {counts(test, failed)}, "
            f"latest <{run['url']}|{utc(run['createdAt'])}>"
        )

    if report["failed"]:
        lines.append(":red_circle: *Failed* (by distinct PRs):")
        lines += [f"• {line(test, True)}" for test in report["failed"][:5]]
    if report["flaky"]:
        lines.append(":large_yellow_circle: *Top flaky* (by distinct PRs):")
        lines += [
            f"{i}. {line(test, False)}"
            for i, test in enumerate(report["flaky"][:TOP], 1)
        ]
    lines.append(
        "Every run of every test is in the attached HTML report; open it in a browser."
    )
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
    try:
        runs = list_runs(args.owner, args.repo, since, until, token)
    except (mq.ApiError, OSError) as exc:
        print(f"::error::Could not list merge-queue runs: {exc}")
        return 1
    with ThreadPoolExecutor(max_workers=6) as pool:
        records = list(
            pool.map(lambda run: collect(args.owner, args.repo, run, token), runs)
        )
    report = aggregate(records)

    title = f"Merge-queue Playwright report, {utc(since)} to {utc(until)} UTC"
    stamp = "-to-".join(
        f"{value.astimezone(timezone.utc):%Y-%m-%d-%H%M}" for value in (since, until)
    )
    out = args.out_dir
    out.mkdir(parents=True, exist_ok=True)
    page = out / f"merge-queue-{stamp}.html"
    page.write_text(render_html(report, title))
    markdown = render_md(report, title)
    (out / "report.md").write_text(markdown)
    if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write(markdown)
    (out / "slack.json").write_text(
        json.dumps(
            {
                "channel_id": args.channel,
                "initial_comment": slack_text(report, title),
                "file": str(page.resolve()),
                "filename": page.name,
                "title": title,
            }
        )
    )
    print(
        f"{report['runs']} runs, {len(report['failed'])} failed tests, {len(report['flaky'])} flaky tests"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
