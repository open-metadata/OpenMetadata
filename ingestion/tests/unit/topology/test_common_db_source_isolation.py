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
Tests for per-iteration fault isolation in
`CommonDbSourceService.get_tables_name_and_type`.

A single table whose name cannot be FQN-built (or whose filter check fails)
must be recorded as a per-table failure on `self.status`, and the loop must
continue with the remaining tables and views in the schema.
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.common_db_source import TableNameAndType
from metadata.ingestion.source.database.snowflake.metadata import SnowflakeSource
from metadata.utils.fqn import FQNBuildingException


@pytest.fixture
def source():
    """Build a minimal CommonDbSourceService instance via the concrete
    SnowflakeSource subclass, without invoking __init__."""
    instance = SnowflakeSource.__new__(SnowflakeSource)
    instance.metadata = MagicMock()
    instance.status = MagicMock()
    instance.source_config = MagicMock()
    instance.source_config.includeTables = True
    instance.source_config.includeViews = True
    instance.source_config.useFqnForFiltering = False
    instance.source_config.tableFilterPattern = None
    instance.context = MagicMock()
    context_state = MagicMock()
    context_state.database_service = "svc"
    context_state.database = "db"
    context_state.database_schema = "schema"
    instance.context.get.return_value = context_state
    return instance


def _fqn_side_effect(*, bad_name):
    """fqn.build that raises FQNBuildingException only for `bad_name`."""

    def _build(_metadata, *, entity_type, service_name, database_name, schema_name, table_name, **_):
        if table_name == bad_name:
            raise FQNBuildingException(f"Error building FQN for Table: Invalid name {table_name}")
        return f"{service_name}.{database_name}.{schema_name}.{table_name}"

    return _build


def test_get_tables_name_and_type_isolates_failed_table(caplog, source):
    """A bad-name table is logged and skipped; valid tables before AND after
    it are still yielded. The bad table is NOT escalated to ``status.failed``
    — per-iteration failures stay as warnings."""
    import logging

    source.query_table_names_and_types = MagicMock(
        return_value=[
            TableNameAndType(name="GOOD_1", type_=TableType.Regular),
            TableNameAndType(name='BAD"NAME', type_=TableType.Regular),
            TableNameAndType(name="GOOD_2", type_=TableType.Regular),
        ]
    )
    source.query_view_names_and_types = MagicMock(return_value=[])
    source.standardize_table_name = lambda _schema, name: name

    with (
        patch(
            "metadata.ingestion.source.database.common_db_source.fqn.build",
            side_effect=_fqn_side_effect(bad_name='BAD"NAME'),
        ),
        caplog.at_level(logging.WARNING, logger="metadata.Ingestion"),
    ):
        yielded = list(source.get_tables_name_and_type())

    assert [(n, t) for n, t in yielded] == [
        ("GOOD_1", TableType.Regular),
        ("GOOD_2", TableType.Regular),
    ]
    # Not escalated to status.failed — just a warning log.
    assert source.status.failed.call_count == 0
    warning_text = "\n".join(rec.message for rec in caplog.records)
    assert "BAD" in warning_text
    assert "Skipping table" in warning_text


def test_get_tables_name_and_type_isolates_failed_view(caplog, source):
    """Same warn-and-continue contract for views."""
    import logging

    source.query_table_names_and_types = MagicMock(return_value=[])
    source.query_view_names_and_types = MagicMock(
        return_value=[
            TableNameAndType(name="V_GOOD", type_=TableType.View),
            TableNameAndType(name='V"BAD', type_=TableType.View),
        ]
    )
    source.standardize_table_name = lambda _schema, name: name

    with (
        patch(
            "metadata.ingestion.source.database.common_db_source.fqn.build",
            side_effect=_fqn_side_effect(bad_name='V"BAD'),
        ),
        caplog.at_level(logging.WARNING, logger="metadata.Ingestion"),
    ):
        yielded = list(source.get_tables_name_and_type())

    assert yielded == [("V_GOOD", TableType.View)]
    assert source.status.failed.call_count == 0
    warning_text = "\n".join(rec.message for rec in caplog.records)
    assert "V" in warning_text
    assert "Skipping view" in warning_text


def test_get_tables_name_and_type_handles_listing_failure(source):
    """If query_table_names_and_types itself raises, the function logs a
    warning and proceeds with the view loop (no crash)."""
    source.query_table_names_and_types = MagicMock(side_effect=RuntimeError("upstream listing exploded"))
    source.query_view_names_and_types = MagicMock(return_value=[TableNameAndType(name="V1", type_=TableType.View)])
    source.standardize_table_name = lambda _schema, name: name

    with patch(
        "metadata.ingestion.source.database.common_db_source.fqn.build",
        side_effect=_fqn_side_effect(bad_name="__never_matches__"),
    ):
        yielded = list(source.get_tables_name_and_type())

    assert yielded == [("V1", TableType.View)]
