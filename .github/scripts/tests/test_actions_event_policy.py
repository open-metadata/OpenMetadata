"""Keep the administrator-applied event policy aligned with real workflow triggers."""

import json
from pathlib import Path

import pytest
import yaml


ROOT = Path(__file__).resolve().parents[3]
POLICY = ROOT / ".github/actions-policies/pull-request-target.json"


@pytest.fixture
def policy():
    return json.loads(POLICY.read_text())


@pytest.fixture
def target_workflows():
    workflows = {}
    for path in sorted((ROOT / ".github/workflows").iterdir()):
        if path.suffix not in {".yml", ".yaml"}:
            continue
        # BaseLoader preserves GitHub's `on` key instead of YAML 1.1's boolean True.
        definition = yaml.load(path.read_text(), Loader=yaml.BaseLoader)
        triggers = definition.get("on", {})
        if isinstance(triggers, str):
            triggers = [triggers]
        if "pull_request_target" in triggers:
            workflows[path.relative_to(ROOT).as_posix()] = set(triggers)
    assert workflows, (
        "No pull_request_target workflows found; review the policy's purpose"
    )
    return workflows


def test_policy_targets_existing_pull_request_target_workflows_only(
    policy, target_workflows
):
    paths = policy["conditions"]["workflow_path"]
    assert paths["exclude"] == []
    assert len(paths["include"]) == len(set(paths["include"]))
    assert set(paths["include"]) == set(target_workflows)


def test_policy_preserves_every_existing_trigger(policy, target_workflows):
    rules = policy["rules"]
    assert len(rules) == 1
    assert rules[0]["type"] == "restrict_action_events"
    events = rules[0]["parameters"]["allowed_events"]
    assert len(events) == len(set(events))
    assert set(events) == set().union(*target_workflows.values())


def test_policy_is_an_active_event_rule_without_actor_or_bypass_changes(policy):
    assert set(policy) == {"name", "enforcement", "conditions", "rules"}
    assert policy["name"]
    assert policy["enforcement"] == "active"
    assert set(policy["conditions"]) == {"workflow_path"}
    assert set(policy["rules"][0]) == {"type", "parameters"}
    assert set(policy["rules"][0]["parameters"]) == {"allowed_events"}
