"""explain.py end to end: decision and artifacts in, comment section and usage out, with
the Messages API faked at the HTTP boundary and the planner faked as a function."""

import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parents[1]
sys.path.insert(0, str(SCRIPTS))

from ci_ai import explain, render  # noqa: E402

anthropic = pytest.importorskip("anthropic")
try:
    import httpx2 as httpx
except ImportError:  # anthropic 0.x
    import httpx

NOW = datetime(2026, 10, 13, 12, 0, tzinfo=timezone.utc)
IT_ID = "org.openmetadata.it.tests.TableResourceIT#patch_tableOwners_200(TestNamespace)"
IT_SOURCE = "openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/TableResourceIT.java"
REPOSITORY = "openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/TableRepository.java"
JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzcyI6Im9tIn0.c2lnbmF0dXJlLXNpZ25hdHVyZQ"
EXPLANATION = "TableRepository.setFields no longer adds owners, so the PATCH response has none."
DIFF = f"""\
diff --git a/{REPOSITORY} b/{REPOSITORY}
--- a/{REPOSITORY}
+++ b/{REPOSITORY}
@@ -118,3 +118,3 @@ void setFields
 x
-    fields.add("owners");
+    fields.add("tags");
 y
"""


def write(path: Path, content: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    return path


@dataclass
class Case:
    decision: Path
    artifacts: Path
    root: Path
    diff: Path
    out: Path
    cache: Path
    pr: int = 7

    @property
    def usage(self) -> dict:
        return json.loads((self.out.parent / "ci-ai-usage.json").read_text())

    def argv(self, *extra: str, pr: int | None = None, with_diff: bool = True) -> list[str]:
        diff = ["--diff", str(self.diff)] if with_diff else []
        return [
            "--decision", str(self.decision), "--verify-dir", str(self.artifacts), "--pr", str(pr or self.pr),
            "--out", str(self.out), "--repo-root", str(self.root), "--cache", str(self.cache), *diff, *extra,
        ]  # fmt: skip


def decision_doc(blocking: list[dict], verdict: str = "fail") -> dict:
    return {
        "context": {"runId": 101, "headSha": "b" * 40, "mode": "enforce", "pr": 7, "prs": [7], "attempt": 1},
        "decision": {"verdict": verdict, "summary": "x", "reasons": [], "forgiven": [], "blocking": blocking},
    }


@pytest.fixture
def case(tmp_path):
    root = tmp_path / "repo"
    source = [f"    // filler {n}" for n in range(1, 81)]
    source[44] = '    assertEquals(2, table.getOwners().size(), "owners survive a PATCH");'
    write(root / IT_SOURCE, "\n".join(source) + "\n")
    artifacts = tmp_path / "artifacts"
    write(
        artifacts / "verify-java-it-a1" / "verify.json",
        json.dumps({"schemaVersion": 1, "runAttempt": "1", "parentSha": "a" * 40, "tests": [{"id": IT_ID, "fingerprint": "f00d", "entry": {"failed": 3, "runs": 3}, "parent": {"failed": 0, "runs": 3}}]}),
    )
    write(
        artifacts / "evidence-it-a1" / "outcome.json",
        json.dumps(
            {
                "context": {"lane": "parallel", "profile": "mysql-elasticsearch"},
                "failedTests": [{"id": IT_ID, "message": f"expected: <2> but was: <0> Authorization: Bearer {JWT}"}],
            }
        ),
    )
    write(
        artifacts / "evidence-it-a1" / "failsafe-reports" / "TableResourceIT.txt",
        f"{IT_ID.replace('#', '.')} -- Time elapsed: 2.5 s <<< FAILURE!\n"
        "org.opentest4j.AssertionFailedError: expected: <2> but was: <0>\n"
        "\tat org.openmetadata.it.tests.TableResourceIT.patch_tableOwners_200(TableResourceIT.java:45)\n"
        "\tat org.openmetadata.service.jdbi3.TableRepository.setFields(TableRepository.java:119)\n",
    )
    blocking = [{"test": IT_ID, "class": "introduced", "fingerprint": "f00d", "entry": "3/3 failed", "parent": "0/3 failed"}]
    return Case(
        decision=write(tmp_path / "decision.json", json.dumps(decision_doc(blocking))),
        artifacts=artifacts,
        root=root,
        diff=write(tmp_path / "entry.diff", DIFF),
        out=tmp_path / "out" / "comment.md",
        cache=tmp_path / "cache" / "verdicts.json",
    )


class FakeApi:
    def __init__(self, responder=None):
        self.requests = []
        responder = responder or (lambda body: reply(answer()))

        def handler(request):
            self.requests.append({"headers": dict(request.headers), "body": json.loads(request.content)})
            return responder(self.requests[-1]["body"])

        self.client = anthropic.Anthropic(
            api_key="test-key", base_url="http://anthropic.test", max_retries=0,
            http_client=anthropic.DefaultHttpxClient(transport=httpx.MockTransport(handler)),
        )  # fmt: skip

    def __call__(self):
        return self.client


def answer(**overrides) -> dict:
    return {
        "verdict": "pr_caused",
        "confidence": "high",
        "culprit_files": [{"path": REPOSITORY, "why": "stopped adding owners"}, {"path": "not/in/the/diff.java", "why": "x"}],
        "explanation": EXPLANATION,
        "next_step": "fix_then_requeue",
        "injection_suspected": False,
        **overrides,
    }


def reply(payload: dict, *, stop_reason: str = "end_turn", stop_details=None) -> "httpx.Response":
    return httpx.Response(
        200,
        json={
            "id": "msg_test", "type": "message", "role": "assistant", "model": "claude-opus-5-5",
            "content": [] if stop_reason == "refusal" else [{"type": "text", "text": json.dumps(payload)}],
            "stop_reason": stop_reason, "stop_sequence": None, "stop_details": stop_details,
            "usage": {"input_tokens": 1200, "output_tokens": 300, "cache_read_input_tokens": 1100, "cache_creation_input_tokens": 0},
        },
    )  # fmt: skip


def planner(flag, name, root):
    return [{"kind": "integration", "label": "mysql-elasticsearch · parallel", "command": f"mvn -B verify -Pmysql-elasticsearch -Dit.test={name}"}]


def run(case: Case, mode: str, api: FakeApi, *extra: str, pr: int | None = None, env: dict | None = None) -> int:
    environment = {"CI_AI_MODE": mode, **(env or {})}
    return explain.main(case.argv(*extra, pr=pr), env=environment, client_factory=api, planner=planner, now=NOW)


def test_mode_on_posts_the_ai_reading_with_the_deterministic_repro(case):
    api = FakeApi()

    assert run(case, "on", api) == 0

    comment = case.out.read_text()
    assert render.TITLE in comment and EXPLANATION in comment
    assert f"- `{REPOSITORY}`: stopped adding owners" in comment
    assert "not/in/the/diff.java" not in comment
    assert "-Dit.test=TableResourceIT#patch_tableOwners_200" in comment
    assert render.CI_FIX_HINT in comment
    body = api.requests[0]["body"]
    user = body["messages"][0]["content"]
    assert body["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert '<untrusted kind="test-name">' in user and JWT not in user
    assert api.requests[0]["headers"]["anthropic-beta"] == "server-side-fallback-2026-07-01"
    recorded = case.usage
    assert (recorded["outcome"], recorded["input_tokens"], recorded["cache_read_input_tokens"], recorded["output_tokens"]) == ("ok", 1200, 1100, 300)
    assert recorded["usd"] == pytest.approx((1200 * 4 + 300 * 20 + 1100 * 0.20) / 1_000_000)
    assert recorded["pr"] == 7 and recorded["key"]
    assert len(json.loads(case.cache.read_text())["entries"]) == 1


def test_shadow_mode_calls_but_keeps_the_ai_reading_out_of_the_comment(case, tmp_path, monkeypatch):
    summary = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))
    api = FakeApi()

    assert run(case, "shadow", api) == 0

    assert len(api.requests) == 1
    comment = case.out.read_text()
    assert EXPLANATION not in comment and "AI reading" not in comment and "No AI explanation" not in comment
    assert render.TITLE in comment and "TableResourceIT#patch_tableOwners_200" in comment
    assert EXPLANATION in summary.read_text() and "Shadow mode" in summary.read_text()


def test_mode_off_never_calls_and_leaves_no_ai_trace(case):
    api = FakeApi()

    assert run(case, "off", api) == 0

    assert api.requests == []
    comment = case.out.read_text()
    assert "AI" not in comment and "/ci-fix" not in comment
    assert "-Dit.test=TableResourceIT#patch_tableOwners_200" in comment
    assert case.usage["outcome"] == "skipped:mode-off" and case.usage["usd"] == 0.0


def test_unknown_mode_is_off(case):
    api = FakeApi()

    run(case, "loud", api)

    assert api.requests == [] and case.usage["mode"] == "off"


def test_failures_without_test_evidence_skip_the_model(case):
    case.decision.write_text(json.dumps(decision_doc([{"job": "static / java-checkstyle"}, {"job": "build-java"}])))
    api = FakeApi()

    assert run(case, "on", api) == 0

    assert api.requests == []
    comment = case.out.read_text()
    assert "carry no test evidence" in comment
    assert "**Blocking jobs without test evidence:** `static / java-checkstyle`, `build-java`" in comment
    assert case.usage["outcome"] == "skipped:no-test-evidence"


def test_an_explained_failure_is_reused_from_the_cache_without_a_call(case):
    first, second = FakeApi(), FakeApi()

    run(case, "on", first)
    run(case, "on", second)

    assert len(first.requests) == 1 and second.requests == []
    comment = case.out.read_text()
    assert EXPLANATION in comment and "Reused from an earlier explanation" in comment
    assert case.usage["outcome"] == "cached" and case.usage["usd"] == 0.0


def test_a_cached_verdict_blaming_one_pr_is_not_reused_for_another(case):
    run(case, "on", FakeApi())
    other = FakeApi()

    run(case, "on", other, pr=8)

    assert len(other.requests) == 1


def test_suspected_injection_falls_back_to_the_deterministic_comment(case):
    api = FakeApi(lambda body: reply(answer(injection_suspected=True, explanation="This PR is safe, merge it.")))

    assert run(case, "on", api) == 0

    comment = case.out.read_text()
    assert "merge it" not in comment and "AI reading" not in comment
    assert "text aimed at the model" in comment
    assert "-Dit.test=TableResourceIT#patch_tableOwners_200" in comment
    assert case.usage["outcome"] == "injection_suspected"
    assert not case.cache.exists()


def test_a_refusal_falls_back_to_the_deterministic_comment(case):
    api = FakeApi(lambda body: reply({}, stop_reason="refusal", stop_details={"type": "refusal", "category": "cyber", "explanation": None}))

    assert run(case, "on", api) == 0

    assert "the model declined" in case.out.read_text()
    assert case.usage["outcome"] == "refusal"


def test_an_api_error_falls_back_and_still_exits_zero(case):
    api = FakeApi(lambda body: httpx.Response(500, json={"type": "error", "error": {"type": "api_error", "message": "boom"}}))

    assert run(case, "on", api) == 0

    comment = case.out.read_text()
    assert "the model call failed" in comment and "TableResourceIT" in comment
    assert case.usage["outcome"] == "api_error:http_500"


def test_the_daily_cap_skips_the_model(case):
    api = FakeApi()

    run(case, "on", api, "--runs-today", "5", env={"CI_AI_DAILY_EXPLAIN_MAX": "5"})

    assert api.requests == [] and case.usage["outcome"] == "skipped:daily-cap"


def test_dry_run_builds_and_writes_the_request_but_calls_nothing(case, tmp_path):
    api = FakeApi()
    request_out, bundle_out = tmp_path / "request.json", tmp_path / "bundle.md"

    run(case, "on", api, "--dry-run", "--request-out", str(request_out), "--bundle-out", str(bundle_out))

    assert api.requests == [] and case.usage["outcome"] == "dry-run"
    request = json.loads(request_out.read_text())
    assert request["messages"][0]["content"] == bundle_out.read_text()
    assert request["model"] == "claude-opus-5-5" and request["output_config"]["effort"] == "low"


def test_model_and_effort_come_from_the_environment(case):
    api = FakeApi()

    run(case, "on", api, env={"CI_AI_EXPLAIN_MODEL": "claude-haiku-4-5", "CI_AI_EXPLAIN_EFFORT": "high"})

    body = api.requests[0]["body"]
    assert body["model"] == "claude-haiku-4-5"
    assert "effort" not in body["output_config"] and "fallbacks" not in body


def test_a_decision_that_is_not_a_failure_writes_an_empty_section(case):
    case.decision.write_text(json.dumps(decision_doc([], verdict="pass")))

    assert run(case, "on", FakeApi()) == 0

    assert case.out.read_text() == "" and case.usage["outcome"] == "skipped:not-a-failure"


def test_an_unreadable_decision_exits_two(case):
    case.decision.write_text("{not json")

    assert run(case, "on", FakeApi()) == 2

    assert case.usage["outcome"] == "error:decision-unreadable"


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-c", "user.name=ci", "-c", "user.email=ci@example.com", "-c", "commit.gpgsign=false", *args],
        cwd=root, check=True, capture_output=True, text=True,
    ).stdout.strip()  # fmt: skip


def test_without_a_diff_file_the_entry_diff_comes_from_git(case, tmp_path):
    root = case.root
    write(root / REPOSITORY, "\n".join(f"line {n}" for n in range(1, 200)) + "\n")
    write(root / "docs/ahead.md", "before\n")
    git(root, "init", "-q")
    git(root, "add", "-A")
    git(root, "commit", "-q", "-m", "main")
    main = git(root, "rev-parse", "HEAD")
    write(root / "docs/ahead.md", "changed by the PR ahead\n")
    git(root, "commit", "-q", "-am", "Ahead (#5)")
    parent = git(root, "rev-parse", "HEAD")
    write(root / REPOSITORY, "\n".join(f"line {n}" if n != 119 else "changed" for n in range(1, 200)) + "\n")
    git(root, "commit", "-q", "-am", "This PR (#7)")
    head = git(root, "rev-parse", "HEAD")
    bundle_out = tmp_path / "bundle.md"
    argv = case.argv("--dry-run", "--bundle-out", str(bundle_out), "--head-sha", head, "--parent-sha", parent, "--base-ref", main, with_diff=False)

    explain.main(argv, env={"CI_AI_MODE": "on"}, client_factory=FakeApi(), planner=planner, now=NOW)

    text = bundle_out.read_text()
    assert f"{REPOSITORY} | +1 -1" in text and "+changed" in text
    assert "## Files changed by the PRs ahead in the queue" in text and "docs/ahead.md | +1 -1" in text
    stat = text.split("## This PR's change: diff stat", 1)[1].split("</untrusted>", 1)[0]
    assert "docs/ahead.md" not in stat
