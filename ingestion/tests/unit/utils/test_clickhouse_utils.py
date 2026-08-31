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
"""Tests for the Clickhouse materialized view `TO` clause extraction."""

import pytest

from metadata.utils.clickhouse_utils import get_materialized_view_target_table


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
                "CREATE MATERIALIZED VIEW db.mv TO INNER UUID "
                "'5b5f0e60-1111-2222-3333-444455556666' (`id` UInt64) AS SELECT id FROM db.src",
                id="implicit-inner-table",
            ),
        ],
    )
    def test_no_target_table(self, view_definition):
        assert get_materialized_view_target_table(view_definition) is None
