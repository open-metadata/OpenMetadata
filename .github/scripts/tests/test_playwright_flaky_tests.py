"""Per-run flaky-test listing: what counts as flaky and how runs are folded."""

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


flaky = load_script("playwright_flaky_tests")


def report(file, describe, tests):
    """A Playwright JSON report with one file suite and one describe."""
    return {
        "suites": [
            {
                "title": file,
                "file": file,
                "suites": [
                    {
                        "title": describe,
                        "file": file,
                        "specs": [
                            {
                                "title": title,
                                "file": file,
                                "tests": [
                                    {
                                        "projectName": project,
                                        "status": status,
                                        "results": [
                                            {"status": "failed", "error": {"message": "boom"}},
                                            {"status": "passed"},
                                        ]
                                        if status == "flaky"
                                        else [{"status": "passed"}],
                                    }
                                ],
                            }
                            for title, project, status in tests
                        ],
                    }
                ],
            }
        ]
    }


def write(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload))
    return path


def test_spec_path_strips_everything_up_to_the_spec_root():
    assert flaky.spec_path("Features/A.spec.ts") == "Features/A.spec.ts"
    assert (
        flaky.spec_path("openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/A.spec.ts")
        == "Features/A.spec.ts"
    )
    assert flaky.spec_path("playwright\\e2e\\Pages\\B.spec.ts") == "Pages/B.spec.ts"


def test_only_flaky_tests_are_listed_with_their_describe_path(tmp_path):
    write(
        tmp_path / "merged" / "results.json",
        report(
            "Features/A.spec.ts",
            "Panel",
            [("opens", "chromium", "flaky"), ("closes", "chromium", "expected")],
        ),
    )
    output = tmp_path / "out" / "playwright-flaky-tests.json"
    summary = tmp_path / "summary.md"

    assert flaky.main(
        [
            "--report-glob",
            str(tmp_path / "merged" / "results.json"),
            "--output",
            str(output),
            "--summary",
            str(summary),
        ]
    ) == 0

    payload = json.loads(output.read_text())
    assert payload["count"] == 1
    [test] = payload["tests"]
    assert (test["spec"], test["title"], test["projects"]) == (
        "Features/A.spec.ts",
        "Panel › opens",
        ["chromium"],
    )
    assert test["firstError"] == "boom"
    assert "`Features/A.spec.ts` › Panel › opens (chromium)" in summary.read_text()


def test_the_merged_and_shard_reports_of_one_test_fold_into_one_entry(tmp_path):
    flaky_test = [("opens", "chromium", "flaky")]
    write(tmp_path / "merged" / "results.json", report("Features/A.spec.ts", "Panel", flaky_test))
    write(
        tmp_path / "results" / "playwright-results-json-chromium-01-a1" / "results.json",
        report("Features/A.spec.ts", "Panel", flaky_test),
    )
    write(
        tmp_path / "results" / "playwright-results-json-rules-01-a1" / "results.json",
        report("Features/A.spec.ts", "Panel", [("opens", "DataAssetRulesEnabled", "flaky")]),
    )
    output = tmp_path / "flaky.json"

    flaky.main(
        [
            "--report-glob",
            str(tmp_path / "merged" / "results.json"),
            "--report-glob",
            str(tmp_path / "results" / "*" / "results.json"),
            "--output",
            str(output),
        ]
    )

    payload = json.loads(output.read_text())
    assert payload["reports"] == 3
    [test] = payload["tests"]
    assert test["projects"] == ["DataAssetRulesEnabled", "chromium"]
    assert test["shards"] == ["chromium-01", "rules-01"]


def test_no_reports_is_said_out_loud_rather_than_reported_as_clean(tmp_path):
    output = tmp_path / "flaky.json"
    summary = tmp_path / "summary.md"

    flaky.main(
        [
            "--report-glob",
            str(tmp_path / "missing" / "*.json"),
            "--output",
            str(output),
            "--summary",
            str(summary),
        ]
    )

    assert json.loads(output.read_text())["reports"] == 0
    assert "No Playwright JSON report was available" in summary.read_text()


def test_an_unparseable_report_is_recorded_and_not_counted(tmp_path):
    (tmp_path / "bad.json").write_text("{not json")
    output = tmp_path / "flaky.json"

    flaky.main(["--report-glob", str(tmp_path / "bad.json"), "--output", str(output)])

    payload = json.loads(output.read_text())
    assert payload["reports"] == 0
    assert len(payload["parseErrors"]) == 1
