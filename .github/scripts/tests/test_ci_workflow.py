"""ci.yml's ordering: static checks gate every suite, builds run beside them."""

from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml")

WORKFLOW = Path(__file__).parents[2] / "workflows" / "ci.yml"
SUITES = ("unit-java", "unit-ui", "python", "it", "playwright")


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
