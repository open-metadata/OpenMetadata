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

from types import SimpleNamespace
from unittest.mock import MagicMock, PropertyMock, call, patch

import pytest

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.databendConnection import (
    DatabendConnection as DatabendConnectionConfig,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.source.database.databend.metadata import DatabendSource
from metadata.ingestion.source.database.databend.service_spec import ServiceSpec


def _catalog_source(catalog=None):
    source = DatabendSource.__new__(DatabendSource)
    source.service_connection = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
            "catalog": catalog,
        }
    )
    source.metadata = MagicMock()
    source.context = MagicMock()
    source.context.get.return_value.database_service = "databend_service"
    source.source_config = SimpleNamespace(
        databaseFilterPattern=None,
        useFqnForFiltering=False,
    )
    source.status = MagicMock()
    source.database_entity_source_state = set()
    return source


def test_configured_catalog_is_ingested_as_database():
    source = _catalog_source("lakehouse")
    source._validate_catalog = MagicMock()

    assert list(source.get_database_names()) == ["lakehouse"]
    source._validate_catalog.assert_called_once_with("lakehouse")


def test_catalog_switch_releases_previous_engine_and_reflection_state():
    source = _catalog_source()
    old_thread_connection = MagicMock()
    old_inspector = MagicMock()
    old_session = MagicMock()
    old_engine = MagicMock()
    old_connection = MagicMock()
    source._connection_map = {1: old_thread_connection}
    source._inspector_map = {1: old_inspector}
    source.session = old_session
    source.engine = old_engine
    source.connection_obj = old_engine
    source._connection = old_connection

    new_engine = MagicMock()
    new_connection = MagicMock()
    new_connection.client = new_engine
    new_session = MagicMock()

    with (
        patch(
            "metadata.ingestion.source.database.databend.metadata.create_connection",
            return_value=new_connection,
        ) as create_connection,
        patch(
            "metadata.ingestion.source.database.databend.metadata.create_and_bind_thread_safe_session",
            return_value=new_session,
        ),
    ):
        source.set_inspector("lakehouse")

    old_thread_connection.close.assert_called_once_with()
    old_session.remove.assert_called_once_with()
    old_engine.dispose.assert_called_once_with()
    old_connection.close.assert_called_once_with()
    assert source._connection_map == {}
    assert source._inspector_map == {}
    assert source._connection is new_connection
    assert source.engine is new_engine
    assert source.session is new_session
    assert source.connection_obj is new_engine
    switched_config = create_connection.call_args.args[0]
    assert switched_config.catalog == "lakehouse"
    assert source.service_connection.catalog is None


def test_catalogs_are_enumerated_when_catalog_is_not_configured():
    source = _catalog_source()
    source._connection_map = {0: MagicMock()}
    source._connection_map[0].execute.return_value = [("default",), ("lakehouse",)]
    source._validate_catalog = MagicMock()

    with patch.object(
        DatabendSource,
        "connection",
        new_callable=PropertyMock,
        return_value=source._connection_map[0],
    ):
        catalogs = list(source.get_database_names())

    assert catalogs == ["default", "lakehouse"]
    assert source._validate_catalog.call_args_list == [call("default"), call("lakehouse")]


def test_empty_catalog_listing_fails_ingestion():
    source = _catalog_source()
    connection = MagicMock()
    connection.execute.return_value = []

    with (
        patch.object(
            DatabendSource,
            "connection",
            new_callable=PropertyMock,
            return_value=connection,
        ),
        pytest.raises(RuntimeError, match="No accessible Databend catalogs found"),
    ):
        list(source.get_database_names())


def test_database_filter_is_applied_to_catalogs():
    source = _catalog_source()
    connection = MagicMock()
    connection.execute.return_value = [("default",), ("lakehouse",)]
    source._validate_catalog = MagicMock()

    with (
        patch.object(
            DatabendSource,
            "connection",
            new_callable=PropertyMock,
            return_value=connection,
        ),
        patch(
            "metadata.ingestion.source.database.databend.metadata.filter_by_database",
            side_effect=[True, False],
        ),
        patch(
            "metadata.ingestion.source.database.databend.metadata.fqn.build",
            side_effect=["databend_service.default", "databend_service.lakehouse"],
        ),
    ):
        catalogs = list(source.get_database_names())

    assert catalogs == ["lakehouse"]
    source.status.filter.assert_called_once_with("databend_service.default", "Database Filtered Out")
    source._validate_catalog.assert_called_once_with("lakehouse")


def test_unavailable_catalog_is_recorded_and_other_catalogs_continue():
    source = _catalog_source()
    connection = MagicMock()
    connection.execute.return_value = [("broken",), ("default",)]
    source._validate_catalog = MagicMock(side_effect=[RuntimeError("denied"), None])

    with (
        patch.object(
            DatabendSource,
            "connection",
            new_callable=PropertyMock,
            return_value=connection,
        ),
        patch(
            "metadata.ingestion.source.database.databend.metadata.fqn.build",
            side_effect=["databend_service.broken", "databend_service.default"],
        ),
    ):
        catalogs = list(source.get_database_names())

    assert catalogs == ["default"]
    assert source.status.failed.call_count == 1
    assert source.status.failed.call_args.args[0].name == "broken"
    assert source.database_entity_source_state == {"databend_service.broken"}


def test_unavailable_catalog_is_kept_in_database_deletion_live_set():
    source = _catalog_source()
    connection = MagicMock()
    connection.execute.return_value = [("broken",), ("default",)]
    source._validate_catalog = MagicMock(side_effect=[RuntimeError("denied"), None])

    with (
        patch.object(
            DatabendSource,
            "connection",
            new_callable=PropertyMock,
            return_value=connection,
        ),
        patch(
            "metadata.ingestion.source.database.databend.metadata.fqn.build",
            side_effect=["databend_service.broken", "databend_service.default"],
        ),
    ):
        assert list(source.get_database_names()) == ["default"]

    source.source_config.markDeletedDatabases = True
    source._get_filtered_database_names = MagicMock(return_value=["default"])
    with (
        patch(
            "metadata.ingestion.source.database.database_service.fqn.build",
            return_value="databend_service.default",
        ),
        patch(
            "metadata.ingestion.source.database.database_service.delete_entity_from_source",
            return_value=iter(()),
        ) as delete_entity_from_source,
    ):
        assert list(source.mark_databases_as_deleted()) == []

    delete_entity_from_source.assert_called_once_with(
        metadata=source.metadata,
        entity_type=Database,
        entity_source_state={
            "databend_service.broken",
            "databend_service.default",
        },
        recursive=True,
        params={"service": "databend_service"},
    )


def test_all_selected_catalogs_failing_fails_ingestion():
    source = _catalog_source()
    connection = MagicMock()
    connection.execute.return_value = [("broken",)]
    source._validate_catalog = MagicMock(side_effect=RuntimeError("denied"))

    with (
        patch.object(
            DatabendSource,
            "connection",
            new_callable=PropertyMock,
            return_value=connection,
        ),
        pytest.raises(RuntimeError, match="Failed to ingest any selected"),
    ):
        list(source.get_database_names())


def test_databend_databases_are_ingested_as_schemas():
    source = DatabendSource.__new__(DatabendSource)
    source.service_connection = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
        }
    )
    inspector = MagicMock()
    inspector.get_schema_names.return_value = [
        "default",
        "analytics",
        "information_schema",
        "system",
        "system_history",
    ]

    with patch.object(DatabendSource, "inspector", new_callable=PropertyMock, return_value=inspector):
        assert list(source.get_raw_database_schema_names()) == [
            "default",
            "analytics",
        ]


def test_database_schema_restricts_schema_ingestion():
    source = DatabendSource.__new__(DatabendSource)
    source.service_connection = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
            "databaseSchema": "analytics",
        }
    )
    with patch.object(DatabendSource, "inspector", new_callable=PropertyMock) as inspector_property:
        assert list(source.get_raw_database_schema_names()) == ["analytics"]
        inspector_property.assert_not_called()


def test_database_schema_allows_explicit_system_database_selection():
    source = DatabendSource.__new__(DatabendSource)
    source.service_connection = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
            "databaseSchema": "system",
        }
    )
    with patch.object(DatabendSource, "inspector", new_callable=PropertyMock) as inspector_property:
        assert list(source.get_raw_database_schema_names()) == ["system"]
        inspector_property.assert_not_called()


def test_database_schema_allows_explicit_system_history_database_selection():
    source = DatabendSource.__new__(DatabendSource)
    source.service_connection = DatabendConnectionConfig.model_validate(
        {
            "username": "openmetadata",
            "password": "secret",
            "hostPort": "localhost:8000",
            "databaseSchema": "system_history",
        }
    )
    with patch.object(DatabendSource, "inspector", new_callable=PropertyMock) as inspector_property:
        assert list(source.get_raw_database_schema_names()) == ["system_history"]
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
