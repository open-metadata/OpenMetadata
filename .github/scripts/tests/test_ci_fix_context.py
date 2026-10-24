"""The fix agent's starting evidence: redacted, capped, with commands that match CI."""

import importlib.util
import json
import sys
from pathlib import Path

SCRIPTS = Path(__file__).parents[1]
sys.path.insert(0, str(SCRIPTS))


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


mq = load_script("merge_queue_metrics")
load_script("playwright_flaky_report")
gate = load_script("merge_gate_policy")
evidence = load_script("merge_gate_evidence")
load_script("verify_failures")
ctx = load_script("ci_fix_context")


def test_secrets_and_invisible_characters_are_removed():
    text = "token ghp_" + "a" * 30 + " and sk-ant-api03-XYZXYZXYZXYZ and Bearer abcdefghijklmnopqrstuvwxyz‮"
    cleaned = ctx.clean(text)
    assert "ghp_" not in cleaned and "sk-ant-" not in cleaned and "abcdefghijklmnop" not in cleaned
    assert "‮" not in cleaned


def test_repro_commands_match_what_ci_runs():
    java = ctx.repro("org.x.TableResourceIT#test_a(TestNamespace)", {"profile": "postgres-opensearch", "lane": "parallel"})
    assert "-Ppostgres-opensearch" in java and "-Dit.test=org.x.TableResourceIT#test_a" in java
    pw = ctx.repro("chromium :: Pages/Glossary.spec.ts :: Glossary › term colors", None)
    assert "--project=chromium" in pw and '"term colors"' in pw


def test_pr_context_lists_failing_tests_with_their_verification(monkeypatch):
    run = {"id": 7, "html_url": "https://github.com/o/r/actions/runs/7", "run_attempt": 1, "head_branch": "gh-readonly-queue/main/pr-42-" + "a" * 40}
    monkeypatch.setattr(ctx, "latest_failed_queue_run", lambda o, r, pr, t: run)
    monkeypatch.setattr(
        evidence,
        "run_evidence",
        lambda o, r, run, attempt, t: (
            [gate.FailedJob(name="it / mysql-elasticsearch / parallel", conclusion="failure", failed_step="Run integration tests", reason="exit 1", failing_tests=("org.x.AIT#t",))],
            [gate.VerifiedTest("org.x.AIT#t", "fp", 3, 3, 0, 3)],
            {"org.x.AIT#t": "fp"},
        ),
    )
    text = ctx.pr_context("o", "r", 42, "t")
    assert "Verification: introduced (entry 3/3 failed, parent 0/3 failed)" in text
    assert "-Pmysql-elasticsearch" in text and "-DintegrationTests.lane=parallel" in text
    assert '<untrusted kind="log">' in text


def test_issue_context_reads_the_registry_block(monkeypatch):
    body = 'Flaky.\n```json\n' + json.dumps({"testId": "org.x.AIT#t", "fingerprint": "fp1", "occurrences": [{"message": "timeout"}]}) + "\n```"
    monkeypatch.setattr(mq, "rest", lambda path, token: {"title": "Flaky: org.x.AIT#t", "body": body})
    text = ctx.issue_context("o", "r", 9, "t")
    assert "org.x.AIT#t" in text and "fp1" in text and "timeout" in text
