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
A table is never cached as its own upstream.

`system.access.table_lineage` records table access rather than derivation, so a
streaming or CDC write legitimately names its target table as its own source.
Those rows must not reach the lineage map, or the table ends up in its own
upstream set and is later emitted as an edge pointing at itself.
"""

from collections import defaultdict
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from metadata.ingestion.source.database.unitycatalog.lineage import (
    UnitycatalogLineageSource,
)

CATALOG, SCHEMA = "analytics", "sales"
EVENT_LOG = f"{CATALOG}.{SCHEMA}.orders_event_log"
SNAPSHOT = f"{CATALOG}.{SCHEMA}.orders_snapshot"


def _row(source_table: str, target_table: str) -> SimpleNamespace:
    return SimpleNamespace(source_table_full_name=source_table, target_table_full_name=target_table)


def _column_row(source_table: str, target_table: str, column: str) -> SimpleNamespace:
    return SimpleNamespace(
        source_table_full_name=source_table,
        target_table_full_name=target_table,
        source_column_name=column,
        target_column_name=column,
    )


def _source(rows, column_rows=None):
    """The real caching method, with only the SQL connection stubbed."""
    with patch.object(UnitycatalogLineageSource, "__init__", lambda s: None):
        source = UnitycatalogLineageSource()

    source.table_lineage_map = defaultdict(set)
    source.source_config = MagicMock()
    source.source_config.queryLogDuration = 1

    source.column_lineage_map = defaultdict(list)

    connection = MagicMock()
    # _cache_lineage runs the table query first, then the column query
    connection.execute.side_effect = [rows, column_rows if column_rows is not None else []]
    engine = MagicMock()
    engine.connect.return_value.__enter__ = MagicMock(return_value=connection)
    engine.connect.return_value.__exit__ = MagicMock(return_value=False)
    source.engine = engine
    return source


class TestSelfReferencingLineageCache:
    def test_a_self_referencing_row_is_not_cached(self):
        source = _source([_row(EVENT_LOG, EVENT_LOG)])
        source._cache_lineage()
        assert EVENT_LOG not in source.table_lineage_map.get(EVENT_LOG, set())
        assert sum(len(v) for v in source.table_lineage_map.values()) == 0

    def test_a_normal_row_is_still_cached(self):
        source = _source([_row(EVENT_LOG, SNAPSHOT)])
        source._cache_lineage()
        assert source.table_lineage_map[SNAPSHOT] == {EVENT_LOG}

    def test_only_the_self_reference_is_dropped(self):
        """The guard must not suppress real upstreams of the same table."""
        source = _source(
            [
                _row(EVENT_LOG, SNAPSHOT),
                _row(SNAPSHOT, SNAPSHOT),
                _row(EVENT_LOG, EVENT_LOG),
            ]
        )
        source._cache_lineage()
        assert source.table_lineage_map[SNAPSHOT] == {EVENT_LOG}
        assert source.table_lineage_map.get(EVENT_LOG, set()) == set()


class TestSelfReferencingColumnLineageCache:
    """A self-pair's columns are unreadable once its table pair is dropped."""

    def test_self_referencing_columns_are_not_cached(self):
        source = _source(
            [_row(EVENT_LOG, EVENT_LOG)],
            column_rows=[_column_row(EVENT_LOG, EVENT_LOG, "id")],
        )
        source._cache_lineage()
        assert (EVENT_LOG, EVENT_LOG) not in source.column_lineage_map
        assert sum(len(v) for v in source.column_lineage_map.values()) == 0

    def test_normal_columns_are_still_cached(self):
        source = _source(
            [_row(EVENT_LOG, SNAPSHOT)],
            column_rows=[_column_row(EVENT_LOG, SNAPSHOT, "id")],
        )
        source._cache_lineage()
        assert source.column_lineage_map[(EVENT_LOG, SNAPSHOT)] == [("id", "id")]
