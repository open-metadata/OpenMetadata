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
"""Tests for the Clickhouse materialized view `TO` clause lineage."""

import pickle
import uuid
from unittest import TestCase
from unittest.mock import MagicMock

import pytest
from clickhouse_sqlalchemy.exceptions import DatabaseException
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import StaticPool

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
)
from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import (
    QueryParserType,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Uuid,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.ingestion.source.database.clickhouse.lineage import ClickhouseLineageSource
from metadata.ingestion.source.database.clickhouse.lineage_utils import (
    get_distributed_local_table,
    get_distributed_table_lineage,
    get_materialized_view_target_table,
    get_mv_target_lineage,
    get_view_lineage_parser,
)
from metadata.ingestion.source.database.lineage_source import LineageSource as BaseLineageSource
from metadata.ingestion.source.models import TableView
from metadata.utils import fqn
from metadata.utils.db_utils import get_view_lineage


class TestMaterializedViewTargetTable:
    """The DDL samples are shaped like `system.tables.create_table_query` results."""

    @pytest.mark.parametrize(
        "view_definition,expected",
        [
            pytest.param(
                "CREATE MATERIALIZED VIEW schema01.samples_mv TO schema02.samples_e "
                "(`column_01` String, `column_02` UInt64) "
                "AS SELECT column_01, column_02 FROM schema01.samples",
                ("schema02", "samples_e"),
                id="qualified-target",
            ),
            pytest.param(
                "CREATE MATERIALIZED VIEW schema01.samples_mv TO schema02.samples_e AS SELECT * FROM schema01.samples",
                ("schema02", "samples_e"),
                id="qualified-target-without-column-list",
            ),
            pytest.param(
                "CREATE MATERIALIZED VIEW schema01.samples_mv TO samples_e AS SELECT * FROM schema01.samples",
                (None, "samples_e"),
                id="unqualified-target",
            ),
            pytest.param(
                "CREATE MATERIALIZED VIEW sch.mv REFRESH EVERY 3 HOUR TO sch.to_table "
                "(`column_01` String, `column_02` UInt64) DEFINER = default SQL SECURITY DEFINER "
                "AS SELECT * FROM sch.from_table",
                ("sch", "to_table"),
                id="refresh-and-definer",
            ),
            pytest.param(
                "CREATE MATERIALIZED VIEW IF NOT EXISTS db.mv ON CLUSTER my_cluster "
                "TO `other db`.`target table` AS SELECT 1",
                ("other db", "target table"),
                id="on-cluster-and-quoted-identifiers",
            ),
            pytest.param(
                "CREATE OR REPLACE MATERIALIZED VIEW db.mv TO db2.target AS SELECT 1",
                ("db2", "target"),
                id="create-or-replace",
            ),
            pytest.param(
                "create materialized view db.mv to db2.target as select 1",
                ("db2", "target"),
                id="lowercase-keywords",
            ),
            pytest.param(
                "CREATE MATERIALIZED VIEW db.`orders to ship` TO db2.target AS SELECT 1",
                ("db2", "target"),
                id="keyword-inside-a-quoted-view-name",
            ),
            pytest.param(
                "CREATE MATERIALIZED VIEW db.`orders as sold` TO db2.target AS SELECT 1",
                ("db2", "target"),
                id="as-inside-a-quoted-view-name",
            ),
            pytest.param(
                "CREATE MATERIALIZED VIEW db.mv ON CLUSTER 'to cluster' TO db2.target AS SELECT 1",
                ("db2", "target"),
                id="keyword-inside-a-string-literal",
            ),
            pytest.param(
                "CREATE MATERIALIZED VIEW db.mv TO `db to`.`target as` AS SELECT 1",
                ("db to", "target as"),
                id="keywords-inside-the-quoted-target",
            ),
            pytest.param(
                'CREATE MATERIALIZED VIEW db."as view" TO db2.target AS SELECT 1',
                ("db2", "target"),
                id="double-quoted-view-name",
            ),
            pytest.param(
                r"CREATE MATERIALIZED VIEW db.`weird\`name to x` TO db2.target AS SELECT 1",
                ("db2", "target"),
                id="backslash-escaped-delimiter-in-the-view-name",
            ),
            pytest.param(
                r"CREATE MATERIALIZED VIEW db.`a``b to c` TO db2.target AS SELECT 1",
                ("db2", "target"),
                id="doubled-delimiter-in-the-view-name",
            ),
            pytest.param(
                r"CREATE MATERIALIZED VIEW db.mv ON CLUSTER 'it\'s to me' TO db2.target AS SELECT 1",
                ("db2", "target"),
                id="escaped-quote-in-a-string-literal",
            ),
            pytest.param(
                r"CREATE MATERIALIZED VIEW db.mv TO db2.`target\`x` AS SELECT 1",
                ("db2", "target`x"),
                id="escaped-delimiter-in-the-target-name",
            ),
        ],
    )
    def test_target_table_is_extracted(self, view_definition, expected):
        target = get_materialized_view_target_table(view_definition)
        assert target is not None
        assert (target.schema_name, target.table_name) == expected

    @pytest.mark.parametrize(
        "view_definition",
        [
            pytest.param(None, id="none"),
            pytest.param("", id="empty"),
            pytest.param("CREATE VIEW db.v AS SELECT * FROM db.src", id="regular-view"),
            pytest.param(
                "CREATE TABLE db.t (`id` UInt64) ENGINE = MergeTree ORDER BY id",
                id="regular-table",
            ),
            pytest.param(
                "CREATE MATERIALIZED VIEW db.mv\n(\n    `id` UInt64\n)\n"
                "ENGINE = MergeTree\nORDER BY id AS\nSELECT id FROM db.src",
                id="materialized-view-with-its-own-storage",
            ),
            pytest.param(
                "CREATE MATERIALIZED VIEW db.mv (`id` UInt64) ENGINE = MergeTree ORDER BY id "
                "AS SELECT id, to_date AS to_col FROM db.src",
                id="to-only-inside-the-select-body",
            ),
            pytest.param(
                "CREATE MATERIALIZED VIEW db.mv ENGINE = MergeTree ORDER BY x "
                "AS SELECT a.x FROM db.a AS a JOIN db.b AS b ON a.x = b.to",
                id="column-named-to",
            ),
            pytest.param(
                "CREATE MATERIALIZED VIEW db.`orders to ship` (`id` UInt64) ENGINE = MergeTree "
                "ORDER BY id AS SELECT id FROM db.src",
                id="keyword-inside-a-quoted-view-name-without-a-target",
            ),
            pytest.param(
                r"CREATE MATERIALIZED VIEW db.`weird\`name to x` (`id` UInt64) ENGINE = MergeTree "
                "ORDER BY id AS SELECT id FROM db.src",
                id="escaped-delimiter-in-a-view-name-without-a-target",
            ),
            pytest.param(
                "CREATE MATERIALIZED VIEW db.`as of`.`to` (`id` UInt64) ENGINE = MergeTree "
                "ORDER BY id AS SELECT id FROM db.src",
                id="quoted-keywords-as-the-whole-view-name",
            ),
            pytest.param(
                "CREATE MATERIALIZED VIEW db.mv TO INNER UUID "
                "'5b5f0e60-1111-2222-3333-444455556666' (`id` UInt64) AS SELECT id FROM db.src",
                id="implicit-inner-table",
            ),
        ],
    )
    def test_no_target_table(self, view_definition):
        assert get_materialized_view_target_table(view_definition) is None


class TestClickhouseLineageSourceExtension:
    def test_the_connector_registers_the_extension(self):
        """The generic view lineage picks the builder up from the connector"""
        assert ClickhouseLineageSource.get_view_lineage_extension(object()) is get_mv_target_lineage


class TestClickhouseMaterializedViewLineage(TestCase):
    """
    A Clickhouse materialized view created with `TO <schema>.<table>` writes its rows
    into that target table, so it needs a downstream edge on top of the upstream one.
    """

    MV_DEFINITION = (
        "CREATE MATERIALIZED VIEW schema01.samples_mv TO schema02.samples_e "
        "(`column_01` String) AS SELECT column_01 FROM schema01.samples"
    )

    def setUp(self):
        """Set up test fixtures"""
        search_cache.clear()

        self.metadata = MagicMock()
        self.service_name = "clickhouse_service"

        self.mv_entity = self._table("samples_mv", "schema01")
        self.source_entity = self._table("samples", "schema01")
        self.target_entity = self._table("samples_e", "schema02")

        self.metadata.es_search_from_fqn = self._es_search_from_fqn
        self.metadata.get_by_name = self._get_by_name

        self.table_view = TableView(
            table_name="samples_mv",
            schema_name="schema01",
            db_name="default",
            view_definition=self.MV_DEFINITION,
        )

    def _table(self, name: str, schema: str) -> Table:
        return Table(
            id=Uuid(root=uuid.uuid4()),
            name=EntityName(root=name),
            fullyQualifiedName=FullyQualifiedEntityName(root=f"{self.service_name}.default.{schema}.{name}"),
            serviceType=DatabaseServiceType.Clickhouse,
            columns=[],
        )

    def _es_search_from_fqn(self, entity_type, fqn_search_string, **kwargs):
        for entity in (self.mv_entity, self.source_entity, self.target_entity):
            if entity.name.root in fqn_search_string.split("."):
                return [entity]
        return []

    def _get_by_name(self, entity, fqn=None, **kwargs):
        for candidate in (self.mv_entity, self.source_entity, self.target_entity):
            if fqn and candidate.fullyQualifiedName.root == fqn:
                return candidate
        return None

    def _run(self) -> dict:
        """Run the view lineage and return the produced {from_fqn: to_fqn} edges"""
        results = list(
            get_view_lineage(
                view=self.table_view,
                metadata=self.metadata,
                service_names=self.service_name,
                connection_type="Clickhouse",
                timeout_seconds=30,
                parser_type=QueryParserType.Auto,
                extension=get_mv_target_lineage,
            )
        )
        self.assertTrue(all(result.left is None for result in results), [result.left for result in results])
        return {result.right.from_entity_fqn: result.right.to_entity_fqn for result in results if result.right}

    def test_materialized_view_to_clause_creates_downstream_lineage(self):
        """Both the upstream and the `TO` target edges are created"""
        edges = self._run()

        self.assertEqual(
            edges,
            {
                self.source_entity.fullyQualifiedName.root: self.mv_entity.fullyQualifiedName.root,
                self.mv_entity.fullyQualifiedName.root: self.target_entity.fullyQualifiedName.root,
            },
        )

    def test_unqualified_target_resolves_against_the_view_schema(self):
        """`TO <table>` without a schema belongs to the schema of the view"""
        self.target_entity = self._table("samples_e", "schema01")
        self.table_view.view_definition = (
            "CREATE MATERIALIZED VIEW schema01.samples_mv TO samples_e AS SELECT column_01 FROM schema01.samples"
        )

        edges = self._run()

        self.assertEqual(
            edges.get(self.mv_entity.fullyQualifiedName.root),
            self.target_entity.fullyQualifiedName.root,
        )

    def test_refresh_and_definer_variant(self):
        """The `REFRESH EVERY ... DEFINER ...` variant is handled as well"""
        self.table_view.view_definition = (
            "CREATE MATERIALIZED VIEW schema01.samples_mv REFRESH EVERY 3 HOUR TO schema02.samples_e "
            "(`column_01` String) DEFINER = default SQL SECURITY DEFINER "
            "AS SELECT column_01 FROM schema01.samples"
        )

        edges = self._run()

        self.assertEqual(
            edges,
            {
                self.source_entity.fullyQualifiedName.root: self.mv_entity.fullyQualifiedName.root,
                self.mv_entity.fullyQualifiedName.root: self.target_entity.fullyQualifiedName.root,
            },
        )

    def test_materialized_view_without_to_clause_is_untouched(self):
        """A materialized view holding its own data only gets the upstream edge"""
        self.table_view.view_definition = (
            "CREATE MATERIALIZED VIEW schema01.samples_mv (`column_01` String) ENGINE = MergeTree "
            "ORDER BY column_01 AS SELECT column_01 FROM schema01.samples"
        )

        edges = self._run()

        self.assertEqual(
            edges,
            {self.source_entity.fullyQualifiedName.root: self.mv_entity.fullyQualifiedName.root},
        )

    def test_unknown_target_table_is_skipped(self):
        """A target table that is not ingested does not produce a broken edge"""
        self.table_view.view_definition = (
            "CREATE MATERIALIZED VIEW schema01.samples_mv TO schema02.not_ingested "
            "AS SELECT column_01 FROM schema01.samples"
        )

        edges = self._run()

        self.assertEqual(
            edges,
            {self.source_entity.fullyQualifiedName.root: self.mv_entity.fullyQualifiedName.root},
        )


@pytest.mark.parametrize(
    "query",
    [
        "CREATE MATERIALIZED VIEW schema1.mv TO schema2.orders AS SELECT id FROM schema1.src",
        "CREATE MATERIALIZED VIEW IF NOT EXISTS schema1.mv ON CLUSTER cluster1 TO schema2.orders AS SELECT id FROM schema1.src",
        'CREATE MATERIALIZED VIEW "schema1"."mv" TO "schema2"."orders" AS SELECT id FROM "schema1"."src"',
        "CREATE MATERIALIZED VIEW schema1.mv TO schema2.orders (`id` Int64) AS SELECT id FROM schema1.src",
    ],
)
def test_clickhouse_view_parser_separates_explicit_output(query):
    parser = get_view_lineage_parser(query, Dialect.CLICKHOUSE, timeout_seconds=10)
    assert [str(table) for table in parser.source_tables] == ["schema1.src"]
    assert [str(table) for table in parser.target_tables] == ["schema1.mv"]
    assert not parser.intermediate_tables
    assert parser.query == query
    original = LineageParser(query, Dialect.CLICKHOUSE, timeout_seconds=10)
    assert parser.query_hash == original.query_hash
    assert "TO" in parser.masked_query
    assert parser.query_parsing_success


@pytest.mark.parametrize(
    "query",
    [
        "CREATE VIEW schema1.mv AS SELECT id FROM schema1.src",
        "CREATE VIEW schema1.mv ON CLUSTER cluster1 AS SELECT id FROM schema1.src",
        "CREATE MATERIALIZED VIEW schema1.mv ENGINE = Memory AS SELECT id FROM schema1.src",
        "SELECT id FROM schema1.src",
        "CREATE TABLE schema1.mv AS SELECT id FROM schema1.src",
        "CREATE MATERIALIZED VIEW schema1.mv TO INNER UUID '1234' AS SELECT id FROM schema1.src",
        "CREATE MATERIALIZED VIEW schema1.mv TO schema2.orders AS",
    ],
)
def test_clickhouse_view_parser_falls_back_for_other_definitions(query):
    expected = LineageParser(query, Dialect.CLICKHOUSE, timeout_seconds=10)
    parser = get_view_lineage_parser(query, Dialect.CLICKHOUSE, timeout_seconds=10)
    assert parser.query == expected.query
    assert parser.masked_query == expected.masked_query
    assert parser.query_hash == expected.query_hash
    assert parser.query_parsing_success == expected.query_parsing_success
    assert [str(table) for table in parser.source_tables] == [str(table) for table in expected.source_tables]
    assert [str(table) for table in parser.target_tables] == [str(table) for table in expected.target_tables]


def test_clickhouse_view_parser_preserves_original_masked_literals():
    query = (
        "CREATE MATERIALIZED VIEW schema1.mv TO schema2.orders AS SELECT id FROM schema1.src WHERE id = 'private-value'"
    )
    original = LineageParser(query, Dialect.CLICKHOUSE, timeout_seconds=10)
    parser = get_view_lineage_parser(query, Dialect.CLICKHOUSE, timeout_seconds=10)
    assert parser.masked_query == original.masked_query
    assert "private-value" not in parser.masked_query
    assert "TO schema2.orders" in parser.masked_query
    assert [str(table) for table in parser.target_tables] == ["schema1.mv"]


def test_clickhouse_view_parser_factory_is_picklable():
    factory = ClickhouseLineageSource.get_view_lineage_parser_factory(object())
    assert factory is get_view_lineage_parser
    assert pickle.loads(pickle.dumps(factory)) is get_view_lineage_parser


def test_clickhouse_view_parser_retains_native_graph_if_normalized_parse_fails(monkeypatch):
    from sqlglot import expressions as exp

    query = "CREATE MATERIALIZED VIEW schema1.mv TO schema2.orders AS SELECT id FROM schema1.src"
    original = LineageParser(query, Dialect.CLICKHOUSE, parser_type="Auto")
    # Simulate an unsupported rendering from the external AST serializer.
    monkeypatch.setattr(exp.Create, "sql", lambda *_args, **_kwargs: "COPY table FROM path")
    parser = get_view_lineage_parser(query, Dialect.CLICKHOUSE, parser_type="Auto")
    assert parser.parser is not None
    assert [str(table) for table in parser.source_tables] == [str(table) for table in original.source_tables]
    assert [str(table) for table in parser.target_tables] == [str(table) for table in original.target_tables]
    assert [str(table) for table in parser.intermediate_tables] == [
        str(table) for table in original.intermediate_tables
    ]
    assert parser.masked_query == original.masked_query


class TestDistributedLocalTable:
    """The samples are shaped like `system.tables.engine_full` results."""

    @pytest.mark.parametrize(
        "engine_full,expected",
        [
            pytest.param(
                "Distributed('my_cluster', 'default', 'events_local', rand())",
                ("default", "events_local"),
                id="sharding-key",
            ),
            pytest.param(
                "Distributed('my_cluster', 'default', 'events_local')",
                ("default", "events_local"),
                id="no-sharding-key",
            ),
            pytest.param(
                "Distributed('{cluster}', 'other_db', 'events_local', cityHash64(user_id, ','), 'default') "
                "SETTINGS fsync_after_insert = 0",
                ("other_db", "events_local"),
                id="macro-cluster-policy-and-settings",
            ),
            pytest.param(
                "Distributed(my_cluster, default, events_local)",
                ("default", "events_local"),
                id="bare-identifiers",
            ),
            pytest.param(
                "Distributed(`my_cluster`, `other db`, `events.local`)",
                ("other db", "events.local"),
                id="backquoted-identifiers",
            ),
            pytest.param(
                "Distributed('my_cluster', 'default', 'event\\'s_local')",
                ("default", "event's_local"),
                id="escaped-quote",
            ),
        ],
    )
    def test_local_table_is_extracted(self, engine_full, expected):
        assert get_distributed_local_table(engine_full) == expected

    @pytest.mark.parametrize(
        "engine_full",
        [
            pytest.param("Distributed('my_cluster', '', 'events_local')", id="empty-database"),
            pytest.param("Distributed('my_cluster', currentDatabase(), 'events_local')", id="unevaluated-database"),
            pytest.param("Distributed()", id="no-arguments"),
            pytest.param("Distributed('my_cluster', 'default')", id="missing-table"),
            pytest.param("Distributed('my_cluster', 'default', '')", id="empty-table"),
            pytest.param("Distributed('my_cluster', 'default', concat('events', '_local'))", id="table-expression"),
            pytest.param("MergeTree ORDER BY id", id="other-engine"),
            pytest.param(
                "ReplicatedMergeTree('/clickhouse/tables/{shard}/events', '{replica}', version) ORDER BY id",
                id="other-engine-with-arguments",
            ),
            pytest.param("", id="empty"),
            pytest.param(None, id="none"),
        ],
    )
    def test_no_local_table(self, engine_full):
        assert get_distributed_local_table(engine_full) is None


class TestDistributedTableLineage:
    """
    A Distributed table reads from and writes into a local table on each shard, so the local
    table is its upstream.
    """

    SERVICE_NAME = "clickhouse_service"

    @pytest.fixture(autouse=True)
    def _clear_search_cache(self):
        search_cache.clear()

    @pytest.fixture
    def tables(self) -> dict:
        return {}

    @pytest.fixture
    def metadata(self, tables):
        def es_search_from_fqn(entity_type, fqn_search_string, **kwargs):
            if entity_type is not Table:
                return []
            *_, schema, name = (fqn.unquote_name(part) for part in fqn.split(fqn_search_string))
            return list(tables.get((schema, name), []))

        metadata = MagicMock()
        metadata.es_search_from_fqn = es_search_from_fqn
        metadata.get_by_name.return_value = None
        return metadata

    @pytest.fixture
    def system_tables(self):
        """An in-memory stand-in for `system.tables`, queried with the connector's SQL"""
        engine = create_engine("sqlite://", poolclass=StaticPool)
        with engine.begin() as conn:
            conn.execute(text("ATTACH DATABASE ':memory:' AS system"))
            conn.execute(text("CREATE TABLE system.tables (database TEXT, name TEXT, engine TEXT, engine_full TEXT)"))
        return engine

    def _add_table(self, tables: dict, schema: str, name: str) -> Table:
        table = Table(
            id=Uuid(root=uuid.uuid4()),
            name=EntityName(root=name),
            fullyQualifiedName=FullyQualifiedEntityName(
                root=".".join(fqn.quote_name(part) for part in (self.SERVICE_NAME, "default", schema, name))
            ),
            serviceType=DatabaseServiceType.Clickhouse,
            columns=[],
        )
        tables.setdefault((schema, name), []).append(table)
        return table

    @staticmethod
    def _add_row(engine, schema: str, name: str, engine_name: str, engine_full: str):
        with engine.begin() as conn:
            conn.execute(
                text("INSERT INTO system.tables VALUES (:schema, :name, :engine, :engine_full)"),
                {"schema": schema, "name": name, "engine": engine_name, "engine_full": engine_full},
            )

    def _run(self, metadata, engine, source_config=None) -> list:
        results = list(
            get_distributed_table_lineage(
                metadata=metadata,
                engine=engine,
                service_name=self.SERVICE_NAME,
                source_config=source_config or DatabaseServiceQueryLineagePipeline(),
            )
        )
        assert all(result.left is None for result in results)
        return [result.right for result in results]

    def test_local_table_is_linked_to_the_distributed_table(self, metadata, tables, system_tables, caplog):
        local = self._add_table(tables, "default", "events_local")
        distributed = self._add_table(tables, "default", "events")
        self._add_row(system_tables, "default", "events_local", "MergeTree", "MergeTree ORDER BY id")
        self._add_row(
            system_tables,
            "default",
            "events",
            "Distributed",
            "Distributed('my_cluster', 'default', 'events_local', rand())",
        )

        with caplog.at_level("WARNING"):
            (request,) = self._run(metadata, system_tables)

        assert "Cannot read the local table" not in caplog.text
        assert isinstance(request, AddLineageRequest)
        assert request.edge.fromEntity.id == local.id
        assert request.edge.toEntity.id == distributed.id
        assert request.edge.lineageDetails.source == LineageSource.ViewLineage

    def test_local_table_in_another_database(self, metadata, tables, system_tables):
        self._add_table(tables, "default", "events_local")
        local = self._add_table(tables, "other db", "events.local")
        distributed = self._add_table(tables, "default", "events")
        self._add_row(system_tables, "default", "events", "Distributed", "Distributed(`c`, `other db`, `events.local`)")

        (request,) = self._run(metadata, system_tables)

        assert request.edge.fromEntity.id == local.id
        assert request.edge.toEntity.id == distributed.id

    def test_local_table_not_ingested_is_skipped_with_a_warning(self, metadata, tables, system_tables, caplog):
        self._add_table(tables, "default", "events")
        self._add_row(system_tables, "default", "events", "Distributed", "Distributed('c', 'default', 'events_local')")

        with caplog.at_level("WARNING"):
            assert self._run(metadata, system_tables) == []
        assert "Local table [default.events_local] of Distributed table [default.events] not found" in caplog.text

    def test_distributed_table_not_ingested_is_skipped(self, metadata, tables, system_tables):
        self._add_table(tables, "default", "events_local")
        self._add_row(system_tables, "default", "events", "Distributed", "Distributed('c', 'default', 'events_local')")

        assert self._run(metadata, system_tables) == []

    def test_unknown_local_database_is_skipped_with_a_warning(self, metadata, tables, system_tables, caplog):
        self._add_table(tables, "default", "events_local")
        self._add_table(tables, "default", "events")
        self._add_row(system_tables, "default", "events", "Distributed", "Distributed('c', '', 'events_local')")

        with caplog.at_level("WARNING"):
            assert self._run(metadata, system_tables) == []
        assert "Cannot read the local table of Distributed table [default.events]" in caplog.text

    def test_ambiguous_local_table_is_skipped(self, metadata, tables, system_tables):
        self._add_table(tables, "default", "events_local")
        self._add_table(tables, "default", "events_local")
        self._add_table(tables, "default", "events")
        self._add_row(system_tables, "default", "events", "Distributed", "Distributed('c', 'default', 'events_local')")

        assert self._run(metadata, system_tables) == []

    def test_distributed_table_naming_itself_is_skipped_with_a_warning(self, metadata, tables, system_tables, caplog):
        self._add_table(tables, "default", "events")
        self._add_row(system_tables, "default", "events", "Distributed", "Distributed('c', 'default', 'events')")

        with caplog.at_level("WARNING"):
            assert self._run(metadata, system_tables) == []
        assert "Local table [default.events] of Distributed table [default.events] not found" in caplog.text

    @pytest.mark.parametrize(
        "source_config",
        [
            pytest.param(
                DatabaseServiceQueryLineagePipeline(databaseFilterPattern=FilterPattern(excludes=["default"])),
                id="database",
            ),
            pytest.param(
                DatabaseServiceQueryLineagePipeline(schemaFilterPattern=FilterPattern(includes=["other_db"])),
                id="schema",
            ),
            pytest.param(
                DatabaseServiceQueryLineagePipeline(tableFilterPattern=FilterPattern(excludes=["^events$"])),
                id="table",
            ),
        ],
    )
    def test_filtered_distributed_table_is_skipped(self, metadata, tables, system_tables, source_config):
        self._add_table(tables, "default", "events_local")
        self._add_table(tables, "default", "events")
        self._add_row(system_tables, "default", "events", "Distributed", "Distributed('c', 'default', 'events_local')")

        assert self._run(metadata, system_tables, source_config) == []

    @pytest.mark.parametrize(
        "error",
        [
            pytest.param(DatabaseException("Code: 159. DB::Exception: TIMEOUT_EXCEEDED"), id="http-driver"),
            pytest.param(OperationalError("SELECT", {}, Exception("connection refused")), id="sqlalchemy"),
        ],
    )
    def test_failed_system_tables_query_is_reported(self, metadata, error):
        engine = MagicMock()
        engine.connect.side_effect = error

        (result,) = get_distributed_table_lineage(
            metadata=metadata,
            engine=engine,
            service_name=self.SERVICE_NAME,
            source_config=DatabaseServiceQueryLineagePipeline(),
        )

        assert result.right is None
        assert "Failed to fetch the Clickhouse Distributed tables" in result.left.error


def test_distributed_table_lineage_follows_the_view_lineage(monkeypatch):
    view_edge = Either(right=MagicMock())
    distributed_edge = Either(right=MagicMock())
    calls = {}

    def distributed_lineage(**kwargs):
        calls.update(kwargs)
        yield distributed_edge

    monkeypatch.setattr(BaseLineageSource, "yield_view_lineage", lambda _self: iter([view_edge]))
    monkeypatch.setattr(
        "metadata.ingestion.source.database.clickhouse.lineage.get_distributed_table_lineage", distributed_lineage
    )
    source = ClickhouseLineageSource.__new__(ClickhouseLineageSource)
    source.metadata = MagicMock()
    source.engine = MagicMock()
    source.config = MagicMock(serviceName="clickhouse_service")
    source.source_config = DatabaseServiceQueryLineagePipeline()

    assert list(source.yield_view_lineage()) == [view_edge, distributed_edge]
    assert calls == {
        "metadata": source.metadata,
        "engine": source.engine,
        "service_name": "clickhouse_service",
        "source_config": source.source_config,
    }
