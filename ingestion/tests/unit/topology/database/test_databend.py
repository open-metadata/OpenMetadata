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
"""Unit tests for the Databend metadata topology."""

from unittest.mock import MagicMock, PropertyMock, patch

import pytest

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.databendConnection import (
    DatabendConnection as DatabendConnectionConfig,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.source.database.databend.metadata import DatabendSource
from metadata.ingestion.source.database.databend.service_spec import ServiceSpec


def _source(**overrides) -> DatabendSource:
    source = DatabendSource.__new__(DatabendSource)
    source.service_connection = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
            **overrides,
        }
    )
    return source


def test_default_catalog_is_the_only_database():
    source = _source()

    with patch.object(DatabendSource, "inspector", new_callable=PropertyMock) as inspector_property:
        assert list(source.get_database_names()) == ["default"]

    inspector_property.assert_not_called()


def test_databend_databases_are_ingested_as_schemas():
    source = _source()
    inspector = MagicMock()
    inspector.get_schema_names.return_value = [
        "default",
        "analytics",
        "information_schema",
        "system",
        "system_history",
    ]

    with patch.object(DatabendSource, "inspector", new_callable=PropertyMock, return_value=inspector):
        assert list(source.get_raw_database_schema_names()) == ["default", "analytics"]


@pytest.mark.parametrize("database_schema", ["analytics", "system", "system_history"])
def test_database_schema_restricts_schema_ingestion(database_schema):
    source = _source(databaseSchema=database_schema)

    with patch.object(DatabendSource, "inspector", new_callable=PropertyMock) as inspector_property:
        assert list(source.get_raw_database_schema_names()) == [database_schema]

    inspector_property.assert_not_called()


def test_tables_are_enumerated_from_databend_schema():
    source = DatabendSource.__new__(DatabendSource)
    inspector = MagicMock()
    inspector.get_table_names.return_value = ["events", "users"]

    with patch.object(DatabendSource, "inspector", new_callable=PropertyMock, return_value=inspector):
        tables = list(source.query_table_names_and_types("analytics"))

    assert [(table.name, table.type_) for table in tables] == [
        ("events", TableType.Regular),
        ("users", TableType.Regular),
    ]
    inspector.get_table_names.assert_called_once_with("analytics")


def test_views_are_enumerated_from_databend_schema():
    source = DatabendSource.__new__(DatabendSource)
    inspector = MagicMock()
    inspector.get_view_names.return_value = ["active_users"]

    with patch.object(DatabendSource, "inspector", new_callable=PropertyMock, return_value=inspector):
        views = list(source.query_view_names_and_types("analytics"))

    assert [(view.name, view.type_) for view in views] == [("active_users", TableType.View)]
    inspector.get_view_names.assert_called_once_with("analytics")


def test_service_spec_registers_metadata_profiler_and_sampler():
    assert ServiceSpec.connection_class is not None
    assert ServiceSpec.metadata_source_class.endswith(".DatabendSource")
    assert ServiceSpec.connection_class.endswith(".DatabendConnection")
    assert ServiceSpec.profiler_class is not None
    assert ServiceSpec.profiler_class.endswith(".SQAProfilerInterface")
    assert ServiceSpec.sampler_class is not None
    assert ServiceSpec.sampler_class.endswith(".SQASampler")
    assert ServiceSpec.test_suite_class is not None
    assert ServiceSpec.test_suite_class.endswith(".SQATestSuiteInterface")
    assert ServiceSpec.lineage_source_class is None
    assert ServiceSpec.usage_source_class is None


def test_create_rejects_a_non_databend_connection():
    config = {
        "type": "mysql",
        "serviceName": "mysql_test",
        "serviceConnection": {
            "config": {
                "type": "Mysql",
                "hostPort": "localhost:3306",
                "username": "root",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    metadata = MagicMock()
    with pytest.raises(InvalidSourceException, match="Expected DatabendConnection"):
        DatabendSource.create(config, metadata)
