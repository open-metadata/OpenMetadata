#!/usr/bin/env python3
"""Daily merge-queue flaky-test report for #pw-health.

Replaces the one-Slack-post-per-queue-run alert, which buried the channel. Every
merge-group run of playwright-postgresql-e2e.yml uploads a `playwright-mq-flaky`
artifact listing the tests that failed their first attempt and passed on retry.
This reads every run in the window, rolls the hits up per test, and writes an HTML report (the workflow prints it to PDF), a
markdown job summary, and a Slack `files.uploadV2` payload.

Counting rules, taken from triaging the queue by hand:
  * A dequeued PR is re-queued and re-runs the same flakes, so one stall can
    triple every count. Tests are ranked by distinct PRs; raw runs sit beside it.
  * Hits in runs that passed are the clean signal; hits in runs that failed
    (ejected batches) are counted separately.
  * "New" means not flaky in the `--lookback-hours` before `--since` and not in
    main's flake baseline. The PR of the first run that hit it is the suspect.

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
ARTIFACT = "playwright-mq-flaky"
BASELINE_REF = "ci/playwright-timing"
TEST_RE = re.compile(r"^(?P<file>.+?):(?P<line>\d+) › (?P<title>.+)$")
TOP = 10
# GITHUB_TOKEN allows 1,000 REST calls/hour per repo on non-Enterprise plans, and
# each queue run costs ~2 (list + download) at ~150 runs/day. Window plus lookback
# at these caps is ~72h, ~900 calls.
MAX_WINDOW_HOURS = 48


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


def read_flaky(owner: str, repo: str, run_id: int, token: str) -> list[dict] | None:
    """The run's retry passes, or None when it uploaded none (cancelled, pre-rollout)."""
    artifacts = [
        artifact
        for artifact in mq.rest(
            f"/repos/{owner}/{repo}/actions/runs/{run_id}/artifacts?name={ARTIFACT}",
            token,
        ).get("artifacts", [])
        if not artifact.get("expired")
    ]
    if not artifacts:
        return None
    artifact = max(artifacts, key=lambda value: value["id"])
    if artifact.get("size_in_bytes", 0) > 1024 * 1024:
        raise mq.ApiError(f"Oversized flaky artifact in run {run_id}")
    # gh follows the API -> signed blob redirect without exposing the token.
    completed = subprocess.run(
        ["gh", "api", f"repos/{owner}/{repo}/actions/artifacts/{artifact['id']}/zip"],
        env={**os.environ, "GH_TOKEN": token},
        capture_output=True,
        timeout=60,
        check=False,
    )
    if completed.returncode:
        raise mq.ApiError(f"Flaky artifact download failed for run {run_id}")
    with zipfile.ZipFile(io.BytesIO(completed.stdout)) as archive:
        payload = json.loads(archive.read("flaky.json"))
    flaky = payload.get("flaky") if isinstance(payload, dict) else None
    if not isinstance(flaky, list) or payload.get("schemaVersion") != 1:
        raise mq.ApiError(f"Invalid flaky artifact in run {run_id}")
    return [item for item in flaky if isinstance(item, dict) and item.get("test")]


def collect(owner: str, repo: str, run: dict, token: str) -> dict:
    try:
        flaky = read_flaky(owner, repo, run["id"], token)
    except (
        mq.ApiError,
        OSError,
        ValueError,
        KeyError,
        zipfile.BadZipFile,
        subprocess.TimeoutExpired,
    ) as exc:
        print(f"::warning::Run {run['id']}: {exc}")
        flaky = None
    return {
        "runId": run["id"],
        "url": run["html_url"],
        "createdAt": mq.parse_ts(run["created_at"]),
        "conclusion": run.get("conclusion") or "unknown",
        "prs": sorted(
            {int(pr) for pr in re.findall(r"pr-(\d+)", run.get("head_branch") or "")}
        ),
        "flaky": flaky,
    }


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


def split_test(name: str) -> tuple[str, int, str]:
    match = TEST_RE.match(name)
    return (
        (match["file"], int(match["line"]), match["title"]) if match else (name, 0, "")
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
    seen_before = {
        (file, title)
        for record in prior
        for item in record["flaky"] or []
        for file, _, title in [split_test(item["test"])]
    }
    tests: dict[tuple[str, str], dict] = {}
    for run in window:
        # A test flaky in two browser projects of one run is one hit for that run.
        hits = {}
        for item in run["flaky"] or []:
            file, line, title = split_test(item["test"])
            hits.setdefault((file, title), line)
        for key, line in hits.items():
            test = tests.get(key)
            if test is None:
                test = tests[key] = {
                    "file": key[0],
                    "title": key[1],
                    "runs": 0,
                    "passedRuns": 0,
                    "prs": set(),
                    "firstRun": run,
                    "onMain": key in on_main,
                    "new": has_history
                    and key not in seen_before
                    and key not in on_main,
                }
            test["line"] = line
            test["runs"] += 1
            test["passedRuns"] += run["conclusion"] == "success"
            test["prs"].update(run["prs"])
            test["lastRun"] = run
    ranked = sorted(
        tests.values(),
        key=lambda test: (
            -len(test["prs"]),
            -test["runs"],
            test["file"],
            test["title"],
        ),
    )
    specs: dict[str, dict] = {}
    for test in ranked:
        spec = specs.setdefault(
            test["file"], {"file": test["file"], "tests": 0, "runs": 0}
        )
        spec["tests"] += 1
        spec["runs"] += test["runs"]
    conclusions = Counter(run["conclusion"] for run in window)
    return {
        "tests": ranked,
        "specs": sorted(
            (spec for spec in specs.values() if spec["tests"] > 1),
            key=lambda spec: (-spec["tests"], -spec["runs"], spec["file"]),
        ),
        "hasHistory": has_history,
        "runs": len(window),
        "passed": conclusions["success"],
        "failed": conclusions["failure"],
        "other": len(window) - conclusions["success"] - conclusions["failure"],
        "withoutData": sum(run["flaky"] is None for run in window),
        "withFlaky": sum(bool(run["flaky"]) for run in window),
        "prs": len({pr for run in window for pr in run["prs"]}),
    }


# ------------------------------------------------------------------- rendering


def test_name(test: dict) -> str:
    return (
        f"{test['file']}:{test['line']} › {test['title']}"
        if test["title"]
        else test["file"]
    )


def first_seen(test: dict, repo_url: str) -> tuple[str, str]:
    run = test["firstRun"]
    label = utc(run["createdAt"])
    if run["prs"]:
        pr = run["prs"][0]
        return f"{label} · #{pr}", f"{repo_url}/pull/{pr}"
    return label, run["url"]


def tag(test: dict) -> str:
    return "NEW" if test["new"] else "main" if test["onMain"] else ""


def tables(
    report: dict, repo_url: str, lookback: float
) -> list[tuple[str, str, list, list]]:
    columns = [
        "#",
        "Test",
        "PRs",
        "Runs (passed / failed)",
        "First seen",
        "Tag",
        "Latest run (trace)",
    ]

    def rows(tests):
        return [
            [
                str(index),
                test_name(test),
                str(len(test["prs"])),
                f"{test['runs']} ({test['passedRuns']} / {test['runs'] - test['passedRuns']})",
                first_seen(test, repo_url),
                tag(test),
                (utc(test["lastRun"]["createdAt"]), test["lastRun"]["url"]),
            ]
            for index, test in enumerate(tests, 1)
        ]

    new = [test for test in report["tests"] if test["new"]]
    sections = []
    if new:
        sections.append(
            (
                "New flaky tests",
                f"Not flaky in the {lookback:g}h before this window and not flaky on main. "
                "The first-seen PR is the first suspect.",
                columns,
                rows(new),
            )
        )
    sections.append(
        (
            "All flaky tests",
            "Ranked by distinct PRs, so a re-queued PR counts once. "
            "PRs = PRs whose queue run hit it; Tag main = also flaky on main.",
            columns,
            rows(report["tests"]),
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
        f"{report['runs']} merge-queue runs ({report['passed']} passed, {report['failed']} failed"
        + (f", {report['other']} other" if report["other"] else "")
        + f") for {report['prs']} PRs",
        f"{report['withFlaky']} runs had retry passes · {len(report['tests'])} distinct flaky tests",
    ]
    if report["withoutData"]:
        lines.append(
            f"{report['withoutData']} runs uploaded no flaky data and are not counted"
        )
    if not report["hasHistory"]:
        lines.append("No readable history before this window, so no test is marked NEW")
    return lines


def cell_html(cell: str | tuple[str, str]) -> str:
    if isinstance(cell, tuple):
        return f'<a href="{html.escape(cell[1])}">{html.escape(cell[0])}</a>'
    return html.escape(cell)


def cell_md(cell: str | tuple[str, str]) -> str:
    text = (
        f"[{html.escape(cell[0])}]({cell[1]})"
        if isinstance(cell, tuple)
        else html.escape(cell)
    )
    return text.replace("|", "\\|").replace("\n", " ")


def render_html(report: dict, title: str, repo_url: str, lookback: float) -> str:
    body = [f"<h1>{html.escape(title)}</h1>", "<ul>"]
    body += [f"<li>{html.escape(line)}</li>" for line in headline(report)]
    body.append("</ul>")
    for heading, note, columns, rows in tables(report, repo_url, lookback):
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
      td:nth-child(2) { word-break: break-word; }
      a { color: #0969da; text-decoration: none; }
    """
    return (
        f"<!doctype html><html><head><meta charset='utf-8'><title>{html.escape(title)}</title>"
        f"<style>{style}</style></head><body>{''.join(body)}</body></html>"
    )


def render_md(report: dict, title: str, repo_url: str, lookback: float) -> str:
    lines = [f"## {title}", ""] + [f"- {line}" for line in headline(report)]
    for heading, note, columns, rows in tables(report, repo_url, lookback):
        lines += ["", f"### {heading}", "", note, ""]
        if not rows:
            lines.append("None.")
            continue
        lines += ["| " + " | ".join(columns) + " |", "|" + "---|" * len(columns)]
        lines += ["| " + " | ".join(cell_md(c) for c in row) + " |" for row in rows]
    return "\n".join(lines) + "\n"


def slack_text(report: dict, title: str, repo_url: str, lookback: float) -> str:
    lines = [f":bar_chart: *{title}*"] + headline(report)
    if not report["tests"]:
        quiet = (
            ":warning: No run in this window uploaded flaky data."
            if report["withoutData"] == report["runs"]
            else ":large_green_circle: No retry passes in the merge queue."
        )
        return "\n".join(lines + [quiet])

    def line(test):
        label, url = first_seen(test, repo_url)
        return (
            f"`{mq.sanitize_external(test_name(test))}` — {len(test['prs'])} PRs, "
            f"{test['runs']} runs, first <{url}|{label}>"
        )

    new = [test for test in report["tests"] if test["new"]]
    if new:
        lines.append(
            f"*New flaky* (not in the prior {lookback:g}h, not flaky on main):"
        )
        lines += [f"• {line(test)}" for test in new[:5]]
    lines.append("*Top flaky* (by distinct PRs):")
    lines += [
        f"{index}. {line(test)}" for index, test in enumerate(report["tests"][:TOP], 1)
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
    if args.lookback_hours > 24:
        raise SystemExit("--lookback-hours may be at most 24")
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
            pool.map(lambda run: collect(args.owner, args.repo, run, token), runs)
        )
    report = aggregate(records, since, main_flaky(args.owner, args.repo, token))

    repo_url = f"https://github.com/{args.owner}/{args.repo}"
    title = f"Merge-queue flaky tests, {utc(since)} to {utc(until)} UTC"
    out = args.out_dir
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.html").write_text(
        render_html(report, title, repo_url, args.lookback_hours)
    )
    markdown = render_md(report, title, repo_url, args.lookback_hours)
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
                "filename": f"merge-queue-flaky-{stamp}.pdf",
                "title": title,
            }
        )
    )
    print(f"{report['runs']} runs, {len(report['tests'])} flaky tests")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
