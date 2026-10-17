"""Queue conflicts: which PRs go back in the queue unchanged, and which the resolver attempts."""

import importlib.util
import json
import sys
from datetime import timedelta
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
qc = load_script("queue_conflicts")


def pr(number=1, mergeable="MERGEABLE", queued=False, draft=False, adds=0, head="abc", fork=False, editable=True, comments=()):
    now = mq.utcnow()
    return {
        "id": f"PR_{number}",
        "number": number,
        "headRefOid": head,
        "isDraft": draft,
        "mergeable": mergeable,
        "isCrossRepository": fork,
        "maintainerCanModify": editable,
        "mergeQueueEntry": {"id": "Q"} if queued else None,
        "adds": {"nodes": [{"createdAt": (now - timedelta(hours=1)).isoformat()} for _ in range(adds)]},
        "comments": {"nodes": [{"body": c} for c in comments]},
    }


@pytest.mark.parametrize(
    ("node", "expected"),
    [
        (pr(), True),
        (pr(queued=True), False),
        (pr(draft=True), False),
        (pr(mergeable="CONFLICTING"), False),
        (pr(mergeable="UNKNOWN"), False),
        (pr(adds=3), False),
        (pr(adds=2), True),
    ],
)
def test_queue_conflicts_requeue_only_when_clean_and_under_the_daily_cap(node, expected):
    assert qc.requeue_decision(node)[0] is expected


def test_resolver_candidates_skip_attempted_heads_and_uneditable_forks():
    assert qc.candidate_decision(pr(mergeable="CONFLICTING"))[0] is True
    assert qc.candidate_decision(pr(mergeable="MERGEABLE"))[0] is False
    assert qc.candidate_decision(pr(mergeable="CONFLICTING", fork=True, editable=False))[0] is False
    tried = pr(mergeable="CONFLICTING", comments=[f"{qc.ATTEMPT_MARKER} abc -->"])
    assert qc.candidate_decision(tried)[0] is False
    new_head = pr(mergeable="CONFLICTING", head="def", comments=[f"{qc.ATTEMPT_MARKER} abc -->"])
    assert qc.candidate_decision(new_head)[0] is True


def test_requeue_only_mutates_in_on_mode(monkeypatch, capsys):
    calls = []

    def graphql(query, variables, token):
        calls.append(query)
        if "search" in query:
            return {"search": {"nodes": [pr(1), pr(2, mergeable="CONFLICTING")]}}
        return {"enqueuePullRequest": {"mergeQueueEntry": {"id": "Q"}}}

    monkeypatch.setattr(mq, "graphql", graphql)
    monkeypatch.setenv("GH_TOKEN", "t")
    assert qc.main(["--mode", "dry-run", "requeue"]) == 0
    assert not any("enqueuePullRequest" in c for c in calls)
    report = json.loads(capsys.readouterr().out)
    assert [(r["pr"], r["requeue"]) for r in report] == [(1, True), (2, False)]

    assert qc.main(["--mode", "on", "requeue"]) == 0
    assert sum("enqueuePullRequest" in c for c in calls) == 1
