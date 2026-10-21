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
"""Exercise fluent bulk creation through the real HTTP serialization boundary."""

import json
from unittest.mock import MagicMock
from uuid import UUID

import pytest
from requests import Response

from metadata.generated.schema.api.data.createGlossaryTerm import CreateGlossaryTermRequest
from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import OpenMetadataConnection
from metadata.generated.schema.type.bulkCreateResult import BulkCreateResult, ConflictPolicy, Reason, Status
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sdk import GlossaryTerms, TestCases

CREATED_ID = "550e8400-e29b-41d4-a716-446655440000"


@pytest.fixture(params=["testCases", "glossaryTerms"])
def bulk_api(request, monkeypatch):
    client = OpenMetadata(
        OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="openmetadata",
            securityConfig={"jwtToken": "test-token"},
            enableVersionValidation=False,
        )
    )
    send = MagicMock()
    monkeypatch.setattr(client.client._session, "send", send)
    if request.param == "testCases":
        facade = TestCases
        payload = {
            "name": "row_count",
            "entityLink": "<#E::table::service.db.schema.table>",
            "testDefinition": "tableRowCountToEqual",
        }
        create_request = CreateTestCaseRequest(**payload)
        endpoint = "dataQuality/testCases"
    else:
        facade = GlossaryTerms
        payload = {"name": "Revenue", "description": "Revenue in €", "glossary": "Finance"}
        create_request = CreateGlossaryTermRequest(**payload)
        endpoint = "glossaryTerms"
    monkeypatch.setattr(facade, "_default_client", client)
    yield facade, create_request, endpoint, payload, send
    client.close()


def response(payload, status=200):
    result = Response()
    result.status_code = status
    result.headers["Content-Type"] = "application/json"
    result._content = json.dumps(payload).encode()
    return result


def outcomes(policy):
    conflict_status = "skipped" if policy is ConflictPolicy.skip else "failed"
    return {
        "onConflict": policy.value,
        "createdCount": 1,
        "skippedCount": 2 if policy is ConflictPolicy.skip else 0,
        "failedCount": 1 if policy is ConflictPolicy.skip else 3,
        "results": [
            {"index": 0, "status": "created", "id": CREATED_ID, "fullyQualifiedName": "entity.created"},
            {"index": 1, "status": conflict_status, "reason": "ALREADY_EXISTS", "message": "Entity already exists"},
            {"index": 2, "status": conflict_status, "reason": "DUPLICATE_IN_REQUEST", "message": "Repeated input"},
            {"index": 3, "status": "failed", "reason": "VALIDATION_ERROR", "message": "Invalid input"},
        ],
    }


@pytest.mark.parametrize("policy", [None, ConflictPolicy.skip, ConflictPolicy.fail])
def test_bulk_create_sends_policy_and_parses_outcomes(bulk_api, policy):
    facade, create_request, endpoint, payload, send = bulk_api
    expected_policy = policy or ConflictPolicy.skip
    send.return_value = response(outcomes(expected_policy))

    options = {} if policy is None else {"on_conflict": policy}
    result = facade.create_many([create_request] * 4, **options)

    assert send.call_count == 1
    sent = send.call_args.args[0]
    assert sent.method == "POST"
    assert sent.url == f"http://localhost:8585/api/v1/{endpoint}/createMany?onConflict={expected_policy.value}"
    body = json.loads(sent.body)
    assert len(body) == 4
    for item in body:
        assert payload.items() <= item.items()
    assert isinstance(result, BulkCreateResult)
    assert result.onConflict is expected_policy
    assert (result.createdCount, result.skippedCount, result.failedCount) == (
        (1, 2, 1) if expected_policy is ConflictPolicy.skip else (1, 0, 3)
    )
    assert [item.index for item in result.results] == [0, 1, 2, 3]
    assert result.results[0].id.root == UUID(CREATED_ID)
    assert result.results[0].status is Status.created
    assert result.results[0].fullyQualifiedName.root == "entity.created"
    conflict_status = Status.skipped if expected_policy is ConflictPolicy.skip else Status.failed
    assert [item.status for item in result.results[1:]] == [conflict_status, conflict_status, Status.failed]
    assert [item.reason for item in result.results[1:]] == [
        Reason.ALREADY_EXISTS,
        Reason.DUPLICATE_IN_REQUEST,
        Reason.VALIDATION_ERROR,
    ]
    assert [item.message for item in result.results[1:]] == ["Entity already exists", "Repeated input", "Invalid input"]
    assert all(item.id is None for item in result.results[1:])


def test_empty_batch_is_sent_as_json_array(bulk_api):
    facade, _, _, _, send = bulk_api
    send.return_value = response(
        {"onConflict": "skip", "createdCount": 0, "skippedCount": 0, "failedCount": 0, "results": []}
    )

    result = facade.create_many([])

    assert send.call_args.args[0].body == "[]"
    assert result.results == []
    assert (result.createdCount, result.skippedCount, result.failedCount) == (0, 0, 0)


def test_http_errors_are_not_reported_as_item_outcomes(bulk_api):
    facade, create_request, _, _, send = bulk_api
    send.return_value = response({"code": 403, "message": "Permission denied"}, status=403)

    with pytest.raises(APIError, match="Permission denied"):
        facade.create_many([create_request])
