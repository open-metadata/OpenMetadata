"""The summary check must pass — not fail — when no Playwright-relevant path changed."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).parents[3]
RENDERER = ROOT / ".github/scripts/render_playwright_summary.cjs"

NOT_REQUIRED = "no Playwright-relevant path changed"


def render(event_name: str, env: dict[str, str]) -> str:
    """Run the renderer with a stubbed Actions context and return its stdout."""
    context = {
        "eventName": event_name,
        "payload": {},
        "repo": {"owner": "open-metadata", "repo": "OpenMetadata"},
    }
    harness = f"""
const {{ renderPlaywrightSummary }} = require({json.dumps(str(RENDERER))});
const context = {json.dumps(context)};
const core = {{ setFailed: message => console.log('SET_FAILED: ' + message) }};
renderPlaywrightSummary({{ github: {{}}, context, core }})
  .catch(error => {{ console.log('THREW: ' + error.message); }});
"""
    result = subprocess.run(
        ["node", "-e", harness],
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "RUNNER_TEMP": "/tmp", **env},
    )
    assert result.returncode == 0, result.stderr
    return result.stdout


SKIPPED_PIPELINE = {
    "CHECK_CHANGES_RESULT": "success",
    "CACHE_KEYS_RESULT": "skipped",
    "BUILD_RESULT": "skipped",
    "DETECT_CHANGES_RESULT": "skipped",
    "PLAN_RESULT": "skipped",
    "PLAYWRIGHT_RESULT": "skipped",
}


def test_pull_request_without_relevant_paths_is_a_green_no_op():
    output = render("pull_request", {**SKIPPED_PIPELINE, "E2E_CHANGED": "false"})

    assert NOT_REQUIRED in output
    assert "SET_FAILED" not in output
    assert "unexpectedly skipped" not in output


def test_merge_queue_without_relevant_paths_is_a_green_no_op():
    output = render("merge_group", {**SKIPPED_PIPELINE, "E2E_CHANGED": "false"})

    assert NOT_REQUIRED in output
    assert "SET_FAILED" not in output


def test_pull_request_touching_relevant_paths_still_reports():
    output = render("pull_request", {**SKIPPED_PIPELINE, "E2E_CHANGED": "true"})

    assert NOT_REQUIRED not in output


def test_a_run_that_built_is_always_reported():
    # Safety valve: until the reusable workflow gates its jobs on the same
    # filter, a build still happens and its results must never be discarded on
    # the strength of the paths filter alone.
    output = render(
        "pull_request",
        {**SKIPPED_PIPELINE, "E2E_CHANGED": "false", "BUILD_RESULT": "success"},
    )

    assert NOT_REQUIRED not in output


def test_scheduled_runs_ignore_the_paths_filter():
    # schedule/dispatch never run the filter, so E2E_CHANGED is empty there and
    # must not be read as "nothing to do".
    output = render("schedule", {**SKIPPED_PIPELINE})

    assert NOT_REQUIRED not in output
