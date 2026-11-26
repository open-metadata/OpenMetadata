"""Guards against workflows that start a runner only to do nothing."""

from __future__ import annotations

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
WORKFLOWS = ROOT / ".github/workflows"


def load(name: str) -> dict:
    workflow = yaml.safe_load((WORKFLOWS / name).read_text())
    # PyYAML reads the bare `on:` key as boolean True.
    workflow["on"] = workflow.pop(True, workflow.get("on"))
    return workflow


def test_backport_automerge_only_takes_a_runner_for_backport_branches():
    job = load("backport-automerge.yaml")["jobs"]["automerge"]
    condition = " ".join(job.get("if", "").split())
    assert condition == (
        "github.event_name == 'workflow_dispatch' || "
        "startsWith(github.event.check_suite.head_branch, 'backport/')"
    )


def test_backport_automerge_keeps_its_provenance_gate():
    steps = load("backport-automerge.yaml")["jobs"]["automerge"]["steps"]
    assert steps[0]["name"] == "Find the backport PR"
    assert "backport/$BASE/pr-" in steps[0]["run"]


def test_merge_queue_ci_runs_only_on_merge_groups_and_manual_dispatch():
    assert set(load("ci-merge-queue.yml")["on"]) == {"merge_group", "workflow_dispatch"}


def test_data_access_request_e2e_requires_selection_or_explicit_main_dispatch():
    assert "data-access-request-e2e" not in load("ci-pr.yml")["jobs"]
    job = load("ci-merge-queue.yml")["jobs"]["data-access-request-e2e"]
    assert job["needs"] == "plan"
    assert " ".join(job["if"].split()) == (
        "needs.plan.outputs.dar == 'true' || "
        "(github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' "
        "&& (inputs.workload == 'all' || inputs.workload == 'data-access-request'))"
    )
