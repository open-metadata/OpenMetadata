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

"""
Unit tests for the Dremio metadata source: creation, databases, delegation to the parent
"""

from unittest.mock import MagicMock, PropertyMock, patch

import pytest

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.dremioConnection import (
    DremioConnection as DremioConnectionConfig,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.dremio.metadata import DremioSource

MODULE = "metadata.ingestion.source.database.dremio.metadata"


def dremio_source(database=None, configured_database=None) -> DremioSource:
    source = DremioSource.__new__(DremioSource)
    source.database = database
    source.service_connection = MagicMock(database=configured_database)
    source.source_config = MagicMock(databaseFilterPattern=None, useFqnForFiltering=False)
    source.status = MagicMock()
    source.metadata = MagicMock()
    source.context = MagicMock()
    source.context.get.return_value.database_service = "dremio_service"
    return source


class TestCreation:
    def test_no_database_is_selected_at_the_start(self):
        with patch.object(CommonDbSourceService, "__init__", return_value=None):
            source = DremioSource(MagicMock(), MagicMock())

        assert source.database is None

    def test_create_builds_a_source_from_a_dremio_connection(self):
        config = MagicMock()
        config.serviceConnection.root.config = DremioConnectionConfig.model_validate(
            {"authType": {"hostPort": "http://dremio:9047", "username": "u", "password": "p"}}
        )

        with (
            patch(f"{MODULE}.WorkflowSource") as workflow_source,
            patch.object(CommonDbSourceService, "__init__", return_value=None),
        ):
            workflow_source.model_validate.return_value = config
            source = DremioSource.create({}, MagicMock())

        assert isinstance(source, DremioSource)

    def test_create_rejects_another_connection(self):
        with patch(f"{MODULE}.WorkflowSource") as workflow_source:
            workflow_source.model_validate.return_value.serviceConnection.root.config = object()

            with pytest.raises(InvalidSourceException, match="Expected DremioConnection"):
                DremioSource.create({}, MagicMock())


class TestDatabases:
    def test_the_configured_namespace_is_the_only_database(self):
        source = dremio_source(configured_database="polaris")
        source.set_inspector = MagicMock()

        assert list(source.get_database_names()) == ["polaris"]
        source.set_inspector.assert_called_once_with(database_name="polaris")

    def test_the_namespaces_come_from_the_catalog(self):
        source = dremio_source()
        source._execute_database_query = MagicMock(return_value=["polaris", "consolidated"])
        source.set_inspector = MagicMock()

        with (
            patch(f"{MODULE}.fqn.build", side_effect=lambda *_, **kw: kw["database_name"]),
            patch(f"{MODULE}.filter_by_database", return_value=False),
        ):
            assert list(source.get_database_names()) == ["polaris", "consolidated"]

    def test_a_filtered_namespace_is_skipped_and_reported(self):
        source = dremio_source()
        source._execute_database_query = MagicMock(return_value=["polaris", "sys_like"])
        source.set_inspector = MagicMock()

        with (
            patch(f"{MODULE}.fqn.build", side_effect=lambda *_, **kw: kw["database_name"]),
            patch(f"{MODULE}.filter_by_database", side_effect=lambda _, name: name == "sys_like"),
        ):
            assert list(source.get_database_names()) == ["polaris"]

        source.status.filter.assert_called_once_with("sys_like", "Database Filtered Out")

    def test_the_filter_is_applied_to_the_fqn_when_asked(self):
        source = dremio_source()
        source.source_config.useFqnForFiltering = True
        source._execute_database_query = MagicMock(return_value=["polaris"])
        source.set_inspector = MagicMock()

        with (
            patch(f"{MODULE}.fqn.build", return_value="dremio_service.polaris"),
            patch(f"{MODULE}.filter_by_database", return_value=False) as filter_by_database,
        ):
            list(source.get_database_names())

        assert filter_by_database.call_args.args[1] == "dremio_service.polaris"

    def test_a_namespace_that_cannot_be_opened_does_not_stop_the_others(self):
        source = dremio_source()
        source._execute_database_query = MagicMock(return_value=["broken", "polaris"])
        source.set_inspector = MagicMock(side_effect=[RuntimeError("denied"), None])

        with (
            patch(f"{MODULE}.fqn.build", side_effect=lambda *_, **kw: kw["database_name"]),
            patch(f"{MODULE}.filter_by_database", return_value=False),
        ):
            assert list(source.get_database_names()) == ["polaris"]

    def test_the_raw_names_are_the_namespaces_of_the_catalog(self):
        source = dremio_source()
        source._execute_database_query = MagicMock(return_value=["polaris"])

        assert list(source.get_database_names_raw()) == ["polaris"]
        assert "STARTS_WITH(SCHEMA_NAME, '@')" in source._execute_database_query.call_args.args[0]

    def test_the_configured_database_is_read_from_the_connection(self):
        assert dremio_source(configured_database="polaris").get_configured_database() == "polaris"
        assert dremio_source().get_configured_database() is None


class TestSchemasWithoutNamespace:
    def test_the_schemas_come_from_the_inspector_before_a_namespace_is_selected(self):
        source = dremio_source(database=None)

        with patch.object(DremioSource, "inspector", new_callable=PropertyMock, return_value=MagicMock()) as inspector:
            inspector.return_value.get_schema_names.return_value = ["polaris", "polaris.demo"]

            assert list(source.get_raw_database_schema_names()) == ["polaris", "polaris.demo"]


class TestDelegationToTheParent:
    def test_the_description_of_a_table_is_empty(self):
        assert DremioSource.get_table_description("demo", "sales", MagicMock()) == ""

    def test_the_columns_are_read_with_the_full_schema_path(self):
        source = dremio_source(database="polaris")
        inspector = MagicMock()

        with patch.object(CommonDbSourceService, "get_columns_and_constraints", return_value=([], [], [])) as parent:
            source.get_columns_and_constraints("demo", "sales", "polaris", inspector, TableType.Regular)

        parent.assert_called_once_with("polaris.demo", "sales", "polaris", inspector, TableType.Regular)

    def test_the_namespace_is_remembered_when_the_inspector_is_set(self):
        source = dremio_source()

        with patch.object(CommonDbSourceService, "set_inspector") as parent:
            source.set_inspector("polaris")

        parent.assert_called_once_with("polaris")
        assert source.database == "polaris"
