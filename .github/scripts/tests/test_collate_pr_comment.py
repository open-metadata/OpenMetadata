# Copyright 2026 Collate
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import yaml


ROOT = Path(__file__).parents[3]
HELPER = ROOT / ".github/scripts/publish_collate_pr_comment.cjs"
WORKFLOW = ROOT / ".github/workflows/maven-build-collate.yml"
MARKER = "<!-- collate-ci-failure -->"
HEAD_SHA = "a" * 40


def run_helper(
    tmp_path: Path,
    *,
    outcome: str,
    log: str | None = None,
    comments: list[dict] | None = None,
) -> subprocess.CompletedProcess[str]:
    log_path = tmp_path / "collate.log"
    if log is not None:
        log_path.write_text(log, encoding="utf-8")

    harness = f"""
const publishCollatePrComment = require({json.dumps(str(HELPER))});
const comments = {json.dumps(comments or [])};
const operations = [];
const warnings = [];
const context = {{
  eventName: 'pull_request_target',
  payload: {{ pull_request: {{ number: 31087 }} }},
  repo: {{ owner: 'open-metadata', repo: 'OpenMetadata' }},
}};
const core = {{
  info: () => {{}},
  warning: (message) => warnings.push(message),
}};
const github = {{
  rest: {{
    issues: {{
      listComments: () => {{}},
      createComment: async (request) => operations.push({{ type: 'create', ...request }}),
      updateComment: async (request) => operations.push({{ type: 'update', ...request }}),
      deleteComment: async (request) => operations.push({{ type: 'delete', ...request }}),
    }},
  }},
  paginate: {{
    iterator: async function* () {{ yield {{ data: comments }}; }},
  }},
}};

(async () => {{
  try {{
    await publishCollatePrComment({{ github, context, core }});
    process.stdout.write(JSON.stringify({{ operations, warnings }}));
  }} catch (error) {{
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }}
}})();
"""
    env = os.environ.copy()
    env.update(
        {
            "COLLATE_DISPATCH_OUTCOME": outcome,
            "COLLATE_LOG_PATH": str(log_path),
            "COLLATE_RUN_URL": "https://github.com/open-metadata/openmetadata-collate/actions/runs/123456",
            "COLLATE_REF": "1.13",
            "OPENMETADATA_SHA": HEAD_SHA,
        }
    )
    return subprocess.run(
        ["node", "-e", harness],
        check=False,
        capture_output=True,
        env=env,
        text=True,
    )


def operation(result: subprocess.CompletedProcess[str]) -> dict:
    assert result.returncode == 0, result.stderr
    operations = json.loads(result.stdout)["operations"]
    assert len(operations) == 1
    return operations[0]


def test_compilation_failure_creates_sanitized_comment(tmp_path: Path):
    result = run_helper(
        tmp_path,
        outcome="failure",
        log=(
            "job\tBuild Collate with Maven\t2026-08-07T16:35:57Z "
            "[WARNING] Unused declared dependencies found:\n"
            "job\tBuild Collate with Maven\t2026-08-07T16:35:58Z "
            "\x1b[31m[ERROR] COMPILATION ERROR :\x1b[0m\n"
            "job\tBuild Collate with Maven\t2026-08-07T16:35:58Z "
            "##[error][ERROR] /home/runner/_work/openmetadata-collate/"
            "collate-service/src/HybridSearchService.java:[767,33] method buildQuery failed\n"
            "job\tBuild Collate with Maven\t2026-08-07T16:35:58Z "
            "required: float[],int,Map,double\n"
            "job\tBuild Collate with Maven\t2026-08-07T16:35:58Z "
            "found: float[],int,Map,double,SubjectContext\n"
            "job\tBuild Collate with Maven\t2026-08-07T16:35:58Z "
            "reason: actual and formal argument lists differ in length\n"
        ),
    )

    created = operation(result)
    assert created["type"] == "create"
    body = created["body"]
    assert MARKER in body
    assert "Collate compilation failed" in body
    assert "`1.13`" in body
    assert HEAD_SHA[:12] in body
    assert "actual and formal argument lists differ" in body
    assert "<workspace>/collate-service/src/HybridSearchService.java" in body
    assert "/home/runner" not in body
    assert "\x1b" not in body
    assert "[WARNING]" not in body


def test_test_failure_updates_existing_bot_comment(tmp_path: Path):
    result = run_helper(
        tmp_path,
        outcome="failure",
        log=(
            "job\tIntegration Tests (MySQL + Elasticsearch)\t"
            "2026-08-07T16:35:58Z [ERROR] Tests run: 42, Failures: 1, Errors: 0\n"
            "job\tIntegration Tests (MySQL + Elasticsearch)\t"
            "2026-08-07T16:35:58Z [ERROR] ExampleIT.testSearch <<< FAILURE!\n"
        ),
        comments=[
            {
                "id": 99,
                "body": f"{MARKER}\nold failure",
                "user": {"login": "github-actions[bot]"},
            }
        ],
    )

    updated = operation(result)
    assert updated["type"] == "update"
    assert updated["comment_id"] == 99
    assert "Collate integration tests failed" in updated["body"]
    assert "Tests run: 42, Failures: 1, Errors: 0" in updated["body"]


def test_human_comment_cannot_spoof_sticky_marker(tmp_path: Path):
    result = run_helper(
        tmp_path,
        outcome="failure",
        comments=[
            {
                "id": 77,
                "body": f"{MARKER}\nnot a bot comment",
                "user": {"login": "contributor"},
            }
        ],
    )

    created = operation(result)
    assert created["type"] == "create"
    assert "comment_id" not in created


def test_success_deletes_previous_bot_failure_comment(tmp_path: Path):
    result = run_helper(
        tmp_path,
        outcome="success",
        comments=[
            {
                "id": 101,
                "body": f"{MARKER}\nold failure",
                "user": {"login": "github-actions[bot]"},
            }
        ],
    )

    deleted = operation(result)
    assert deleted["type"] == "delete"
    assert deleted["comment_id"] == 101


def test_success_does_not_delete_spoofed_human_comment(tmp_path: Path):
    result = run_helper(
        tmp_path,
        outcome="success",
        comments=[
            {
                "id": 102,
                "body": f"{MARKER}\nnot a bot comment",
                "user": {"login": "contributor"},
            }
        ],
    )

    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["operations"] == []


def test_missing_log_uses_bounded_generic_fallback(tmp_path: Path):
    result = run_helper(tmp_path, outcome="failure")

    created = operation(result)
    body = created["body"]
    assert "Collate workflow failed or could not be completed" in body
    assert "Sanitized failure excerpt" not in body
    assert len(body) < 4_000


def test_failure_excerpt_is_bounded(tmp_path: Path):
    repeated_error = "[ERROR] Failed to execute goal " + ("x" * 500) + "\n"
    result = run_helper(
        tmp_path,
        outcome="failure",
        log=repeated_error * 100,
    )

    created = operation(result)
    assert len(created["body"]) < 4_000


def test_workflow_aligns_refs_reports_failure_and_propagates_result():
    workflow = yaml.load(WORKFLOW.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    job = workflow["jobs"]["maven-collate-ci"]
    steps = job["steps"]
    steps_by_id = {step["id"]: step for step in steps if "id" in step}
    steps_by_name = {step["name"]: step for step in steps}

    assert workflow["permissions"]["pull-requests"] == "write"
    assert (
        job["env"]["COLLATE_REF"]
        == "${{ github.event_name == 'pull_request_target' && github.event.pull_request.base.ref || github.ref_name }}"
    )

    checkout = steps_by_name["Checkout trusted workflow helpers"]
    assert (
        checkout["with"]["ref"]
        == "${{ github.event_name == 'pull_request_target' && github.event.pull_request.base.sha || github.sha }}"
    )
    assert checkout["with"]["persist-credentials"] == "false"
    assert (
        ".github/scripts/publish_collate_pr_comment.cjs"
        in checkout["with"]["sparse-checkout"]
    )

    dispatch = steps_by_id["collate-dispatch"]
    assert dispatch["continue-on-error"] == "true"
    assert dispatch["with"]["ref"] == "${{ env.COLLATE_REF }}"
    assert "github.event.pull_request.head.sha" in dispatch["env"]["SHA"]

    collect = steps_by_name["Collect Collate failure diagnostics"]
    assert "steps.collate-dispatch.outcome != 'success'" in collect["if"]
    assert collect["env"]["GH_TOKEN"] == "${{ secrets.COLLATE_PAT }}"
    assert (
        collect["env"]["COLLATE_RUN_ID"]
        == "${{ steps.collate-dispatch.outputs.runId }}"
    )

    report = steps_by_name["Report Collate result on pull request"]
    assert report["continue-on-error"] == "true"
    assert "always()" in report["if"]
    assert report["with"]["github-token"] == "${{ secrets.GITHUB_TOKEN }}"
    assert "publish_collate_pr_comment.cjs" in report["with"]["script"]

    propagate = steps_by_name["Propagate Collate result"]
    assert "steps.collate-dispatch.outcome != 'success'" in propagate["if"]
    assert propagate["run"] == "exit 1"
