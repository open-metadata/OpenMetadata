#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Guards for the Java unit-test / checkstyle speed-ups and PR cache hygiene.

A cache saved by a pull_request run is scoped to that PR's merge ref. Only that
PR's own re-runs can read it, yet it counts against the repo's 10 GB LRU budget
and evicts the main-scoped Maven, uv and Playwright caches every run restores.
So no job a pull_request can reach may save a cache, directly or through a
local composite action or reusable workflow. Writers stay on push / schedule.
"""

from __future__ import annotations

import importlib.util
import shlex
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[3]
WORKFLOWS = ROOT / ".github" / "workflows"

_SPEC = importlib.util.spec_from_file_location(
    "pr_workflow_security", ROOT / ".github/scripts/check_pr_workflow_security.py"
)
_security = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_security)
excludes_pull_request = _security.excludes_pull_request

# Exact PR-reachable cache writers outside this change's ownership. Each entry
# must still be a real violation (see the staleness test), so the list can only
# shrink, and any other writer in the same workflow still fails the guard.
KNOWN_UNOWNED_WRITERS = {
    # Saves ~/.m2 on every PR with no event gate; runs on pull_request and
    # workflow_dispatch only, so it needs a main-scoped writer before gating.
    (
        ".github/workflows/maven-sonar-build.yml: jobs.maven-sonarcloud-ci"
        " > Save Maven dependencies: actions/cache/save"
    ),
}

# Third-party composites that save a cache internally, where the guard cannot
# read their steps. Verified in each action.yml at the pinned version.
THIRD_PARTY_WRITERS = {
    # v1.6.3 action.yml: `save-cache` step runs actions/cache/save on a miss.
    "awalsh128/cache-apt-pkgs-action": "cache-apt-pkgs saves on a cache miss",
}


def load(path: Path) -> dict:
    # BaseLoader keeps every scalar a string and `on:` a plain key, matching
    # check_pr_workflow_security.py.
    return yaml.load(path.read_text(), Loader=yaml.BaseLoader) or {}


def is_false_on_pull_request(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().casefold() == "false" or excludes_pull_request(value)


def cache_writer(step: dict) -> str | None:
    """Name the way this step can save a cache, or None if it cannot."""
    uses = step.get("uses", "")
    action, _, _ = uses.partition("@")
    inputs = step.get("with", {}) or {}
    if action == "actions/cache":
        return "actions/cache saves in its post step"
    if action == "actions/cache/save":
        return "actions/cache/save"
    if action in THIRD_PARTY_WRITERS:
        return THIRD_PARTY_WRITERS[action]
    if action == "astral-sh/setup-uv":
        if is_false_on_pull_request(inputs.get("enable-cache")):
            return None
        if is_false_on_pull_request(inputs.get("save-cache")):
            return None
        return "setup-uv saves its cache unless save-cache/enable-cache is false"
    if (
        action
        in {
            "actions/setup-java",
            "actions/setup-node",
            "actions/setup-python",
            "actions/setup-go",
        }
        and inputs.get("cache", "").strip()
    ):
        return f"{action} `cache:` saves in its post step"
    cache_to = inputs.get("cache-to", "")
    if (
        action == "docker/build-push-action"
        and "type=gha" in cache_to
        and not excludes_pull_request(cache_to)
    ):
        return "docker/build-push-action cache-to type=gha"
    return None


def step_writers(steps: list, root: Path, trail: str, seen: tuple = ()) -> list[str]:
    found = []
    for index, step in enumerate(steps or []):
        if excludes_pull_request(step.get("if", "")):
            continue
        label = f"{trail} > {step.get('name') or step.get('uses') or f'step {index}'}"
        reason = cache_writer(step)
        if reason:
            found.append(f"{label}: {reason}")
        uses = step.get("uses", "")
        if uses.startswith("./") and uses not in seen:
            action_dir = root / uses[2:]
            action_file = next(
                (
                    p
                    for p in (action_dir / "action.yml", action_dir / "action.yaml")
                    if p.is_file()
                ),
                None,
            )
            assert action_file, f"{label}: local action {uses} not found"
            runs = load(action_file).get("runs", {})
            if runs.get("using") == "composite":
                found += step_writers(runs.get("steps"), root, label, (*seen, uses))
    return found


def workflow_writers(path: Path, root: Path, seen: tuple = ()) -> list[str]:
    relative = str(path.relative_to(root))
    found = []
    for job_id, job in (load(path).get("jobs") or {}).items():
        if excludes_pull_request(job.get("if", "")):
            continue
        trail = f"{relative}: jobs.{job_id}"
        uses = job.get("uses", "")
        if uses.startswith("./") and uses not in seen:
            found += workflow_writers(root / uses[2:], root, (*seen, uses))
        found += step_writers(job.get("steps"), root, trail)
    return found


def pull_request_workflows(root: Path) -> list[Path]:
    paths = []
    for path in sorted((root / ".github/workflows").glob("*.y*ml")):
        events = load(path).get("on", {})
        if events == "pull_request" or (
            isinstance(events, (dict, list)) and "pull_request" in events
        ):
            paths.append(path)
    return paths


def pull_request_cache_writers(root: Path = ROOT) -> dict[str, list[str]]:
    by_workflow = {}
    for path in pull_request_workflows(root):
        writers = workflow_writers(path, root)
        if writers:
            by_workflow[str(path.relative_to(root))] = writers
    return by_workflow


# ---------------------------------------------------------------------------
# The guard's own behaviour, on synthetic repos.
# ---------------------------------------------------------------------------


def write(root: Path, relative: str, document: dict) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(document, sort_keys=False))


def pr_workflow(
    root: Path, steps: list, *, job_if: str | None = None, uses: str | None = None
):
    job = {"runs-on": "ubuntu-latest"}
    if job_if:
        job["if"] = job_if
    if uses:
        job = {"uses": uses}
    else:
        job["steps"] = steps
    write(
        root,
        ".github/workflows/pr.yml",
        {"on": {"pull_request": {}}, "jobs": {"build": job}},
    )


@pytest.mark.parametrize(
    "step",
    [
        {"uses": "actions/cache@v6", "with": {"path": "x", "key": "k"}},
        {"uses": "actions/cache/save@v6", "with": {"path": "x", "key": "k"}},
        {"uses": "astral-sh/setup-uv@v7"},
        {
            "uses": "astral-sh/setup-uv@v7",
            "with": {"enable-cache": "${{ github.event_name != 'merge_group' }}"},
        },
        {"uses": "actions/setup-node@v5", "with": {"cache": "yarn"}},
        {"uses": "actions/cache/save@v6", "if": "github.event_name != 'merge_group'"},
    ],
)
def test_guard_flags_every_kind_of_pr_reachable_writer(
    tmp_path: Path, step: dict
) -> None:
    pr_workflow(tmp_path, [step])
    assert pull_request_cache_writers(tmp_path)


@pytest.mark.parametrize(
    "step",
    [
        {"uses": "actions/cache/restore@v6", "with": {"path": "x", "key": "k"}},
        {"uses": "actions/cache/save@v6", "if": "github.event_name == 'push'"},
        {
            "uses": "actions/cache@v6",
            "if": "${{ github.event_name != 'pull_request' }}",
        },
        {
            "uses": "astral-sh/setup-uv@v7",
            "with": {"save-cache": "${{ github.event_name != 'pull_request' }}"},
        },
        {"uses": "astral-sh/setup-uv@v7", "with": {"enable-cache": "false"}},
        {"uses": "actions/setup-java@v5", "with": {"java-version": "21"}},
    ],
)
def test_guard_accepts_restore_only_and_event_gated_saves(
    tmp_path: Path, step: dict
) -> None:
    pr_workflow(tmp_path, [step])
    assert pull_request_cache_writers(tmp_path) == {}


def test_guard_resolves_local_composite_actions(tmp_path: Path) -> None:
    write(
        tmp_path,
        ".github/actions/inner/action.yml",
        {"runs": {"using": "composite", "steps": [{"uses": "actions/cache@v5"}]}},
    )
    write(
        tmp_path,
        ".github/actions/outer/action.yml",
        {
            "runs": {
                "using": "composite",
                "steps": [{"uses": "./.github/actions/inner"}],
            }
        },
    )
    pr_workflow(tmp_path, [{"uses": "./.github/actions/outer"}])
    [writer] = pull_request_cache_writers(tmp_path)[".github/workflows/pr.yml"]
    assert "./.github/actions/inner" in writer


def test_guard_follows_reusable_workflows_and_honours_job_gates(tmp_path: Path) -> None:
    write(
        tmp_path,
        ".github/workflows/reusable.yml",
        {
            "on": {"workflow_call": {}},
            "jobs": {
                "gated": {
                    "if": "github.event_name == 'push'",
                    "steps": [{"uses": "actions/cache@v6"}],
                },
                "open": {"steps": [{"uses": "actions/cache/save@v6"}]},
            },
        },
    )
    pr_workflow(tmp_path, [], uses="./.github/workflows/reusable.yml")
    [writer] = pull_request_cache_writers(tmp_path)[".github/workflows/pr.yml"]
    assert "reusable.yml: jobs.open" in writer


def test_guard_flags_third_party_composite_writers(tmp_path: Path) -> None:
    # v1.6.3 restores with actions/cache/restore and, on a miss, saves with
    # actions/cache/save inside its own composite, which we cannot resolve.
    pr_workflow(tmp_path, [{"uses": "awalsh128/cache-apt-pkgs-action@v1.6.3"}])
    assert pull_request_cache_writers(tmp_path)


def test_allowlist_covers_only_the_exact_existing_writer(tmp_path: Path) -> None:
    write(
        tmp_path,
        ".github/workflows/maven-sonar-build.yml",
        {
            "on": {"pull_request": {}},
            "jobs": {
                "maven-sonarcloud-ci": {
                    "runs-on": "ubuntu-latest",
                    "steps": [
                        {
                            "name": "Save Maven dependencies",
                            "uses": "actions/cache/save@v6",
                        },
                        {"name": "Another save", "uses": "actions/cache/save@v6"},
                    ],
                }
            },
        },
    )
    [extra] = unexpected_writers(pull_request_cache_writers(tmp_path))
    assert "Another save" in extra


def test_allowlist_does_not_hide_a_second_writer_with_the_same_name(
    tmp_path: Path,
) -> None:
    save = {"name": "Save Maven dependencies", "uses": "actions/cache/save@v6"}
    write(
        tmp_path,
        ".github/workflows/maven-sonar-build.yml",
        {
            "on": {"pull_request": {}},
            "jobs": {
                "maven-sonarcloud-ci": {
                    "runs-on": "ubuntu-latest",
                    "steps": [save, {**save, "with": {"key": "other"}}],
                }
            },
        },
    )
    [extra] = unexpected_writers(pull_request_cache_writers(tmp_path))
    assert "Save Maven dependencies" in extra


# ---------------------------------------------------------------------------
# O-5: the real repository.
# ---------------------------------------------------------------------------


def all_writers(by_workflow: dict[str, list[str]]) -> set[str]:
    return {writer for found in by_workflow.values() for writer in found}


def unexpected_writers(by_workflow: dict[str, list[str]]) -> list[str]:
    # Per workflow, each allowlisted writer excuses one occurrence only, so a
    # second step with the same label is still reported.
    unexpected = []
    for found in by_workflow.values():
        excused = set()
        for writer in found:
            if writer in KNOWN_UNOWNED_WRITERS and writer not in excused:
                excused.add(writer)
            else:
                unexpected.append(writer)
    return sorted(unexpected)


def test_no_job_reachable_from_pull_request_saves_a_cache() -> None:
    unexpected = unexpected_writers(pull_request_cache_writers())
    assert unexpected == [], "\n".join(unexpected)


def test_known_unowned_writers_are_still_real_violations() -> None:
    stale = KNOWN_UNOWNED_WRITERS - all_writers(pull_request_cache_writers())
    assert not stale, f"fixed, delete from KNOWN_UNOWNED_WRITERS: {sorted(stale)}"


def steps_of(workflow: str, job: str) -> list[dict]:
    return load(WORKFLOWS / workflow)["jobs"][job]["steps"]


def index_of(steps: list[dict], predicate) -> int:
    return next(i for i, step in enumerate(steps) if predicate(step))


MAVEN_JOBS = [
    "openmetadata-service-unit-tests",
    "k8s_operator-unit-tests",
    "docker-image-smoke-test",
]


@pytest.mark.parametrize("job", MAVEN_JOBS)
def test_unit_test_jobs_still_restore_maven_on_prs_and_save_on_main(job: str) -> None:
    steps = steps_of("openmetadata-service-unit-tests.yml", job)
    restore = index_of(
        steps, lambda s: s.get("uses", "").startswith("actions/cache/restore@")
    )
    save = index_of(
        steps, lambda s: s.get("uses", "").startswith("actions/cache/save@")
    )
    first_mvn = index_of(steps, lambda s: "mvn " in s.get("run", ""))
    assert restore < first_mvn < save
    assert steps[restore]["with"]["path"] == steps[save]["with"]["path"] == "~/.m2"
    assert not excludes_pull_request(steps[restore].get("if", ""))
    # Saved after the build so the entry holds what the build downloaded, and
    # only from push (main), the scope every PR can read.
    assert steps[save]["if"].replace(" ", "").startswith("github.event_name=='push'")


# ---------------------------------------------------------------------------
# O-2: service unit tests run in two surefire forks, without JaCoCo / apt.
# ---------------------------------------------------------------------------


def mvn_command(steps: list[dict]) -> list[str]:
    [script] = [
        s["run"]
        for s in steps
        if "mvn " in s.get("run", "") and "openmetadata-service" in s["run"]
    ]
    return shlex.split(script.replace("\\\n", " "))


def test_service_unit_tests_run_in_two_surefire_forks_without_jacoco() -> None:
    steps = steps_of(
        "openmetadata-service-unit-tests.yml", "openmetadata-service-unit-tests"
    )
    command = mvn_command(steps)
    assert "-DforkCount=2" in command
    assert not any(
        arg.startswith("-P") and "static-code-analysis" in arg for arg in command
    )
    # Same suite as before: the whole service module, tests not skipped.
    assert {"package", "-pl", "openmetadata-service", "-am"} <= set(command)
    assert not any(
        arg.startswith(("-DskipTests", "-Dmaven.test.skip")) for arg in command
    )


def test_service_unit_tests_skip_the_unused_apt_and_antlr_installs() -> None:
    steps = steps_of(
        "openmetadata-service-unit-tests.yml", "openmetadata-service-unit-tests"
    )
    scripts = " ".join(s.get("run", "") for s in steps)
    assert "apt-get" not in scripts
    assert "install_antlr_cli" not in scripts


# ---------------------------------------------------------------------------
# O-4: java-checkstyle restores Maven read-only and no longer purges disk.
# ---------------------------------------------------------------------------


def test_java_checkstyle_restores_the_shared_maven_cache_without_purging_disk() -> None:
    steps = steps_of("java-checkstyle.yml", "java-checkstyle")
    assert not any("free-disk-space" in s.get("uses", "") for s in steps)
    restore = index_of(
        steps, lambda s: s.get("uses", "").startswith("actions/cache/restore@")
    )
    assert restore < index_of(steps, lambda s: "mvn " in s.get("run", ""))
    # Same key scheme the unit-test jobs save from main, so a PR hits it.
    [unit_restore] = [
        s
        for s in steps_of(
            "openmetadata-service-unit-tests.yml", "openmetadata-service-unit-tests"
        )
        if s.get("uses", "").startswith("actions/cache/restore@")
    ]
    assert steps[restore]["with"] == unit_restore["with"]


# ---------------------------------------------------------------------------
# cache-ui-dist: restore-only on PRs, still signals a hit either way.
# ---------------------------------------------------------------------------


def test_cache_ui_dist_is_restore_only_on_prs_and_signals_hits_from_both_paths() -> (
    None
):
    steps = load(ROOT / ".github/actions/cache-ui-dist/action.yml")["runs"]["steps"]
    on_pr = [
        s for s in steps if s.get("id") and not excludes_pull_request(s.get("if", ""))
    ]
    pr_restores = [s for s in on_pr if s.get("uses", "").startswith("actions/cache")]
    assert [s["uses"].partition("@")[0] for s in pr_restores] == [
        "actions/cache/restore"
    ]
    combined = [
        s for s in steps if s.get("uses", "").partition("@")[0] == "actions/cache"
    ]
    assert len(combined) == 1, "non-PR events must keep the restore+save writer"
    signal = next(s for s in steps if "SKIP_UI_BUILD" in s.get("run", ""))
    for step in (*pr_restores, *combined):
        assert f"steps.{step['id']}.outputs.cache-hit" in signal["if"]
