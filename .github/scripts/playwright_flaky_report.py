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


STYLE = """
:root { --bg:#f7f7f7; --card:#fff; --fg:#181d27; --muted:#535862; --line:#e9eaeb; --soft:#fafafa;
  --brand:#1570ef; --bad:#d92d20; --bad-soft:#fef3f2; --warn:#dc6803; --warn-soft:#fffaeb;
  --ok:#079455; --ok-soft:#ecfdf3; }
@media (prefers-color-scheme: dark) { :root { --bg:#0c0e12; --card:#13161b; --fg:#f7f7f7; --muted:#94979c;
  --line:#22262f; --soft:#181b21; --brand:#53b1fd; --bad:#f97066; --bad-soft:#55160c;
  --warn:#fdb022; --warn-soft:#4e1d09; --ok:#47cd89; --ok-soft:#053321; } }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.5 Inter, -apple-system, "Segoe UI", Roboto, sans-serif; }
a { color:var(--brand); text-decoration:none; } a:hover { text-decoration:underline; }
header { background:var(--card); border-bottom:1px solid var(--line); }
.wrap { max-width:1240px; margin:0 auto; padding:0 24px; }
header .wrap { padding-top:20px; padding-bottom:20px; }
.eyebrow { color:var(--brand); font-weight:600; font-size:12px; letter-spacing:.04em; text-transform:uppercase; }
h1 { font-size:22px; margin:2px 0 4px; } .sub { color:var(--muted); margin:0; }
.tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin:20px 0 8px; }
.tile { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
.tile b { display:block; font-size:26px; line-height:1.2; } .tile span { color:var(--muted); font-size:13px; }
.tile.bad b { color:var(--bad); } .tile.warn b { color:var(--warn); }
.bar { position:sticky; top:0; z-index:2; background:var(--bg); padding:12px 0; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.bar input { flex:1; min-width:220px; font:inherit; padding:8px 12px; border:1px solid var(--line); border-radius:8px; background:var(--card); color:var(--fg); }
.chip, button { font:inherit; font-size:13px; padding:6px 12px; border:1px solid var(--line); border-radius:8px; background:var(--card); color:var(--fg); cursor:pointer; }
.chip:hover, button:hover { border-color:var(--brand); text-decoration:none; }
section { background:var(--card); border:1px solid var(--line); border-radius:12px; margin:16px 0; overflow:hidden; scroll-margin-top:64px; }
section > h2 { margin:0; padding:14px 16px 2px; font-size:16px; }
section > .note { margin:0; padding:0 16px 12px; color:var(--muted); font-size:13px; border-bottom:1px solid var(--line); }
section > .none { padding:12px 16px; color:var(--muted); margin:0; }
details { border-bottom:1px solid var(--line); } details:last-child { border-bottom:0; }
details[open] { background:var(--soft); }
summary { list-style:none; display:grid; grid-template-columns:44px 1fr auto; gap:12px; align-items:center; padding:10px 16px; cursor:pointer; border-left:3px solid transparent; }
summary::-webkit-details-marker { display:none; }
.failed summary { border-left-color:var(--bad); } .flaky summary { border-left-color:var(--warn); }
summary:hover { background:var(--soft); }
.count { font-weight:700; text-align:center; border-radius:999px; padding:2px 0; font-size:13px; }
.failed .count { color:var(--bad); background:var(--bad-soft); } .flaky .count { color:var(--warn); background:var(--warn-soft); }
.name { min-width:0; } .name .file { color:var(--muted); font-size:12px; display:block; } .name .title { font-weight:500; word-break:break-word; }
.meta { display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
.pill { font-size:12px; padding:2px 8px; border-radius:999px; background:var(--soft); border:1px solid var(--line); white-space:nowrap; }
.pill.ok { color:var(--ok); background:var(--ok-soft); border-color:transparent; }
.pill.bad { color:var(--bad); background:var(--bad-soft); border-color:transparent; }
.strip { display:flex; gap:2px; } .strip i { width:8px; height:14px; border-radius:2px; background:var(--ok); opacity:.85; }
.strip i.f { background:var(--bad); }
.body { padding:4px 16px 14px 72px; }
.errors { margin:6px 0 10px; padding:0; list-style:none; }
.errors li { font:12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; background:var(--bad-soft); color:var(--bad); padding:6px 10px; border-radius:6px; margin:4px 0; word-break:break-word; }
table { width:100%; border-collapse:collapse; font-size:13px; }
th { text-align:left; color:var(--muted); font-weight:500; padding:6px 8px; border-bottom:1px solid var(--line); }
td { padding:6px 8px; border-bottom:1px solid var(--line); vertical-align:top; word-break:break-word; } tr:last-child td { border-bottom:0; }
td.err { font:12px ui-monospace, Menlo, monospace; color:var(--muted); }
.plain td, .plain th { padding:8px 16px; }
.nojs .js-only { display:none; }
footer { color:var(--muted); font-size:12px; padding:8px 0 32px; }
@media (max-width:640px) { .wrap { padding:0 16px; } summary { grid-template-columns:36px 1fr; } .meta { grid-column:2; justify-content:flex-start; } .body { padding-left:16px; } }
"""

# The filter and Expand/Collapse need scripts. Viewers that block them (Slack's
# file preview, static previews) would show dead controls, so the controls stay
# hidden until this runs. The filter hides every entry whose text lacks the query;
# closed <details> are still searched, so a match in a run list or error counts.
PAGE_JS = """<script>
document.documentElement.classList.remove('nojs');
const entries = document.querySelectorAll('details');
document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () =>
  entries.forEach(d => { d.open = b.dataset.open === 'true'; })));
const q = document.getElementById('q');
q.addEventListener('input', () => { const v = q.value.toLowerCase();
  entries.forEach(d => { d.hidden = v && !d.textContent.toLowerCase().includes(v); }); });
</script>"""
STRIP_MAX = 30


def runs_table(test: dict, failed: bool, repo_url: str) -> str:
    # One distinct error is already shown above the table; repeat it per run only
    # when the runs disagree.
    show_error = failed and len(test["errors"]) > 1
    rows = []
    for run, error in test["hits"]:
        passed = run["conclusion"] == "success"
        pr = (
            link(f"#{run['prs'][0]}", f"{repo_url}/pull/{run['prs'][0]}")
            if run["prs"]
            else "—"
        )
        attempt = f" (attempt {run['attempt']})" if run["attempt"] > 1 else ""
        rows.append(
            f"<tr><td>{pr}</td><td>{link('run ' + str(run['runId']) + attempt, run['url'])}</td>"
            f"<td>{e(utc(run['createdAt']))}</td>"
            f"<td><span class='pill {'ok' if passed else 'bad'}'>{'passed' if passed else e(run['conclusion'])}</span></td>"
            + (f"<td class=err>{e(error)}</td>" if show_error else "")
            + "</tr>"
        )
    head = (
        "<tr><th>PR</th><th>Run</th><th>Time (UTC)</th><th>Queue run</th>"
        + ("<th>Error</th>" if show_error else "")
        + "</tr>"
    )
    return f"<table>{head}{''.join(rows)}</table>"


def test_entry(test: dict, failed: bool, repo_url: str) -> str:
    errors = "".join(
        f"<li>{e(error)}{f' ×{count}' if len(test['errors']) > 1 else ''}</li>"
        for error, count in test["errors"].most_common()
    )
    squares = "".join(
        f"<i class='{'' if run['conclusion'] == 'success' else 'f'}' title='{e(run_label(run))} · {e(utc(run['createdAt']))}'></i>"
        for run, _ in test["hits"][:STRIP_MAX]
    )
    pills = [
        f"<span class=strip title='Newest first'>{squares}</span>",
        f"<span class=pill>{e(plural(len(test['prs']), 'PR'))}</span>",
    ]
    if not failed:
        pills.append(f"<span class='pill ok'>{test['passedRuns']} passed</span>")
        if test["runs"] > test["passedRuns"]:
            pills.append(
                f"<span class='pill bad'>{test['runs'] - test['passedRuns']} failed</span>"
            )
    return (
        f"<details class={'failed' if failed else 'flaky'}><summary><span class=count>{test['runs']}</span>"
        f"<span class=name><span class=file>{e(test['file'])}:{test['line']}</span><span class=title>{e(test['title'])}</span></span>"
        f"<span class=meta>{''.join(pills)}</span></summary>"
        f"<div class=body>{f'<ul class=errors>{errors}</ul>' if errors else ''}{runs_table(test, failed, repo_url)}</div></details>"
    )


def section(anchor: str, title: str, note: str, body: str) -> str:
    return f"<section id={anchor}><h2>{e(title)}</h2><p class=note>{e(note)}</p>{body or '<p class=none>None.</p>'}</section>"


def render_html(report: dict, title: str, window: str, repo_url: str) -> str:
    tiles = [
        ("", report["runs"], f"queue runs · {report['passed']} passed"),
        ("bad", report["failedRuns"], "ejected runs"),
        ("", report["prs"], "PRs"),
        ("bad", len(report["failed"]), "failed tests"),
        ("warn", len(report["flaky"]), "flaky tests"),
    ]
    if report["broken"]:
        tiles.append(("bad", len(report["broken"]), "ejected with no failing test"))
    if report["unreadable"]:
        tiles.append(("warn", report["unreadable"], "runs not readable"))
    chips = [
        ("failed", f"Failed {len(report['failed'])}"),
        ("flaky", f"Flaky {len(report['flaky'])}"),
    ]
    if report["broken"]:
        chips.append(("broken", f"No failing test {len(report['broken'])}"))
    if report["specs"]:
        chips.append(("specs", "Specs"))
    broken = "".join(
        f"<tr><td>{link(run_label(run), run['url'])}<br><span class=sub>{e(utc(run['createdAt']))}</span></td>"
        f"<td>{'<br>'.join(link(job['name'], job['url']) + ' — ' + e(job['reason']) for job in run['broken'])}</td></tr>"
        for run in report["broken"]
    )
    specs = "".join(
        f"<tr><td>{e(spec['file'])}</td><td>{spec['tests']}</td><td>{spec['runs']}</td></tr>"
        for spec in report["specs"]
    )
    parts = [
        "<header><div class=wrap><div class=eyebrow>OpenMetadata · Merge queue</div>"
        f"<h1>Playwright failed &amp; flaky tests</h1><p class=sub>{e(window)} · ranked by distinct PRs, "
        "so a re-queued PR counts once</p></div></header><div class=wrap>",
        "<div class=tiles>"
        + "".join(
            f"<div class='tile {cls}'><b>{value}</b><span>{e(label)}</span></div>"
            for cls, value, label in tiles
        )
        + "</div>",
        "<div class=bar><input id=q class=js-only type=search placeholder='Filter tests, specs, PRs, errors…' aria-label='Filter'>"
        + "".join(
            f"<a class=chip href='#{anchor}'>{e(label)}</a>" for anchor, label in chips
        )
        + "<button type=button class=js-only data-open=true>Expand all</button>"
        "<button type=button class=js-only data-open=false>Collapse all</button></div>",
        section(
            "failed",
            f"Failed tests ({len(report['failed'])})",
            FAILED_NOTE,
            "".join(test_entry(t, True, repo_url) for t in report["failed"]),
        ),
        section(
            "flaky",
            f"Flaky tests ({len(report['flaky'])})",
            FLAKY_NOTE,
            "".join(test_entry(t, False, repo_url) for t in report["flaky"]),
        ),
    ]
    if broken:
        parts.append(
            section(
                "broken",
                f"Failed runs with no failing test ({len(report['broken'])})",
                BROKEN_NOTE,
                f"<table class=plain><tr><th>Run</th><th>Failed jobs</th></tr>{broken}</table>",
            )
        )
    if specs:
        parts.append(
            section(
                "specs",
                "Specs with several flaky tests",
                SPECS_NOTE,
                f"<table class=plain><tr><th>Spec</th><th>Flaky tests</th><th>Runs</th></tr>{specs}</table>",
            )
        )
    parts.append(
        "<footer>Generated by playwright-flaky-daily-report.yml</footer></div>"
    )
    return (
        "<!doctype html><html lang=en class=nojs><head><meta charset=utf-8>"
        f"<meta name=viewport content='width=device-width, initial-scale=1'><title>{e(title)}</title>"
        f"<style>{STYLE}</style></head><body>{''.join(parts)}{PAGE_JS}</body></html>"
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
    window = f"{utc(since)} → {utc(until)} UTC"
    page.write_text(
        render_html(
            report, title, window, f"https://github.com/{args.owner}/{args.repo}"
        )
    )
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
