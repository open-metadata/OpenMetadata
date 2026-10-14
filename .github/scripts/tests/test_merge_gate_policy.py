"""Merge-gate decisions: the verify table, the decision order, budgets and strict mode.

Run against the checked-in policy.json, so a threshold edit that changes a verdict
fails here rather than in the queue.
"""

import importlib.util
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("merge_gate_policy", SCRIPTS / "merge_gate_policy.py")
gate = importlib.util.module_from_spec(spec)
sys.modules["merge_gate_policy"] = gate
spec.loader.exec_module(gate)

POLICY = gate.Policy.load(SCRIPTS.parent / "merge-gate" / "policy.json")


def lane(tests=("TableResourceIT#t1",), **kw):
    defaults = dict(
        name="it / mysql-elasticsearch / parallel",
        conclusion="failure",
        failed_step="Run integration tests",
        outcome="test_failure",
        failing_tests=tuple(tests),
    )
    defaults.update(kw)
    return gate.FailedJob(**defaults)


def verified(test_id="TableResourceIT#t1", entry=(0, 3), parent=None, fp="fp1"):
    return gate.VerifiedTest(
        test_id,
        fp,
        entry_failed=entry[0],
        entry_runs=entry[1],
        parent_failed=None if parent is None else parent[0],
        parent_runs=None if parent is None else parent[1],
    )


def evidence(jobs, tests=(), **kw):
    defaults = dict(attempt=1, entry_age_minutes=60, failed_jobs=tuple(jobs), verified=tuple(tests))
    defaults.update(kw)
    return gate.Evidence(**defaults)


@pytest.mark.parametrize(
    ("entry", "parent", "expected"),
    [
        ((0, 3), None, gate.FLAKY),
        ((3, 3), (1, 3), gate.PRE_EXISTING),
        ((1, 3), (3, 3), gate.PRE_EXISTING),
        ((3, 3), (0, 3), gate.INTRODUCED),
        ((2, 3), (0, 3), gate.INTRODUCED),
        ((1, 3), (0, 3), gate.AMBIGUOUS),
        ((0, 0), None, gate.NOT_VERIFIED),
        ((2, 3), None, gate.NOT_VERIFIED),
    ],
)
def test_verify_table(entry, parent, expected):
    assert gate.classify_test(verified(entry=entry, parent=parent)) == expected


@pytest.mark.parametrize(
    ("has_history", "related", "expected"),
    [(True, False, True), (True, True, False), (False, False, False)],
)
def test_ambiguous_failures_need_history_and_no_link_to_the_diff(has_history, related, expected):
    assert gate.forgivable(gate.AMBIGUOUS, has_history, related) is expected


def test_no_failed_job_passes_and_the_summary_job_is_never_counted():
    summary = gate.FailedJob(name=POLICY.summary_job, conclusion="failure")
    assert gate.decide(evidence([summary]), POLICY).verdict == gate.PASS


def test_failures_proven_unrelated_let_the_entry_through():
    jobs = [lane(("A#flaky", "B#broken"))]
    tests = [verified("A#flaky", (0, 3)), verified("B#broken", (3, 3), (2, 3), fp="fpB")]
    decision = gate.decide(evidence(jobs, tests), POLICY)
    assert decision.verdict == gate.PASS
    assert [(f["test"], f["class"]) for f in decision.forgiven] == [
        ("A#flaky", gate.FLAKY),
        ("B#broken", gate.PRE_EXISTING),
    ]


def test_one_introduced_failure_ejects_even_beside_forgiven_ones():
    jobs = [lane(("A#flaky", "B#regressed"))]
    tests = [verified("A#flaky", (0, 3)), verified("B#regressed", (3, 3), (0, 3))]
    decision = gate.decide(evidence(jobs, tests), POLICY)
    assert decision.verdict == gate.FAIL
    assert decision.summary.startswith("B#regressed reproduces on the entry")
    assert [b["test"] for b in decision.blocking] == ["B#regressed"]


def test_an_ambiguous_failure_without_independent_history_ejects():
    jobs = [lane(("A#once",))]
    tests = [verified("A#once", (1, 3), (0, 3), fp="fpA")]
    assert gate.decide(evidence(jobs, tests), POLICY).verdict == gate.FAIL
    with_history = evidence(jobs, tests, independent_history=frozenset({"fpA"}))
    assert gate.decide(with_history, POLICY).verdict == gate.PASS
    linked = evidence(
        jobs, tests, independent_history=frozenset({"fpA"}), impact_related=frozenset({"A#once"})
    )
    assert gate.decide(linked, POLICY).verdict == gate.FAIL


def test_strict_entries_forgive_nothing():
    jobs = [lane(("A#flaky",))]
    decision = gate.decide(evidence(jobs, [verified("A#flaky", (0, 3))], strict=True), POLICY)
    assert decision.verdict == gate.FAIL


def test_compile_errors_eject_without_spending_a_rerun():
    build = gate.FailedJob(
        name="build / java", conclusion="failure", failed_step="Build", reason="[ERROR] COMPILATION ERROR :"
    )
    assert gate.decide(evidence([build]), POLICY).verdict == gate.FAIL
    static = gate.FailedJob(name="static / ui", conclusion="failure", failed_step="Lint")
    assert gate.decide(evidence([static]), POLICY).verdict == gate.FAIL


def test_infra_beats_the_job_name_a_build_that_hit_maven_central_is_rerun():
    build = gate.FailedJob(
        name="build / java",
        conclusion="failure",
        failed_step="Build",
        reason="Could not transfer artifact org.foo:bar:1.0 from/to central: status code: 503, reason phrase: Service Unavailable",
    )
    decision = gate.decide(evidence([build]), POLICY)
    assert decision.verdict == gate.RERUN
    assert decision.rerun_jobs == ["build / java"]


def test_a_wedged_lane_is_rerun_not_counted_as_hundreds_of_regressions():
    wedged = lane(
        tuple(f"T{i}#t" for i in range(388)),
        reason="Network error: unexpected end of stream on http://localhost:8585/ … Process completed with exit code 124.",
    )
    decision = gate.decide(evidence([wedged]), POLICY)
    assert decision.verdict == gate.RERUN


def test_too_many_failing_tests_eject_without_verification_per_suite_cap():
    java_cap = POLICY.suite_for_job("it / mysql-elasticsearch / parallel")[1]
    browser_cap = POLICY.suite_for_job("playwright / chromium-03")[1]
    assert java_cap > browser_cap

    cluster = lane(tuple(f"T{i}#t" for i in range(java_cap)))
    assert "too many" not in gate.decide(evidence([cluster]), POLICY).summary

    too_many = gate.decide(evidence([lane(tuple(f"T{i}#t" for i in range(java_cap + 1)))]), POLICY)
    assert too_many.verdict == gate.FAIL and "java-it tests failed; too many" in too_many.summary

    shards = [lane(tuple(f"spec{i}" for i in range(browser_cap + 1)), name="playwright / chromium-03")]
    assert "playwright tests failed; too many" in gate.decide(evidence(shards), POLICY).summary


def test_a_build_failure_without_a_compile_error_is_rerun_once():
    build = gate.FailedJob(name="build / java", conclusion="failure", failed_step="Build", reason="Process completed with exit code 1.")
    assert gate.decide(evidence([build]), POLICY).verdict == gate.RERUN
    assert gate.decide(evidence([build], attempt=2), POLICY).verdict == gate.FAIL


def test_a_failed_verify_job_is_rerun_before_the_entry_is_blamed():
    jobs = [
        lane(("A#t",)),
        gate.FailedJob(name="verify / java-it", conclusion="failure", failed_step="Start test environment"),
    ]
    first = gate.decide(evidence(jobs), POLICY)
    assert first.verdict == gate.RERUN
    assert first.rerun_jobs == ["verify / java-it"]
    second = gate.decide(evidence(jobs, attempt=2), POLICY)
    assert second.verdict == gate.FAIL
    assert "could not be verified" in second.summary


def test_persistent_infra_holds_and_alerts_unknown_failures_eject():
    setup = gate.FailedJob(name="playwright / chromium-03", conclusion="failure", failed_step="Download backend distribution")
    assert gate.decide(evidence([setup]), POLICY).verdict == gate.RERUN
    held = gate.decide(evidence([setup], attempt=2), POLICY)
    assert (held.verdict, held.alert) == (gate.PENDING, True)

    mystery = gate.FailedJob(name="unit / jest-2", conclusion="failure", failed_step="Report")
    assert gate.decide(evidence([mystery]), POLICY).verdict == gate.RERUN
    assert gate.decide(evidence([mystery], attempt=2), POLICY).verdict == gate.FAIL


def test_a_persistent_setup_failure_that_passes_on_the_parent_is_the_entrys():
    # A PR that stops the server from starting looks like infra on every lane.
    lane_job = gate.FailedJob(name="it / pg-os / parallel", conclusion="failure", outcome="setup_failure")
    first = gate.decide(evidence([lane_job]), POLICY)
    assert first.verdict == gate.RERUN
    broken_here = evidence([lane_job], attempt=2, parent_passed_jobs=frozenset({"it / pg-os / parallel"}))
    assert gate.decide(broken_here, POLICY).verdict == gate.FAIL
    broken_everywhere = evidence([lane_job], attempt=2)
    assert gate.decide(broken_everywhere, POLICY).verdict == gate.PENDING


def test_a_static_check_that_stopped_the_tests_is_deterministic_not_infra():
    static = gate.FailedJob(
        name="static / python", conclusion="failure", failed_step="Run Static Checks", outcome="setup_failure"
    )
    assert gate.decide(evidence([static]), POLICY).verdict == gate.FAIL


def test_exhausted_budgets_and_old_entries_get_no_rerun():
    setup = gate.FailedJob(name="py-it / shard-1", conclusion="cancelled")
    assert gate.decide(evidence([setup], reruns_left=False), POLICY).verdict == gate.PENDING
    old = evidence([setup], entry_age_minutes=POLICY.max_entry_age_minutes + 1)
    assert gate.decide(old, POLICY).verdict == gate.PENDING


@pytest.mark.parametrize(
    ("files", "truncated", "strict"),
    [
        ([".github/workflows/ci.yml"], False, True),
        (["openmetadata-integration-tests/pom.xml"], False, True),
        (["openmetadata-service/src/main/java/Foo.java", "pom.xml"], False, False),
        (["openmetadata-service/src/main/java/Foo.java"], True, True),
    ],
)
def test_strict_paths(files, truncated, strict):
    assert gate.is_strict(files, truncated, POLICY) is strict


def test_status_description_fits_the_commit_status_limit():
    jobs = [lane((f"org.openmetadata.it.tests.{'Very' * 40}LongResourceIT#a",))]
    tests = [verified(jobs[0].failing_tests[0], (3, 3), (0, 3))]
    decision = gate.decide(evidence(jobs, tests), POLICY)
    assert len(decision.summary) <= gate.STATUS_DESCRIPTION_LIMIT


def test_only_the_triage_adapter_reaches_a_model():
    # ADR:2026-10-13-ci-ai-output-is-advisory-and-never-decides-a-merge
    gate_sources = [
        "merge_gate.py",
        "merge_gate_policy.py",
        "merge_gate_evidence.py",
        "merge_gate_entry.py",
        "verify_failures.py",
    ]
    for name in gate_sources:
        text = (SCRIPTS / name).read_text().lower()
        for marker in ("ci_ai", "ci-ai", "anthropic", "claude"):
            assert marker not in text, f"{name} mentions {marker}"
    assert "import merge_gate_triage" not in (SCRIPTS / "merge_gate_policy.py").read_text()


def unknown_job(name="unit / java", **kw):
    defaults = dict(name=name, conclusion="failure", failed_step="Run unit tests", job_id=7)
    defaults.update(kw)
    return gate.FailedJob(**defaults)


def transient(job):
    return gate.FailedJob(**{**job.__dict__, "log_signal": "transient", "log_why": "network: Connection reset"})


EVIDENCE_CASES = [
    [unknown_job()],
    [unknown_job(), lane()],
    [unknown_job(), unknown_job("it / pg / rdf", failing_tests=("A#t",))],
    [unknown_job(conclusion="cancelled")],
    [unknown_job(failed_step="Build", reason="COMPILATION ERROR")],
    [unknown_job("static / ui")],
]


@pytest.mark.parametrize("jobs", EVIDENCE_CASES)
@pytest.mark.parametrize("attempt", [1, 2, 3, 4])
@pytest.mark.parametrize("strict", [False, True])
def test_reading_a_job_as_a_blip_can_only_ever_add_a_rerun(jobs, attempt, strict):
    # ADR:2026-10-13-ci-ai-output-is-advisory-and-never-decides-a-merge
    plain = evidence(jobs, [verified("TableResourceIT#t1", (0, 3))], attempt=attempt, strict=strict)
    read = evidence([transient(j) for j in jobs], [verified("TableResourceIT#t1", (0, 3))], attempt=attempt, strict=strict)
    for decide in (gate.decide, gate.decide_pr):
        before, after = decide(plain, POLICY), decide(read, POLICY)
        assert after.verdict in (before.verdict, gate.RERUN), (decide.__name__, before.verdict, after.verdict)
        assert after.verdict != gate.PASS or before.verdict == gate.PASS


def test_an_unknown_failure_read_as_a_blip_gets_one_run_past_the_blind_retry():
    job = transient(unknown_job())
    assert gate.decide(evidence([job], attempt=1), POLICY).verdict == gate.RERUN
    assert gate.decide(evidence([job], attempt=2), POLICY).verdict == gate.RERUN
    assert gate.decide(evidence([job], attempt=3), POLICY).verdict == gate.FAIL
    assert gate.decide(evidence([unknown_job()], attempt=2), POLICY).verdict == gate.FAIL


def test_a_blip_signature_in_the_log_makes_the_job_infra():
    job = gate.FailedJob(**{**unknown_job().__dict__, "log_signal": "infra", "log_why": "network: Could not resolve host"})
    assert gate.job_kind(job, POLICY)[0] == "infra"
    decision = gate.decide(evidence([job], attempt=2), POLICY)
    assert decision.verdict == gate.PENDING and decision.alert


def test_a_strict_entry_still_reruns_a_blip_but_forgives_no_test():
    blip = gate.FailedJob(name="it / pg / rdf", conclusion="failure", failed_step="Download the reactor bundle")
    assert gate.decide(evidence([blip], strict=True), POLICY).verdict == gate.RERUN
    assert gate.decide(evidence([blip, lane()], [verified("TableResourceIT#t1", (0, 3))], strict=True), POLICY).verdict == gate.FAIL


def test_pr_runs_rerun_only_jobs_that_failed_on_infrastructure():
    infra = gate.FailedJob(name="unit / jest (2/3)", conclusion="failure", failed_step="Install UI packages")
    assert gate.decide_pr(evidence([infra]), POLICY).rerun_jobs == ["unit / jest (2/3)"]
    assert gate.decide_pr(evidence([infra], attempt=2), POLICY).verdict == gate.FAIL
    assert gate.decide_pr(evidence([transient(unknown_job())], attempt=2), POLICY).verdict == gate.RERUN
    assert gate.decide_pr(evidence([unknown_job()]), POLICY).verdict == gate.FAIL
    assert gate.decide_pr(evidence([infra, gate.FailedJob(name="static / java", conclusion="failure")]), POLICY).verdict == gate.FAIL
    assert gate.decide_pr(evidence([gate.FailedJob(name="unit / java", conclusion="cancelled")]), POLICY).verdict == gate.FAIL
    assert gate.decide_pr(evidence([infra], reruns_left=False), POLICY).verdict == gate.FAIL
    assert gate.decide_pr(evidence([]), POLICY).verdict == gate.PASS