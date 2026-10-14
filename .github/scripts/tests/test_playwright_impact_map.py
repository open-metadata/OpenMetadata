from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest
from test_playwright_ci_planning import load_script

SCRIPTS = Path(__file__).parents[1]
UI_ROOT = Path("openmetadata-ui/src/main/resources/ui")
SOURCE = str(UI_ROOT / "src/components/Widget.tsx")
WIDGET_SPEC = "playwright/e2e/Features/Widget.spec.ts"
MANUAL_SPEC = "playwright/e2e/Features/Manual.spec.ts"
SMOKE_SPEC = "playwright/e2e/Features/Smoke.spec.ts"


@pytest.fixture
def repo(tmp_path):
    ui = tmp_path / UI_ROOT
    (ui / "src/components").mkdir(parents=True)
    (ui / "playwright/e2e/Features").mkdir(parents=True)
    (tmp_path / SOURCE).write_text('<div data-testid="widget" />\n')
    (ui / WIDGET_SPEC).write_text("page.getByTestId('widget');\n")
    for spec in (MANUAL_SPEC, SMOKE_SPEC):
        (ui / spec).write_text("test('visible', async () => {});\n")
    hand = tmp_path / ".github/playwright/impact-map.json"
    hand.parent.mkdir(parents=True)
    hand.write_text(
        json.dumps(
            {
                "smoke": [{"specs": [SMOKE_SPEC], "projects": ["Basic"]}],
                "canary": [],
                "sharedInfrastructure": [],
                "delegatedSpecs": [],
                "mappings": [{"sources": [SOURCE], "specs": [MANUAL_SPEC]}],
            }
        )
    )
    return tmp_path


def select(
    repo,
    output,
    *extra_args,
    script=None,
    event_name="pull_request",
    changed_files=None,
):
    changed = output.with_suffix(".changed.txt")
    changed.write_text("\n".join(changed_files or [SOURCE]) + "\n")
    return subprocess.run(
        [
            sys.executable,
            str(script or SCRIPTS / "select_playwright_tests.py"),
            "--event-name",
            event_name,
            "--changed-files",
            str(changed),
            "--impact-map",
            ".github/playwright/impact-map.json",
            "--output",
            str(output),
            *extra_args,
        ],
        cwd=repo,
        check=False,
        env={key: value for key, value in os.environ.items() if key != "GITHUB_OUTPUT"},
        capture_output=True,
        text=True,
    )


def selected_specs(output):
    plan = json.loads(output.read_text())
    assert plan["mode"] == "targeted"
    return {entry["spec"] for entry in plan["selectors"]}


@pytest.mark.parametrize("legacy_snapshot", [False, True])
def test_selection_refreshes_current_tree_without_committing_a_map(
    repo, tmp_path, legacy_snapshot
):
    if legacy_snapshot:
        (repo / ".github/playwright/impact-map.generated.json").write_text(
            json.dumps({"mappings": [{"sources": [SOURCE], "specs": [WIDGET_SPEC]}]})
        )
    output = tmp_path / "selection.json"
    result = select(repo, output)
    assert result.returncode == 0, result.stderr
    assert selected_specs(output) == {SMOKE_SPEC, MANUAL_SPEC, WIDGET_SPEC}

    (repo / UI_ROOT / WIDGET_SPEC).unlink()
    (repo / SOURCE).write_text('<div data-testid="updated-widget" />\n')
    updated = "playwright/e2e/Features/UpdatedWidget.spec.ts"
    (repo / UI_ROOT / updated).write_text("page.getByTestId('updated-widget');\n")

    result = select(repo, output)
    assert result.returncode == 0, result.stderr
    assert selected_specs(output) == {SMOKE_SPEC, MANUAL_SPEC, updated}


@pytest.mark.parametrize("contents", [None, "{invalid json"])
def test_explicit_missing_or_invalid_generated_map_fails_planning(
    repo, tmp_path, contents
):
    generated = tmp_path / "explicit-generated.json"
    if contents is not None:
        generated.write_text(contents)
    output = tmp_path / "selection.json"

    result = select(repo, output, "--generated-impact-map", str(generated))

    assert result.returncode != 0
    assert not output.exists()


def test_generator_failure_cannot_fall_back_to_a_legacy_snapshot(repo, tmp_path):
    (repo / ".github/playwright/impact-map.generated.json").write_text(
        json.dumps({"mappings": [{"sources": [SOURCE], "specs": [WIDGET_SPEC]}]})
    )
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    selector = scripts / "select_playwright_tests.py"
    shutil.copyfile(SCRIPTS / selector.name, selector)
    (scripts / "generate_playwright_impact_map.py").write_text(
        "raise SystemExit('generation failed')\n"
    )
    output = tmp_path / "selection.json"

    result = select(repo, output, script=selector)

    assert result.returncode != 0
    assert "generation failed" in result.stderr
    assert not output.exists()


def test_local_plan_matches_ci_with_a_fresh_generated_artifact(repo, tmp_path):
    generated = tmp_path / "ci-generated.json"
    subprocess.run(
        [
            sys.executable,
            str(SCRIPTS / "generate_playwright_impact_map.py"),
            "--output",
            str(generated),
        ],
        cwd=repo,
        check=True,
        capture_output=True,
        text=True,
    )
    output = tmp_path / "ci-selection.json"
    result = select(repo, output, "--generated-impact-map", str(generated))
    assert result.returncode == 0, result.stderr

    planner = load_script("plan_local_playwright")
    plan = planner.build_plan(repo, [SOURCE])

    assert set(plan.specs) == selected_specs(output)
    assert set(plan.specs) == {SMOKE_SPEC, MANUAL_SPEC, WIDGET_SPEC}


def test_merge_group_selects_smoke_and_affected_tests(repo, tmp_path):
    output = tmp_path / "queue-selection.json"

    result = select(repo, output, event_name="merge_group")

    assert result.returncode == 0, result.stderr
    assert selected_specs(output) == {SMOKE_SPEC, MANUAL_SPEC, WIDGET_SPEC}


@pytest.mark.parametrize("shared", [False, True])
def test_merge_group_widens_unknown_or_shared_changes_to_full(repo, tmp_path, shared):
    source = str(UI_ROOT / "src/Unknown.tsx")
    if shared:
        hand = repo / ".github/playwright/impact-map.json"
        data = json.loads(hand.read_text())
        data["sharedInfrastructure"] = [source]
        hand.write_text(json.dumps(data))
    output = tmp_path / "queue-selection.json"

    result = select(repo, output, event_name="merge_group", changed_files=[source])

    assert result.returncode == 0, result.stderr
    plan = json.loads(output.read_text())
    assert plan["mode"] == "full"
    assert source in plan["changedFiles"]


def test_merge_group_without_a_candidate_diff_fails_planning(repo, tmp_path):
    output = tmp_path / "queue-selection.json"
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPTS / "select_playwright_tests.py"),
            "--event-name",
            "merge_group",
            "--impact-map",
            ".github/playwright/impact-map.json",
            "--output",
            str(output),
        ],
        cwd=repo,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert not output.exists()


@pytest.mark.parametrize("event", ["schedule", "push", "workflow_dispatch"])
def test_broad_events_keep_full_coverage(repo, tmp_path, event):
    output = tmp_path / "selection.json"
    result = select(repo, output, "--full-suite", "true", event_name=event)

    assert result.returncode == 0, result.stderr
    assert json.loads(output.read_text())["mode"] == "full"


def test_queue_workflow_plans_the_whole_candidate_diff(repo, tmp_path):
    scripts = repo / ".github/scripts"
    scripts.mkdir()
    for name in ("generate_playwright_impact_map.py", "select_playwright_tests.py"):
        shutil.copyfile(SCRIPTS / name, scripts / name)

    def git(*args):
        return subprocess.run(
            ["git", *args], cwd=repo, check=True, capture_output=True, text=True
        ).stdout.strip()

    git("init")
    git("config", "user.name", "Test")
    git("config", "user.email", "test@example.com")
    git("add", ".")
    git("commit", "-m", "base")
    base = git("rev-parse", "HEAD")

    other_source = str(UI_ROOT / "src/components/Other.tsx")
    other_spec = "playwright/e2e/Features/Other.spec.ts"
    (repo / other_source).write_text('<div data-testid="other" />\n')
    (repo / UI_ROOT / other_spec).write_text("page.getByTestId('other');\n")
    git("add", ".")
    git("commit", "-m", "first queued change")
    (repo / SOURCE).write_text('<div data-testid="widget">updated</div>\n')
    git("add", ".")
    git("commit", "-m", "last queued change")
    head = git("rev-parse", "HEAD")

    workflow = (SCRIPTS.parent / "workflows/playwright-e2e-reusable.yml").read_text()
    step = workflow.split("- name: Select PR coverage\n", 1)[1].split(
        "\n      - name:", 1
    )[0]
    run = textwrap.dedent(step.split("        run: |\n", 1)[1])
    run = run.replace("${{ github.event_name }}", "merge_group")
    run = run.replace("${{ inputs.full_suite }}", "true")
    result = subprocess.run(
        ["bash", "-e", "-c", run],
        cwd=repo,
        check=False,
        env={
            **os.environ,
            "PATH": str(Path(sys.executable).parent) + os.pathsep + os.environ["PATH"],
            "RUNNER_TEMP": str(tmp_path),
            "GITHUB_OUTPUT": str(tmp_path / "github-output"),
            "EVENT_NAME": "merge_group",
            "MERGE_BASE_SHA": base,
            "MERGE_HEAD_SHA": head,
            "ALL_FILES": SOURCE,
        },
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    output = tmp_path / "playwright-selection/selection.json"
    assert selected_specs(output) == {SMOKE_SPEC, MANUAL_SPEC, WIDGET_SPEC, other_spec}
    assert set(json.loads(output.read_text())["changedFiles"]) == {
        SOURCE,
        other_source,
        str(UI_ROOT / other_spec),
    }
