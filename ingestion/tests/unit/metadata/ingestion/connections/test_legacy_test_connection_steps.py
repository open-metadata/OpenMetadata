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
"""Unit tests for the legacy `test_connection_steps` orchestration."""

import uuid
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)

# imported as a module: `test_connection_steps` would otherwise be collected as a test
from metadata.ingestion.connections import test_connections
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    raise_test_connection_exception,
)


class _DefinitionStep:
    """Stand-in for a server-side test connection definition step."""

    def __init__(self, name, mandatory=True, short_circuit=False):
        self.name = name
        self.description = f"{name} description"
        self.mandatory = mandatory
        self.errorMessage = f"{name} failed"
        self.shortCircuit = short_circuit


def _metadata(*steps):
    metadata = MagicMock()
    metadata.get_by_name.return_value = MagicMock(steps=list(steps))
    return metadata


def _workflow():
    return AutomationWorkflow(
        id=str(uuid.uuid4()),
        name="test-workflow",
        workflowType="TEST_CONNECTION",
        request={},
    )  # type: ignore


def _run(metadata, test_fn, automation_workflow=None):
    return test_connections.test_connection_steps(
        metadata=metadata,
        service_type="Redshift",
        test_fn=test_fn,
        automation_workflow=automation_workflow,
        timeout_seconds=None,
    )


def test_unimplemented_step_is_skipped_instead_of_raising():
    """A definition step the connector does not implement used to raise a KeyError,
    breaking every other step of the test connection."""
    metadata = _metadata(
        _DefinitionStep("CheckAccess"),
        _DefinitionStep("GetPartitionTableDetails", mandatory=False),
    )

    result = _run(metadata, {"CheckAccess": MagicMock()})

    assert [step.name for step in result.steps] == ["CheckAccess", "GetPartitionTableDetails"]
    assert result.steps[0].passed is True
    skipped = result.steps[1]
    assert skipped.passed is False
    assert skipped.status.value == "Skipped"
    assert skipped.skipReason.value == "NotImplemented"


def test_unimplemented_optional_step_does_not_fail_the_connection():
    metadata = _metadata(_DefinitionStep("CheckAccess"), _DefinitionStep("GetQueries", mandatory=False))

    result = _run(metadata, {"CheckAccess": MagicMock()})

    raise_test_connection_exception(result)


def test_unimplemented_mandatory_step_reports_the_version_mismatch():
    metadata = _metadata(_DefinitionStep("GetPartitionTableDetails"))

    result = _run(metadata, {})

    with pytest.raises(SourceConnectionException, match="no implementation in this ingestion version"):
        raise_test_connection_exception(result)


def test_unimplemented_optional_step_keeps_the_workflow_successful():
    metadata = _metadata(_DefinitionStep("CheckAccess"), _DefinitionStep("GetQueries", mandatory=False))

    result = _run(metadata, {"CheckAccess": MagicMock()}, automation_workflow=_workflow())

    assert result.status.value == "Successful"
    assert metadata.patch_automation_workflow_response.called


def test_failing_step_still_fails_the_connection():
    def _boom():
        raise RuntimeError("no access")

    metadata = _metadata(_DefinitionStep("CheckAccess", short_circuit=True), _DefinitionStep("GetSchemas"))

    result = _run(metadata, {"CheckAccess": _boom, "GetSchemas": MagicMock()})

    # short circuit: the failing gate stops the run
    assert [step.name for step in result.steps] == ["CheckAccess"]
    assert result.steps[0].errorLog == "no access"
    assert result.steps[0].message == "CheckAccess failed"
    with pytest.raises(SourceConnectionException, match="Failed to run the test connection step: CheckAccess"):
        raise_test_connection_exception(result)


def test_failing_optional_step_does_not_fail_the_workflow_run():
    def _boom():
        raise RuntimeError("no query history")

    metadata = _metadata(_DefinitionStep("CheckAccess"), _DefinitionStep("GetQueries", mandatory=False))

    result = _run(metadata, {"CheckAccess": MagicMock(), "GetQueries": _boom})

    raise_test_connection_exception(result)
    assert result.steps[1].passed is False
