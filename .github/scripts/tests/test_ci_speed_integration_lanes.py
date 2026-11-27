"""Guards for the Java integration-test lanes' runner preparation.

The lanes used to spend ~3 minutes purging preinstalled SDKs before checkout and
then install apt packages and the ANTLR CLI they never use. They now check out,
let ``configure_docker_storage.sh`` confirm there is room for Docker, and purge
only when that check fails.
"""

import os
import shutil
import stat
import subprocess
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[3]
LANE_WORKFLOW = REPO_ROOT / ".github/workflows/reusable-java-integration-lanes.yml"
STORAGE_SCRIPT = ".github/scripts/configure_docker_storage.sh"
LANE_JOB = "integration-test-lanes"
LANE_MODULE = "openmetadata-integration-tests"


def lane_steps():
    return yaml.safe_load(LANE_WORKFLOW.read_text())["jobs"][LANE_JOB]["steps"]


def index_of(steps, predicate, description):
    matches = [i for i, step in enumerate(steps) if predicate(step)]
    assert matches, f"no lane step {description}"
    return matches[0]


def uses(step, action):
    return step.get("uses", "").startswith(action)


def runs_storage_script(step):
    return STORAGE_SCRIPT in step.get("run", "")


def is_disk_purge(step):
    return uses(step, "jlumbroso/free-disk-space")


def storage_check(steps):
    checks = [step for step in steps if runs_storage_script(step) and "if" not in step]
    assert len(checks) == 1, "expected exactly one unconditional storage check"
    return checks[0]


def failed_check_condition(steps):
    return f"steps.{storage_check(steps)['id']}.outcome == 'failure'"


def test_storage_check_runs_after_checkout_and_before_tests():
    steps = lane_steps()
    checkout = index_of(steps, lambda s: uses(s, "actions/checkout"), "checks out")
    check = steps.index(storage_check(steps))
    setup_java = index_of(
        steps, lambda s: uses(s, "actions/setup-java"), "sets up Java"
    )
    tests = index_of(
        steps, lambda s: s.get("id") == "integration-tests", "runs the tests"
    )

    assert checkout < check < setup_java < tests


def test_no_disk_purge_runs_before_checkout_or_unconditionally():
    steps = lane_steps()
    checkout = index_of(steps, lambda s: uses(s, "actions/checkout"), "checks out")

    for position, step in enumerate(steps):
        if is_disk_purge(step):
            assert position > checkout, "the purge must not run before checkout"
            assert "if" in step, "the purge must only run as a fallback"


def test_fallback_purge_runs_only_when_the_storage_check_fails():
    steps = lane_steps()
    check = storage_check(steps)
    condition = failed_check_condition(steps)

    assert check.get("continue-on-error") is True
    purges = [step for step in steps if is_disk_purge(step)]
    assert len(purges) == 1, "keep one fallback purge for low-space runners"
    assert condition in purges[0]["if"]


def test_storage_is_rechecked_after_the_fallback_purge_and_fails_closed():
    steps = lane_steps()
    condition = failed_check_condition(steps)
    purge = index_of(steps, is_disk_purge, "purges disk")
    rechecks = [
        i
        for i, step in enumerate(steps)
        if runs_storage_script(step) and condition in step.get("if", "")
    ]

    assert len(rechecks) == 1
    recheck = steps[rechecks[0]]
    assert rechecks[0] > purge
    assert not recheck.get("continue-on-error", False)
    setup_java = index_of(
        steps, lambda s: uses(s, "actions/setup-java"), "sets up Java"
    )
    assert rechecks[0] < setup_java, (
        "a tool-cache purge must not delete the JDK after setup"
    )


def test_lanes_do_not_install_host_packages_or_the_antlr_cli():
    for step in lane_steps():
        script = step.get("run", "")
        assert "apt-get" not in script, step.get("name")
        assert "install_antlr_cli" not in script, step.get("name")


def test_lane_maven_build_cannot_need_the_antlr_cli():
    # The ANTLR CLI only generates the Python and JavaScript parsers (Makefile
    # py_antlr/js_antlr). Java parsers come from antlr4-maven-plugin in the spec
    # and service modules, which the lane takes prebuilt from the runtime bundle.
    steps = lane_steps()
    tests = steps[
        index_of(steps, lambda s: s.get("id") == "integration-tests", "runs tests")
    ]
    command = tests["run"]

    assert f"-pl :{LANE_MODULE}" in command
    assert " -am" not in command and "--also-make" not in command
    lane_pom = (REPO_ROOT / LANE_MODULE / "pom.xml").read_text()
    assert "antlr" not in lane_pom.lower()


def write_stub(directory, name, body):
    path = directory / name
    path.write_text(f"#!/usr/bin/env bash\n{body}\n")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def run_storage_script(tmp_path, available_kb):
    stubs = tmp_path / "bin"
    stubs.mkdir()
    # One filesystem for / and /mnt, as on the 4-vCPU hosted runners.
    write_stub(stubs, "stat", "echo 2049")
    write_stub(stubs, "df", f"echo Avail; echo {available_kb}")
    write_stub(stubs, "docker", "echo 'Docker root: /var/lib/docker'")
    env = {**os.environ, "PATH": f"{stubs}{os.pathsep}{os.environ['PATH']}"}
    return subprocess.run(
        ["bash", str(REPO_ROOT / STORAGE_SCRIPT)],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


needs_linux_runner_layout = pytest.mark.skipif(
    not Path("/mnt").is_dir() or shutil.which("bash") is None,
    reason="the storage script requires a runner-like /mnt",
)


@needs_linux_runner_layout
def test_storage_check_fails_when_the_runner_is_low_on_space(tmp_path):
    result = run_storage_script(tmp_path, available_kb=10 * 1024 * 1024)

    assert result.returncode != 0
    assert "is required" in result.stdout


@needs_linux_runner_layout
def test_storage_check_passes_on_a_roomy_runner(tmp_path):
    result = run_storage_script(tmp_path, available_kb=86 * 1024 * 1024)

    assert result.returncode == 0, result.stdout + result.stderr
