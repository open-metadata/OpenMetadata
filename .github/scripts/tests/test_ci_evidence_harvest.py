"""Evidence harvest: which artifacts it reads, what it keeps, and when it retries."""

import importlib.util
import io
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parents[1]
sys.path.insert(0, str(SCRIPTS))


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


mq = load_script("merge_queue_metrics")
pfr = load_script("playwright_flaky_report")
evidence = load_script("merge_gate_evidence")
harvest = load_script("ci_evidence_harvest")

RUN_ID = 38377494829
BASE = "610a7f9b33cacbb23eae1c8aa86d65fdc0f2ada1"


def artifact(name, size=1000, expired=False, artifact_id=1):
    return {"id": artifact_id, "name": name, "size_in_bytes": size, "expired": expired}


def job(name, conclusion="failure", failed_step="Run Integration Tests", job_id=7):
    return {
        "id": job_id,
        "name": name,
        "conclusion": conclusion,
        "html_url": f"https://github.com/o/r/actions/runs/{RUN_ID}/job/{job_id}",
        "started_at": "2026-10-12T10:00:00Z",
        "completed_at": "2026-10-12T10:40:00Z",
        "steps": [
            {"name": "Checkout", "conclusion": "success"},
            {"name": failed_step, "conclusion": conclusion},
        ],
    }


def run(path=".github/workflows/integration-tests-mysql-elasticsearch.yml", attempt=1, conclusion="failure"):
    return {
        "id": RUN_ID,
        "name": "Integration Tests - MySQL + Elasticsearch",
        "path": path,
        "head_branch": f"gh-readonly-queue/main/pr-35297-{BASE}",
        "head_sha": "9aac6e95c795d2a658bd3ede35980c2d5bdeb98e",
        "created_at": "2026-10-12T10:00:00Z",
        "html_url": f"https://github.com/o/r/actions/runs/{RUN_ID}",
        "run_attempt": attempt,
        "conclusion": conclusion,
        "check_suite_node_id": "CS_1",
    }


def zip_bytes(members: dict) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in members.items():
            archive.writestr(name, content)
    return buffer.getvalue()


def outcome(failed_classes=("org.openmetadata.it.tests.TableResourceIT",), attempt="1", classification="test_failure"):
    return json.dumps(
        {
            "schemaVersion": 1,
            "classification": classification,
            "context": {"runId": str(RUN_ID), "runAttempt": attempt, "lane": "parallel"},
            "failedTests": [
                {"className": name, "id": f"{name}#test_a", "message": "expected <2> but was <0>"}
                for name in failed_classes
            ],
            "tests": {"tests": 10, "failures": len(failed_classes), "errors": 0, "skipped": 0},
        }
    )


@pytest.fixture
def api(monkeypatch):
    """Fake GitHub: listings by path prefix, artifact zips by id."""
    state = {"lists": {}, "zips": {}, "rest": {}, "downloads": []}

    def paginated_items(path, key, token, max_pages=10):
        for prefix, items in state["lists"].items():
            if path.startswith(prefix):
                return items(path) if callable(items) else items
        return []

    def download_zip(owner, repo, art, token):
        state["downloads"].append(art["name"])
        return state["zips"][art["id"]]

    monkeypatch.setattr(mq, "paginated_items", paginated_items)
    monkeypatch.setattr(mq, "rest", lambda path, token: state["rest"][path])
    monkeypatch.setattr(pfr, "download_zip", download_zip)
    monkeypatch.setattr(
        pfr,
        "job_reasons",
        lambda owner, repo, jobs, token: [
            {"url": j["html_url"], "reason": "Process completed with exit code 124 (timed out)."}
            for j in jobs
        ],
    )
    return state


def test_only_the_failed_lane_diagnostics_are_downloaded(api, tmp_path):
    artifacts = [
        artifact(f"java-it-reports-mysql-elasticsearch-parallel-{RUN_ID}-1", 20_000_000, artifact_id=1),
        artifact(f"java-it-build-mysql-elasticsearch-{RUN_ID}", 60_000_000, artifact_id=2),
        artifact(f"java-it-mysql-elasticsearch-global-state-{RUN_ID}-1", artifact_id=3),
        artifact(f"java-it-mysql-elasticsearch-parallel-{RUN_ID}-1", artifact_id=4),
    ]
    api["lists"] = {
        f"/repos/o/r/actions/runs/{RUN_ID}/attempts/1/jobs": [
            job("Integration Test Lane (parallel)"),
            job("integration-tests-mysql-elasticsearch", failed_step="Verify Maven Integration Test Lanes", job_id=8),
            job("Integration Test Lane (global-state)", conclusion="success", job_id=9),
        ],
        f"/repos/o/r/actions/runs/{RUN_ID}/artifacts": artifacts,
    }
    api["zips"][4] = zip_bytes(
        {
            "ci-diagnostics/outcome.json": outcome(),
            "failsafe-reports/org.openmetadata.it.tests.TableResourceIT.txt": "Tests run: 3, Failures: 1",
            "failsafe-reports/org.openmetadata.it.tests.OtherIT.txt": "Tests run: 9",
        }
    )

    record = harvest.harvest_attempt(
        "o", "r", run(), 1, None, "t", harvest.Budget(10**9), tmp_path
    )

    assert api["downloads"] == [f"java-it-mysql-elasticsearch-parallel-{RUN_ID}-1"]
    assert record["prNumber"] == 35297 and record["baseSha"] == BASE
    assert [j["failedStep"] for j in record["jobs"]] == [
        "Run Integration Tests",
        "Verify Maven Integration Test Lanes",
    ]
    assert record["jobs"][0]["reason"].endswith("(timed out).")
    [lane] = record["outcomes"]
    assert lane["failedTests"][0]["id"].endswith("TableResourceIT#test_a")
    kept = sorted(p.name for p in (tmp_path / "runs").rglob("*.txt"))
    assert kept == ["org.openmetadata.it.tests.TableResourceIT.txt"]
    assert record["complete"] is True


def test_a_failed_lane_without_its_artifact_is_reported_missing(api, tmp_path):
    api["lists"] = {
        f"/repos/o/r/actions/runs/{RUN_ID}/attempts/1/jobs": [job("Integration Test Lane (rdf)")],
        f"/repos/o/r/actions/runs/{RUN_ID}/artifacts": [],
    }
    record = harvest.harvest_attempt("o", "r", run(), 1, None, "t", harvest.Budget(10**9), tmp_path)
    assert record["missingEvidence"] == ["no diagnostics artifact for lane rdf"]
    assert record["outcomes"] == []


def test_python_results_overwritten_by_a_later_attempt_are_not_attributed(api, tmp_path):
    py_run = run(path=".github/workflows/py-tests.yml", attempt=2, conclusion="success")
    api["lists"] = {
        f"/repos/o/r/actions/runs/{RUN_ID}/attempts/1/jobs": [
            job("python / Integration Tests (shard-2, 3.10)")
        ],
        f"/repos/o/r/actions/runs/{RUN_ID}/artifacts": [
            artifact("py-integration-test-results-shard-2-3.10", artifact_id=5),
            artifact("coverage-unit", 2_000_000, artifact_id=6),
        ],
    }
    # The artifact name has no attempt, so attempt 2's upload replaced attempt 1's.
    api["zips"][5] = zip_bytes({"ci-diagnostics/outcome.json": outcome(attempt="2")})

    record = harvest.harvest_attempt("o", "r", py_run, 1, "success", "t", harvest.Budget(10**9), tmp_path)

    assert record["outcomes"] == []
    assert record["laterAttemptConclusion"] == "success"
    assert any("belongs to run" in note for note in record["missingEvidence"])
    assert api["downloads"] == ["py-integration-test-results-shard-2-3.10"]


def test_oversized_members_are_refused_before_inflating(tmp_path):
    archive = zipfile.ZipFile(
        io.BytesIO(
            zip_bytes(
                {
                    "ci-diagnostics/outcome.json": outcome(),
                    "failsafe-reports/org.openmetadata.it.tests.TableResourceIT.txt": "x"
                    * (evidence.MAX_FAILSAFE_BYTES + 1),
                }
            )
        )
    )
    parsed, reports, problems = evidence.outcomes_from_archive(archive, RUN_ID, 1)
    assert parsed["classification"] == "test_failure"
    assert reports == {}
    assert problems and "over" in problems[0]


def test_written_names_cannot_escape_the_archive_directory():
    assert harvest.safe_name("../../etc/passwd") == ".._.._etc_passwd"
    assert "/" not in harvest.safe_name("a/b\\c")


def test_playwright_failures_keep_error_and_stack_and_flakes():
    results = {
        "suites": [
            {
                "specs": [
                    {
                        "file": "Features/PersonaSettings.spec.ts",
                        "line": 120,
                        "title": "a new tab is saved",
                        "tests": [
                            {
                                "projectName": "chromium",
                                "status": "unexpected",
                                "results": [
                                    {"error": {"message": "first try"}},
                                    {
                                        "error": {
                                            "message": "\x1b[31mexpect(locator).toBeVisible() failed\x1b[39m",
                                            "stack": "\n".join(f"at frame{i}" for i in range(100)),
                                        }
                                    },
                                ],
                            }
                        ],
                    }
                ],
                "suites": [
                    {
                        "specs": [
                            {
                                "file": "Pages/Glossary.spec.ts",
                                "line": 9,
                                "title": "term colors",
                                "tests": [{"projectName": "chromium", "status": "flaky"}],
                            }
                        ]
                    }
                ],
            }
        ]
    }
    failed, flaky = evidence.playwright_tests(results)
    assert failed[0]["error"] == "expect(locator).toBeVisible() failed"
    assert failed[0]["attempts"] == 2
    assert len(failed[0]["stack"].splitlines()) == evidence.MAX_STACK_LINES
    assert flaky == [
        {"file": "Pages/Glossary.spec.ts", "line": 9, "title": "term colors", "project": "chromium"}
    ]


def test_exhausted_budget_leaves_the_attempt_for_the_next_harvest(api, tmp_path):
    api["lists"] = {
        f"/repos/o/r/actions/runs/{RUN_ID}/attempts/1/jobs": [job("Integration Test Lane (parallel)")],
        f"/repos/o/r/actions/runs/{RUN_ID}/artifacts": [
            artifact(f"java-it-mysql-elasticsearch-parallel-{RUN_ID}-1", size=5000, artifact_id=4)
        ],
    }
    record = harvest.harvest_attempt("o", "r", run(), 1, None, "t", harvest.Budget(10), tmp_path)
    harvest.write_record(tmp_path, record)

    assert record["complete"] is False
    assert api["downloads"] == []
    assert harvest.already_archived(tmp_path, RUN_ID, 1) is False


def test_earlier_failed_attempts_of_a_rerun_are_selected(api):
    api["rest"] = {
        f"/repos/o/r/actions/runs/{RUN_ID}/attempts/1": {"conclusion": "failure"},
        f"/repos/o/r/actions/runs/{RUN_ID}/attempts/2": {"conclusion": "success"},
    }
    green_after_two_reruns = run(attempt=3, conclusion="success")
    assert harvest.list_attempts("o", "r", green_after_two_reruns, "t") == [(1, "success")]


def test_an_empty_window_is_an_error_not_a_quiet_success(monkeypatch, tmp_path):
    monkeypatch.setenv("GH_TOKEN", "t")
    listed = []
    monkeypatch.setattr(harvest, "list_runs", lambda *a: listed.append(a) or [])
    assert harvest.main(["--since", "", "--out", str(tmp_path)]) == 1
    assert listed == []


def test_a_listing_slice_over_the_api_cap_is_halved(monkeypatch):
    calls = []

    def paginated_items(path, key, token, max_pages=10):
        calls.append(path)
        if len(calls) == 1:
            raise mq.ApiError("Partial data: exceeded 10 pages")
        return [{"id": len(calls), "created_at": "2026-10-12T00:00:00Z"}]

    monkeypatch.setattr(mq, "paginated_items", paginated_items)
    start = datetime(2026, 10, 12, tzinfo=timezone.utc)
    runs = harvest.list_runs("o", "r", start, start + harvest.LIST_SLICE, "t")
    assert len(calls) == 3
    assert sorted(r["id"] for r in runs) == [2, 3]
