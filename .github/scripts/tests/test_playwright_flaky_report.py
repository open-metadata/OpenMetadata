"""Daily merge-queue report: what it reads, how it counts, and the files it posts."""

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


mq = load_script("merge_queue_metrics")
report_script = load_script("playwright_flaky_report")

GLOSSARY = ("Features/CustomizeDetailPage.spec.ts", "Glossary Term tabs")
FILTERS = ("Features/ContextCenterArticlesFilters.spec.ts", "domain filter")
SORTS = ("Features/ContextCenterArticlesFilters.spec.ts", "sort options")
MAIN = ("Pages/Domains.spec.ts", "asset count")
DESTINATION = ("Features/ProfileNotificationTab.spec.ts", "Destination")


def run(run_id, created, pr, conclusion="success", flaky=(), failed=None, broken=None):
    return {
        "id": run_id,
        "html_url": f"https://github.com/o/r/actions/runs/{run_id}",
        "created_at": created,
        "conclusion": conclusion,
        "head_branch": f"gh-readonly-queue/main/pr-{pr}-abc",
        "check_suite_node_id": f"CS_{run_id}",
        "_flaky": None if flaky is None else {key: 10 for key in flaky},
        "_failed": failed or {},
        "_broken": broken or [],
    }


RUNS = [
    run(2, "2026-09-30T06:44:00Z", 34042, flaky=[GLOSSARY, FILTERS, MAIN]),
    # The same PR re-queued after an ejection hits the same tests again.
    run(
        3,
        "2026-09-30T09:40:00Z",
        34042,
        "failure",
        flaky=[GLOSSARY],
        failed={DESTINATION: (478, "TimeoutError: add-header-button-1")},
    ),
    run(4, "2026-09-30T10:00:00Z", 200, flaky=[GLOSSARY, SORTS]),
    run(
        5,
        "2026-09-30T10:36:00Z",
        34042,
        "failure",
        failed={DESTINATION: (478, "TimeoutError: add-header-button-1")},
    ),
    run(
        6,
        "2026-09-30T11:00:00Z",
        300,
        "failure",
        broken=[
            {
                "name": "playwright-ci (chromium-05)",
                "url": "u",
                "reason": "exit code 124 (timed out).",
            }
        ],
    ),
    run(7, "2026-09-30T12:00:00Z", 400, flaky=None),
]
PAGE = "merge-queue-2026-09-30-0000-to-2026-10-01-0000.html"


def build(tmp_path, monkeypatch, runs=RUNS):
    by_id = {r["id"]: r for r in runs}
    calls = []
    monkeypatch.setenv("GH_TOKEN", "token")
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    monkeypatch.setattr(report_script, "list_runs", lambda *a: runs)

    def read_flaky(r, token):
        if by_id[r["id"]]["_flaky"] is None:
            raise mq.ApiError("GraphQL down")
        return dict(by_id[r["id"]]["_flaky"])

    def read_failures(o, repo, r, token):
        calls.append(r["id"])
        return by_id[r["id"]]["_failed"], {}

    monkeypatch.setattr(report_script, "read_flaky", read_flaky)
    monkeypatch.setattr(report_script, "read_failures", read_failures)
    monkeypatch.setattr(
        report_script, "failed_jobs", lambda o, repo, r, t: by_id[r["id"]]["_broken"]
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
    return json.loads((tmp_path / "slack.json").read_text()), calls


def test_failures_are_read_only_for_failed_runs(tmp_path, monkeypatch):
    _, calls = build(tmp_path, monkeypatch)
    assert sorted(calls) == [3, 5, 6]


def test_slack_text_ranks_by_distinct_prs(tmp_path, monkeypatch):
    slack, _ = build(tmp_path, monkeypatch)
    text = slack["initial_comment"]
    assert "6 merge-queue runs (3 passed, 3 failed) for 4 PRs" in text
    assert "1 failed test · 4 flaky tests · 1 failed run with no failing test" in text
    assert "1 run could not be read" in text
    # Glossary hit 3 runs but only 2 PRs: the re-queue does not triple it.
    glossary = "Features/CustomizeDetailPage.spec.ts:10 › Glossary Term tabs"
    assert (
        f"1. `{glossary}` — 2 PRs · 3 runs (2 passed, 1 failed), "
        "latest <https://github.com/o/r/actions/runs/4|2026-09-30 10:00>"
    ) in text
    # Ejected twice for one PR.
    assert (
        "`Features/ProfileNotificationTab.spec.ts:478 › Destination` — 1 PR · 2 failed runs"
        in text
    )
    assert "NEW" not in text and "New flaky" not in text
    assert slack["channel_id"] == "C1"
    assert slack["file"] == str((tmp_path / PAGE).resolve())
    assert slack["filename"] == PAGE


def test_html_lists_every_run_of_every_test_newest_first(tmp_path, monkeypatch):
    build(tmp_path, monkeypatch)
    page = (tmp_path / PAGE).read_text()
    assert page.count("<details class=") == 5  # 1 failed + 4 flaky
    glossary = page[page.index("Glossary Term tabs") :].split("</details>")[0]
    runs = [f"actions/runs/{n}" for n in (4, 3, 2)]
    assert [glossary.index(r) for r in runs] == sorted(glossary.index(r) for r in runs)
    assert "/pull/34042" in glossary and "pill bad" in glossary
    destination = page[page.index(">Destination<") :].split("</details>")[0]
    assert "TimeoutError: add-header-button-1" in destination
    assert "actions/runs/5" in destination and "actions/runs/3" in destination
    assert "Failed runs with no failing test (1)" in page
    assert "playwright-ci (chromium-05)</a> — exit code 124 (timed out)." in page
    assert "Expand all" in page and "id=q" in page  # filter box


def test_job_summary_has_failed_flaky_and_broken_tables(tmp_path, monkeypatch):
    build(tmp_path, monkeypatch)
    markdown = (tmp_path / "report.md").read_text()
    for heading in [
        "### Failed tests (1)",
        "### Flaky tests (4)",
        "### Failed runs with no failing test (1)",
    ]:
        assert heading in markdown
    failed_row = next(line for line in markdown.splitlines() if "› Destination" in line)
    assert "| 1 | 2 | TimeoutError: add-header-button-1 |" in failed_row
    glossary_row = next(
        line for line in markdown.splitlines() if "Glossary Term tabs" in line
    )
    assert (
        "| 2 | 3 (2 / 1) | [2026-09-30 10:00](https://github.com/o/r/actions/runs/4) |"
        in glossary_row
    )


def test_untrusted_test_names_are_escaped(tmp_path, monkeypatch):
    evil = ("Pages/X.spec.ts", "<!channel> `x` <script>")
    slack, _ = build(
        tmp_path, monkeypatch, [run(9, "2026-09-30T06:00:00Z", 1, flaky=[evil])]
    )
    assert "<!channel>" not in slack["initial_comment"]
    page = (tmp_path / PAGE).read_text()
    assert "<script> `x`" not in page and "&lt;script&gt;" in page


def test_quiet_window_still_posts(tmp_path, monkeypatch):
    slack, _ = build(tmp_path, monkeypatch, [run(9, "2026-09-30T06:00:00Z", 1)])
    assert "No failed or flaky tests in the merge queue." in slack["initial_comment"]


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


def test_retry_pass_annotations_are_read_from_one_check_suite_query(monkeypatch):
    seen = {}

    def graphql(query, variables, token):
        seen.update(variables)
        note = {
            "title": "Retry pass in merge queue",
            "message": "A.spec.ts:1 › one\nB.spec.ts:2 › two",
        }
        other = {"title": "Node.js 20 is deprecated", "message": "x.spec.ts:1 › nope"}
        return {
            "node": {
                "checkRuns": {
                    "nodes": [
                        {"annotations": {"nodes": [note, other]}},
                        {"annotations": None},
                    ]
                }
            }
        }

    monkeypatch.setattr(mq, "graphql", graphql)
    flaky = report_script.read_flaky({"id": 1, "check_suite_node_id": "CS_1"}, "t")
    assert seen == {"id": "CS_1"}
    assert flaky == {("A.spec.ts", "one"): 1, ("B.spec.ts", "two"): 2}


def test_results_json_gives_failed_tests_with_the_final_error_and_flaky_tests():
    results = {
        "suites": [
            {
                "suites": [
                    {
                        "specs": [
                            {
                                "file": "A.spec.ts",
                                "line": 3,
                                "title": "breaks",
                                "tests": [
                                    {
                                        "status": "unexpected",
                                        "results": [
                                            {"error": {"message": "first"}},
                                            {
                                                "error": {
                                                    "message": "\x1b[31m\nError: last\x1b[0m\nstack"
                                                }
                                            },
                                        ],
                                    }
                                ],
                            },
                            {
                                "file": "A.spec.ts",
                                "line": 9,
                                "title": "wobbles",
                                "tests": [{"status": "flaky", "results": [{}, {}]}],
                            },
                            {
                                "file": "A.spec.ts",
                                "line": 12,
                                "title": "fine",
                                "tests": [{"status": "expected", "results": [{}]}],
                            },
                        ]
                    }
                ]
            }
        ]
    }
    failed, flaky = report_script.results_tests(results)
    assert failed == {("A.spec.ts", "breaks"): (3, "Error: last")}
    assert flaky == {("A.spec.ts", "wobbles"): 9}
