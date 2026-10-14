"""Same-run verification: what it selects, the commands it builds, how it counts
attempts, and that its verify.json reads back through the gate's own reader."""

import importlib.util
import json
import sys
import textwrap

import pytest
from pathlib import Path


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
gate = load_script("merge_gate_policy")
evidence = load_script("merge_gate_evidence")
verify = load_script("verify_failures")


def write_outcome(directory: Path, name: str, outcome: dict) -> None:
    path = directory / name / "outcome.json"
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps(outcome))


def java_outcome(ids, lane="parallel", profile="mysql-elasticsearch"):
    return {
        "classification": "test_failure",
        "context": {"lane": lane, "profile": profile, "runId": "1", "runAttempt": "1"},
        "failedTests": [{"id": i, "message": "expected <2> but was <0>"} for i in ids],
    }


def test_select_reads_each_suite_and_skips_unit_suites(tmp_path):
    write_outcome(tmp_path, "it", java_outcome(["org.x.TableResourceIT#test_a(TestNamespace)"]))
    write_outcome(tmp_path, "unit", {"classification": "test_failure", "context": {"profile": "java-unit"}, "failedTests": [{"id": "org.x.FooTest#t"}]})
    write_outcome(
        tmp_path,
        "pw",
        {"failures": [{"stableId": "chromium :: Pages/Glossary.spec.ts :: Glossary › term colors", "firstError": "Timeout"}]},
    )

    java, skipped = verify.select(tmp_path, "java-it", 10)
    assert not skipped
    assert [(t.class_name, t.method, t.profile, t.lane) for t in java] == [
        ("org.x.TableResourceIT", "test_a", "mysql-elasticsearch", "parallel")
    ]
    [pw], _ = verify.select(tmp_path, "playwright", 10)
    assert (pw.project, pw.file, pw.title) == ("chromium", "Pages/Glossary.spec.ts", "Glossary › term colors")


def test_select_verifies_nothing_past_the_policy_cap(tmp_path):
    write_outcome(tmp_path, "it", java_outcome([f"org.x.T{i}IT#t" for i in range(11)]))
    targets, skipped = verify.select(tmp_path, "java-it", 10)
    assert targets == [] and "exceed" in skipped


def test_java_command_runs_the_lane_with_its_engine_profile_and_no_in_jvm_reruns():
    targets = [
        verify.java_target("org.x.AIT#a(TestNamespace)", "f", {"profile": "postgres-opensearch", "lane": "parallel"}),
        verify.java_target("org.x.BIT#b", "f", {"profile": "postgres-opensearch", "lane": "parallel"}),
    ]
    argv = verify.java_command(targets)
    assert "-Ppostgres-opensearch" in argv
    assert "-DintegrationTests.lane=parallel" in argv
    assert "-Dit.test=org.x.AIT#a,org.x.BIT#b" in argv
    # failsafe re-runs after the IT harness has shut down, so they always error
    assert "-Dfailsafe.rerunFailingTestsCount=0" in argv


@pytest.mark.parametrize(
    ("side", "outcomes", "expected"),
    [
        ("entry", [True, False], (1, 2, 2)),  # stops at the first pass: a flake reads 1 of 2
        ("entry", [True, True, True], (3, 3, 3)),
        ("parent", [False, True], (1, 2, 2)),  # stops at the first failure
        ("parent", [False, False, False], (0, 3, 3)),
    ],
)
def test_each_attempt_is_a_fresh_jvm_until_the_side_has_its_answer(tmp_path, monkeypatch, side, outcomes, expected):
    reports = tmp_path / "failsafe-reports"
    reports.mkdir()
    monkeypatch.setattr(verify, "IT_REPORTS", reports)
    target = verify.java_target("org.x.AIT#a", "f", {"profile": "postgres-opensearch", "lane": "retry-queue"})
    calls = []

    def fake_execute(argv, cwd, log):
        failed = outcomes[len(calls)]
        calls.append(argv)
        body = '<failure message="boom"/>' if failed else ""
        (reports / "TEST-org.x.AIT.xml").write_text(
            f'<testsuite name="org.x.AIT"><testcase classname="org.x.AIT" name="a">{body}</testcase></testsuite>'
        )

    monkeypatch.setattr(verify, "execute", fake_execute)
    [result] = verify.run_java([target], side, 3, tmp_path).values()
    assert (result.failed, result.runs, len(calls)) == expected


def junit(path: Path, body: str) -> Path:
    path.write_text(f'<testsuite name="s">{textwrap.dedent(body)}</testsuite>')
    return path


def test_junit_counts_failsafe_rerun_records(tmp_path):
    report = junit(
        tmp_path / "TEST-x.xml",
        """
        <testcase classname="org.x.AIT" name="flaky(TestNamespace)"><flakyFailure message="m"/></testcase>
        <testcase classname="org.x.AIT" name="broken"><failure message="m"/><rerunFailure/><rerunFailure/></testcase>
        <testcase classname="org.x.AIT" name="fine"/>
        <testcase classname="org.x.AIT" name="off"><skipped/></testcase>
        """,
    )
    flaky = verify.junit_counts(report, "org.x.AIT", "flaky")
    broken = verify.junit_counts(report, "org.x.AIT", "broken")
    fine = verify.junit_counts(report, "org.x.AIT", "fine")
    assert (flaky.failed, flaky.runs) == (1, 2)
    assert (broken.failed, broken.runs) == (3, 3)
    assert (fine.failed, fine.runs) == (0, 1)
    assert verify.junit_counts(report, "org.x.AIT", "off") is None
    assert verify.junit_counts(report, "org.x.AIT", "absent") is None


def test_playwright_counts_only_the_target_title_and_project():
    target = verify.playwright_target("chromium :: Pages/Glossary.spec.ts :: Glossary › term colors", "f")
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
                                "tests": [
                                    {"projectName": "chromium", "results": [{"status": "failed"}]},
                                    {"projectName": "chromium", "results": [{"status": "passed"}]},
                                    {"projectName": "chromium", "results": [{"status": "timedOut"}]},
                                    {"projectName": "firefox", "results": [{"status": "failed"}]},
                                ],
                            },
                            {"title": "term colors 2", "tests": [{"projectName": "chromium", "results": [{"status": "failed"}]}]},
                        ],
                    }
                ],
            }
        ]
    }
    counts = verify.playwright_counts(results, target)
    assert (counts.failed, counts.runs) == (2, 3)


def test_python_node_ids_resolve_against_the_checkout(tmp_path):
    module = tmp_path / "tests" / "integration" / "profiler" / "test_median.py"
    module.parent.mkdir(parents=True)
    module.write_text("")
    nodeid = verify.python_nodeid("tests.integration.profiler.test_median.TestMedian#test_a[1]", tmp_path)
    assert nodeid == "tests/integration/profiler/test_median.py::TestMedian::test_a"
    assert verify.python_nodeid("tests.missing.TestX#t", tmp_path) == ""


def test_python_runs_stop_at_the_first_pass_on_the_entry_and_first_failure_on_the_parent(tmp_path, monkeypatch):
    project = tmp_path / "ingestion"
    tests = project / "tests"
    tests.mkdir(parents=True)
    counter = tmp_path / "counter"
    (tests / "test_sample.py").write_text(
        textwrap.dedent(
            f"""
            from pathlib import Path
            COUNTER = Path({str(counter)!r})

            class TestSample:
                def test_always_fails(self):
                    assert False

                def test_always_passes(self):
                    assert True

                def test_fails_first_time(self):
                    seen = int(COUNTER.read_text()) if COUNTER.exists() else 0
                    COUNTER.write_text(str(seen + 1))
                    assert seen > 0
            """
        )
    )
    monkeypatch.setattr(verify, "INGESTION_DIR", project)
    targets = [
        verify.Target("python", f"tests.test_sample.TestSample#{name}", "f", nodeid=f"tests/test_sample.py::TestSample::{name}")
        for name in ("test_always_fails", "test_always_passes", "test_fails_first_time")
    ]
    entry = verify.run_python(targets, "entry", 3, tmp_path / "work")
    assert [(entry[t.test_id].failed, entry[t.test_id].runs) for t in targets] == [(3, 3), (0, 1), (1, 2)]
    parent = verify.run_python(targets[:2], "parent", 3, tmp_path / "work")
    assert [(parent[t.test_id].failed, parent[t.test_id].runs) for t in targets[:2]] == [(1, 1), (0, 3)]


def test_the_verify_document_reads_back_through_the_gate():
    targets = [
        verify.Target("java-it", "A#flaky", "fa"),
        verify.Target("java-it", "B#regressed", "fb"),
        verify.Target("java-it", "C#broken-on-main", "fc"),
    ]
    entry = {
        "A#flaky": {"failed": 0, "runs": 1, "problems": []},
        "B#regressed": {"failed": 3, "runs": 3, "problems": []},
        "C#broken-on-main": {"failed": 3, "runs": 3, "problems": []},
    }
    parent = {
        "B#regressed": {"failed": 0, "runs": 3, "problems": []},
        "C#broken-on-main": {"failed": 1, "runs": 1, "problems": []},
    }
    document = verify.build_document(targets, entry, parent, "9", "1", "abc")
    assert verify.unverifiable(document) is False
    classes = [gate.classify_test(t) for t in evidence.verified_tests(document)]
    assert classes == [gate.FLAKY, gate.INTRODUCED, gate.PRE_EXISTING]


def test_a_reproduced_failure_without_a_parent_answer_fails_the_verify_job():
    targets = [verify.Target("java-it", "B#t", "fb")]
    document = verify.build_document(targets, {"B#t": {"failed": 3, "runs": 3, "problems": []}}, None, "9", "1", "abc")
    assert verify.unverifiable(document) is True
    missing = verify.build_document(targets, {"B#t": {"failed": 0, "runs": 0, "problems": ["no report named B#t"]}}, None, "9", "1", "abc")
    assert verify.unverifiable(missing) is True


def test_a_shard_reruns_its_failed_tests_by_location_and_counts_each(tmp_path, monkeypatch):
    def spec(title, line, status):
        return {"title": title, "file": "Pages/Glossary.spec.ts", "line": line, "tests": [{"projectName": "chromium", "status": status, "results": [{"error": {"message": "boom"}}]}]}

    results = {"suites": [{"title": "Pages/Glossary.spec.ts", "file": "Pages/Glossary.spec.ts", "suites": [
        {"title": "Glossary", "specs": [spec("colors", 9, "unexpected"), spec("names", 20, "unexpected"), spec("fine", 30, "expected")]}
    ]}]}
    results_path = tmp_path / "results.json"
    results_path.write_text(json.dumps(results))
    calls = []

    def fake_run(argv, cwd, stdout, stderr, check, env):
        calls.append(argv)
        rerun = {"suites": [{"title": "Pages/Glossary.spec.ts", "file": "Pages/Glossary.spec.ts", "suites": [
            {"title": "Glossary", "specs": [
                {"title": "colors", "tests": [{"projectName": "chromium", "results": [{"status": "passed"}]}] * 3},
                {"title": "names", "tests": [{"projectName": "chromium", "results": [{"status": "failed"}]}] * 3},
            ]}
        ]}]}
        Path(env["PLAYWRIGHT_JSON_OUTPUT_NAME"]).write_text(json.dumps(rerun))

    monkeypatch.setattr(verify.subprocess, "run", fake_run)
    targets, entry, skipped = verify.run_playwright_shard(results_path, 3, tmp_path / "work", 10)

    assert not skipped
    [argv] = calls
    assert "playwright/e2e/Pages/Glossary.spec.ts:9" in argv and "playwright/e2e/Pages/Glossary.spec.ts:20" in argv
    assert "--repeat-each=3" in argv and "--retries=0" in argv
    by_title = {t.title: entry[t.test_id] for t in targets}
    assert (by_title["Glossary › colors"].failed, by_title["Glossary › colors"].runs) == (0, 3)
    assert (by_title["Glossary › names"].failed, by_title["Glossary › names"].runs) == (3, 3)

    document = verify.build_document(targets, {k: vars(v) for k, v in entry.items()}, None, "9", "1", "")
    classes = {t.test_id: gate.classify_test(t) for t in evidence.verified_tests(document)}
    assert sorted(classes.values()) == [gate.FLAKY, gate.NOT_VERIFIED]


def test_the_parent_control_reuses_what_the_ledger_already_answers(tmp_path, monkeypatch):
    registry = load_script("merge_gate_registry")
    targets = [
        verify.java_target("org.x.AIT#a", "a1b2c3d4e5f6", {"profile": "mysql-elasticsearch", "lane": "parallel"}),
        verify.java_target("org.x.BIT#b", "0f1e2d3c4b5a", {"profile": "mysql-elasticsearch", "lane": "parallel"}),
    ]
    targets_file = tmp_path / "targets.json"
    targets_file.write_text(json.dumps({"targets": [vars(t) for t in targets], "skipped": ""}))
    parent = "9aac6e95c795d2a658bd3ede35980c2d5bdeb98e"
    ledger = [{"testId": "org.x.AIT#a", "fingerprint": "a1b2c3d4e5f6", "parentSha": parent, "parentFailed": 1, "parentRuns": 1, "class": "pre-existing", "prs": [7]}]
    monkeypatch.setattr(registry, "ledger_read", lambda owner, repo, token: ledger)
    monkeypatch.setenv("GITHUB_REPOSITORY", "o/r")
    monkeypatch.setenv("GH_TOKEN", "t")
    ran = []

    def fake_runner(group, side, runs, work):
        ran.extend(t.test_id for t in group)
        return {t.test_id: verify.SideResult(failed=0, runs=runs) for t in group}

    monkeypatch.setitem(verify.RUNNERS, "java-it", fake_runner)
    out = tmp_path / "parent.json"
    assert verify.main(["run", "--targets", str(targets_file), "--side", "parent", "--parent-sha", parent,
                        "--reuse-ledger", "--work", str(tmp_path / "w"), "--out", str(out)]) == 0
    results = json.loads(out.read_text())
    assert ran == ["org.x.BIT#b"]
    assert results["org.x.AIT#a"]["failed"] == 1
    assert results["org.x.BIT#b"] == {"failed": 0, "runs": 3, "problems": []}
