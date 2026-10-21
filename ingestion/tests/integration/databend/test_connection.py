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
"""Databend connection integration tests."""

from metadata.ingestion.source.connections import get_test_connection_fn


def test_connection_checks_catalog_schemas_tables_and_views(metadata, databend_connection):
    result = get_test_connection_fn(databend_connection)(metadata)

    assert [step.name for step in result.steps] == [
        "CheckAccess",
        "GetDatabases",
        "GetSchemas",
        "GetTables",
        "GetViews",
        "GetLineage",
    ]
    assert all(step.passed for step in result.steps if step.name != "GetLineage")


def test_connection_lineage_step_is_optional_without_enterprise_license(metadata, databend_connection):
    """The test container has no license, so lineage is unavailable but must not fail the test connection."""
    result = get_test_connection_fn(databend_connection)(metadata)

    lineage_step = next(step for step in result.steps if step.name == "GetLineage")
    assert lineage_step.passed is False
    assert lineage_step.mandatory is False


def test_connection_without_database_schema_starts_in_default_database(metadata, databend_connection):
    configured_connection = databend_connection.model_copy(update={"databaseSchema": None})

    result = get_test_connection_fn(configured_connection)(metadata)

    assert all(step.passed for step in result.steps if step.name != "GetLineage")


def test_connection_explains_missing_sslmode_for_http_endpoint(metadata, databend_connection):
    configured_connection = databend_connection.model_copy(update={"connectionOptions": None})

    result = get_test_connection_fn(configured_connection)(metadata)

    assert len(result.steps) == 1
    assert result.steps[0].name == "CheckAccess"
    assert result.steps[0].passed is False
    assert "sslmode=disable" in result.steps[0].errorLog
    assert "HTTP/TLS mode" in result.steps[0].errorLog
    assert "InvalidContentType" not in result.steps[0].errorLog
