"""ci_local.py's stubbing, without act: the job graph survives, only the work is replaced."""

import importlib.util
import json
import sys
from pathlib import Path

import pytest

pytest.importorskip("yaml")

SCRIPTS = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("ci_local", SCRIPTS / "ci_local.py")
ci_local = importlib.util.module_from_spec(spec)
sys.modules["ci_local"] = ci_local
spec.loader.exec_module(ci_local)

WORKFLOW = {
    "name": "CI",
    "on": {"pull_request": None},
    "jobs": {
        "plan": {
            "runs-on": "ubuntu-latest",
            "outputs": {"ui": "${{ steps.filter.outputs.ui }}"},
            "steps": [
                {"uses": "actions/checkout@v7"},
                {"name": "Detect", "id": "filter", "if": "${{ github.event_name != 'workflow_dispatch' }}", "uses": "dorny/paths-filter@x"},
                {"name": "Sample", "id": "sample", "run": "echo run=true >> $GITHUB_OUTPUT"},
            ],
        },
        "static-ui": {"name": "static / ui", "needs": "plan", "uses": "./.github/workflows/ui-checkstyle.yml", "with": {"x": 1}, "permissions": {"contents": "read"}},
        "it": {
            "name": "it / ${{ matrix.engine }} / ${{ matrix.lane }}",
            "needs": ["plan", "static-ui"],
            "if": "${{ !cancelled() && !contains(needs.*.result, 'failure') }}",
            "runs-on": "ubuntu-latest",
            "strategy": {"matrix": {"engine": ["mysql", "pg"], "lane": ["parallel", "rdf"]}},
            "steps": [{"run": "mvn verify"}],
        },
        "ci-summary": {"needs": ["plan", "it"], "if": "${{ always() }}", "runs-on": "ubuntu-latest", "steps": [{"run": "echo summary"}, {"uses": "actions/upload-artifact@v7"}]},
    },
}


def scenario(**overrides):
    values = {"name": "s", "about": "", "event": "pull_request", "payload": {}, "success": (), "areas": ("ui",)}
    return ci_local.Scenario(**{**values, **overrides})


def test_the_graph_survives_and_called_workflows_become_plain_jobs():
    stubbed = ci_local.stub_workflow(WORKFLOW, scenario(fail=("it:pg/rdf",)))
    jobs = stubbed["jobs"]
    assert jobs["it"]["needs"] == ["plan", "static-ui"]
    assert jobs["it"]["if"] == WORKFLOW["jobs"]["it"]["if"]
    assert jobs["it"]["strategy"] == WORKFLOW["jobs"]["it"]["strategy"]
    assert "uses" not in jobs["static-ui"] and "with" not in jobs["static-ui"]
    assert jobs["static-ui"]["name"] == "static / ui"
    assert all(job["runs-on"] == "ubuntu-latest" for job in jobs.values())


def test_only_the_named_matrix_leg_fails():
    [step] = ci_local.stub_workflow(WORKFLOW, scenario(fail=("it:pg/rdf",)))["jobs"]["it"]["steps"]
    assert step["env"]["CI_LOCAL_LEG"] == "${{ matrix.engine }}/${{ matrix.lane }}"
    assert '"pg/rdf") echo' in step["run"] and "exit 1" in step["run"]


def test_kept_jobs_keep_their_scripts_and_the_path_filter_reports_the_scenario():
    jobs = ci_local.stub_workflow(WORKFLOW, scenario(areas=("ui", "ci")))["jobs"]
    detect, sample = jobs["plan"]["steps"]
    assert (detect["id"], detect["if"]) == ("filter", WORKFLOW["jobs"]["plan"]["steps"][1]["if"])
    assert "ui=true" in detect["run"] and "java=false" in detect["run"] and "ci=true" in detect["run"]
    assert sample["run"] == "echo run=true >> $GITHUB_OUTPUT"
    summary = jobs["ci-summary"]["steps"]
    assert summary[0]["run"] == "echo summary"
    assert ci_local.NEEDS_MARKER in summary[-1]["run"] and len(summary) == 2


def test_the_dump_round_trips_through_yaml():
    stubbed = ci_local.stub_workflow(WORKFLOW, scenario())
    reloaded = ci_local.yaml.safe_load(ci_local.dump(stubbed))
    assert reloaded["jobs"]["it"]["if"] == WORKFLOW["jobs"]["it"]["if"]
    assert "on" in reloaded


def test_every_scenario_names_only_jobs_its_workflow_has():
    workflows = Path(__file__).parents[2] / "workflows"
    for item in ci_local.SCENARIOS:
        path = workflows / item.workflow
        if not path.exists():
            pytest.skip(f"{item.workflow} is not in .github/workflows yet")
        jobs = list(ci_local.load_workflow(path)["jobs"])
        expected = item.expected(jobs)
        assert set(expected) == set(jobs)
        for leg in item.fail:
            assert leg.split(":", 1)[0] in jobs, f"{item.name} fails a job {item.workflow} does not have"


def test_parse_log_reads_job_results_steps_and_the_needs_line():
    stdout = "\n".join(
        [
            '{"jobID": "plan", "job": "CI/plan", "jobResult": "success", "msg": "done"}',
            '{"jobID": "plan", "job": "CI/plan", "step": "Not sampled", "stepResult": "success", "msg": "x"}',
            '{"jobID": "it", "job": "CI/it / a", "jobResult": "success", "msg": ""}',
            '{"jobID": "it", "job": "CI/it / b", "jobResult": "failure", "msg": ""}',
            '{"jobID": "ci-summary", "job": "CI/ci-summary", "msg": "ci-local-needs: {\\"it\\": {\\"result\\": \\"failure\\"}}"}',
            "not json",
        ]
    )
    jobs, steps, needs, _ = ci_local.parse_log(stdout)
    assert steps == {"plan/Not sampled": "success"}
    results = ci_local.job_results(["plan", "it", "fail-fast"], jobs, needs)
    assert results == {"plan": "success", "it": "failure", "fail-fast": "skipped"}


ACT_LOG = "\n".join(
    json.dumps(record)
    for record in [
        {"job": "CI [job-x]/plan", "jobID": "plan", "step": "Set up job", "msg": "⭐ Run Set up job"},
        {"job": "CI [job-x]/plan", "jobID": "plan", "step": "Detect changed areas", "msg": "Invoking listFiles(pull_number: 1)", "raw_output": True},
        {"job": "CI [job-x]/plan", "jobID": "plan", "step": "Detect changed areas", "msg": "❗  ::error::getaddrinfo EAI_AGAIN api.github.com"},
        {"job": "CI [job-x]/plan", "jobID": "plan", "step": "Detect changed areas", "stage": "Main", "stepResult": "failure", "msg": "❌  Failure"},
        {"job": "CI [job-x]/plan", "jobID": "plan", "jobResult": "failure", "msg": "🏁  Job failed"},
        {"job": "CI [job-x]/static / json-yaml", "jobID": "static-json", "step": "actions/setup-python@v6", "msg": "ok", "raw_output": True},
        {"job": "CI [job-x]/static / json-yaml", "jobID": "static-json", "jobResult": "success", "msg": "🏁  Job succeeded"},
    ]
)


def test_job_logs_look_like_github_logs_with_annotations():
    jobs = ci_local.job_logs(ACT_LOG)
    plan = jobs["plan"]
    assert (plan["result"], plan["failed_step"], plan["errors"]) == ("failure", "Detect changed areas", ["getaddrinfo EAI_AGAIN api.github.com"])
    assert plan["log"].splitlines()[-3:] == [
        "Invoking listFiles(pull_number: 1)",
        "##[error]getaddrinfo EAI_AGAIN api.github.com",
        "##[error]Process completed with exit code 1.",
    ]
    assert jobs["static / json-yaml"]["steps"][0][0] == "Run actions/setup-python@v6"


def test_the_local_gate_reruns_a_network_failure_on_a_pr(tmp_path):
    decision, readings = ci_local.local_gate(ACT_LOG, tmp_path, "pull_request", 1, "off")
    assert decision["verdict"] == "rerun" and decision["rerunJobs"] == ["plan"]


def test_artifact_actions_are_pinned_to_v4_only_in_the_scratch_copy(tmp_path):
    workflow = tmp_path / ".github" / "workflows" / "ci.yml"
    action = tmp_path / ".github" / "actions" / "x" / "action.yml"
    for path in (workflow, action):
        path.parent.mkdir(parents=True)
    workflow.write_text("uses: actions/upload-artifact@v7\nuses: actions/download-artifact@v12\nuses: actions/upload-artifact@v4\n")
    action.write_text("uses: actions/cache/restore@v6\n")
    assert ci_local.localize_artifact_actions(tmp_path) == [".github/workflows/ci.yml"]
    assert workflow.read_text() == "uses: actions/upload-artifact@v4\nuses: actions/download-artifact@v4\nuses: actions/upload-artifact@v4\n"
