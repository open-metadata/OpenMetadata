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

import json
from unittest.mock import Mock
from uuid import uuid4

import pytest

from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCaseResolutionStatus import Severities
from metadata.ingestion.models.tests_data import OMetaTestCaseResultsSample
from metadata.ingestion.sink.metadata_rest import MetadataRestSink, MetadataRestSinkConfig


@pytest.fixture
def sample_sink():
    incident_id = str(uuid4())
    result = {"testCaseStatus": "Failed", "timestamp": 1000, "incidentId": incident_id}
    metadata = Mock()
    metadata.add_test_case_results.return_value = result
    metadata.get_suffix.return_value = "/dataQuality/testCases"
    metadata.client.get.return_value = {
        "data": [
            {"id": "latest", "timestamp": 2000, "severity": "Severity3"},
            {"id": "older", "timestamp": 1000, "severity": "Severity2"},
        ]
    }
    record = OMetaTestCaseResultsSample(
        test_case_name="svc.db.schema.table.test", test_case_results=TestCaseResult.model_validate(result)
    )
    return MetadataRestSink(MetadataRestSinkConfig(), metadata), metadata, record


@pytest.mark.parametrize("severity", [Severities.Severity1, Severities.Severity5])
def test_sample_priority_patches_the_new_incidents_latest_record(sample_sink, severity):
    sink, metadata, record = sample_sink
    record.incident_severity = severity

    sink.write_test_case_results_sample(record)

    incident_id = metadata.add_test_case_results.return_value["incidentId"]
    assert metadata.client.get.call_args.args == (
        f"/dataQuality/testCases/testCaseIncidentStatus/stateId/{incident_id}",
    )
    assert metadata.client.patch.call_args.args == ("/dataQuality/testCases/testCaseIncidentStatus/latest",)
    assert json.loads(metadata.client.patch.call_args.kwargs["data"]) == [
        {"op": "add", "path": "/severity", "value": severity.value}
    ]


def test_sample_results_without_explicit_priority_keep_inferred_priority(sample_sink):
    sink, metadata, record = sample_sink

    sink.write_test_case_results_sample(record)

    metadata.client.get.assert_not_called()
    metadata.client.patch.assert_not_called()


@pytest.mark.parametrize("missing", ["incident", "history", "response"])
def test_missing_sample_incident_is_reported_instead_of_losing_priority(sample_sink, missing):
    sink, metadata, record = sample_sink
    record.incident_severity = Severities.Severity5
    if missing == "incident":
        metadata.add_test_case_results.return_value.pop("incidentId")
    elif missing == "history":
        metadata.client.get.return_value = {"data": []}
    else:
        metadata.client.get.return_value = None

    with pytest.raises(ValueError, match=r"[Ss]ample incident|Sample test failure"):
        sink.write_test_case_results_sample(record)
    metadata.client.patch.assert_not_called()
