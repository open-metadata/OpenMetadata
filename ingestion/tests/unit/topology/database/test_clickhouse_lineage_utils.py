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

import uuid
from unittest import TestCase
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import (
    QueryParserType,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Uuid,
)
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.ingestion.source.database.clickhouse.lineage import ClickhouseLineageSource
from metadata.ingestion.source.database.clickhouse.lineage_utils import (
    get_materialized_view_target_table,
    get_mv_target_lineage,
)
from metadata.ingestion.source.models import TableView
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
