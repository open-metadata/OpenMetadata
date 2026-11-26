#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Tests for .github/scripts/summarize_surefire.py."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
_SPEC = importlib.util.spec_from_file_location(
    "summarize_surefire", ROOT / ".github/scripts/summarize_surefire.py"
)
summarize = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = summarize
_SPEC.loader.exec_module(summarize)


@pytest.mark.parametrize(
    ("checkstyle", "unit_tests", "headline"),
    [
        ("success", "failure", "Java checkstyle passed; unit tests failed."),
        ("failure", "skipped", "Java checkstyle failed; unit tests skipped."),
        ("success", "success", "Java checkstyle passed; unit tests passed."),
        ("success", "skipped", "Java checkstyle passed; unit tests skipped."),
        ("success", "cancelled", "Java checkstyle passed; unit tests cancelled."),
    ],
)
def test_summary_leads_with_stage_results(checkstyle, unit_tests, headline):
    md = summarize.render_markdown(
        title="Backend checks",
        checkstyle_outcome=checkstyle,
        checkstyle_files=[],
        unit_tests_outcome=unit_tests,
        summary=summarize.parse_surefire_reports([]),
    )
    assert md.startswith(f"## Backend checks\n\n**{headline}**\n")


def test_checkstyle_failure_fail_fast_summary_and_annotations(tmp_path: Path) -> None:
    cs_list = tmp_path / "files.txt"
    cs_list.write_text("openmetadata-service/src/main/java/Foo.java\ncommon/Bar.java\n")
    summary_file = tmp_path / "summary.md"

    rc = summarize.main(
        [
            "--checkstyle-outcome",
            "failure",
            "--checkstyle-files",
            str(cs_list),
            "--unit-tests-outcome",
            "skipped",
            "--summary-file",
            str(summary_file),
        ]
    )
    assert rc == 0
    md = summary_file.read_text()
    assert "| Java Checkstyle | **FAIL** |" in md
    assert "| Unit Tests | **SKIPPED** | Skipped (fail-fast: fix checkstyle first) |" in md
    assert "`openmetadata-service/src/main/java/Foo.java`" in md
    assert "`mvn spotless:apply`" in md

    annotations = summarize.format_annotations(
        checkstyle_outcome="failure",
        checkstyle_files=["openmetadata-service/src/main/java/Foo.java"],
        unit_tests_outcome="skipped",
        summary=summarize.parse_surefire_reports([]),
    )
    assert annotations == [
        "::error file=openmetadata-service/src/main/java/Foo.java,title=Java Checkstyle Failed::"
        "File is not formatted. Run 'mvn spotless:apply' and commit the changes."
    ]


def test_unit_test_failures_and_errors_are_parsed_and_annotated(tmp_path: Path) -> None:
    xml = tmp_path / "TEST-org.openmetadata.service.FooTest.xml"
    xml.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="org.openmetadata.service.FooTest" tests="3" failures="1" errors="1" skipped="0" time="4.2">
  <testcase classname="org.openmetadata.service.FooTest" name="ok" time="0.1"/>
  <testcase classname="org.openmetadata.service.FooTest" name="badAssert" time="1.0">
    <failure type="org.opentest4j.AssertionFailedError" message="expected: &lt;1&gt; but was: &lt;2&gt;">stack trace line 1</failure>
  </testcase>
  <testcase classname="org.openmetadata.service.FooTest" name="boom" time="3.1">
    <error type="java.lang.IllegalStateException" message="boom">java.lang.IllegalStateException: boom</error>
  </testcase>
</testsuite>
"""
    )
    parsed = summarize.parse_surefire_reports([str(tmp_path / "TEST-*.xml")])
    assert parsed.tests == 3
    assert parsed.passed == 1
    assert parsed.failures == 1
    assert parsed.errors == 1
    assert len(parsed.failed_cases) == 2

    md = summarize.render_markdown(
        title="Backend CI Summary",
        checkstyle_outcome="success",
        checkstyle_files=[],
        unit_tests_outcome="failure",
        summary=parsed,
    )
    assert "| Java Checkstyle | **PASS** |" in md
    assert "| Unit Tests | **FAIL** | 1/3 passed, 1 failed, 1 errors, 0 skipped (4.2s) |" in md
    assert "`FooTest#badAssert`" in md
    assert "`FooTest#boom`" in md

    annotations = summarize.format_annotations(
        checkstyle_outcome="success",
        checkstyle_files=[],
        unit_tests_outcome="failure",
        summary=parsed,
    )
    assert any("Unit Test Failed: FooTest#badAssert" in a for a in annotations)
    assert any("Unit Test Failed: FooTest#boom" in a for a in annotations)


def test_compilation_failure_without_surefire_reports_is_called_out() -> None:
    empty = summarize.parse_surefire_reports([])
    md = summarize.render_markdown(
        title="Backend CI Summary",
        checkstyle_outcome="success",
        checkstyle_files=[],
        unit_tests_outcome="failure",
        summary=empty,
    )
    assert "Build/compilation failed before Surefire produced any test reports" in md
    annotations = summarize.format_annotations(
        checkstyle_outcome="success",
        checkstyle_files=[],
        unit_tests_outcome="failure",
        summary=empty,
    )
    assert any("Backend Build Failed" in a for a in annotations)
