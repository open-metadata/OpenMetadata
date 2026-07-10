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
"""Databricks seeds ``Database`` + per-database ``DatabaseSchema`` progress totals
from a single cross-catalog ``system.information_schema.schemata``, and reconciles
when that view is unavailable."""

from types import SimpleNamespace
from unittest.mock import MagicMock, PropertyMock, patch

import pytest

from metadata.ingestion.progress.modes import ProgressMode, TotalsDeclarer
from metadata.ingestion.progress.tracking import ProgressTracking
from metadata.ingestion.source.database.databricks import metadata as databricks_metadata

DatabricksSource = databricks_metadata.DatabricksSource


@pytest.fixture
def databricks_source():
    source = object.__new__(DatabricksSource)
    source.source_config = SimpleNamespace(
        useFqnForFiltering=False,
        databaseFilterPattern=None,
        schemaFilterPattern=None,
    )
    source.metadata = MagicMock()
    source.status = MagicMock()
    source.context = MagicMock()
    source.context.get.return_value = SimpleNamespace(database_service="svc")
    source.__dict__["_progress_tracking"] = ProgressTracking(ProgressMode.AUTO, "Test")
    return source


def _counters(source):
    return {t: (done, total) for t, done, total in source.progress_tracking.registry.global_counters()}


def test_declare_progress_totals_seeds_database_and_schema(databricks_source):
    databricks_source._filtered_database_names_for_totals = lambda: ["db1", "db2"]
    databricks_source._schema_names_by_database = lambda: {"db1": ["s1", "s2"], "db2": ["s3"]}
    databricks_source._is_schema_filtered = lambda db, sch: False
    databricks_source.declare_progress_totals(TotalsDeclarer(databricks_source.progress_tracking.registry))
    counters = _counters(databricks_source)
    assert counters["Database"] == (0, 2)
    assert counters["DatabaseSchema"] == (0, 3)


def test_declare_progress_totals_applies_schema_filter(databricks_source):
    databricks_source._filtered_database_names_for_totals = lambda: ["db1"]
    databricks_source._schema_names_by_database = lambda: {"db1": ["keep", "drop"]}
    databricks_source._is_schema_filtered = lambda db, sch: sch == "drop"
    databricks_source.declare_progress_totals(TotalsDeclarer(databricks_source.progress_tracking.registry))
    assert _counters(databricks_source)["DatabaseSchema"] == (0, 1)


def test_declare_progress_totals_reconciles_when_view_unavailable(databricks_source):
    databricks_source._filtered_database_names_for_totals = lambda: ["db1"]
    databricks_source._schema_names_by_database = lambda: None
    databricks_source.declare_progress_totals(TotalsDeclarer(databricks_source.progress_tracking.registry))
    registry = databricks_source.progress_tracking.registry
    assert registry.is_reconcilable("DatabaseSchema") is True
    counters = _counters(databricks_source)
    assert counters["Database"] == (0, 1)
    assert counters["DatabaseSchema"] == (0, None)


def test_schema_names_by_database_groups_rows_and_returns_none_on_error(databricks_source):
    # `connection` is a read-only property on CommonDbSourceService (no setter),
    # so it must be patched at the class level rather than assigned on the instance.
    mock_connection = MagicMock()
    mock_connection.execute.return_value.fetchall.return_value = [
        ("db1", "s1"),
        ("db1", "s2"),
        ("db2", "s3"),
    ]
    with patch.object(DatabricksSource, "connection", new_callable=PropertyMock) as mock_connection_property:
        mock_connection_property.return_value = mock_connection
        grouped = databricks_source._schema_names_by_database()
        assert grouped == {"db1": ["s1", "s2"], "db2": ["s3"]}

        mock_connection.execute.side_effect = Exception("permission denied on system.information_schema.schemata")
        assert databricks_source._schema_names_by_database() is None


def test_filtered_database_names_for_totals_uses_configured_database(databricks_source):
    databricks_source.get_configured_database = lambda: "only_db"
    databricks_source.get_database_names_raw = MagicMock()
    assert databricks_source._filtered_database_names_for_totals() == ["only_db"]
    databricks_source.get_database_names_raw.assert_not_called()


def test_filtered_database_names_for_totals_filters_all_databases(databricks_source):
    databricks_source.get_configured_database = lambda: None
    databricks_source.get_database_names_raw = lambda: iter(["keep", "drop"])
    databricks_source._is_database_filtered = lambda db: db == "drop"
    assert databricks_source._filtered_database_names_for_totals() == ["keep"]
