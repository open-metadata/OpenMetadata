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
Tests for the mark-deleted safety guard introduced in issue #18187.

The fix ensures that when table listing fails for a schema (e.g. due to a
transient connectivity error), `mark_tables_as_deleted` skips that schema
rather than wiping all of its tables from OpenMetadata.
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.database.database_service import DatabaseServiceSource


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

HEALTHY_SCHEMA = "my_service.my_db.healthy_schema"
FAILED_SCHEMA = "my_service.my_db.broken_schema"
ANOTHER_HEALTHY_SCHEMA = "my_service.my_db.another_schema"


def _make_source(schema_fqn_list: list, mark_deleted: bool = True) -> MagicMock:
    """Return a MagicMock that delegates the real mark_tables_as_deleted."""
    source = MagicMock(spec=DatabaseServiceSource)
    source.mark_tables_as_deleted = DatabaseServiceSource.mark_tables_as_deleted.__get__(source)

    ctx = MagicMock()
    ctx.database = "my_db"
    source.context.get.return_value = ctx

    source.source_config.markDeletedTables = mark_deleted
    source._get_filtered_schema_names.return_value = schema_fqn_list
    source.schemas_with_table_listing_errors = set()
    source.database_source_state = set()

    return source


# ---------------------------------------------------------------------------
# Tests: mark_tables_as_deleted skips failed schemas
# ---------------------------------------------------------------------------


class TestMarkDeletedTablesSafety:
    def test_no_failed_schemas_processes_all(self):
        """When no schema had listing errors, delete_entity_from_source is called for each."""
        source = _make_source([HEALTHY_SCHEMA, ANOTHER_HEALTHY_SCHEMA])

        with patch(
            "metadata.ingestion.source.database.database_service.delete_entity_from_source",
            return_value=iter([]),
        ) as mock_delete:
            list(source.mark_tables_as_deleted())

        assert mock_delete.call_count == 2
        called_schemas = {call.kwargs["params"]["database"] for call in mock_delete.call_args_list}
        assert called_schemas == {HEALTHY_SCHEMA, ANOTHER_HEALTHY_SCHEMA}

    def test_failed_schema_is_skipped(self):
        """A schema in schemas_with_table_listing_errors must never reach delete_entity_from_source."""
        source = _make_source([HEALTHY_SCHEMA, FAILED_SCHEMA])
        source.schemas_with_table_listing_errors.add(FAILED_SCHEMA)

        with patch(
            "metadata.ingestion.source.database.database_service.delete_entity_from_source",
            return_value=iter([]),
        ) as mock_delete:
            list(source.mark_tables_as_deleted())

        assert mock_delete.call_count == 1
        assert mock_delete.call_args.kwargs["params"]["database"] == HEALTHY_SCHEMA

    def test_all_failed_schemas_skips_all_deletes(self):
        """If every schema failed listing, delete_entity_from_source is never called."""
        source = _make_source([FAILED_SCHEMA])
        source.schemas_with_table_listing_errors.add(FAILED_SCHEMA)

        with patch(
            "metadata.ingestion.source.database.database_service.delete_entity_from_source",
            return_value=iter([]),
        ) as mock_delete:
            list(source.mark_tables_as_deleted())

        mock_delete.assert_not_called()

    def test_mark_deleted_false_skips_everything(self):
        """When markDeletedTables is False, nothing runs regardless of error state."""
        source = _make_source([HEALTHY_SCHEMA, FAILED_SCHEMA], mark_deleted=False)

        with patch(
            "metadata.ingestion.source.database.database_service.delete_entity_from_source",
            return_value=iter([]),
        ) as mock_delete:
            list(source.mark_tables_as_deleted())

        mock_delete.assert_not_called()

    def test_multiple_failed_schemas_only_skips_those(self):
        """Only the failed schemas are skipped; healthy ones still get processed."""
        schemas = [HEALTHY_SCHEMA, FAILED_SCHEMA, ANOTHER_HEALTHY_SCHEMA]
        source = _make_source(schemas)
        source.schemas_with_table_listing_errors.add(FAILED_SCHEMA)

        with patch(
            "metadata.ingestion.source.database.database_service.delete_entity_from_source",
            return_value=iter([]),
        ) as mock_delete:
            list(source.mark_tables_as_deleted())

        assert mock_delete.call_count == 2
        called_schemas = {call.kwargs["params"]["database"] for call in mock_delete.call_args_list}
        assert called_schemas == {HEALTHY_SCHEMA, ANOTHER_HEALTHY_SCHEMA}
        assert FAILED_SCHEMA not in called_schemas


# ---------------------------------------------------------------------------
# Tests: get_tables_name_and_type populates schemas_with_table_listing_errors
# ---------------------------------------------------------------------------


class TestGetTablesNameAndTypeErrorTracking:
    def _make_common_source(self, schema_name: str, schema_fqn: str) -> MagicMock:
        """Minimal mock for CommonDbSourceService.get_tables_name_and_type."""
        from metadata.ingestion.source.database.common_db_source import CommonDbSourceService

        source = MagicMock(spec=CommonDbSourceService)
        source.get_tables_name_and_type = CommonDbSourceService.get_tables_name_and_type.__get__(source)

        ctx = MagicMock()
        ctx.database_schema = schema_name
        ctx.database_service = "my_service"
        ctx.database = "my_db"
        source.context.get.return_value = ctx

        source.source_config.includeTables = True
        source.source_config.includeViews = False
        source.source_config.useFqnForFiltering = False

        source.schemas_with_table_listing_errors = set()
        return source, schema_name, schema_fqn

    def test_listing_error_adds_schema_to_error_set(self):
        """When query_table_names_and_types raises, the schema FQN is added to the error set."""
        from metadata.ingestion.source.database.common_db_source import CommonDbSourceService

        source = MagicMock(spec=CommonDbSourceService)
        source.get_tables_name_and_type = CommonDbSourceService.get_tables_name_and_type.__get__(source)

        ctx = MagicMock()
        ctx.database_schema = "broken_schema"
        ctx.database_service = "my_service"
        ctx.database = "my_db"
        source.context.get.return_value = ctx

        source.source_config.includeTables = True
        source.source_config.includeViews = False
        source.source_config.useFqnForFiltering = False
        source.schemas_with_table_listing_errors = set()

        source.query_table_names_and_types.side_effect = Exception("connection refused")

        expected_fqn = "my_service.my_db.broken_schema"
        with patch(
            "metadata.ingestion.source.database.common_db_source.fqn.build",
            return_value=expected_fqn,
        ):
            list(source.get_tables_name_and_type())

        assert expected_fqn in source.schemas_with_table_listing_errors

    def test_listing_success_leaves_error_set_empty(self):
        """Successful listing must not add anything to schemas_with_table_listing_errors."""
        from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
        from metadata.generated.schema.entity.data.table import TableType
        from metadata.ingestion.models.topology import TableNameAndType

        source = MagicMock(spec=CommonDbSourceService)
        source.get_tables_name_and_type = CommonDbSourceService.get_tables_name_and_type.__get__(source)

        ctx = MagicMock()
        ctx.database_schema = "good_schema"
        ctx.database_service = "my_service"
        ctx.database = "my_db"
        source.context.get.return_value = ctx

        source.source_config.includeTables = True
        source.source_config.includeViews = False
        source.source_config.useFqnForFiltering = False
        source.source_config.tableFilterPattern = None
        source.schemas_with_table_listing_errors = set()

        source.query_table_names_and_types.return_value = [
            TableNameAndType(name="orders", type_=TableType.Regular)
        ]
        source.standardize_table_name.side_effect = lambda schema, name: name
        source.get_tag_labels.return_value = None

        with patch(
            "metadata.ingestion.source.database.common_db_source.filter_by_table",
            return_value=False,
        ):
            list(source.get_tables_name_and_type())

        assert source.schemas_with_table_listing_errors == set()

    def test_listing_error_with_no_fqn_does_not_add_none(self):
        """If fqn.build returns None (schema not found), nothing should be added to the error set."""
        from metadata.ingestion.source.database.common_db_source import CommonDbSourceService

        source = MagicMock(spec=CommonDbSourceService)
        source.get_tables_name_and_type = CommonDbSourceService.get_tables_name_and_type.__get__(source)

        ctx = MagicMock()
        ctx.database_schema = "missing_schema"
        ctx.database_service = "my_service"
        ctx.database = "my_db"
        source.context.get.return_value = ctx

        source.source_config.includeTables = True
        source.source_config.includeViews = False
        source.source_config.useFqnForFiltering = False
        source.schemas_with_table_listing_errors = set()

        source.query_table_names_and_types.side_effect = Exception("timeout")

        with patch(
            "metadata.ingestion.source.database.common_db_source.fqn.build",
            return_value=None,
        ):
            list(source.get_tables_name_and_type())

        assert None not in source.schemas_with_table_listing_errors
        assert len(source.schemas_with_table_listing_errors) == 0
