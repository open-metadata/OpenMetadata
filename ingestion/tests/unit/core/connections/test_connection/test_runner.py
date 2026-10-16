#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Unit tests for the TestConnectionRunner orchestration."""

import logging
import time

from metadata.core.connections.test_connection.check import check
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.core.connections.test_connection.classifier import (
    ErrorPack,
    Matchers,
    when,
)
from metadata.core.connections.test_connection.records import Diagnosis, Evidence
from metadata.core.connections.test_connection.runner import TestConnectionRunner
from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
    Category,
)


class _Step:
    def __init__(self, name, category, mandatory=True):
        self.name = name
        self.category = category
        self.mandatory = mandatory
        self.shortCircuit = False


class _Definition:
    def __init__(self, steps):
        self.steps = steps


class _Metadata:
    def __init__(self, definition):
        self._definition = definition
        self.patches = []

    def get_by_name(self, entity, fqn):
        return self._definition

    def patch_automation_workflow_response(self, workflow, result, status):
        self.patches.append(status)


def _run(provider, *steps, workflow=None):
    metadata = _Metadata(_Definition(list(steps)))
    result = TestConnectionRunner(provider, "Snowflake", timeout_seconds=None).run(metadata, workflow)
    return result, metadata


def test_missing_check_is_skipped_and_fails_a_mandatory_result():
    class Provider:
        errors = ErrorPack()

    result, _ = _run(Provider(), _Step("GetTables", Category.Capability))
    assert result.steps[0].status.value == "Skipped"
    assert result.steps[0].skipReason.value == "NotImplemented"
    # a mandatory step that did not run fails the whole test
    assert result.status.value == "Failed"


def test_missing_non_mandatory_check_does_not_fail_the_result():
    class Provider:
        errors = ErrorPack()

        @check(DatabaseStep.CheckAccess)
        def check_access(self):
            return None

    result, _ = _run(
        Provider(),
        _Step("CheckAccess", Category.ConnectionGate),
        _Step("GetQueries", Category.Capability, mandatory=False),
    )
    assert result.steps[1].status.value == "Skipped"
    assert result.status.value == "Successful"


def test_multiple_gates_skip_everything_after_the_first_failure():
    class Provider:
        errors = ErrorPack()

        @check(DatabaseStep.CheckAccess)
        def check_access(self):
            raise ValueError("no auth")

    result, _ = _run(
        Provider(),
        _Step("CheckAccess", Category.ConnectionGate),
        _Step("GetDatabases", Category.ConnectionGate),
        _Step("GetTables", Category.Capability),
    )
    assert result.steps[0].status.value == "Failed"
    # the second gate AND the capability skip once the first gate fails
    assert [s.skipReason.value for s in result.steps[1:]] == [
        "ConnectionNotEstablished",
        "ConnectionNotEstablished",
    ]


def test_gate_failure_skips_capabilities():
    class Provider:
        errors = ErrorPack()

        @check(DatabaseStep.CheckAccess)
        def check_access(self):
            raise ValueError("no auth")

        @check(DatabaseStep.GetTables)
        def get_tables(self):
            return None

    result, _ = _run(
        Provider(),
        _Step("CheckAccess", Category.ConnectionGate),
        _Step("GetTables", Category.Capability),
    )
    assert result.steps[0].status.value == "Failed"
    assert result.steps[1].status.value == "Skipped"
    assert result.steps[1].skipReason.value == "ConnectionNotEstablished"
    assert result.status.value == "Failed"


def test_all_steps_pass_is_successful():
    class Provider:
        errors = ErrorPack()

        @check(DatabaseStep.CheckAccess)
        def check_access(self):
            return None

    result, _ = _run(Provider(), _Step("CheckAccess", Category.ConnectionGate))
    assert result.steps[0].status.value == "Passed"
    assert result.status.value == "Successful"


def test_mandatory_caveat_is_a_warning_but_keeps_the_connection_successful():
    class Provider:
        errors = ErrorPack()

        @check(DatabaseStep.GetTables)
        def get_tables(self):
            return Evidence(summary="0 tables", caveat=Diagnosis(title="No tables visible"))

    result, _ = _run(Provider(), _Step("GetTables", Category.Capability, mandatory=True))
    assert result.steps[0].status.value == "Warning"
    assert result.steps[0].passed is True
    assert result.steps[0].diagnosis.title == "No tables visible"
    assert result.status.value == "Successful"


def test_capability_failure_does_not_skip_later_capabilities():
    class Provider:
        errors = ErrorPack()

        @check(DatabaseStep.CheckAccess)
        def check_access(self):
            return None

        @check(DatabaseStep.GetTables)
        def get_tables(self):
            raise ValueError("boom")

        @check(DatabaseStep.GetViews)
        def get_views(self):
            return None

    result, _ = _run(
        Provider(),
        _Step("CheckAccess", Category.ConnectionGate),
        _Step("GetTables", Category.Capability),
        _Step("GetViews", Category.Capability),
    )
    assert [s.status.value for s in result.steps] == ["Passed", "Failed", "Passed"]
    assert result.status.value == "Failed"


def test_patches_workflow_once_per_step_plus_final():
    class Provider:
        errors = ErrorPack()

        @check(DatabaseStep.CheckAccess)
        def check_access(self):
            return None

    _, metadata = _run(Provider(), _Step("CheckAccess", Category.ConnectionGate), workflow=object())
    assert len(metadata.patches) == 2


def test_per_step_timeout_fails_only_the_stuck_step():
    class Provider:
        errors = ErrorPack()

        @check(DatabaseStep.CheckAccess)
        def check_access(self):
            return None

        @check(DatabaseStep.GetTables)
        def get_tables(self):
            time.sleep(3)

        @check(DatabaseStep.GetViews)
        def get_views(self):
            return None

    metadata = _Metadata(
        _Definition(
            [
                _Step("CheckAccess", Category.ConnectionGate),
                _Step("GetTables", Category.Capability),
                _Step("GetViews", Category.Capability),
            ]
        )
    )
    result = TestConnectionRunner(Provider(), "Snowflake", timeout_seconds=1).run(metadata)
    assert [s.status.value for s in result.steps] == ["Passed", "Failed", "Passed"]
    assert result.status.value == "Failed"
    # the stuck step is diagnosed as a timeout, not whatever the cause wrapped to
    assert result.steps[1].diagnosis.title == "Check timed out"


def test_fast_wrapped_timeouterror_is_not_misread_as_a_step_timeout():
    """A driver's own fast timeout (a wrapped ``TimeoutError``) is the driver's
    error, not our per-step budget - it must be classified by the error pack,
    since our timeout only fires after the full budget elapses."""

    class Provider:
        errors = ErrorPack(when(Matchers.contains("connection lost")).diagnose("Lost connection", fix="check load"))

        @check(DatabaseStep.CheckAccess)
        def check_access(self):
            cause = TimeoutError("socket read timeout")
            raise ValueError("connection lost") from cause

    metadata = _Metadata(_Definition([_Step("CheckAccess", Category.ConnectionGate)]))
    result = TestConnectionRunner(Provider(), "Snowflake", timeout_seconds=60).run(metadata)
    assert result.steps[0].diagnosis.title == "Lost connection"


def test_each_step_result_is_logged_at_info(caplog):
    class Provider:
        errors = ErrorPack()

        @check(DatabaseStep.CheckAccess)
        def check_access(self):
            return None

    with caplog.at_level(logging.INFO):
        _run(Provider(), _Step("CheckAccess", Category.ConnectionGate))
    assert "CheckAccess: Passed" in caplog.text
    assert "Successful" in caplog.text


def test_runner_surfaces_executed_command_and_timing():
    from metadata.core.connections.test_connection.records import Evidence

    class Provider:
        errors = ErrorPack()

        @check(DatabaseStep.CheckAccess)
        def check_access(self):
            return Evidence(summary="connection established", command="SELECT 1")

    result, _ = _run(Provider(), _Step("CheckAccess", Category.ConnectionGate))
    step = result.steps[0]
    assert step.executedCommand == "SELECT 1"
    assert step.resultSummary == "connection established"
    assert step.durationMs is not None and step.durationMs >= 0


def test_runner_attaches_diagnosis_from_error_pack():
    class Provider:
        errors = ErrorPack(when(Matchers.contains("no auth")).diagnose("Auth failed", fix="check creds"))

        @check(DatabaseStep.CheckAccess)
        def check_access(self):
            raise ValueError("no auth here")

    result, _ = _run(Provider(), _Step("CheckAccess", Category.ConnectionGate))
    assert result.steps[0].status.value == "Failed"
    assert result.steps[0].diagnosis.title == "Auth failed"
    assert result.steps[0].diagnosis.remediation == "check creds"
