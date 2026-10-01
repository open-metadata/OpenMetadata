"""Daily merge-queue flaky report: counting rules and the files the workflow posts."""

import importlib.util
import json
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parents[1]


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


load_script("merge_queue_metrics")
report_script = load_script("playwright_flaky_report")

GLOSSARY = "Features/CustomizeDetailPage.spec.ts:722 › Glossary Term tabs"
FILTERS = "Features/ContextCenterArticlesFilters.spec.ts:206 › domain filter"
SORTS = "Features/ContextCenterArticlesFilters.spec.ts:284 › sort options"
MAIN = "Pages/Domains.spec.ts:790 › asset count"


def run(run_id, created, pr, conclusion="success", tests=()):
    return {
        "id": run_id,
        "html_url": f"https://github.com/o/r/actions/runs/{run_id}",
        "created_at": created,
        "conclusion": conclusion,
        "head_branch": f"gh-readonly-queue/main/pr-{pr}-abc",
        "_flaky": None if tests is None else [{"test": t} for t in tests],
    }


RUNS = [
    # Lookback: the filters setup was already flaky before the window.
    run(1, "2026-09-29T10:00:00Z", 100, tests=[FILTERS]),
    run(2, "2026-09-30T06:44:00Z", 34042, tests=[GLOSSARY, FILTERS, MAIN]),
    # The same PR re-queued after an ejection hits the same flakes again.
    run(3, "2026-09-30T09:40:00Z", 34042, "failure", tests=[GLOSSARY, GLOSSARY]),
    run(4, "2026-09-30T10:00:00Z", 200, tests=[GLOSSARY, SORTS]),
    run(5, "2026-09-30T11:00:00Z", 300, tests=[]),
    run(6, "2026-09-30T12:00:00Z", 400, tests=None),
]


def build(tmp_path, monkeypatch, runs=RUNS):
    by_id = {r["id"]: r for r in runs}
    monkeypatch.setenv("GH_TOKEN", "token")
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    monkeypatch.setattr(report_script, "list_runs", lambda *a: runs)
    monkeypatch.setattr(
        report_script, "read_flaky", lambda o, r, run_id, t: by_id[run_id]["_flaky"]
    )
    monkeypatch.setattr(
        report_script,
        "main_flaky",
        lambda *a: {("Pages/Domains.spec.ts", "asset count")},
    )
    code = report_script.main(
        [
            "--owner",
            "o",
            "--repo",
            "r",
            "--channel",
            "C1",
            "--out-dir",
            str(tmp_path),
            "--since",
            "2026-09-30",
            "--until",
            "2026-10-01",
        ]
    )
    assert code == 0
    return json.loads((tmp_path / "slack.json").read_text())


def test_ranks_by_distinct_prs_and_marks_new_against_history(tmp_path, monkeypatch):
    slack = build(tmp_path, monkeypatch)
    text = slack["initial_comment"]
    assert "5 merge-queue runs (4 passed, 1 failed) for 4 PRs" in text
    assert "1 runs uploaded no flaky data" in text
    # Glossary hit 3 runs but only 2 PRs; the re-queue does not triple it, and the
    # duplicate line inside run 3 is one hit.
    assert (
        f"1. `{GLOSSARY}` — 2 PRs, 3 runs, first <https://github.com/o/r/pull/34042|"
        in text
    )
    new = text.split("*New flaky*")[1].split("*Top flaky*")[0]
    assert GLOSSARY in new and SORTS in new
    assert FILTERS not in new, "flaky before the window"
    assert MAIN not in new, "already flaky on main"
    assert slack["channel_id"] == "C1"
    assert slack["file"] == str((tmp_path / "report.pdf").resolve())
    assert (
        slack["filename"] == "merge-queue-flaky-2026-09-30-0000-to-2026-10-01-0000.pdf"
    )


def test_report_splits_passing_from_failed_runs_and_links_latest_run(
    tmp_path, monkeypatch
):
    build(tmp_path, monkeypatch)
    markdown = (tmp_path / "report.md").read_text()
    glossary_row = next(
        line for line in markdown.splitlines() if "Glossary Term tabs" in line
    )
    assert "| 2 | 3 (2 / 1) |" in glossary_row
    # The latest run is where the trace for the most recent hit lives.
    assert "[2026-09-30 10:00](https://github.com/o/r/actions/runs/4)" in glossary_row
    assert "Features/ContextCenterArticlesFilters.spec.ts | 2 | 2" in markdown
    page = (tmp_path / "report.html").read_text()
    assert "<td>main</td>" in page and "<td>NEW</td>" in page


def test_untrusted_test_names_are_escaped(tmp_path, monkeypatch):
    evil = "Pages/X.spec.ts:1 › <!channel> `x` <script>"
    slack = build(
        tmp_path, monkeypatch, [run(9, "2026-09-30T06:00:00Z", 1, tests=[evil])]
    )
    assert "<!channel>" not in slack["initial_comment"]
    assert "<script>" not in (tmp_path / "report.html").read_text()
    assert "No readable history" in slack["initial_comment"]
    assert "*New flaky*" not in slack["initial_comment"]


def test_quiet_window_still_posts(tmp_path, monkeypatch):
    slack = build(tmp_path, monkeypatch, [run(9, "2026-09-30T06:00:00Z", 1, tests=[])])
    assert "No retry passes in the merge queue." in slack["initial_comment"]


def test_window_over_48h_is_refused(monkeypatch):
    monkeypatch.setenv("GH_TOKEN", "token")
    monkeypatch.setattr(
        report_script, "list_runs", lambda *a: pytest.fail("no API calls")
    )
    args = ["--owner", "o", "--repo", "r", "--channel", "C1", "--out-dir", "x"]
    with pytest.raises(SystemExit, match="at most 48h"):
        report_script.main(
            args + ["--since", "2026-09-28T23:00", "--until", "2026-09-30T23:01"]
        )
    with pytest.raises(SystemExit, match="at most 24"):
        report_script.main(args + ["--lookback-hours", "48"])
