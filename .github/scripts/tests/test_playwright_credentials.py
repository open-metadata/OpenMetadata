from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parents[1]
UI = Path("openmetadata-ui/src/main/resources/ui")


def report_for(specs):
    return {
        "suites": [
            {
                "file": name.removeprefix("playwright/e2e/"),
                "specs": [
                    {
                        "tags": tags,
                        "tests": [{"expectedStatus": "passed", "results": results}],
                    }
                    for tags, results in cases
                ],
            }
            for name, cases in specs.items()
        ]
    }


def run_script(name, *args, cwd):
    return subprocess.run(
        [sys.executable, str(SCRIPTS / f"{name}.py"), *map(str, args)],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )


def test_pr_defers_only_credential_cases_and_keeps_mixed_files(tmp_path):
    specs = {
        "playwright/e2e/Auth/Private.spec.ts": [(["requires-secrets"], [])],
        "playwright/e2e/Features/Mixed.spec.ts": [([], []), (["requires-secrets"], [])],
        "playwright/e2e/Features/Public.spec.ts": [([], [])],
    }
    for spec in specs:
        path = tmp_path / UI / spec
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('test.describe("fixture", () => {});\n')
    changed = tmp_path / "diff.txt"
    changed.write_text("\n".join(str(UI / spec) for spec in specs))
    report = tmp_path / "collection.json"
    report.write_text(json.dumps(report_for(specs)))
    output = tmp_path / "plan.json"
    result = run_script(
        "plan_playwright_pr",
        "--changed-files",
        changed,
        "--collection-report",
        report,
        "--output",
        output,
        cwd=tmp_path,
    )
    assert result.returncode == 0, result.stderr
    plan = json.loads(output.read_text())
    assert plan["routes"]["auth"] == []
    assert plan["routes"]["normal"] == [
        "playwright/e2e/Features/Mixed.spec.ts",
        "playwright/e2e/Features/Public.spec.ts",
    ]
    assert plan["deferredSpecs"] == [
        "playwright/e2e/Auth/Private.spec.ts",
        "playwright/e2e/Features/Mixed.spec.ts",
    ]


def test_missing_collection_cannot_be_presented_as_a_credential_exemption(tmp_path):
    spec = UI / "playwright/e2e/Features/Missing.spec.ts"
    path = tmp_path / spec
    path.parent.mkdir(parents=True)
    path.write_text("// @requires-secrets is a comment, not a registered test tag\n")
    changed = tmp_path / "diff.txt"
    changed.write_text(str(spec))
    report = tmp_path / "collection.json"
    report.write_text(json.dumps({"suites": []}))
    result = run_script(
        "plan_playwright_pr",
        "--changed-files",
        changed,
        "--collection-report",
        report,
        "--output",
        tmp_path / "plan.json",
        cwd=tmp_path,
    )
    assert result.returncode != 0
    assert "Missing.spec.ts" in result.stderr


@pytest.mark.parametrize(
    "status,passes", [("passed", True), ("skipped", False), ("failed", False)]
)
def test_queue_requires_actual_credential_execution_even_when_public_tests_pass(
    tmp_path, status, passes
):
    spec = "playwright/e2e/Auth/Mixed.spec.ts"
    report = tmp_path / "results.json"
    report.write_text(
        json.dumps(
            report_for(
                {
                    spec: [
                        ([], [{"status": "passed"}]),
                        (["requires-secrets"], [{"status": status}]),
                    ]
                }
            )
        )
    )
    result = run_script(
        "verify_playwright_changed_specs",
        "--specs-json",
        json.dumps([spec]),
        "--require-tag",
        "@requires-secrets",
        "--report-glob",
        report,
        cwd=tmp_path,
    )
    assert (result.returncode == 0) is passes, result.stderr


def test_queue_cannot_claim_private_coverage_from_a_public_only_report(tmp_path):
    spec = "playwright/e2e/Auth/Mixed.spec.ts"
    report = tmp_path / "results.json"
    report.write_text(json.dumps(report_for({spec: [([], [{"status": "passed"}])]})))
    result = run_script(
        "verify_playwright_changed_specs",
        "--specs-json",
        json.dumps([spec]),
        "--require-tag",
        "@requires-secrets",
        "--report-glob",
        report,
        cwd=tmp_path,
    )
    assert result.returncode != 0


def test_queue_selects_only_affected_credential_specs(tmp_path):
    selected = "playwright/e2e/Auth/Affected.spec.ts"
    unrelated = "playwright/e2e/Auth/Unrelated.spec.ts"
    for spec in [selected, unrelated]:
        path = tmp_path / UI / spec
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('test("fixture", () => {});\n')
    changed = tmp_path / "diff.txt"
    changed.write_text("openmetadata-service/src/Changed.java")
    selection = tmp_path / "selection.json"
    selection.write_text(
        json.dumps(
            {
                "mode": "targeted",
                "selectors": [{"spec": selected, "projects": ["auto"]}],
            }
        )
    )
    report = tmp_path / "collection.json"
    report.write_text(
        json.dumps(
            report_for(
                {spec: [(["requires-secrets"], [])] for spec in [selected, unrelated]}
            )
        )
    )
    output = tmp_path / "plan.json"
    result = run_script(
        "plan_playwright_pr",
        "--event-name",
        "merge_group",
        "--changed-files",
        changed,
        "--queue-selection",
        selection,
        "--collection-report",
        report,
        "--output",
        output,
        cwd=tmp_path,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(output.read_text())["routes"]["auth"] == [selected]


def test_declaration_in_a_helper_is_owned_by_the_calling_spec(tmp_path):
    source = "playwright/e2e/Features/Caller.spec.ts"
    report = report_for({source: [(["requires-secrets"], [{"status": "passed"}])]})
    report["suites"][0]["specs"][0]["file"] = "../utils/sharedScenarios.ts"
    path = tmp_path / "report.json"
    path.write_text(json.dumps(report))
    result = run_script(
        "verify_playwright_changed_specs",
        "--specs-json",
        json.dumps([source]),
        "--require-tag",
        "@requires-secrets",
        "--report-glob",
        path,
        cwd=tmp_path,
    )
    assert result.returncode == 0, result.stderr


def test_missing_credential_test_id_cannot_hide_behind_another_passing_case(tmp_path):
    source = "playwright/e2e/Features/Mixed.spec.ts"
    report = report_for({source: [(["requires-secrets"], [{"status": "passed"}])]})
    report["suites"][0]["specs"][0]["id"] = "executed-case"
    path = tmp_path / "report.json"
    path.write_text(json.dumps(report))
    result = run_script(
        "verify_playwright_changed_specs",
        "--specs-json",
        json.dumps([source]),
        "--require-tag",
        "@requires-secrets",
        "--required-test-ids-json",
        '["executed-case", "missing-case"]',
        "--report-glob",
        path,
        cwd=tmp_path,
    )
    assert result.returncode != 0
    assert "missing-case" in result.stderr
