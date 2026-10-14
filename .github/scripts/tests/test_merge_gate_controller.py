"""The merge-gate controller against a fake GitHub: what it posts and re-runs, per mode."""

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
triage_reader = load_script("merge_gate_triage")
controller = load_script("merge_gate")

PARENT = "610a7f9b33cacbb23eae1c8aa86d65fdc0f2ada1"
HEAD = "9aac6e95c795d2a658bd3ede35980c2d5bdeb98e"
BRANCH = f"gh-readonly-queue/main/pr-35297-{PARENT}"


@pytest.fixture(autouse=True)
def token(monkeypatch):
    monkeypatch.setenv("GH_TOKEN", "t")
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    monkeypatch.delenv("MERGE_GATE_MODE", raising=False)


def zip_with(members):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in members.items():
            archive.writestr(name, content)
    return buffer.getvalue()


class FakeGitHub:
    def __init__(self, monkeypatch, jobs, artifacts=(), zips=None, ref_alive=True, run_attempt=1, files=("x.java",), event="merge_group"):
        self.posts = []
        self.run = {
            "id": 500,
            "event": event,
            "head_branch": BRANCH,
            "head_sha": HEAD,
            "run_attempt": run_attempt,
            "created_at": mq.utcnow().isoformat(),
            "html_url": "https://github.com/o/r/actions/runs/500",
            "conclusion": "failure",
            "pull_requests": [],
        }
        self.jobs = jobs
        self.artifacts = list(artifacts)
        self.zips = zips or {}
        self.ref_alive = ref_alive
        self.files = files
        self.parent_jobs = []
        self.recent_runs = []
        self.statuses = []
        self.pull = None
        self.logs = {}
        monkeypatch.setattr(mq, "rest", self.rest)
        monkeypatch.setattr(triage_reader, "fetch_log", lambda o, r, job_id, token: self.logs[job_id])
        monkeypatch.setattr(mq, "paginated_items", self.paginated_items)
        monkeypatch.setattr(pfr, "download_zip", lambda o, r, a, t: self.zips[a["id"]])
        monkeypatch.setattr(pfr, "job_reasons", lambda o, r, js, t: [{"url": j["html_url"], "reason": j.get("_reason", "")} for j in js])
        monkeypatch.setattr(controller, "post", self.post)

    def rest(self, path, token):
        if path == "/repos/o/r/actions/runs/500":
            return self.run
        if path.startswith(f"/repos/o/r/actions/runs?head_sha={PARENT}"):
            return {"workflow_runs": [{"id": 400, "path": ".github/workflows/ci.yml", "run_attempt": 1}]}
        if path.startswith("/repos/o/r/git/ref/heads/"):
            if not self.ref_alive:
                raise mq.ApiError("HTTP 404", 404)
            return {"ref": BRANCH}
        if path.startswith(f"/repos/o/r/commits/{HEAD}/statuses"):
            return self.statuses
        if path.startswith("/repos/o/r/pulls/") and self.pull is not None:
            return self.pull
        if path.startswith("/repos/o/r/compare/main..."):
            return {"total_commits": 1, "commits": [{"commit": {"message": "x (#35297)"}}], "files": [{"filename": f} for f in self.files]}
        raise AssertionError(f"unexpected GET {path}")

    def paginated_items(self, path, key, token, max_pages=10):
        if path.startswith("/repos/o/r/actions/runs/400/"):
            return self.parent_jobs
        if "/jobs" in path:
            return self.jobs
        if "/artifacts" in path:
            return self.artifacts
        if "/actions/workflows/ci.yml/runs?status=completed" in path:
            return self.recent_runs
        if "/actions/workflows/ci.yml/runs" in path:
            return []
        raise AssertionError(f"unexpected list {path}")

    def post(self, path, body, token):
        self.posts.append((path, body))


def job(job_id, name, conclusion="failure", step="Run tests", reason=""):
    return {"id": job_id, "name": name, "conclusion": conclusion, "html_url": f"u{job_id}", "_reason": reason, "steps": [{"name": step, "conclusion": conclusion}]}


def statuses(fake):
    return [body for path, body in fake.posts if path.endswith(f"/statuses/{HEAD}")]


def run(args):
    return controller.main(["--owner", "o", "--repo", "r", *args])


def test_shadow_mode_posts_the_shadow_context_and_reruns_only_the_infra_job(monkeypatch):
    fake = FakeGitHub(
        monkeypatch,
        jobs=[
            job(1, "playwright / chromium-03", step="Download backend distribution"),
            job(2, "it / mysql-elasticsearch / parallel", conclusion="success"),
        ],
    )
    assert run(["--mode", "shadow", "entry", "--run-id", "500"]) == 0
    [status] = statuses(fake)
    assert status["context"] == "merge-gate (shadow)"
    assert status["state"] == "pending"
    assert ("/repos/o/r/actions/jobs/1/rerun", None) in fake.posts


def test_forgiven_failures_pass_the_entry_in_enforce_mode(monkeypatch):
    zips = {
        10: zip_with({"outcome.json": json.dumps({"classification": "test_failure", "failedTests": [{"id": "A#t", "message": "boom"}]})}),
        11: zip_with({"verify.json": json.dumps({"runAttempt": 1, "tests": [{"id": "A#t", "fingerprint": "f", "entry": {"failed": 0, "runs": 3}}]})}),
    }
    fake = FakeGitHub(
        monkeypatch,
        jobs=[job(1, "it / mysql-elasticsearch / parallel", step="Run integration tests")],
        artifacts=[
            {"id": 10, "name": "evidence-it-mysql-elasticsearch-parallel-a1", "size_in_bytes": 10},
            {"id": 11, "name": "verify-java-it-a1", "size_in_bytes": 10},
        ],
        zips=zips,
    )
    assert run(["--mode", "enforce", "entry", "--run-id", "500"]) == 0
    [status] = statuses(fake)
    assert (status["context"], status["state"]) == ("merge-gate", "success")
    assert not [p for p, _ in fake.posts if "/rerun" in p]


def test_after_its_rerun_a_lane_that_passes_on_the_parent_ejects_the_entry(monkeypatch):
    lane = job(1, "it / pg-os / parallel", step="Run integration tests", reason="Failed.")
    fake = FakeGitHub(monkeypatch, jobs=[lane], run_attempt=2)
    fake.artifacts = [{"id": 10, "name": "evidence-it-pg-os-parallel-a2", "size_in_bytes": 10}]
    fake.zips = {10: zip_with({"outcome.json": json.dumps({"classification": "setup_failure"})})}
    fake.parent_jobs = [{"name": "it / pg-os / parallel", "conclusion": "success"}]
    assert run(["--mode", "enforce", "entry", "--run-id", "500"]) == 0
    assert statuses(fake)[0]["state"] == "failure"

    fake.posts.clear()
    fake.parent_jobs = [{"name": "it / pg-os / parallel", "conclusion": "failure"}]
    assert run(["--mode", "enforce", "entry", "--run-id", "500"]) == 0
    assert statuses(fake)[0]["state"] == "pending"


def test_strict_mode_fails_any_failed_job_without_rerunning(monkeypatch):
    fake = FakeGitHub(monkeypatch, jobs=[job(1, "playwright / chromium-03", step="Download backend distribution")])
    assert run(["--mode", "strict", "entry", "--run-id", "500"]) == 0
    [status] = statuses(fake)
    assert (status["context"], status["state"]) == ("merge-gate", "failure")
    assert not [p for p, _ in fake.posts if "/rerun" in p]


def test_entries_that_change_ci_config_forgive_nothing(monkeypatch):
    zips = {
        10: zip_with({"outcome.json": json.dumps({"classification": "test_failure", "failedTests": [{"id": "A#t", "message": "boom"}]})}),
        11: zip_with({"verify.json": json.dumps({"runAttempt": 1, "tests": [{"id": "A#t", "fingerprint": "f", "entry": {"failed": 0, "runs": 3}}]})}),
    }
    fake = FakeGitHub(
        monkeypatch,
        jobs=[job(1, "it / mysql-elasticsearch / parallel")],
        artifacts=[
            {"id": 10, "name": "evidence-it-mysql-elasticsearch-parallel-a1", "size_in_bytes": 10},
            {"id": 11, "name": "verify-java-it-a1", "size_in_bytes": 10},
        ],
        zips=zips,
        files=(".github/workflows/ci.yml",),
    )
    assert run(["--mode", "enforce", "entry", "--run-id", "500"]) == 0
    assert statuses(fake)[0]["state"] == "failure"


def test_an_entry_that_left_the_queue_gets_no_verdict(monkeypatch):
    fake = FakeGitHub(monkeypatch, jobs=[job(1, "playwright / chromium-03")], ref_alive=False)
    assert run(["--mode", "enforce", "entry", "--run-id", "500"]) == 0
    assert fake.posts == []


def test_pull_request_runs_are_skipped_by_the_entry_command(monkeypatch):
    fake = FakeGitHub(monkeypatch, jobs=[], event="pull_request")
    assert run(["entry", "--run-id", "500"]) == 0
    assert fake.posts == []


def test_dry_run_decides_but_posts_nothing(monkeypatch, capsys):
    fake = FakeGitHub(monkeypatch, jobs=[job(1, "playwright / chromium-03", step="Download backend distribution")])
    assert run(["--dry-run", "entry", "--run-id", "500"]) == 0
    assert fake.posts == []
    assert '"verdict": "rerun"' in capsys.readouterr().out


def test_unreadable_runs_exit_nonzero_and_post_nothing(monkeypatch):
    fake = FakeGitHub(monkeypatch, jobs=[])

    def broken(path, token):
        raise mq.ApiError("HTTP 502", 502)

    monkeypatch.setattr(mq, "rest", broken)
    assert run(["entry", "--run-id", "500"]) == 1
    assert fake.posts == []


def test_auto_decides_a_pull_request_run_strictly(monkeypatch):
    fake = FakeGitHub(monkeypatch, jobs=[], event="pull_request")
    fake.run["conclusion"] = "success"
    assert run(["--mode", "shadow", "auto", "--run-id", "500"]) == 0
    [status] = statuses(fake)
    assert (status["context"], status["state"]) == ("merge-gate (shadow)", "success")


def test_the_sweep_decides_only_runs_without_a_gate_status(monkeypatch):
    fake = FakeGitHub(monkeypatch, jobs=[job(1, "playwright / chromium-03", step="Download backend distribution")])
    fake.recent_runs = [dict(fake.run)]
    fake.statuses = [{"context": "merge-gate (shadow)", "state": "pending"}]
    assert run(["--mode", "shadow", "sweep"]) == 0
    assert fake.posts == []

    fake.statuses = [{"context": "some-other-check", "state": "success"}]
    assert run(["--mode", "shadow", "sweep"]) == 0
    assert statuses(fake)[0]["context"] == "merge-gate (shadow)"


def ambiguous_run(monkeypatch):
    fp = evidence.fingerprint("A#t", "boom")
    zips = {
        10: zip_with({"outcome.json": json.dumps({"classification": "test_failure", "failedTests": [{"id": "A#t", "message": "boom"}]})}),
        11: zip_with({"verify.json": json.dumps({"runAttempt": 1, "tests": [{"id": "A#t", "fingerprint": fp, "entry": {"failed": 1, "runs": 3}, "parent": {"failed": 0, "runs": 3}}]})}),
    }
    fake = FakeGitHub(
        monkeypatch,
        jobs=[job(1, "it / mysql-elasticsearch / parallel", step="Run integration tests")],
        artifacts=[
            {"id": 10, "name": "evidence-it-mysql-elasticsearch-parallel-a1", "size_in_bytes": 10},
            {"id": 11, "name": "verify-java-it-a1", "size_in_bytes": 10},
        ],
        zips=zips,
    )
    return fake, fp


def test_an_ambiguous_failure_seen_on_main_is_forgiven_through_the_ledger(monkeypatch):
    fake, fp = ambiguous_run(monkeypatch)
    monkeypatch.setattr(controller.registry, "ledger_read", lambda o, r, t: [{"fingerprint": fp, "prs": [], "class": "pre-existing"}])
    assert run(["--mode", "enforce", "entry", "--run-id", "500"]) == 0
    assert statuses(fake)[0]["state"] == "success"


def test_an_unreadable_ledger_means_no_history_and_the_entry_is_ejected(monkeypatch):
    fake, _ = ambiguous_run(monkeypatch)

    def broken(owner, repo, token):
        raise mq.ApiError("HTTP 502", 502)

    monkeypatch.setattr(controller.registry, "ledger_read", broken)
    assert run(["--mode", "enforce", "entry", "--run-id", "500"]) == 0
    assert statuses(fake)[0]["state"] == "failure"


def plan_job(sampled):
    step = {"name": "Not sampled", "conclusion": "skipped" if sampled else "success"}
    return {"id": 9, "name": "plan", "conclusion": "success", "html_url": "u9", "steps": [step]}


@pytest.mark.parametrize("event", ["merge_group", "pull_request"])
def test_a_run_outside_the_shadow_sample_gets_no_verdict(monkeypatch, event):
    fake = FakeGitHub(monkeypatch, jobs=[plan_job(sampled=False)], event=event)
    fake.run["conclusion"] = "success"
    assert run(["--mode", "shadow", "auto", "--run-id", "500"]) == 0
    assert fake.posts == []


def test_a_sampled_run_is_decided(monkeypatch):
    fake = FakeGitHub(monkeypatch, jobs=[plan_job(sampled=True)], event="pull_request")
    fake.run["conclusion"] = "success"
    assert run(["--mode", "shadow", "auto", "--run-id", "500"]) == 0
    assert statuses(fake)[0]["state"] == "success"


def pr_run(fake, jobs, conclusion="failure"):
    fake.run.update(event="pull_request", conclusion=conclusion, pull_requests=[{"number": 35297}])
    fake.pull = {"head": {"sha": HEAD}, "draft": False}
    fake.jobs = jobs


def test_a_pr_job_that_failed_installing_packages_is_rerun_not_failed(monkeypatch):
    fake = FakeGitHub(monkeypatch, jobs=[])
    pr_run(fake, [job(3, "unit / jest (2/3)", step="Install UI packages")])
    assert run(["--mode", "shadow", "auto", "--run-id", "500"]) == 0
    assert ("/repos/o/r/actions/jobs/3/rerun", None) in fake.posts
    assert statuses(fake)[0]["state"] == "pending"


def test_a_pr_run_superseded_by_a_newer_push_gets_no_verdict(monkeypatch):
    fake = FakeGitHub(monkeypatch, jobs=[])
    pr_run(fake, [job(3, "unit / jest (2/3)", step="Install UI packages")])
    fake.pull["head"]["sha"] = "f" * 40
    assert run(["--mode", "shadow", "auto", "--run-id", "500"]) == 0
    assert fake.posts == []


def test_a_pr_job_whose_log_shows_failing_tests_fails_without_asking_a_model(monkeypatch):
    monkeypatch.setenv("CI_AI_TRIAGE_MODE", "on")
    fake = FakeGitHub(monkeypatch, jobs=[])
    pr_run(fake, [job(4, "unit / java / openmetadata-service-unit-tests", step="Run openmetadata-service unit tests")])
    fake.logs[4] = "##[group]Run mvn\n[ERROR] Tests run: 9, Failures: 1, Errors: 0\n##[error]Process completed with exit code 1."
    import ci_ai.triage as ai
    monkeypatch.setattr(ai, "triage", lambda *a, **k: pytest.fail("a test failure must not reach the model"))
    assert run(["--mode", "shadow", "auto", "--run-id", "500"]) == 0
    assert statuses(fake)[0]["state"] == "failure"
    assert not [p for p, _ in fake.posts if "/rerun" in p]


def test_a_queue_job_read_as_a_blip_after_its_blind_retry_gets_one_more_run(monkeypatch):
    monkeypatch.setenv("CI_AI_TRIAGE_MODE", "on")
    fake = FakeGitHub(monkeypatch, jobs=[job(5, "unit / java / openmetadata-service-unit-tests", step="Run things")], run_attempt=2)
    fake.logs[5] = "##[group]Run thing\nsomething odd: stream closed\n##[error]Process completed with exit code 1."
    import ci_ai.triage as ai
    calls = []

    def blip(name, step, conclusion, excerpt, **kwargs):
        calls.append(name)
        return {"verdict": "transient", "category": "network", "evidence": "something odd: stream closed", "confidence": "high", "outcome": "ok", "cached": False, "usage": {}}

    monkeypatch.setattr(ai, "triage", blip)
    assert run(["--mode", "enforce", "entry", "--run-id", "500"]) == 0
    assert calls == ["unit / java / openmetadata-service-unit-tests"]
    assert ("/repos/o/r/actions/jobs/5/rerun", None) in fake.posts
    assert statuses(fake)[0]["state"] == "pending"

    fake.posts.clear()
    monkeypatch.setenv("CI_AI_TRIAGE_MODE", "off")
    assert run(["--mode", "enforce", "entry", "--run-id", "500"]) == 0
    assert statuses(fake)[0]["state"] == "failure"
