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
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

from metadata.generated.schema.entity.teams.user import User
from metadata.ingestion.models.tests_data import OMetaTestCaseResultsSample
from metadata.ingestion.ometa.ometa_api import OpenMetadata
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


def test_sample_range_tests_use_numeric_columns_and_matching_references():
    folder = Path(__file__).resolve().parents[4] / "examples/sample_data"
    tables = json.loads((folder / "datasets/tables.json").read_text())["tables"]
    table = next(table for table in tables if table["name"] == "dim_address")
    columns = {column["name"]: column["dataType"] for column in table["columns"]}
    suites = json.loads((folder / "tests/testSuites.json").read_text())["tests"]
    suite = next(suite for suite in suites if suite["executableEntityReference"].endswith(".dim_address"))
    range_tests = [case for case in suite["testCases"] if case["testDefinitionName"] == "columnValuesToBeBetween"]
    results = json.loads((folder / "tests/testCaseResults.json").read_text())["testCaseResults"]
    contracts = json.loads((folder / "dataContracts/dataContracts.json").read_text())["dataContracts"]
    contract = next(contract for contract in contracts if contract["tableFQN"].endswith(".dim_address"))

    assert len(range_tests) == 2
    for case in range_tests:
        column = case["entityLink"].split("::")[-1].removesuffix(">")
        assert columns[column] == "NUMERIC"
        name = f"{column}.{case['name']}"
        assert f"{contract['tableFQN']}.{name}" in contract["qualityExpectations"]
        result = next(result for result in results if result["name"] == name)
        if "failedRowsSample" in result:
            sample = result["failedRowsSample"]
            index = sample["columns"].index(column)
            bounds = {param["name"]: float(param["value"]) for param in case["parameterValues"]}
            assert all(not bounds["minValue"] <= float(row[index]) <= bounds["maxValue"] for row in sample["rows"])
            assert f"WHERE {column} NOT BETWEEN" in result["inspectionQuery"]


def test_sample_contract_resolves_quality_references_without_incident_details():
    source = object.__new__(SampleDataSource)
    source.metadata = object.__new__(OpenMetadata)
    source.metadata.client = Mock()
    table_id, case_id = uuid4(), uuid4()
    table_fqn = "sample_data.ecommerce_db.shopify.dim_address"
    case_name = "table_column_count_equals"
    case_fqn = f"{table_fqn}.{case_name}"
    source.data_contracts = {
        "dataContracts": [{"tableFQN": table_fqn, "name": "sample_contract", "qualityExpectations": [case_fqn]}]
    }
    source.data_contract_results = {"dataContractResults": []}

    def get_response(path):
        if path.startswith("/tables/"):
            return {
                "id": str(table_id),
                "name": "dim_address",
                "columns": [],
                "databaseSchema": {"id": str(uuid4()), "type": "databaseSchema"},
            }
        response = {
            "id": str(case_id),
            "name": case_name,
            "entityLink": f"<#E::table::{table_fqn}>",
        }
        fields = parse_qs(urlparse(path).query).get("fields", [""])[0].split(",")
        if "*" in fields or "testDefinition" in fields:
            response["testDefinition"] = {"id": str(uuid4()), "type": "testDefinition"}
        if "*" in fields or "testSuite" in fields:
            response["testSuite"] = {"id": str(uuid4()), "type": "testSuite"}
        if "*" in fields or "incidentStatus" in fields:
            response["incidentStatus"] = {
                "testCaseResolutionStatusType": "New",
                "updatedBy": {"type": "User", "fullyQualifiedName": "admin"},
            }
        return response

    source.metadata.client.get.side_effect = get_response
    records = list(source.ingest_data_contracts())

    assert len(records) == 1
    assert records[0].left is None
    contract = records[0].right
    assert contract.entity.id.root == table_id
    assert contract.qualityExpectations[0].id.root == case_id
    assert contract.qualityExpectations[0].type == "testCase"
