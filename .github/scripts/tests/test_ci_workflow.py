"""ci.yml's ordering: static checks gate every suite, builds run beside them, and a
PR runs unit tests while the merge queue adds integration and Playwright."""

import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml")

WORKFLOW = Path(__file__).parents[2] / "workflows" / "ci.yml"
SUITES = ("unit-java", "unit-ui", "python", "it", "playwright")
PR_SUITES = ("unit-java", "unit-ui", "python")
QUEUE_ONLY = ("build-java", "it", "playwright", "verify-java")
QUEUE_CONDITIONS = ("needs.plan.outputs.tier == 'mq'", "github.event_name == 'merge_group'")


@pytest.fixture(scope="module")
def jobs():
    if not WORKFLOW.exists():
        pytest.skip("ci.yml is not in .github/workflows yet")
    return yaml.safe_load(WORKFLOW.read_text())["jobs"]


def test_every_suite_needs_the_static_checks(jobs):
    # ADR:2026-10-13-one-ci-workflow-builds-once-and-static-checks-gate-every-suite
    static = {name for name in jobs if name.startswith("static-")}
    assert static, "ci.yml has no static-check jobs"
    for suite in SUITES:
        needs = set(jobs[suite]["needs"])
        assert static <= needs, f"{suite} does not wait for {sorted(static - needs)}"
        assert "contains(needs.*.result, 'failure')" in jobs[suite]["if"]


def test_builds_run_beside_the_static_checks_not_after_them(jobs):
    for name, job in jobs.items():
        if name.startswith("build-"):
            needs = job["needs"] if isinstance(job["needs"], list) else [job["needs"]]
            assert not any(n.startswith("static-") for n in needs), f"{name} waits for static checks"


def test_no_job_is_named_merge_gate(jobs):
    # ADR:2026-10-13-merge-queue-entries-are-decided-by-the-merge-gate-status
    assert all((job.get("name") or name) != "merge-gate" for name, job in jobs.items())


LEVELS = {"none": 0, "read": 1, "write": 2}


def test_called_workflows_get_the_permissions_their_jobs_declare(jobs):
    # GitHub refuses to start a run whose called workflow has a job asking for more
    # than the calling job grants; actionlint does not check it.
    workflows = WORKFLOW.parent
    for name, job in jobs.items():
        if not str(job.get("uses", "")).startswith("./.github/workflows/"):
            continue
        granted = job.get("permissions") or {}
        called = yaml.safe_load((workflows / job["uses"].rsplit("/", 1)[-1]).read_text())
        for nested, nested_job in called["jobs"].items():
            wanted = nested_job.get("permissions", called.get("permissions")) or {}
            for scope, level in wanted.items():
                assert LEVELS[level] <= LEVELS[granted.get(scope, "none")], (
                    f"{name} grants {scope}: {granted.get(scope, 'none')}, "
                    f"but {job['uses']} job {nested} asks for {level}"
                )


def needs_of(job):
    needs = job.get("needs") or []
    return needs if isinstance(needs, list) else [needs]


def queue_only(jobs, name):
    condition = jobs[name].get("if", "")
    if any(queue in condition for queue in QUEUE_CONDITIONS):
        return True
    # A job that runs only once a queue-only job succeeded is queue-only too.
    return any(
        f"needs.{need}.result == 'success'" in condition and queue_only(jobs, need) for need in needs_of(jobs[name])
    )


def plan_tier(jobs, tmp_path, event):
    step = next(step for step in jobs["plan"]["steps"] if step.get("id") == "sample")
    script = step["run"].split("<<'PY'\n", 1)[1].rsplit("\nPY", 1)[0]
    out = tmp_path / f"{event}.out"
    env = {
        "PATH": os.environ.get("PATH", ""),
        "EVENT": event,
        "PR_NUMBER": "7" if event == "pull_request" else "",
        "QUEUE_REF": "gh-readonly-queue/main/pr-7-" + "a" * 40,
        "PR_PERCENT": "100",
        "MQ_PERCENT": "100",
        "GATE_MODE": "shadow",
        "GITHUB_OUTPUT": str(out),
    }
    subprocess.run([sys.executable, "-c", script], env=env, check=True, capture_output=True)
    return dict(line.split("=", 1) for line in out.read_text().splitlines())["tier"]


def test_prs_run_unit_tests_and_the_queue_adds_integration_and_playwright(jobs, tmp_path):
    # On a PR: the static checks and the unit suites (Java, Jest, Python unit). The IT
    # lanes, Playwright, Python integration and verification run in the merge queue.
    assert (plan_tier(jobs, tmp_path, "pull_request"), plan_tier(jobs, tmp_path, "merge_group")) == ("pr", "mq")
    for name in QUEUE_ONLY:
        assert queue_only(jobs, name), f"{name} would run on a pull request"
    for name in PR_SUITES:
        assert not queue_only(jobs, name), f"{name} would not run on a pull request"
    shared = yaml.safe_load((WORKFLOW.parent / "py-tests-shared.yml").read_text())
    integration = shared["jobs"]["changes"]["outputs"]["integration"]
    assert "pull_request" not in integration and "github.event_name == 'merge_group'" in integration


MAINS_CONTEXT = ("ci-conflict-resolve.yml", "ci-ai-fix.yml")
BUILDS = re.compile(r"(^|[\s;&|(])(mvn|gradle|yarn|npm|npx|pnpm|make|pip|poetry|node)\b")


@pytest.mark.parametrize("name", MAINS_CONTEXT)
def test_workflows_in_mains_context_never_run_the_code_they_check_out(name):
    # ADR:2026-10-13-queue-conflicts-are-requeued-or-resolved-by-ci. Schedules, dispatches
    # and comments run in main's cache scope, so a PR's code run here could poison main's
    # caches. The PR's own CI builds and tests what these workflows push.
    workflow = yaml.safe_load((WORKFLOW.parent / name).read_text())
    for job_name, job in workflow["jobs"].items():
        for step in job.get("steps") or []:
            label = f"{name} {job_name}: {step.get('name') or step.get('uses')}"
            assert "working-directory" not in step, f"{label} runs inside a checkout"
            assert not str(step.get("uses", "")).startswith("./"), f"{label} is a local action"
            assert not BUILDS.search(step.get("run", "")), f"{label} builds or installs"
            if str(step.get("uses", "")).startswith("actions/checkout@") and (step.get("with") or {}).get("ref"):
                assert step["with"].get("path"), f"{label} checks code out at the workspace root"


def test_no_artifact_upload_path_climbs_out_with_dot_dot(jobs):
    # upload-artifact rejects '.' and '..' in a path; verify.json would never reach the gate.
    workflow_env = yaml.safe_load(WORKFLOW.read_text()).get("env") or {}
    for name, job in jobs.items():
        env = {**workflow_env, **(job.get("env") or {})}
        for step in job.get("steps") or []:
            if not str(step.get("uses", "")).startswith("actions/upload-artifact@"):
                continue
            path = str((step.get("with") or {}).get("path", ""))
            for key, value in env.items():
                path = path.replace("${{ env.%s }}" % key, str(value))
            assert "/../" not in path and not path.startswith("../"), f"{name}: upload path {path!r}"
