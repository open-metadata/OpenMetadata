import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[1] / "jacoco_class_coverage.py"
SPEC = importlib.util.spec_from_file_location("jacoco_class_coverage", SCRIPT)
coverage = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = coverage
SPEC.loader.exec_module(coverage)


def report(tmp_path, classes):
    path = tmp_path / "jacoco.xml"
    path.write_text(f'<report><package name="example">{classes}</package></report>')
    return path


def java_class(name, covered, missed, source="Example.java"):
    return (
        f'<class name="example/{name}" sourcefilename="{source}">'
        '<method name="irrelevant"><counter type="LINE" missed="999" covered="0"/></method>'
        f'<counter type="LINE" missed="{missed}" covered="{covered}"/></class>'
    )


def evaluate(tmp_path, classes, outcomes=None):
    return coverage.evaluate_report(
        report(tmp_path, classes),
        {"src/main/java/example/Example.java"},
        ["src/main/java"],
        outcomes or [{"name": "unit", "exit_code": 0}],
    )


def test_nested_class_cannot_hide_behind_covered_outer_class(tmp_path):
    result = evaluate(
        tmp_path, java_class("Example", 1000, 0) + java_class("Example$Worker", 8, 2)
    )
    assert not result["passed"]
    assert result["below_threshold"] == ["example/Example$Worker"]
    assert result["classes"][0]["covered"] == 1000


@pytest.mark.parametrize(
    "covered,missed,passed", [(9, 1, True), (89, 11, False), (0, 0, True)]
)
def test_whole_class_threshold_is_exact(tmp_path, covered, missed, passed):
    result = evaluate(tmp_path, java_class("Example", covered, missed))
    assert result["passed"] is passed


def test_missing_changed_sources_fail_closed(tmp_path):
    result = evaluate(tmp_path, java_class("Other", 100, 0, "Other.java"))
    assert not result["passed"]
    assert result["missing_sources"] == ["src/main/java/example/Example.java"]


def test_failed_test_execution_cannot_supply_regression_acceptance(tmp_path):
    result = evaluate(
        tmp_path,
        java_class("Example", 100, 0),
        [{"name": "integration", "exit_code": 1}],
    )
    assert result["coverage_passed"]
    assert not result["passed"]
    assert result["failed_executions"] == ["integration"]


def test_empty_scope_cannot_pass_by_accident(tmp_path):
    with pytest.raises(ValueError, match="No changed production"):
        coverage.evaluate_report(report(tmp_path, ""), set(), ["src/main/java"], [])


def test_duplicate_class_reports_are_rejected(tmp_path):
    with pytest.raises(ValueError, match="Duplicate class"):
        evaluate(tmp_path, java_class("Example", 100, 0) * 2)


def test_empty_execution_list_cannot_prove_coverage(tmp_path):
    with pytest.raises(ValueError, match="No test executions"):
        coverage.evaluate_report(
            report(tmp_path, java_class("Example", 100, 0)),
            {"src/main/java/example/Example.java"},
            ["src/main/java"],
            [],
        )


def test_gate_cannot_omit_a_changed_module(tmp_path):
    def git(*args):
        subprocess.run(
            ["git", "-C", str(tmp_path), *args], check=True, capture_output=True
        )

    git("init", "-q")
    git(
        "-c",
        "user.name=Coverage Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "--allow-empty",
        "-qm",
        "Initialize coverage fixture",
    )
    missing = tmp_path / "another-module/src/main/java/example/Missing.java"
    missing.parent.mkdir(parents=True)
    missing.write_text("package example; class Missing {}\n")
    with pytest.raises(ValueError, match="Gate scope omits.*another-module"):
        coverage.changed_sources(tmp_path, ["src/main/java"], "HEAD")


def test_stale_build_cannot_certify_a_changed_source(tmp_path):
    source = "src/main/java/example/Example.java"
    path = tmp_path / source
    path.parent.mkdir(parents=True)
    path.write_text("package example; class Example {}\n")
    hashes = {source: coverage.sha256(path)}
    coverage.verify_sources(tmp_path, {source}, hashes)
    path.write_text("package example; class Example { int changed() { return 1; } }\n")
    with pytest.raises(ValueError, match="Source changed since"):
        coverage.verify_sources(tmp_path, {source}, hashes)


def test_build_provenance_cannot_omit_changed_sources(tmp_path):
    with pytest.raises(ValueError, match="omits source hashes"):
        coverage.verify_sources(tmp_path, {"src/main/java/example/Example.java"}, {})
