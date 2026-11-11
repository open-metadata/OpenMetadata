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
        ("retried", "More than one execution attempt"),
        ("failed", "Unexpected test outcome"),
        ("flaky", "Unexpected test outcome"),
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
    if fault == "retried":
        spec["tests"][0]["results"] = [
            {"status": "failed", "retry": 0},
            {"status": "passed", "retry": 1},
        ]
    if fault == "failed":
        spec["tests"][0]["results"] = [{"status": "failed"}]
    if fault == "flaky":
        spec["tests"][0]["status"] = "flaky"
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
            "--require-single-attempt",
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


def test_every_setup_and_teardown_project_is_excluded_from_native_coverage():
    # A fixture project (playwright.config.ts FIXTURE_TEST_MATCH) runs alongside
    # the planned tests but is never planned, so the merge-queue native check
    # rejects it unless excluded.
    import re
    from pathlib import Path

    module = load_script("verify_playwright_coverage")
    config = (
        Path(__file__).parents[3] / "openmetadata-ui/src/main/resources/ui/playwright.config.ts"
    ).read_text()
    # Each project's fields run from its `name:` to the next one, in any order.
    chunks = re.split(r"\n\s*name:\s*", config)[1:]
    fixtures = set()
    for chunk in chunks:
        name = re.match(r"'([^']+)'", chunk)
        test_match = re.search(r"testMatch:\s*'([^']+)'", chunk)
        if name and test_match and re.search(
            r"(?:\.(?:setup|teardown)\.ts|dataInsightApp\.ts)$", test_match.group(1)
        ):
            fixtures.add(name.group(1))
    assert {"setup", "entity-data-setup", "data-insight-application", "ontology-rdf-setup"} <= fixtures
    assert fixtures - module.LIFECYCLE_PROJECTS == set()
