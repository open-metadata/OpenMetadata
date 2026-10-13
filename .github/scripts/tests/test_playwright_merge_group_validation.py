"""Merge-queue validation: the inline gate, shard coverage, and the retry policy."""

import json
import os
import subprocess
from pathlib import Path

import pytest
import yaml

WORKFLOWS = Path(__file__).parents[2] / "workflows"


def workflow(name):
    return yaml.safe_load((WORKFLOWS / name).read_text())


def summary_step(name):
    steps = workflow("playwright-postgresql-e2e.yml")["jobs"]["playwright-summary"][
        "steps"
    ]
    return next(step for step in steps if step["name"] == name)


def shard_steps():
    return workflow("playwright-e2e-reusable.yml")["jobs"]["playwright-ci"]["steps"]


@pytest.mark.parametrize(
    "overrides,passes",
    [
        ({}, True),
        ({"SHARD_RESULT": "failure"}, False),
        ({"SHARD_RESULT": "cancelled"}, False),
        ({"SHARD_RESULT": "skipped"}, False),
        ({"SHARD_RESULT": ""}, False),
        ({"GATE_RESULT": "failure"}, False),
        ({"SHOULD_RUN": "false"}, False),
        ({"PLAN_RESULT": "failure"}, False),
        ({"EXPECTED_MATRIX": '{"include": []}'}, False),
        ({"EXPECTED_MATRIX": '{"include": [{"shardId": ""}]}'}, False),
        (
            {"EXPECTED_MATRIX": '{"include": [{"shardId": "a"}, {"shardId": "a"}]}'},
            False,
        ),
        ({"EXPECTED_MATRIX": "{broken"}, False),
    ],
)
def test_queue_gate_requires_every_upstream_job(tmp_path, overrides, passes):
    gate = summary_step("Gate verified merge-group shards")
    assert gate["if"] == "${{ github.event_name == 'merge_group' }}"
    env = {
        **os.environ,
        "GATE_RESULT": "success",
        "SHOULD_RUN": "true",
        "PLAN_RESULT": "success",
        "SHARD_RESULT": "success",
        "EXPECTED_MATRIX": json.dumps({"include": [{"shardId": "chromium-01"}]}),
        **overrides,
    }
    result = subprocess.run(
        ["bash", "-e", "-c", gate["run"]],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert (result.returncode == 0) is passes, result.stderr
    assert list(tmp_path.iterdir()) == []


def test_queue_shards_enforce_coverage_but_allow_one_retry():
    coverage = next(step for step in shard_steps() if step.get("id") == "verify-shard-coverage")
    assert "github.event_name == 'merge_group'" in coverage["if"]
    assert not coverage.get("continue-on-error", False)
    assert '"$(git rev-parse HEAD)" != "$GITHUB_SHA"' in coverage["run"]
    assert "--require-native-evidence" in coverage["run"]
    # The queue keeps one retry for now (#32833), so a retry pass must not fail
    # coverage. Tightening the queue to zero retries adds this flag back.
    assert "--require-single-attempt" not in coverage["run"]


def test_retry_policy_is_one_everywhere_during_the_flake_week():
    caller = workflow("playwright-postgresql-e2e.yml")
    assert caller["jobs"]["playwright"]["with"]["retries"] == 1
    # The flip to zero PR retries is documented next to the value, so it is a
    # deliberate one-line change once main-health reports main is clean.
    text = (WORKFLOWS / "playwright-postgresql-e2e.yml").read_text()
    assert '"pull_request","pull_request_target"' in text


def test_main_health_alerts_and_keeps_the_flake_baseline_off_main():
    caller = workflow("playwright-postgresql-e2e.yml")
    job = caller["jobs"]["main-health"]
    assert "github.ref == 'refs/heads/main'" in job["if"]
    assert "merge_group" not in job["if"]
    assert job["env"]["DATA_BRANCH"] == "ci/playwright-timing"
    script = "\n".join(step.get("run", "") for step in job["steps"])
    assert "HEAD:main" not in script
    assert "refresh_flake_baseline.py" in script
    assert "--threshold 2" in script and "--window 10" in script
    slack = next(step for step in job["steps"] if step["name"] == "Build the Slack message")
    # Anything but a clean pass alerts: flaky passes included.
    assert "classification != 'passed'" in slack["if"]
    # Everything from main goes to #pw-health; #ci-cleanup is queue-only.
    assert "C0C008ZAK0V" in slack["run"]
    assert "C0AC5T013V1" not in slack["run"]


def test_merge_queue_failures_alert_ci_cleanup_only_through_the_dequeue_report():
    # A failed run does not always dequeue its PR: when an entry ahead leaves,
    # GitHub rebuilds the group and lets the old run finish. So the summary only
    # annotates its failed tests, and the dequeue report, which fires on a real
    # dequeue, folds them into the one #ci-cleanup alert.
    job = workflow("playwright-postgresql-e2e.yml")["jobs"]["playwright-summary"]
    assert "C0AC5T013V1" not in json.dumps(job)
    steps = job["steps"]
    download = next(s for s in steps if s["name"] == "Download failed merge-queue shard results")
    # Artifacts belong to the run, so an unscoped pattern would report tests
    # that failed only in an earlier attempt of a re-run.
    assert download["with"]["pattern"] == "playwright-results-json-*-a${{ github.run_attempt }}*"
    annotate = next(s for s in steps if s["name"] == "Annotate the failed merge-queue tests")
    assert annotate["if"] == "${{ failure() && github.event_name == 'merge_group' }}"
    # Queue runs never check out code in the summary job, so it must not run
    # repository scripts.
    assert ".github/scripts" not in annotate["run"]
    assert 'select(.status == "unexpected")' in annotate["run"]
    assert "::error title=Merge queue failed tests::" in annotate["run"]

    dequeue = workflow("merge-queue-dequeue-report.yml")
    assert dequeue[True]["pull_request_target"]["types"] == ["dequeued"]
    report = json.dumps(dequeue["jobs"]["report"])
    assert "C0AC5T013V1" in report
    assert "check_name=playwright-summary" in report
    assert 'select(.title == \\"Merge queue failed tests\\")' in report


def test_pr_summary_reads_the_flake_baseline_report_only():
    step = summary_step("Evaluate zero-retry gate in shadow mode")
    assert "flake-baseline.json" in step["run"]
    assert "--retry-baseline" in step["run"]
    assert "--enforce" not in step["run"]

def test_shard_status_records_execution_identity():
    status = next(
        step for step in shard_steps() if step["name"] == "Record shard execution status"
    )
    for field in ("headSha", "runId", "runAttempt"):
        assert f"{field}: ${field}" in status["run"]


TRACE_REPORT_STEPS = {
    "Checkout",
    "Download blob reports",
    "Setup Node.js",
    "Restore yarn package cache",
    "Install report dependencies",
    "Merge HTML report",
    # Reporting only: lists retry passes from the merged report the step above
    # already writes, so the queue keeps a per-run flaky record.
    "List flaky tests",
    "Upload flaky tests",
    "Upload merged Playwright report",
}


def test_merge_groups_upload_only_the_trace_report():
    steps = workflow("playwright-postgresql-e2e.yml")["jobs"]["playwright-summary"][
        "steps"
    ]
    for step in steps:
        condition = step.get("if", "")
        if step["name"] in TRACE_REPORT_STEPS:
            assert "merge_group" not in condition, step["name"]
            assert "always()" in condition, step["name"]
            continue
        if step["name"] == "Gate verified merge-group shards":
            continue
        if "github.event_name == 'merge_group'" in condition:
            continue  # queue-only Slack alerts: inline
        if "github.event_name == 'pull_request'" in condition:
            continue  # PR-only: never runs in the queue
        assert "github.event_name != 'merge_group'" in condition, step["name"]
    # Traces ship on every queue run so retry passes stay debuggable; the other
    # uploads still leave evidence only when the shard failed or was cancelled.
    for step in shard_steps():
        if not step.get("uses", "").startswith("actions/upload-artifact"):
            continue
        condition = step["if"]
        if step["name"] == "Upload Playwright blob report":
            assert condition == "always()"
            continue
        if "github.event_name != 'merge_group'" in condition:
            continue
        assert "failure()" in condition, step["name"]


def test_baseline_refresh_writes_the_data_branch_from_full_runs_on_main():
    caller = workflow("playwright-postgresql-e2e.yml")
    assert caller[True]["schedule"], "a scheduled full run must feed the baseline"
    refresh = caller["jobs"]["refresh-timing-baseline"]
    assert "github.event_name == 'schedule'" in refresh["if"]
    assert "github.event_name == 'workflow_dispatch'" in refresh["if"]
    assert "github.ref == 'refs/heads/main'" in refresh["if"]
    assert "merge_group" not in refresh["if"]
    script = "\n".join(step.get("run", "") for step in refresh["steps"])
    # main is merge-queue only: a direct push there is rejected (GH013) and
    # would reset in-flight queue entries.
    assert "HEAD:main" not in script
    [push] = [step for step in refresh["steps"] if "DATA_BRANCH" in step.get("env", {})]
    assert push["env"]["DATA_BRANCH"] == "ci/playwright-timing"
    assert 'HEAD:refs/heads/$DATA_BRANCH' in push["run"]


def test_planning_reads_the_data_branch_baseline():
    steps = workflow("playwright-e2e-reusable.yml")["jobs"]["plan-playwright"]["steps"]
    names = [step["name"] for step in steps]
    fetch = names.index("Fetch auto-refreshed timing baseline")
    assert fetch < names.index("Build duration-aware shard plans")
    step = steps[fetch]
    assert step.get("continue-on-error") is True
    assert "ci/playwright-timing" in step["run"]
    # The planner's history loop only picks up files with this name.
    assert "playwright-timing-history.json" in step["run"]


def test_queue_retry_report_lists_only_retry_passes(tmp_path):
    coverage = next(step for step in shard_steps() if step.get("id") == "verify-shard-coverage")
    report_part = coverage["run"][coverage["run"].index('results="$GITHUB_WORKSPACE'):]
    output = tmp_path / "openmetadata-ui/src/main/resources/ui/playwright/output"
    output.mkdir(parents=True)

    def spec(title, status, attempts):
        return {
            "title": title,
            "file": "Features/Sample.spec.ts",
            "line": 1,
            "tests": [{"status": status, "results": [{"status": s} for s in attempts]}],
        }

    (output / "results.json").write_text(
        json.dumps(
            {
                "suites": [
                    {
                        "specs": [
                            spec("first attempt", "expected", ["passed"]),
                            spec("retry pass", "flaky", ["failed", "passed"]),
                            spec("real failure", "unexpected", ["failed", "failed"]),
                        ]
                    }
                ]
            }
        )
    )
    summary = tmp_path / "summary.md"
    summary.touch()
    result = subprocess.run(
        ["bash", "-e", "-c", report_part],
        env={
            **os.environ,
            "GITHUB_WORKSPACE": str(tmp_path),
            "GITHUB_STEP_SUMMARY": str(summary),
            "SHARD_ID": "chromium-01",
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "retry pass" in summary.read_text()
    assert "real failure" not in summary.read_text()
    assert result.stdout.count("::warning") == 1


def test_merge_queue_flaky_tests_alert_pw_health_from_annotations():
    steps = workflow("playwright-postgresql-e2e.yml")["jobs"]["playwright-summary"][
        "steps"
    ]
    build = next(s for s in steps if s.get("id") == "queue-flaky")
    assert "github.event_name == 'merge_group'" in build["if"]
    assert "failure()" not in build["if"], "flakes are reported on green queue runs too"
    assert "C0C008ZAK0V" in build["run"]  # #pw-health
    # Reads what the shards already emit instead of uploading reports.
    assert '"Retry pass in merge queue"' in build["run"]
    assert ".github/scripts" not in build["run"]
    shard_warning = next(
        s for s in shard_steps() if s.get("id") == "verify-shard-coverage"
    )["run"]
    assert "::warning title=Retry pass in merge queue::" in shard_warning
    permissions = workflow("playwright-postgresql-e2e.yml")["jobs"]["playwright-summary"][
        "permissions"
    ]
    assert permissions.get("checks") == "read"


def test_daily_report_reads_queue_results_and_posts_with_a_fallback():
    daily = workflow("playwright-flaky-daily-report.yml")
    assert daily["permissions"] == {"actions": "read", "checks": "read", "contents": "read"}
    steps = daily["jobs"]["report"]["steps"]
    post = next(s for s in steps if s["name"].startswith("Post to Slack"))
    # An absent input compares equal to false, so the schedule is named explicitly.
    assert post["if"] == "${{ github.event_name == 'schedule' || inputs.post_to_slack }}"
    # A failed HTML upload must not end the job before the text fallback posts.
    assert post.get("continue-on-error") is True
    fallback = next(s for s in steps if s["name"].startswith("Post a text fallback"))
    assert fallback["if"] == "${{ steps.post.outcome == 'failure' }}"
    assert fallback["with"]["method"] == "chat.postMessage"
    assert fallback["with"]["payload-file-path"].endswith("/slack-fallback.json")
    # The fallback message tells readers which artifact to download.
    upload = next(s for s in steps if s["name"] == "Upload the report")
    assert upload["with"]["name"] == "playwright-flaky-report"
    assert steps.index(upload) < steps.index(post)


def test_shard_reports_every_retry_pass_in_one_annotation(tmp_path):
    # GitHub keeps only 10 warning annotations per step; one per test would
    # silently drop the rest before the queue's #pw-health alert reads them.
    coverage = next(step for step in shard_steps() if step.get("id") == "verify-shard-coverage")
    report_part = coverage["run"][coverage["run"].index('results="$GITHUB_WORKSPACE'):]
    output = tmp_path / "openmetadata-ui/src/main/resources/ui/playwright/output"
    output.mkdir(parents=True)
    titles = [f"flaky {index:02d}" for index in range(12)] + ["50% done"]
    specs = [
        {"title": title, "file": "Pages/X.spec.ts", "line": 1,
         "tests": [{"status": "flaky", "results": [{}, {}]}]}
        for title in titles
    ]
    (output / "results.json").write_text(json.dumps({"suites": [{"specs": specs}]}))
    summary = tmp_path / "summary.md"
    summary.touch()
    result = subprocess.run(
        ["bash", "-e", "-c", report_part],
        env={**os.environ, "GITHUB_WORKSPACE": str(tmp_path),
             "GITHUB_STEP_SUMMARY": str(summary), "SHARD_ID": "chromium-01"},
        capture_output=True, text=True, check=False,
    )
    assert result.returncode == 0, result.stderr
    [warning] = [line for line in result.stdout.splitlines() if line.startswith("::warning")]
    message = warning.split("::", 2)[2].replace("%0A", "\n").replace("%25", "%")
    assert sorted(line.split(" › ")[1] for line in message.splitlines()) == sorted(titles)


def test_only_the_safe_to_test_label_reruns_the_pr_pipeline():
    caller = workflow("playwright-postgresql-e2e.yml")
    assert "labeled" in caller[True]["pull_request"]["types"]
    safe = "github.event.label.name == 'safe to test'"
    playwright = caller["jobs"]["playwright"]
    summary = caller["jobs"]["playwright-summary"]
    # Other labels never call the reusable, so they cannot touch its
    # concurrency group or cancel an in-flight run for the PR.
    assert "github.event.action != 'labeled'" in playwright["if"] and safe in playwright["if"]
    assert "github.event.action != 'labeled'" in summary["if"] and safe in summary["if"]
    # ...and their skipped summary must not report under the required name.
    assert "'playwright-summary (ignored label event)'" in summary["name"]
    reusable = workflow("playwright-e2e-reusable.yml")
    assert "github.event.action != 'labeled'" in reusable["concurrency"]["cancel-in-progress"]
    gate = reusable["jobs"]["gate"]["steps"][0]["run"]
    assert '"$ACTION" != "labeled" || "$LABEL" == "safe to test"' in gate
