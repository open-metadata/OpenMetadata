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
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock
from uuid import uuid4

from metadata.generated.schema.entity.teams.user import User
from metadata.ingestion.models.tests_data import OMetaTestCaseResultsSample
from metadata.ingestion.source.database.sample_data import SampleDataSource, get_lineage_details


def test_get_lineage_details_falls_back_when_camel_case_columns_are_null():
    details = get_lineage_details(
        {
            "columnsLineage": None,
            "columns_lineage": [
                {
                    "fromColumns": ["service.database.schema.source.id"],
                    "toColumn": "service.database.schema.target.id",
                }
            ],
        },
        None,
        datetime(2026, 1, 1, tzinfo=timezone.utc),
    )

    assert details is not None
    assert details.columnsLineage is not None
    assert len(details.columnsLineage) == 1
    assert details.columnsLineage[0].toColumn.root == "service.database.schema.target.id"


def test_sample_incident_sequences_start_with_a_failure_instead_of_reopening():
    source = object.__new__(SampleDataSource)
    fixture = Path(__file__).resolve().parents[4] / "examples/sample_data/tests/testSuites.json"
    source.tests_suites = json.loads(fixture.read_text())
    source.metadata = Mock()
    source.metadata.get_by_name.return_value = User(
        id=uuid4(), name="sample_owner", fullyQualifiedName="sample_owner", email="sample@example.com"
    )

    records = [item.right for item in source.ingest_incidents()]
    expected_failures = [
        resolution["testCaseResolutionStatusType"] == "New"
        for suite in source.tests_suites["tests"]
        for test_case in suite["testCases"]
        for sequence in test_case["resolutions"].values()
        for resolution in sequence
    ]
    failures = [record for record in records if isinstance(record, OMetaTestCaseResultsSample)]
    assert any(expected_failures)
    assert [isinstance(record, OMetaTestCaseResultsSample) for record in records] == expected_failures
    assert all(record.test_case_results.testCaseStatus.value == "Failed" for record in failures)
    assert all(record.test_case_name for record in failures)
    expected_severities = [
        resolution["severity"]
        for suite in source.tests_suites["tests"]
        for test_case in suite["testCases"]
        for sequence in test_case["resolutions"].values()
        for resolution in sequence
        if resolution["testCaseResolutionStatusType"] == "New"
    ]
    assert [record.incident_severity.value for record in failures] == expected_severities
    statuses = [record.test_case_resolution for record in records if not isinstance(record, OMetaTestCaseResultsSample)]
    assert all(record.testCaseResolutionStatusType.value != "New" for record in statuses)
    expected_statuses = [
        resolution["testCaseResolutionStatusType"]
        for suite in source.tests_suites["tests"]
        for test_case in suite["testCases"]
        for sequence in test_case["resolutions"].values()
        for resolution in sequence
        if resolution["testCaseResolutionStatusType"] != "New"
    ]
    assert [record.testCaseResolutionStatusType.value for record in statuses] == expected_statuses
