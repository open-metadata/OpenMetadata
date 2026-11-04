"""Reading a failed job's log for the gate: deterministic readers first, the model last."""

import importlib.util
import sys
from pathlib import Path

SCRIPTS = Path(__file__).parents[1]
sys.path.insert(0, str(SCRIPTS))


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


gate = load_script("merge_gate_policy")
reader = load_script("merge_gate_triage")
POLICY_PATH = SCRIPTS.parent / "merge-gate" / "policy.json"
POLICY = gate.Policy.load(POLICY_PATH)
POLICY_DOC = __import__("json").loads(POLICY_PATH.read_text())


def log(*steps):
    """A job log as GitHub serves it: timestamped lines, a group per step, the last
    failing step closed by an ##[error] line."""
    lines = []
    for name, body in steps:
        lines.append(f"2026-10-14T08:00:00.0000000Z ##[group]Run {name}")
        lines.append("2026-10-14T08:00:00.0000000Z ##[endgroup]")
        lines += [f"2026-10-14T08:00:01.1234567Z {line}" for line in body]
    return "\n".join(lines)


EARLIER = ("make lint", ["ok", "##[error]a continue-on-error step complained"])
BLIP = log(EARLIER, ("yarn install", ["[1/4] Resolving packages...", "fatal: unable to access: Could not resolve host: registry.yarnpkg.com", "##[error]Process completed with exit code 1."]))
TESTS = log(("mvn test", ["[ERROR] Tests run: 120, Failures: 2, Errors: 0, Skipped: 1", "##[error]Process completed with exit code 1."]))
UNKNOWN = log(("deploy-ish thing", ["Something odd happened in the wiring", "##[error]Process completed with exit code 3."]))


def job(name="unit / java", job_id=7):
    return gate.FailedJob(name=name, conclusion="failure", failed_step="Run things", job_id=job_id)


def read(jobs, logs, *, mode="off", blind_retry_left=False, answer=None, calls=None):
    calls = [] if calls is None else calls

    def fake_triage(name, step, conclusion, excerpt, **kwargs):
        calls.append((name, excerpt))
        return answer or {"verdict": "transient", "category": "network", "evidence": "the line", "confidence": "high", "outcome": "ok", "cached": False, "usage": {}}

    return reader.read_jobs(
        "o", "r", jobs, POLICY, POLICY_DOC, "t",
        blind_retry_left=blind_retry_left,
        env={"CI_AI_TRIAGE_MODE": mode},
        log_fetcher=lambda o, r, job_id, t: logs[job_id],
        triage_call=fake_triage,
    )


def test_the_excerpt_is_the_failing_step_without_timestamps():
    excerpt = reader.failing_step_excerpt(BLIP, 300, 16000)
    assert excerpt.splitlines()[0] == "##[group]Run yarn install"
    assert "Could not resolve host" in excerpt and "continue-on-error" not in excerpt
    assert "2026-10-14T" not in excerpt
    assert reader.failing_step_excerpt(BLIP, 2, 16000).splitlines() == [excerpt.splitlines()[-2], excerpt.splitlines()[-1]]


def test_a_blip_signature_in_the_log_marks_the_job_infra_without_a_model():
    calls = []
    [updated], [reading] = read([job()], {7: BLIP}, mode="on", calls=calls)
    assert (updated.log_signal, reading["signal"]) == ("infra", "infra")
    assert reading["why"].startswith("network: ") and calls == []


def test_failing_tests_in_the_log_are_never_a_blip():
    calls = []
    [updated], [reading] = read([job()], {7: TESTS}, mode="on", calls=calls)
    assert (updated.log_signal, reading["signal"], calls) == ("", "test", [])


def test_on_mode_asks_only_once_the_blind_retry_is_spent():
    calls = []
    [updated], _ = read([job()], {7: UNKNOWN}, mode="on", blind_retry_left=True, calls=calls)
    assert (updated.log_signal, calls) == ("", [])
    [updated], [reading] = read([job()], {7: UNKNOWN}, mode="on", blind_retry_left=False, calls=calls)
    assert updated.log_signal == "transient" and len(calls) == 1
    assert reading["ai"]["verdict"] == "transient"


def test_shadow_mode_asks_every_time_and_applies_nothing():
    calls = []
    [updated], [reading] = read([job()], {7: UNKNOWN}, mode="shadow", blind_retry_left=True, calls=calls)
    assert updated.log_signal == "" and len(calls) == 1
    assert reading["shadow"].startswith("would mark transient")


def test_off_mode_and_a_genuine_answer_leave_the_job_unknown():
    calls = []
    [updated], _ = read([job()], {7: UNKNOWN}, mode="off", calls=calls)
    assert (updated.log_signal, calls) == ("", [])
    genuine = {"verdict": "genuine", "category": "code", "evidence": "x", "confidence": "high", "outcome": "ok", "cached": False}
    [updated], _ = read([job()], {7: UNKNOWN}, mode="on", answer=genuine)
    assert updated.log_signal == ""


def test_too_many_unexplained_jobs_are_not_read_one_by_one():
    jobs = [job(f"it / pg / lane-{n}", job_id=n) for n in range(6)]
    updated, readings = read(jobs, {}, mode="on")
    assert updated == jobs and all(r["why"] == "too many unexplained jobs to read" for r in readings)


def test_an_unreadable_log_is_reported_not_fatal():
    def broken(o, r, job_id, t):
        raise OSError("HTTP 410")

    [updated], [reading] = reader.read_jobs(
        "o", "r", [job()], POLICY, POLICY_DOC, "t", blind_retry_left=False, env={}, log_fetcher=broken
    )
    assert updated.log_signal == "" and reading["why"].startswith("log unavailable")


def test_jobs_with_test_evidence_or_a_known_kind_are_not_read():
    lane = gate.FailedJob(name="it / pg / rdf", conclusion="failure", failing_tests=("A#t",), job_id=1)
    setup = gate.FailedJob(name="it / pg / parallel", conclusion="failure", failed_step="Download the reactor bundle", job_id=2)
    updated, readings = read([lane, setup], {}, mode="on")
    assert updated == [lane, setup] and readings == []
