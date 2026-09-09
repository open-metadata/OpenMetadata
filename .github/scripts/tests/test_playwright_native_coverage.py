import json
import sys

import pytest
from test_playwright_ci_planning import load_script


@pytest.mark.parametrize(
    "fault,expected",
    [
        (None, None),
        ("missing", "Missing native result"),
        ("duplicate", "Duplicate native result"),
        ("unexpected", "Unexpected native result"),
        ("unexecuted", "No execution attempts"),
        ("empty-plan", "No tests were planned"),
    ],
)
def test_native_results_independently_verify_timing_coverage(
    tmp_path, monkeypatch, fault, expected
):
    module = load_script("verify_playwright_coverage")
    spec = {
        "id": "planned-test",
        "tests": [
            {
                "projectName": "chromium",
                "status": "expected",
                "results": [{"status": "passed"}],
            }
        ],
    }
    specs = [] if fault == "missing" else [spec]
    if fault == "duplicate":
        specs.append(spec)
    if fault == "unexpected":
        specs.append({**spec, "id": "unplanned-test"})
    if fault == "unexecuted":
        spec["tests"][0]["results"] = []
    planned = [] if fault == "empty-plan" else ["planned-test"]
    (tmp_path / "plan.json").write_text(
        json.dumps({"shardId": "chromium-01", "testIds": planned})
    )
    (tmp_path / "timing.json").write_text(
        json.dumps({"tests": [{"id": test_id} for test_id in planned]})
    )
    (tmp_path / "result.json").write_text(json.dumps({"suites": [{"specs": specs}]}))
    (tmp_path / "quarantine-inventory.json").write_text(
        json.dumps(
            {
                "suites": [
                    {
                        "specs": [
                            {"tags": ["quarantine"], "tests": [{}, {}]},
                            {"tags": ["@quarantine"], "tests": [{}]},
                            {"tags": [], "tests": [{}]},
                        ]
                    }
                ],
            }
        )
    )
    output = tmp_path / "coverage.json"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "verify_playwright_coverage.py",
            "--plan-glob",
            str(tmp_path / "*.json"),
            "--timing-glob",
            str(tmp_path / "timing.json"),
            "--result-glob",
            str(tmp_path / "result.json"),
            "--require-native-evidence",
            "--output",
            str(output),
        ],
    )
    if expected:
        with pytest.raises(SystemExit, match="coverage mismatch"):
            module.main()
        assert any(
            expected in issue
            for issue in json.loads(output.read_text())["nativeEvidenceIssues"]
        )
    else:
        module.main()
        assert json.loads(output.read_text())["nativeEvidenceIssues"] == []
    assert json.loads(output.read_text())["quarantinedTests"] == 3
