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
"""
Serialization guard for ``patch_automation_workflow_response``.

The step result carries nested enums (``status``, ``skipReason``) and a nested
``diagnosis`` object. The PATCH payload must be JSON-serializable end to end -
a regression here silently drops the test-connection result and the UI spins
until it times out.
"""

import json
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.entity.automations.workflow import WorkflowStatus
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    SkipReason,
    Status,
    StatusType,
    TestConnectionResult,
    TestConnectionStepResult,
)
from metadata.generated.schema.type.basic import Uuid
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def _ometa_with_mock_client():
    ometa = object.__new__(OpenMetadata)
    ometa.client = MagicMock()
    ometa.client.patch.return_value = {"ok": True}
    return ometa


def _result_with_nested_enums():
    return TestConnectionResult(
        lastUpdatedAt=None,
        status=StatusType.Failed,
        steps=[
            TestConnectionStepResult(
                name="CheckAccess",
                mandatory=True,
                passed=True,
                status=Status.Passed,
                executedCommand="SELECT 1",
                resultSummary="connection established",
            ),
            TestConnectionStepResult(
                name="GetTables",
                mandatory=True,
                passed=False,
                status=Status.Skipped,
                skipReason=SkipReason.ConnectionNotEstablished,
            ),
        ],
    )


def test_patch_payload_is_json_serializable_with_nested_step_enums():
    ometa = _ometa_with_mock_client()
    workflow = SimpleNamespace(id=Uuid(root=UUID("122a54ac-a03f-460d-abc5-30b1de4a40f8")))

    ometa.patch_automation_workflow_response(workflow, _result_with_nested_enums(), WorkflowStatus.Successful)

    data = ometa.client.patch.call_args.kwargs["data"]
    ops = json.loads(data)
    response = next(op for op in ops if op["path"] == "/response")["value"]
    assert response["status"] == "Failed"
    assert response["steps"][0]["status"] == "Passed"
    assert response["steps"][1]["status"] == "Skipped"
    assert response["steps"][1]["skipReason"] == "ConnectionNotEstablished"


def test_patch_targets_the_workflow_and_sets_workflow_status():
    ometa = _ometa_with_mock_client()
    workflow = SimpleNamespace(id=Uuid(root=UUID("122a54ac-a03f-460d-abc5-30b1de4a40f8")))

    ometa.patch_automation_workflow_response(workflow, _result_with_nested_enums(), WorkflowStatus.Successful)

    call = ometa.client.patch.call_args
    assert call.kwargs["path"].endswith("122a54ac-a03f-460d-abc5-30b1de4a40f8")
    ops = json.loads(call.kwargs["data"])
    status_op = next(op for op in ops if op["path"] == "/status")
    assert status_op["value"] == "Successful"
