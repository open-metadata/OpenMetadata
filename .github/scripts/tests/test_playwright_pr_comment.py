from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).parents[3]
HELPER = ROOT / ".github/scripts/publish_playwright_pr_comment.cjs"
WORKFLOW = ROOT / ".github/workflows/playwright-postgresql-pr-comment.yml"
SOURCE_SHA = "a" * 40


def test_comment_workflow_uses_a_small_trusted_helper_wrapper():
    workflow = WORKFLOW.read_text(encoding="utf-8")
    script = workflow.split("          script: |\n", 1)[1]

    assert len(script) < 21_000
    assert "ref: ${{ github.event.repository.default_branch }}" in workflow
    assert "persist-credentials: false" in workflow
    assert (
        "require('./.github/scripts/publish_playwright_pr_comment.cjs')" in script
    )


def render_comment(tmp_path: Path, payload: dict) -> subprocess.CompletedProcess[str]:
    payload_path = tmp_path / "summary.json"
    payload_path.write_text(json.dumps(payload), encoding="utf-8")
    harness = f"""
const publishPlaywrightPrComment = require({json.dumps(str(HELPER))});
const sourceSha = {json.dumps(SOURCE_SHA)};
let capturedBody = null;
const pull = {{
  number: 30310,
  state: 'open',
  head: {{ sha: sourceSha }},
  base: {{ repo: {{ id: 1, full_name: 'open-metadata/OpenMetadata' }} }},
}};
const context = {{
  payload: {{
    workflow_run: {{
      id: 123456,
      run_attempt: 1,
      event: 'pull_request',
      conclusion: 'success',
      head_sha: sourceSha,
      repository: {{ id: 1 }},
      pull_requests: [{{ number: pull.number, base: {{ repo: {{ id: 1 }} }} }}],
    }},
  }},
  repo: {{ owner: 'open-metadata', repo: 'OpenMetadata' }},
}};
const core = {{
  info: () => {{}},
  notice: () => {{}},
  warning: () => {{}},
}};
const github = {{
  rest: {{
    pulls: {{ get: async () => ({{ data: pull }}) }},
    repos: {{ listPullRequestsAssociatedWithCommit: async () => ({{ data: [pull] }}) }},
    issues: {{
      listComments: () => {{}},
      createComment: async (request) => {{ capturedBody = request.body; }},
      updateComment: async (request) => {{ capturedBody = request.body; }},
    }},
  }},
  paginate: {{
    iterator: async function* () {{
      yield {{ data: [] }};
    }},
  }},
}};

(async () => {{
  try {{
    await publishPlaywrightPrComment({{ github, context, core }});
    process.stdout.write(JSON.stringify({{ body: capturedBody }}));
  }} catch (error) {{
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }}
}})();
"""
    env = os.environ.copy()
    env["COMMENT_PAYLOAD_PATH"] = str(payload_path)
    return subprocess.run(
        ["node", "-e", harness],
        check=False,
        capture_output=True,
        env=env,
        text=True,
    )


def legacy_payload() -> dict:
    return {
        "version": 1,
        "totals": {"passed": 1, "failed": 0, "flaky": 0, "skipped": 0},
        "shards": [
            {
                "id": "chromium-01",
                "expected": True,
                "present": True,
                "passed": 1,
                "failed": 0,
                "flaky": 0,
                "skipped": 0,
            }
        ],
        "infrastructureIssueCount": 0,
        "infrastructureIssues": [],
        "failures": [],
        "flakyTests": [],
    }


def current_payload() -> dict:
    return {
        "version": 2,
        "totals": {
            "passed": 10,
            "failed": 0,
            "flaky": 1,
            "skipped": 2,
            "zeroAttemptSkipped": 1,
            "lifecycleFlaky": 1,
        },
        "shards": [
            {
                "id": "chromium-01",
                "expected": True,
                "present": True,
                "passed": 10,
                "failed": 0,
                "flaky": 1,
                "skipped": 2,
                "lifecycleFailed": 0,
                "lifecycleFlaky": 1,
            }
        ],
        "infrastructureIssueCount": 0,
        "infrastructureIssues": [],
        "failures": [],
        "flakyTests": [
            {
                "shard": "chromium-01",
                "file": "playwright/e2e/example.spec.ts",
                "title": "product retry",
                "retries": 1,
            }
        ],
        "lifecycleFlakyTests": [
            {
                "shard": "chromium-01",
                "file": "playwright/e2e/auth.setup.ts",
                "title": "authenticate",
                "retries": 1,
            }
        ],
        "performance": {
            "blockingTargetsMet": True,
            "convergenceTargetsMet": False,
            "metrics": {
                "maxEnvironmentSeconds": 181,
                "maxExecutionSeconds": 1200,
                "maxElapsedBeforeUploadSeconds": 1500,
                "reportingSeconds": 27,
                "workflowWallSeconds": 3600,
                "requestsPerAttempt": 220.12,
                "appBootsPerUIScenario": 2.28,
                "commonShardSkewPercent": 32.06,
            },
            "convergenceWarnings": [
                "Requests per attempt are 220.12; target is below 200."
            ],
        },
    }


def test_legacy_v1_payload_still_publishes(tmp_path: Path):
    result = render_comment(tmp_path, legacy_payload())

    assert result.returncode == 0, result.stderr
    body = json.loads(result.stdout)["body"]
    assert "✅ 1 passed" in body
    assert "Lifecycle failed" not in body
    assert "### Performance" not in body


def test_v2_payload_renders_lifecycle_and_performance_details(tmp_path: Path):
    result = render_comment(tmp_path, current_payload())

    assert result.returncode == 0, result.stderr
    body = json.loads(result.stdout)["body"]
    assert "2 skipped (1 zero-attempt; reason unknown)" in body
    assert "🧰 1 lifecycle flaky" in body
    assert "Lifecycle failed | Lifecycle flaky" in body
    assert "### Performance" in body
    assert "max shard execution 20m 0s" in body
    assert "max shard-job elapsed before upload 25m 0s" in body
    assert "not the full workflow wall time" in body
    assert "Full workflow signal wall (to summary) 1h 0m 0s" in body
    assert "220.12 requests/attempt" in body
    assert "2.28 app boots/UI scenario" in body
    assert "32.06% common-shard skew" in body
    assert "Optimization targets still in progress:" in body
    assert "flaky lifecycle test(s)" in body


def test_v2_payload_without_performance_metrics_still_publishes(tmp_path: Path):
    payload = current_payload()
    payload["performance"] = None

    result = render_comment(tmp_path, payload)

    assert result.returncode == 0, result.stderr
    body = json.loads(result.stdout)["body"]
    assert "Performance metrics unavailable" in body


def test_v1_rejects_unversioned_extended_fields(tmp_path: Path):
    payload = current_payload()
    payload["version"] = 1

    result = render_comment(tmp_path, payload)

    assert result.returncode != 0
    assert "payload must contain exactly" in result.stderr


def test_v2_rejects_inconsistent_lifecycle_total(tmp_path: Path):
    payload = current_payload()
    payload["totals"]["lifecycleFlaky"] = 2

    result = render_comment(tmp_path, payload)

    assert result.returncode != 0
    assert "sum of shard lifecycleFlaky counts" in result.stderr
