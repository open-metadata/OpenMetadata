#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""CLI output and failure context reach ordinary pytest reports."""

from xml.etree import ElementTree as ET

import pytest

from .test_cli import PROBE
from .test_workflow_case import _configure_child


@pytest.mark.parametrize("capture", ["fd", "no", "tee-sys"])
def test_cli_streams_remain_visible_when_a_persisted_check_fails(pytester, monkeypatch, capture):
    _configure_child(pytester, monkeypatch)
    pytester.makepyfile(probe=PROBE)
    pytester.makepyfile("""
from ingestion.tests.cli_e2e_v2.runtime.case import WorkflowCase, run_and_check
from ingestion.tests.cli_e2e_v2.runtime.cli import WorkflowInvocation
from ingestion.tests.cli_e2e_v2.runtime.expect import Query

def test_persisted_result(cli):
    def check(actual):
        assert actual == 'expected table', f'expected table, got {actual}'
    run_and_check(cli, WorkflowCase(
        WorkflowInvocation('ingest', {}),
        Query('my_service.my_table', lambda: 'wrong table'), check,
    ), poll_timeout=0.25)
""")
    result = pytester.runpytest_subprocess("-q", f"--capture={capture}", "--junitxml=report.xml")
    result.assert_outcomes(failed=1)
    assert result.ret == pytest.ExitCode.TESTS_FAILED
    output = result.stdout.str() + result.stderr.str()
    assert "source output" in output
    assert "source error" in output
    assert "my_service.my_table" in output
    assert "3 attempts" in output
    assert "expected table, got wrong table" in output
    failure = ET.parse(pytester.path / "report.xml").find(".//failure")
    assert failure is not None
    assert "my_service.my_table" in failure.text


def test_passing_cli_output_can_be_displayed_without_an_artifact_bundle(pytester, monkeypatch):
    _configure_child(pytester, monkeypatch)
    pytester.makepyfile(probe=PROBE)
    pytester.makepyfile("""
from ingestion.tests.cli_e2e_v2.runtime.cli import WorkflowInvocation

def test_cli(cli):
    assert cli.run(WorkflowInvocation('ingest', {})).status.success is True
""")
    result = pytester.runpytest_subprocess("-q", "-rP")
    result.assert_outcomes(passed=1)
    assert result.ret == pytest.ExitCode.OK
    assert "source output" in result.stdout.str()
    assert "source error" in result.stdout.str()


@pytest.mark.parametrize("phase", ["setup", "call", "teardown"])
def test_fixture_and_test_failures_keep_their_original_diagnostics(pytester, monkeypatch, phase):
    _configure_child(pytester, monkeypatch)
    monkeypatch.setenv("REPORT_FAILURE_PHASE", phase)
    pytester.makepyfile("""
import os
import sys
import pytest

def fail(phase):
    if os.environ['REPORT_FAILURE_PHASE'] == phase:
        print(f'{phase} stdout context')
        print(f'{phase} stderr context', file=sys.stderr)
        raise RuntimeError(f'{phase} original failure')

@pytest.fixture
def resource():
    fail('setup')
    yield
    fail('teardown')

def test_resource(resource):
    fail('call')
""")
    result = pytester.runpytest_subprocess("-q", "--junitxml=report.xml")
    result.assert_outcomes(failed=int(phase == "call"), errors=int(phase != "call"), passed=int(phase == "teardown"))
    assert result.ret == pytest.ExitCode.TESTS_FAILED
    output = result.stdout.str() + result.stderr.str()
    assert f"{phase} stdout context" in output
    assert f"{phase} stderr context" in output
    assert f"{phase} original failure" in output
    report = ET.parse(pytester.path / "report.xml")
    failure = report.find(".//failure" if phase == "call" else ".//error")
    assert failure is not None
    assert f"{phase} original failure" in failure.text
