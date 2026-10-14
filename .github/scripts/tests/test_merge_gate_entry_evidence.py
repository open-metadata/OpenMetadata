"""Queue-entry identity and evidence parsing for the merge gate."""

import importlib.util
import io
import json
import sys
import zipfile
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
policy = load_script("merge_gate_policy")
entry = load_script("merge_gate_entry")
evidence = load_script("merge_gate_evidence")

PARENT = "610a7f9b33cacbb23eae1c8aa86d65fdc0f2ada1"


@pytest.mark.parametrize(
    "ref",
    [
        f"gh-readonly-queue/main/pr-35297-{PARENT}",
        f"refs/heads/gh-readonly-queue/main/pr-35297-{PARENT}",
    ],
)
def test_queue_ref_names_the_entry_pr_and_its_parent(ref):
    parsed = entry.parse_queue_ref(ref)
    assert (parsed.base, parsed.pr, parsed.parent_sha) == ("main", 35297, PARENT)


def test_non_queue_refs_are_not_entries():
    assert entry.parse_queue_ref("feature/pr-1-abc") is None
    assert entry.parse_queue_ref("") is None


@pytest.mark.parametrize(
    ("title", "pr"),
    [
        ("fix(metabase): normalise MBQL type (#34644) (#34677)", 34677),
        ("Fixes #34436: stop ContractSemanticFormTab enabling Save (#34495)", 34495),
        ("Merge branch 'main' into feature", None),
    ],
)
def test_the_squash_commit_title_names_its_pr_last(title, pr):
    assert entry.pr_from_title(title) == pr


def compare(titles, files, total_commits=None):
    return {
        "total_commits": total_commits if total_commits is not None else len(titles),
        "commits": [{"commit": {"message": f"{t}\n\nbody (#1)"}} for t in titles],
        "files": [{"filename": f} for f in files],
    }


def test_entry_pr_set_includes_the_entries_ahead_and_its_own_pr():
    ref = entry.parse_queue_ref(f"gh-readonly-queue/main/pr-35297-{PARENT}")
    built = entry.entry_from_compare(
        ref, "head", compare(["A (#35001)", "B (#35002)", "C (#35297)"], ["x.java"])
    )
    assert built.prs == frozenset({35001, 35002, 35297})
    assert built.changed_files == ("x.java",) and built.truncated is False


def test_a_diff_too_large_to_list_is_marked_truncated():
    ref = entry.parse_queue_ref(f"gh-readonly-queue/main/pr-7-{PARENT}")
    many = entry.entry_from_compare(ref, "h", compare(["x (#7)"], [f"f{i}" for i in range(300)]))
    assert many.truncated is True
    long = entry.entry_from_compare(ref, "h", compare(["x (#7)"], ["f"], total_commits=251))
    assert long.truncated is True


def test_entries_sharing_a_pr_are_not_independent_evidence():
    assert entry.independent(frozenset({1, 2}), frozenset({2, 3})) is False
    assert entry.independent(frozenset({1}), frozenset({2, 3})) is True
    assert entry.independent(frozenset(), frozenset({2})) is True


def test_failing_tests_read_both_outcome_schemas():
    junit = {"failedTests": [{"id": "a.B#c", "message": "expected <2> but was <0>"}]}
    playwright = {"failures": [{"stableId": "chromium :: X.spec.ts :: t", "firstError": "Timeout"}]}
    assert evidence.failing_tests(junit) == [("a.B#c", "expected <2> but was <0>")]
    assert evidence.failing_tests(playwright) == [("chromium :: X.spec.ts :: t", "Timeout")]


def test_fingerprints_ignore_ids_that_change_every_run():
    one = evidence.fingerprint("T#t", "Entity 1a2b3c4d-1111-2222-3333-444455556666 not found after 30123 ms")
    two = evidence.fingerprint("T#t", "Entity 9f8e7d6c-aaaa-bbbb-cccc-ddddeeeeffff not found after 30984 ms")
    other = evidence.fingerprint("T#t", "expected <2> but was <0>")
    assert one == two != other


def test_job_slugs_match_the_evidence_artifact_names():
    assert evidence.job_slug("it / postgres-opensearch / parallel") == "it-postgres-opensearch-parallel"
    assert evidence.job_slug("playwright / chromium-03") == "playwright-chromium-03"


def test_verify_documents_become_verified_tests():
    document = {
        "runAttempt": 1,
        "tests": [
            {"id": "A#t", "fingerprint": "fa", "entry": {"failed": 0, "runs": 3}, "parent": None},
            {"id": "B#t", "fingerprint": "fb", "entry": {"failed": 3, "runs": 3}, "parent": {"failed": 0, "runs": 3}},
        ],
    }
    tests = evidence.verified_tests(document)
    assert [policy.classify_test(t) for t in tests] == [policy.FLAKY, policy.INTRODUCED]


def zip_with(members):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in members.items():
            archive.writestr(name, content)
    return buffer.getvalue()


def test_run_evidence_joins_jobs_outcomes_and_verify_results_for_the_attempt(monkeypatch):
    jobs = [
        {
            "id": 1,
            "name": "it / mysql-elasticsearch / parallel",
            "conclusion": "failure",
            "html_url": "u1",
            "steps": [{"name": "Run integration tests", "conclusion": "failure"}],
        },
        {"id": 2, "name": "verify / java-it", "conclusion": "success", "html_url": "u2", "steps": []},
    ]
    artifacts = [
        {"id": 10, "name": "evidence-it-mysql-elasticsearch-parallel-a1", "size_in_bytes": 100},
        {"id": 11, "name": "evidence-it-mysql-elasticsearch-parallel-a2", "size_in_bytes": 100},
        {"id": 12, "name": "verify-java-it-a1", "size_in_bytes": 100},
    ]
    zips = {
        10: zip_with({"outcome.json": json.dumps({"classification": "test_failure", "failedTests": [{"id": "A#t", "message": "boom"}]})}),
        11: zip_with({"outcome.json": json.dumps({"classification": "passed", "failedTests": []})}),
        12: zip_with({"verify.json": json.dumps({"runAttempt": 1, "tests": [{"id": "A#t", "fingerprint": "f", "entry": {"failed": 0, "runs": 3}}]})}),
    }
    downloads = []

    def paginated_items(path, key, token, max_pages=10):
        return jobs if path.endswith("/attempts/1/jobs") else artifacts

    def download_zip(owner, repo, artifact, token):
        downloads.append(artifact["id"])
        return zips[artifact["id"]]

    monkeypatch.setattr(mq, "paginated_items", paginated_items)
    monkeypatch.setattr(pfr, "download_zip", download_zip)
    monkeypatch.setattr(pfr, "job_reasons", lambda o, r, js, t: [{"url": j["html_url"], "reason": "exit 1"} for j in js])

    failed, verified, fingerprints = evidence.run_evidence("o", "r", {"id": 99}, 1, "t")

    assert sorted(downloads) == [10, 12]
    assert [(j.name, j.outcome, j.failing_tests, j.failed_step) for j in failed] == [
        ("it / mysql-elasticsearch / parallel", "test_failure", ("A#t",), "Run integration tests")
    ]
    assert [(v.test_id, v.entry_runs) for v in verified] == [("A#t", 3)]
    assert set(fingerprints) == {"A#t"}


def test_playwright_ids_keep_the_describe_path_like_the_classifier():
    results = {
        "suites": [
            {
                "title": "Pages/Glossary.spec.ts",
                "file": "Pages/Glossary.spec.ts",
                "suites": [
                    {
                        "title": "Glossary",
                        "specs": [
                            {
                                "title": "term colors",
                                "file": "Pages/Glossary.spec.ts",
                                "line": 9,
                                "tests": [{"projectName": "chromium", "status": "unexpected", "results": [{"error": {"message": "boom"}}]}],
                            }
                        ],
                    }
                ],
            }
        ]
    }
    failed, _ = evidence.playwright_tests(results)
    assert evidence.playwright_id(failed[0]) == "chromium :: Pages/Glossary.spec.ts :: Glossary › term colors"


def test_reusable_suites_are_read_from_their_own_artifacts(monkeypatch):
    jobs = [
        {"id": 1, "name": "playwright / playwright-ci (chromium-03, chromium-03.json, 3, chromium, false)", "conclusion": "failure", "html_url": "u1", "steps": []},
        {"id": 2, "name": "py-it / Integration Tests (shard-2, 3.10)", "conclusion": "failure", "html_url": "u2", "steps": []},
    ]
    results = {"suites": [{"title": "X", "file": "X.spec.ts", "specs": [{"title": "t", "file": "X.spec.ts", "line": 3, "tests": [{"projectName": "chromium", "status": "unexpected", "results": [{"error": {"message": "Timeout"}}]}]}]}]}
    outcome_this = {"classification": "test_failure", "context": {"runId": "99", "runAttempt": "1"}, "failedTests": [{"id": "tests.x.TestY#t", "message": "m"}]}
    artifacts = [
        {"id": 10, "name": "playwright-results-json-chromium-03-a1", "size_in_bytes": 10},
        {"id": 11, "name": "py-integration-test-results-shard-2-3.10", "size_in_bytes": 10},
    ]
    zips = {
        10: zip_with({"results.json": json.dumps(results)}),
        11: zip_with({"ci-diagnostics/outcome.json": json.dumps(outcome_this)}),
    }
    monkeypatch.setattr(mq, "paginated_items", lambda path, key, token, max_pages=10: jobs if path.endswith("/jobs") else artifacts)
    monkeypatch.setattr(pfr, "download_zip", lambda o, r, a, t: zips[a["id"]])
    monkeypatch.setattr(pfr, "job_reasons", lambda o, r, js, t: [])

    failed, _, _ = evidence.run_evidence("o", "r", {"id": 99}, 1, "t")
    assert [j.failing_tests for j in failed] == [("chromium :: X.spec.ts :: X › t",), ("tests.x.TestY#t",)]

    # The Python artifact has no attempt in its name; a later attempt's upload is not this attempt's evidence.
    zips[11] = zip_with({"ci-diagnostics/outcome.json": json.dumps({**outcome_this, "context": {"runId": "99", "runAttempt": "2"}})})
    failed, _, _ = evidence.run_evidence("o", "r", {"id": 99}, 1, "t")
    assert failed[1].failing_tests == ()
