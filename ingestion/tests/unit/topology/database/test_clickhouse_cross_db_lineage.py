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
"""Tests for the Clickhouse cross database lineage."""

import uuid
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Uuid,
)
from metadata.ingestion.source.database.clickhouse.lineage import ClickhouseLineageSource

CLICKHOUSE_SERVICE = "clickhouse"
POSTGRES_SERVICE = "postgres"
POSTGRES_DATABASE_FQN = f"{POSTGRES_SERVICE}.mydb"
CLICKHOUSE_DATABASE_FQN = f"{CLICKHOUSE_SERVICE}.default"


def _table(fqn: str, column_names=("id", "name")) -> Table:
    return Table(
        id=Uuid(root=uuid.uuid4()),
        name=EntityName(root=fqn.rsplit(".", maxsplit=1)[-1]),
        fullyQualifiedName=FullyQualifiedEntityName(root=fqn),
        columns=[
            Column(
                name=column_name,
                dataType=DataType.STRING,
                fullyQualifiedName=FullyQualifiedEntityName(root=f"{fqn}.{column_name}"),
            )
            for column_name in column_names
        ],
    )


def _database(fqn: str) -> Database:
    database = MagicMock(spec=Database)
    database.fullyQualifiedName = FullyQualifiedEntityName(root=fqn)
    return database


class TestClickhouseCrossDatabaseLineage(TestCase):
    """
    Clickhouse keeps no reference to where a replicated table came from, so the tables
    are matched on their own name and columns.
    """

    def setUp(self):
        """Set up test fixtures"""
        self.source = object.__new__(ClickhouseLineageSource)
        self.source.metadata = MagicMock()
        self.source.config = MagicMock()
        self.source.config.serviceName = CLICKHOUSE_SERVICE
        self.source.source_config = MagicMock()
        self.source.source_config.crossDatabaseServiceNames = [POSTGRES_SERVICE]

        self.clickhouse_table = _table(f"{CLICKHOUSE_DATABASE_FQN}.public.orders")
        self.postgres_table = _table(f"{POSTGRES_DATABASE_FQN}.public.orders")
        self.clickhouse_tables = [self.clickhouse_table]

        self.source.metadata.list_all_entities.side_effect = self._list_all_entities
        self.source.metadata.get_by_name.return_value = None
        self.search_results = []

    def _list_all_entities(self, entity, params=None, **__):
        if entity is Database:
            service = (params or {}).get("service")
            if service == CLICKHOUSE_SERVICE:
                return [_database(CLICKHOUSE_DATABASE_FQN)]
            return [_database(POSTGRES_DATABASE_FQN)]
        return self.clickhouse_tables

    def _run(self) -> list:
        with patch(
            "metadata.ingestion.source.database.clickhouse.lineage.fqn.search_table_from_es",
            return_value=self.search_results,
        ):
            return list(self.source.yield_cross_database_lineage())

    def _edges(self) -> list:
        results = self._run()
        self.assertTrue(all(result.left is None for result in results), [result.left for result in results])
        return [result.right for result in results if result.right]

    def test_table_found_at_the_same_schema_and_name(self):
        """The replicated table sits at the same schema and name in the other service"""
        self.source.metadata.get_by_name.return_value = self.postgres_table

        edges = self._edges()

        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].edge.fromEntity.id.root, self.postgres_table.id.root)
        self.assertEqual(edges[0].edge.toEntity.id.root, self.clickhouse_table.id.root)

    def test_lineage_carries_the_matching_columns(self):
        """Columns of the same name are linked"""
        self.source.metadata.get_by_name.return_value = self.postgres_table

        column_lineage = self._edges()[0].edge.lineageDetails.columnsLineage

        self.assertEqual(
            {(lineage.fromColumns[0].root, lineage.toColumn.root) for lineage in column_lineage},
            {
                (
                    f"{self.postgres_table.fullyQualifiedName.root}.{column}",
                    f"{self.clickhouse_table.fullyQualifiedName.root}.{column}",
                )
                for column in ("id", "name")
            },
        )

    def test_table_found_by_name_under_another_schema(self):
        """
        A Clickhouse database maps to a schema, so a replica rarely keeps the schema it
        came from and only the name and the columns are left to match on.
        """
        self.clickhouse_table = _table(f"{CLICKHOUSE_DATABASE_FQN}.analytics.orders")
        self.clickhouse_tables = [self.clickhouse_table]
        self.search_results = [self.postgres_table]

        edges = self._edges()

        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].edge.fromEntity.id.root, self.postgres_table.id.root)

    def test_an_ambiguous_name_yields_nothing(self):
        """Two tables of that name and those columns: a missing edge beats a wrong one"""
        self.search_results = [
            self.postgres_table,
            _table(f"{POSTGRES_DATABASE_FQN}.staging.orders"),
        ]

        self.assertEqual(self._edges(), [])

    def test_different_columns_are_not_the_same_table(self):
        """A table sharing only the name is not a replica"""
        self.search_results = [_table(f"{POSTGRES_DATABASE_FQN}.public.orders", column_names=("id", "total"))]

        self.assertEqual(self._edges(), [])

    def test_a_candidate_without_columns_is_not_a_match(self):
        """Nothing but the columns backs a match found by name"""
        candidate = _table(f"{POSTGRES_DATABASE_FQN}.public.orders")
        candidate.columns = []
        self.search_results = [candidate]

        self.assertEqual(self._edges(), [])

    def test_the_search_by_name_is_skipped_once_the_fqn_matches(self):
        """The cheap lookup wins, and the search never runs"""
        self.source.metadata.get_by_name.return_value = self.postgres_table

        with patch(
            "metadata.ingestion.source.database.clickhouse.lineage.fqn.search_table_from_es"
        ) as search_table_from_es:
            list(self.source.yield_cross_database_lineage())

        search_table_from_es.assert_not_called()

    def test_tables_sharing_a_name_are_matched_on_their_own_columns(self):
        """The cached search results are re-matched per table, not the verdict"""
        orders = _table(f"{CLICKHOUSE_DATABASE_FQN}.analytics.orders")
        other_orders = _table(f"{CLICKHOUSE_DATABASE_FQN}.staging.orders", column_names=("id", "total"))
        self.clickhouse_tables = [orders, other_orders]
        self.search_results = [self.postgres_table]

        with patch(
            "metadata.ingestion.source.database.clickhouse.lineage.fqn.search_table_from_es",
            return_value=self.search_results,
        ) as search_table_from_es:
            results = list(self.source.yield_cross_database_lineage())

        edges = [result.right for result in results if result.right]
        self.assertEqual(len(edges), 1, "only the table whose columns match is linked")
        self.assertEqual(edges[0].edge.toEntity.id.root, orders.id.root)
        self.assertEqual(search_table_from_es.call_count, 1, "the second table reuses the cached search")

    def test_no_match_yields_nothing(self):
        """Nothing found in the other service"""
        self.assertEqual(self._edges(), [])

    def test_errors_are_reported_not_raised(self):
        """A failing API call is reported as a failure, not an exception"""
        self.source.metadata.list_all_entities.side_effect = RuntimeError("boom")

        results = self._run()

        self.assertEqual(len(results), 1)
        self.assertIsNotNone(results[0].left)
        self.assertIn("boom", results[0].left.error)
