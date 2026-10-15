"""The merge-gate controller against a fake GitHub: what it posts and re-runs, per mode."""

import importlib.util
import io
import json
import re
import sys
import zipfile
from datetime import timedelta
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

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
            "path": ".github/workflows/ci.yml",
            "head_branch": BRANCH,
            "head_sha": HEAD,
            "run_attempt": run_attempt,
            "created_at": mq.utcnow().isoformat(),
            "updated_at": mq.utcnow().isoformat(),
            "html_url": "https://github.com/o/r/actions/runs/500",
            "status": "completed",
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
        self.statuses_by_sha = {}
        self.dead_refs = set()
        self.unlistable = set()
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
        if match := re.fullmatch(r"/repos/o/r/actions/runs/(\d+)", path):
            return next(r for r in self.recent_runs if r["id"] == int(match.group(1)))
        if path.startswith(f"/repos/o/r/actions/runs?head_sha={PARENT}"):
            return {"workflow_runs": [{"id": 400, "path": ".github/workflows/ci.yml", "run_attempt": 1}]}
        if path.startswith("/repos/o/r/git/ref/heads/"):
            branch = unquote(path.removeprefix("/repos/o/r/git/ref/heads/"))
            if not self.ref_alive or branch in self.dead_refs:
                raise mq.ApiError("HTTP 404", 404)
            return {"ref": branch}
        if match := re.fullmatch(r"/repos/o/r/commits/([0-9a-f]{40})/statuses\?per_page=100", path):
            return self.statuses_by_sha.get(match.group(1), self.statuses if match.group(1) == HEAD else [])
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
        query = parse_qs(urlsplit(path).query)
        if "/actions/workflows/ci.yml/runs" in path and query.get("status") == ["completed"]:
            # The sweep's listing: GitHub filters on the event and on creation time only.
            event = query["event"][0]
            if event in self.unlistable:
                raise mq.ApiError(f"Partial data: {path} exceeded {max_pages} pages")
            created = mq.parse_ts(query["created"][0].removeprefix(">="))
            return [r for r in self.recent_runs if r["event"] == event and mq.parse_ts(r["created_at"]) >= created]
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


FP = evidence.fingerprint("A#t", "boom")


def test_forgiven_failures_pass_the_entry_in_enforce_mode(monkeypatch):
    zips = {
        10: zip_with({"outcome.json": json.dumps({"classification": "test_failure", "failedTests": [{"id": "A#t", "message": "boom"}]})}),
        11: zip_with({"verify.json": json.dumps({"runAttempt": 1, "tests": [{"id": "A#t", "fingerprint": FP, "entry": {"failed": 0, "runs": 3}}]})}),
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
        11: zip_with({"verify.json": json.dumps({"runAttempt": 1, "tests": [{"id": "A#t", "fingerprint": FP, "entry": {"failed": 0, "runs": 3}}]})}),
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
    fake = FakeGitHub(monkeypatch, jobs=[plan_job(sampled=True)], event="pull_request")
    fake.run["conclusion"] = "success"
    assert run(["--mode", "shadow", "auto", "--run-id", "500"]) == 0
    [status] = statuses(fake)
    assert (status["context"], status["state"]) == ("merge-gate (shadow)", "success")


def finished(fake, created_minutes_ago, finished_minutes_ago):
    now = mq.utcnow()
    return {
        **fake.run,
        "created_at": (now - timedelta(minutes=created_minutes_ago)).isoformat(),
        "updated_at": (now - timedelta(minutes=finished_minutes_ago)).isoformat(),
    }


def test_the_sweep_decides_a_long_queue_run_whose_delivery_was_missed(monkeypatch):
    fake = FakeGitHub(monkeypatch, jobs=[job(1, "playwright / chromium-03", step="Download backend distribution")])
    fake.recent_runs = [finished(fake, created_minutes_ago=95, finished_minutes_ago=20)]
    assert run(["--mode", "shadow", "sweep"]) == 0
    assert statuses(fake)[0]["context"] == "merge-gate (shadow)"


@pytest.mark.parametrize(
    "history, decided",
    [
        ([], True),
        ([{"context": "some-other-check", "state": "success"}], True),
        # Newest first, as GitHub lists them: a re-run left the head pending.
        ([{"context": "merge-gate (shadow)", "state": "pending"}, {"context": "merge-gate (shadow)", "state": "failure"}], True),
        ([{"context": "merge-gate (shadow)", "state": "success"}, {"context": "merge-gate (shadow)", "state": "pending"}], False),
        ([{"context": "merge-gate (shadow)", "state": "failure"}], False),
    ],
)
def test_the_sweep_decides_heads_whose_latest_gate_status_is_missing_or_pending(monkeypatch, history, decided):
    fake = FakeGitHub(monkeypatch, jobs=[job(1, "playwright / chromium-03", step="Download backend distribution")])
    fake.recent_runs = [finished(fake, created_minutes_ago=95, finished_minutes_ago=20)]
    fake.statuses = history
    assert run(["--mode", "shadow", "sweep"]) == 0
    assert bool(statuses(fake)) is decided


@pytest.mark.parametrize("finished_minutes_ago", [5, 120])
def test_the_sweep_leaves_runs_finished_inside_the_grace_or_before_its_window(monkeypatch, finished_minutes_ago):
    # Inside the grace the delivered decision may still be posting; before the window,
    # earlier sweeps covered the run.
    fake = FakeGitHub(monkeypatch, jobs=[job(1, "playwright / chromium-03", step="Download backend distribution")])
    fake.recent_runs = [finished(fake, created_minutes_ago=150, finished_minutes_ago=finished_minutes_ago)]
    assert run(["--mode", "shadow", "sweep"]) == 0
    assert fake.posts == []


def another_run(fake, run_id, pr, created_minutes_ago, finished_minutes_ago, event="merge_group"):
    """A further finished run with its own id, head commit and queue ref."""
    now = mq.utcnow()
    run = {
        **fake.run,
        "id": run_id,
        "event": event,
        "head_branch": f"gh-readonly-queue/main/pr-{pr}-{PARENT}" if event == "merge_group" else f"feature-{pr}",
        "head_sha": f"{run_id:040x}",
        "html_url": f"https://github.com/o/r/actions/runs/{run_id}",
        "created_at": (now - timedelta(minutes=created_minutes_ago)).isoformat(),
        "updated_at": (now - timedelta(minutes=finished_minutes_ago)).isoformat(),
    }
    fake.recent_runs.append(run)
    return run


def decided_heads(fake):
    return [path.rsplit("/", 1)[1] for path, _ in fake.posts if "/statuses/" in path]


def blip(monkeypatch):
    return FakeGitHub(monkeypatch, jobs=[job(1, "playwright / chromium-03", step="Download backend distribution")])


def test_the_sweep_decides_queue_runs_first_and_the_oldest_first(monkeypatch):
    # Under its limit, the entry nearest its check timeout goes first, and PR runs wait
    # behind every queue run.
    monkeypatch.setattr(controller, "SWEEP_LIMIT", 1)
    fake = blip(monkeypatch)
    another_run(fake, 601, pr=1, created_minutes_ago=50, finished_minutes_ago=20, event="pull_request")
    another_run(fake, 602, pr=2, created_minutes_ago=100, finished_minutes_ago=20)
    oldest = another_run(fake, 603, pr=3, created_minutes_ago=200, finished_minutes_ago=30)
    assert run(["--mode", "shadow", "sweep"]) == 0
    assert decided_heads(fake) == [oldest["head_sha"]]


def test_runs_that_get_no_verdict_do_not_use_up_the_sweep_limit(monkeypatch):
    # Entries that left the queue, like runs outside the sample or superseded heads,
    # never get a status, and a decided head keeps its own: neither may crowd out a run
    # that still needs a verdict.
    monkeypatch.setattr(controller, "SWEEP_LIMIT", 1)
    fake = blip(monkeypatch)
    for run_id, pr in ((701, 11), (702, 12)):
        fake.dead_refs.add(another_run(fake, run_id, pr=pr, created_minutes_ago=300, finished_minutes_ago=25)["head_branch"])
    decided = another_run(fake, 703, pr=13, created_minutes_ago=250, finished_minutes_ago=25)
    fake.statuses_by_sha[decided["head_sha"]] = [{"context": "merge-gate (shadow)", "state": "failure"}]
    waiting = another_run(fake, 704, pr=14, created_minutes_ago=100, finished_minutes_ago=25)
    assert run(["--mode", "shadow", "sweep"]) == 0
    assert decided_heads(fake) == [waiting["head_sha"]]


def test_an_unreadable_listing_does_not_stop_the_queue_runs(monkeypatch):
    # More PR runs than the listing's page budget: the queue runs are still decided, and
    # the sweep fails so the gap shows.
    fake = blip(monkeypatch)
    fake.unlistable.add("pull_request")
    entry = another_run(fake, 801, pr=21, created_minutes_ago=90, finished_minutes_ago=20)
    assert run(["--mode", "shadow", "sweep"]) == 1
    assert decided_heads(fake) == [entry["head_sha"]]


@pytest.mark.parametrize("event, command", [("merge_group", "entry"), ("merge_group", "auto"), ("pull_request", "auto")])
def test_a_run_still_in_progress_gets_no_verdict(monkeypatch, event, command):
    # A dispatch on a live run, or a re-run starting between the sweep's list and its
    # decision: jobs without a conclusion yet must not read as passed.
    fake = FakeGitHub(monkeypatch, jobs=[job(1, "it / mysql-elasticsearch / parallel", conclusion=None)], event=event)
    fake.run.update(status="in_progress", conclusion=None)
    assert run(["--mode", "enforce", command, "--run-id", "500"]) == 0
    assert fake.posts == []


TABLE_IT = "org.openmetadata.it.tests.TableResourceIT#test_create"
UI_FILE = "openmetadata-ui/src/main/resources/ui/src/App.tsx"
TABLE_REPOSITORY = "openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/TableRepository.java"


def ambiguous_run(monkeypatch, files=(UI_FILE,)):
    """A Java IT that failed once in three on the entry and never on its parent."""
    fp = evidence.fingerprint(TABLE_IT, "boom")
    zips = {
        10: zip_with({"outcome.json": json.dumps({"classification": "test_failure", "failedTests": [{"id": TABLE_IT, "message": "boom"}]})}),
        11: zip_with({"verify.json": json.dumps({"runAttempt": 1, "tests": [{"id": TABLE_IT, "fingerprint": fp, "entry": {"failed": 1, "runs": 3}, "parent": {"failed": 0, "runs": 3}}]})}),
    }
    fake = FakeGitHub(
        monkeypatch,
        jobs=[job(1, "it / mysql-elasticsearch / parallel", step="Run integration tests")],
        artifacts=[
            {"id": 10, "name": "evidence-it-mysql-elasticsearch-parallel-a1", "size_in_bytes": 10},
            {"id": 11, "name": "verify-java-it-a1", "size_in_bytes": 10},
        ],
        zips=zips,
        files=files,
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


def test_an_ambiguous_failure_the_impact_map_links_to_the_entry_is_not_forgiven(monkeypatch):
    # ADR:2026-10-13-a-queue-failure-is-forgiven-only-when-the-same-run-proves-it-is-not-the-entrys:
    # history breaks the tie only for a test the entry's diff does not reach.
    fake, fp = ambiguous_run(monkeypatch, files=(TABLE_REPOSITORY,))
    monkeypatch.setattr(controller.registry, "ledger_read", lambda o, r, t: [{"fingerprint": fp, "prs": [], "class": "pre-existing"}])
    assert run(["--mode", "enforce", "entry", "--run-id", "500"]) == 0
    assert statuses(fake)[0]["state"] == "failure"


@pytest.mark.parametrize("event", ["merge_group", "pull_request"])
@pytest.mark.parametrize("conclusion", ["startup_failure", "failure"])
def test_a_run_whose_jobs_never_started_fails(monkeypatch, event, conclusion):
    # A broken ci.yml, or a called workflow asking for more than ci.yml grants: no job
    # ran, so "no failed job" proves nothing.
    fake = FakeGitHub(monkeypatch, jobs=[], event=event)
    fake.run["conclusion"] = conclusion
    assert run(["--mode", "enforce", "auto", "--run-id", "500"]) == 0
    [status] = statuses(fake)
    assert (status["context"], status["state"]) == ("merge-gate", "failure")


@pytest.mark.parametrize("conclusion", ["action_required", "cancelled", "skipped"])
def test_a_run_no_job_ran_in_gets_no_verdict(monkeypatch, conclusion):
    # A fork's first run awaits a maintainer's approval; a superseded run was cancelled
    # before it began.
    fake = FakeGitHub(monkeypatch, jobs=[], event="pull_request")
    fake.run["conclusion"] = conclusion
    assert run(["--mode", "enforce", "auto", "--run-id", "500"]) == 0
    assert fake.posts == []


def test_a_run_of_another_workflow_named_ci_gets_no_verdict(monkeypatch):
    fake = FakeGitHub(monkeypatch, jobs=[plan_job(sampled=True)], event="pull_request")
    fake.run.update(conclusion="success", path=".github/workflows/also-ci.yml")
    assert run(["--mode", "enforce", "auto", "--run-id", "500"]) == 0
    assert fake.posts == []


def flaky_lane_and_blip(monkeypatch, lane_started_at):
    """Attempt 2 of a run where attempt 1 forgave A#t in the MySQL parallel lane as flaky
    and re-ran another lane, which failed on a blip, by itself."""
    lane = job(1, "it / mysql-elasticsearch / parallel", step="Run integration tests")
    lane["started_at"] = lane_started_at
    rerun = job(2, "it / postgres-opensearch / rdf", conclusion="success")
    rerun["started_at"] = "2026-10-14T11:30:00Z"
    fake = FakeGitHub(monkeypatch, jobs=[lane, rerun], run_attempt=2)
    fake.artifacts = [
        {"id": 10, "name": "evidence-it-mysql-elasticsearch-parallel-a1", "size_in_bytes": 10, "created_at": "2026-10-14T10:40:00Z"},
        {"id": 11, "name": "verify-java-it-a1", "size_in_bytes": 10, "created_at": "2026-10-14T11:05:00Z"},
        {"id": 12, "name": "verify-java-it-a2", "size_in_bytes": 10, "created_at": "2026-10-14T12:20:00Z"},
    ]
    fake.zips = {
        10: zip_with({"outcome.json": json.dumps({"classification": "test_failure", "failedTests": [{"id": "A#t", "message": "boom"}]})}),
        11: zip_with({"verify.json": json.dumps({"runAttempt": 1, "tests": [{"id": "A#t", "job": "it-mysql-elasticsearch-parallel", "fingerprint": FP, "entry": {"failed": 0, "runs": 3}}]})}),
        12: zip_with({"verify.json": json.dumps({"runAttempt": 2, "tests": []})}),
    }
    fake.logs[1] = "##[group]Run mvn\n[ERROR] Tests run: 9, Failures: 1, Errors: 0\n##[error]Process completed with exit code 1."
    return fake


def test_a_flake_forgiven_before_a_rerun_stays_forgiven(monkeypatch):
    # GitHub copies a job a re-run left alone into the new attempt with its original start
    # time; its evidence and its verification are the ones attempt 1 wrote.
    fake = flaky_lane_and_blip(monkeypatch, lane_started_at="2026-10-14T10:00:00Z")
    assert run(["--mode", "enforce", "entry", "--run-id", "500"]) == 0
    assert statuses(fake)[0]["state"] == "success"


def test_a_rerun_job_is_not_answered_by_its_earlier_run(monkeypatch):
    # Re-run in attempt 2, the lane uploaded nothing new: attempt 1's evidence is not its
    # own, so the old verification forgives nothing and the unexplained failure ejects.
    fake = flaky_lane_and_blip(monkeypatch, lane_started_at="2026-10-14T11:30:00Z")
    assert run(["--mode", "enforce", "entry", "--run-id", "500"]) == 0
    assert statuses(fake)[0]["state"] == "failure"


def test_several_jobs_are_rerun_together_through_the_runs_failed_jobs(monkeypatch):
    # After one targeted re-run starts attempt 2, GitHub refuses a targeted re-run of a
    # job from attempt 1, so two blips are re-run in one call.
    fake = FakeGitHub(
        monkeypatch,
        jobs=[
            job(1, "playwright / chromium-03", step="Download backend distribution"),
            job(2, "playwright / chromium-04", step="Download backend distribution"),
        ],
    )
    assert run(["--mode", "enforce", "entry", "--run-id", "500"]) == 0
    assert [path for path, _ in fake.posts if "rerun" in path] == ["/repos/o/r/actions/runs/500/rerun-failed-jobs"]
    assert statuses(fake)[0]["state"] == "pending"


def test_the_report_marks_an_entry_that_changes_ci_configuration(monkeypatch, tmp_path):
    # The registry keeps nothing from a strict entry; it reads the mark from this report.
    FakeGitHub(monkeypatch, jobs=[job(1, "playwright / chromium-03", step="Download backend distribution")], files=(".github/workflows/ci.yml",))
    out = tmp_path / "decision.json"
    assert run(["--dry-run", "--out", str(out), "entry", "--run-id", "500"]) == 0
    assert json.loads(out.read_text())["context"]["strict"] is True


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
