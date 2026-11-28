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
Unit tests for SQL and dbt DIRECT vs. INDIRECT lineage classification using sqlglot.
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.entity.data.table import Column, DataModel, DataType, ModelType, Table
from metadata.generated.schema.type.basic import SqlQuery
from metadata.generated.schema.type.entityLineage import DependencyType
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.ingestion.lineage.indirect_lineage import (
    MAX_QUERY_LENGTH,
    SUBTYPE_FILTER,
    SUBTYPE_GROUP_BY,
    SUBTYPE_JOIN,
    SUBTYPE_SORT,
    SUBTYPE_WINDOW,
    analyze_indirect_lineage,
)
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import (
    get_lineage_by_query,
    get_lineage_via_table_entity,
    search_cache,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.database_service import DataModelLink
from metadata.ingestion.source.database.dbt.metadata import DbtSource
from metadata.utils import fqn
from metadata.utils.lru_cache import LRUCache

DIM_USER_SQL = """
CREATE TABLE analytics.dim_user AS
WITH base AS (
    SELECT
        u.user_id,
        u.email,
        b.team_id
    FROM raw.sat_user u
    JOIN raw.bridge_user_team b
        ON u.user_id = b.user_id
    LEFT JOIN raw.xref_team x
        ON b.team_id = x.team_id
    LEFT JOIN raw.sat_team st
        ON x.team_hk = st.team_hk
    WHERE EXISTS (
        SELECT 1
        FROM raw.filter_only_tbl f
        WHERE f.user_id = u.user_id
          AND f.active = 1
    )
    QUALIFY ROW_NUMBER() OVER (PARTITION BY u.user_id ORDER BY st.updated_at DESC) = 1
)
SELECT user_id, email, team_id FROM base
"""


def _make_table(table_fqn: str, columns: list[str]) -> Table:
    return Table(
        id=uuid.uuid4(),
        name=fqn.split(table_fqn)[-1].strip('"'),
        fullyQualifiedName=table_fqn,
        columns=[
            Column(
                name=col,
                dataType=DataType.STRING,
                fullyQualifiedName=f"{table_fqn}.{col}",
            )
            for col in columns
        ],
    )


def _mock_metadata_for_tables(tables: dict[str, Table]) -> MagicMock:
    metadata = MagicMock()
    metadata.get_by_name.side_effect = lambda entity, fqn, **_: tables.get(fqn)

    def es_search_from_fqn(entity_type, fqn_search_string, **_):
        if fqn_search_string in tables:
            return [tables[fqn_search_string]]
        # Match case-insensitively on FQN suffix for query lookups
        lowered = fqn_search_string.lower()
        return [tbl for key, tbl in tables.items() if key.lower() == lowered]

    metadata.es_search_from_fqn.side_effect = es_search_from_fqn
    return metadata


class TestIndirectLineageClassifier:
    def test_dim_user_reference_query(self):
        result = analyze_indirect_lineage(DIM_USER_SQL, dialect=Dialect.SNOWFLAKE)

        assert not result.conservative_fallback
        assert result.classify_table("raw.sat_user") == DependencyType.DIRECT
        assert result.classify_table("raw.bridge_user_team") == DependencyType.DIRECT
        assert result.classify_table("raw.xref_team") == DependencyType.INDIRECT
        assert result.classify_table("raw.sat_team") == DependencyType.INDIRECT
        assert result.classify_table("raw.filter_only_tbl") == DependencyType.INDIRECT

        xref_cols = {(r.column_name.lower(), r.subtype) for r in result.get_indirect_columns("raw.xref_team")}
        assert xref_cols == {("team_id", SUBTYPE_JOIN), ("team_hk", SUBTYPE_JOIN)}

        sat_team_cols = {(r.column_name.lower(), r.subtype) for r in result.get_indirect_columns("raw.sat_team")}
        assert sat_team_cols == {("team_hk", SUBTYPE_JOIN), ("updated_at", SUBTYPE_WINDOW)}

        filter_cols = {(r.column_name.lower(), r.subtype) for r in result.get_indirect_columns("raw.filter_only_tbl")}
        assert filter_cols == {("user_id", SUBTYPE_FILTER), ("active", SUBTYPE_FILTER)}

        assert set(result.indirect_tables()) == {"raw.xref_team", "raw.sat_team", "raw.filter_only_tbl"}

    def test_select_projection_and_expressions_are_direct(self):
        sql = """
        SELECT
            u.id,
            UPPER(u.email) AS email_upper,
            CASE WHEN f.is_vip = 1 THEN 'vip' ELSE 'std' END AS tier,
            (SELECT MAX(o.amount) FROM raw.orders o WHERE o.user_id = u.id) AS max_amount
        FROM raw.users u
        LEFT JOIN raw.flags f ON u.id = f.user_id
        """
        result = analyze_indirect_lineage(sql, dialect=Dialect.SNOWFLAKE)

        assert result.classify_table("raw.users") == DependencyType.DIRECT
        assert result.classify_table("raw.flags") == DependencyType.DIRECT
        assert result.classify_table("raw.orders") == DependencyType.DIRECT

    def test_join_on_and_using_only_are_indirect_join(self):
        sql = """
        SELECT u.id, u.name
        FROM raw.users u
        JOIN raw.teams t USING (team_id)
        LEFT JOIN raw.orgs o ON t.org_id = o.org_id
        """
        result = analyze_indirect_lineage(sql, dialect=Dialect.POSTGRES)

        assert result.classify_table("raw.users") == DependencyType.DIRECT
        assert result.classify_table("raw.teams") == DependencyType.INDIRECT
        assert result.classify_table("raw.orgs") == DependencyType.INDIRECT
        assert {(r.column_name.lower(), r.subtype) for r in result.get_indirect_columns("raw.teams")} >= {
            ("team_id", SUBTYPE_JOIN),
            ("org_id", SUBTYPE_JOIN),
        }
        assert {(r.column_name.lower(), r.subtype) for r in result.get_indirect_columns("raw.orgs")} == {
            ("org_id", SUBTYPE_JOIN)
        }

    def test_where_in_not_exists_and_semi_anti_joins_are_indirect_filter(self):
        sql_where = """
        SELECT u.id
        FROM raw.users u
        WHERE u.org_id IN (SELECT a.org_id FROM raw.allowed_orgs a WHERE a.enabled = true)
          AND NOT EXISTS (SELECT 1 FROM raw.blocked_users b WHERE b.user_id = u.id)
        """
        res_where = analyze_indirect_lineage(sql_where, dialect=Dialect.POSTGRES)

        assert res_where.classify_table("raw.users") == DependencyType.DIRECT
        assert res_where.classify_table("raw.allowed_orgs") == DependencyType.INDIRECT
        assert res_where.classify_table("raw.blocked_users") == DependencyType.INDIRECT
        assert {(r.column_name.lower(), r.subtype) for r in res_where.get_indirect_columns("raw.allowed_orgs")} == {
            ("org_id", SUBTYPE_FILTER),
            ("enabled", SUBTYPE_FILTER),
        }
        assert {(r.column_name.lower(), r.subtype) for r in res_where.get_indirect_columns("raw.blocked_users")} == {
            ("user_id", SUBTYPE_FILTER)
        }

        sql_semi = """
        SELECT u.id
        FROM raw.users u
        LEFT SEMI JOIN raw.active_set s ON u.id = s.user_id
        LEFT ANTI JOIN raw.deleted_set d ON u.id = d.user_id
        """
        res_semi = analyze_indirect_lineage(sql_semi, dialect=Dialect.SPARKSQL)

        assert res_semi.classify_table("raw.users") == DependencyType.DIRECT
        assert res_semi.classify_table("raw.active_set") == DependencyType.INDIRECT
        assert res_semi.classify_table("raw.deleted_set") == DependencyType.INDIRECT
        assert {(r.column_name.lower(), r.subtype) for r in res_semi.get_indirect_columns("raw.active_set")} == {
            ("user_id", SUBTYPE_FILTER)
        }
        assert {(r.column_name.lower(), r.subtype) for r in res_semi.get_indirect_columns("raw.deleted_set")} == {
            ("user_id", SUBTYPE_FILTER)
        }

    def test_group_by_having_order_by_subtypes(self):
        sql = """
        SELECT u.id, COUNT(*) AS cnt
        FROM raw.users u
        JOIN raw.orgs o ON u.org_id = o.id
        GROUP BY u.id, o.region
        HAVING MAX(o.score) > 10
        ORDER BY o.rank DESC
        """
        result = analyze_indirect_lineage(sql, dialect=Dialect.POSTGRES)

        assert result.classify_table("raw.users") == DependencyType.DIRECT
        assert result.classify_table("raw.orgs") == DependencyType.INDIRECT
        org_refs = {(r.column_name.lower(), r.subtype) for r in result.get_indirect_columns("raw.orgs")}
        assert org_refs == {
            ("id", SUBTYPE_JOIN),
            ("region", SUBTYPE_GROUP_BY),
            ("score", SUBTYPE_GROUP_BY),
            ("rank", SUBTYPE_SORT),
        }

    def test_window_clause_in_qualify_vs_select(self):
        sql_qualify = """
        SELECT u.id
        FROM raw.users u
        JOIN raw.scores s ON u.id = s.user_id
        WINDOW w AS (PARTITION BY u.id ORDER BY s.score_ts DESC)
        QUALIFY ROW_NUMBER() OVER w = 1
        """
        res_qualify = analyze_indirect_lineage(sql_qualify, dialect=Dialect.SNOWFLAKE)
        assert res_qualify.classify_table("raw.users") == DependencyType.DIRECT
        assert res_qualify.classify_table("raw.scores") == DependencyType.INDIRECT
        assert {(r.column_name.lower(), r.subtype) for r in res_qualify.get_indirect_columns("raw.scores")} == {
            ("user_id", SUBTYPE_JOIN),
            ("score_ts", SUBTYPE_WINDOW),
        }

        sql_select = """
        SELECT u.id, ROW_NUMBER() OVER w AS rn
        FROM raw.users u
        JOIN raw.scores s ON u.id = s.user_id
        WINDOW w AS (PARTITION BY u.id ORDER BY s.score_ts DESC)
        """
        res_select = analyze_indirect_lineage(sql_select, dialect=Dialect.SNOWFLAKE)
        assert res_select.classify_table("raw.users") == DependencyType.DIRECT
        assert res_select.classify_table("raw.scores") == DependencyType.DIRECT

    def test_multi_level_cte_propagation_and_pruning(self):
        sql = """
        WITH active_ids AS (
            SELECT f.user_id FROM raw.filter_src f WHERE f.active = 1
        ),
        step1 AS (
            SELECT u.user_id, u.email, t.team_name
            FROM raw.users u
            JOIN raw.teams t ON u.team_id = t.team_id
        ),
        step2 AS (
            SELECT s.user_id, s.email, s.team_name
            FROM step1 s
            WHERE s.user_id IN (SELECT user_id FROM active_ids)
        ),
        unused_cte AS (
            SELECT x.id FROM raw.unused_tbl x
        )
        SELECT user_id, email
        FROM step2
        WHERE team_name = 'Platform'
        """
        result = analyze_indirect_lineage(sql, dialect=Dialect.SNOWFLAKE)

        assert result.classify_table("raw.users") == DependencyType.DIRECT
        # team_name was projected in step1/step2, but ONLY consumed in the outer WHERE clause.
        assert result.classify_table("raw.teams") == DependencyType.INDIRECT
        assert {(r.column_name.lower(), r.subtype) for r in result.get_indirect_columns("raw.teams")} == {
            ("team_id", SUBTYPE_JOIN),
            ("team_name", SUBTYPE_FILTER),
        }
        # active_ids CTE was only referenced in WHERE ... IN (...).
        assert result.classify_table("raw.filter_src") == DependencyType.INDIRECT
        assert {(r.column_name.lower(), r.subtype) for r in result.get_indirect_columns("raw.filter_src")} == {
            ("user_id", SUBTYPE_FILTER),
            ("active", SUBTYPE_FILTER),
        }
        # Unused CTE table must not be classified at all.
        assert result.classify_table("raw.unused_tbl") is None

    def test_recursive_cte_terminates_and_classifies(self):
        sql = """
        WITH RECURSIVE tree AS (
            SELECT n.id, n.parent_id
            FROM raw.nodes n
            WHERE n.parent_id IS NULL
            UNION ALL
            SELECT c.id, c.parent_id
            FROM raw.nodes c
            JOIN tree t ON c.parent_id = t.id
            JOIN raw.allowed_edges e ON c.id = e.child_id
        )
        SELECT id FROM tree
        """
        result = analyze_indirect_lineage(sql, dialect=Dialect.POSTGRES)

        assert result.classify_table("raw.nodes") == DependencyType.DIRECT
        assert result.classify_table("raw.allowed_edges") == DependencyType.INDIRECT
        assert {(r.column_name.lower(), r.subtype) for r in result.get_indirect_columns("raw.allowed_edges")} == {
            ("child_id", SUBTYPE_JOIN)
        }

    def test_union_branches_propagate_direct_and_indirect(self):
        sql = """
        SELECT a.id FROM raw.t1 a JOIN raw.j1 b ON a.id = b.id
        UNION ALL
        SELECT c.id FROM raw.t2 c WHERE EXISTS (SELECT 1 FROM raw.f2 d WHERE d.id = c.id)
        """
        result = analyze_indirect_lineage(sql, dialect=Dialect.POSTGRES)

        assert result.classify_table("raw.t1") == DependencyType.DIRECT
        assert result.classify_table("raw.t2") == DependencyType.DIRECT
        assert result.classify_table("raw.j1") == DependencyType.INDIRECT
        assert result.classify_table("raw.f2") == DependencyType.INDIRECT

    def test_select_star_and_unqualified_columns_conservative_fallback(self):
        # Single table SELECT * -> DIRECT
        single_star = analyze_indirect_lineage("SELECT * FROM raw.users", dialect=Dialect.ANSI)
        assert single_star.classify_table("raw.users") == DependencyType.DIRECT

        # Multi-table bare SELECT * -> conservatively DIRECT for ALL joined tables
        multi_star = analyze_indirect_lineage(
            "SELECT * FROM raw.users u JOIN raw.teams t ON u.team_id = t.id",
            dialect=Dialect.ANSI,
        )
        assert multi_star.classify_table("raw.users") == DependencyType.DIRECT
        assert multi_star.classify_table("raw.teams") == DependencyType.DIRECT

        # Qualified SELECT u.* -> u is DIRECT, t is provably INDIRECT (JOIN)
        qualified_star = analyze_indirect_lineage(
            "SELECT u.* FROM raw.users u JOIN raw.teams t ON u.team_id = t.id",
            dialect=Dialect.ANSI,
        )
        assert qualified_star.classify_table("raw.users") == DependencyType.DIRECT
        assert qualified_star.classify_table("raw.teams") == DependencyType.INDIRECT

        # Ambiguous unqualified column in multi-table SELECT -> conservatively DIRECT for both
        unqualified = analyze_indirect_lineage(
            "SELECT email FROM raw.users u JOIN raw.teams t ON u.team_id = t.id",
            dialect=Dialect.ANSI,
        )
        assert unqualified.classify_table("raw.users") == DependencyType.DIRECT
        assert unqualified.classify_table("raw.teams") == DependencyType.DIRECT

    def test_single_table_count_star_is_direct(self):
        result = analyze_indirect_lineage(
            "CREATE TABLE analytics.user_counts AS SELECT COUNT(*) AS total FROM raw.users",
            dialect=Dialect.SNOWFLAKE,
        )
        assert result.classify_table("raw.users") == DependencyType.DIRECT

    def test_unnest_udtf_marks_parent_source_direct(self):
        result = analyze_indirect_lineage(
            "SELECT o.id, item FROM raw.orders o, UNNEST(o.items) AS item",
            dialect=Dialect.BIGQUERY,
        )
        assert result.classify_table("raw.orders") == DependencyType.DIRECT

    def test_table_in_both_select_and_where_is_direct(self):
        sql = "SELECT u.id FROM raw.users u WHERE u.active = 1"
        result = analyze_indirect_lineage(sql, dialect=Dialect.POSTGRES)

        assert result.classify_table("raw.users") == DependencyType.DIRECT
        assert {(r.column_name.lower(), r.subtype) for r in result.get_indirect_columns("raw.users")} == {
            ("active", SUBTYPE_FILTER)
        }

    @pytest.mark.parametrize(
        "bad_sql",
        [
            "",
            "   ",
            "SELECT FROM WHERE ??? INVALID SQL ((",
            "SELECT id FROM {{ ref('stg_users') }} WHERE status = 'active'",
            "SELECT id FROM raw.users WHERE id IN (" + ",".join(["1"] * (MAX_QUERY_LENGTH // 2)) + ")",
        ],
        ids=["empty", "whitespace", "invalid_sql", "jinja_template", "oversized_query"],
    )
    def test_invalid_jinja_or_oversized_sql_falls_back_conservatively(self, bad_sql):
        result = analyze_indirect_lineage(bad_sql, dialect=Dialect.SNOWFLAKE)
        assert result.classify_table("raw.users") is None
        assert result.indirect_tables() == ()

    def test_merge_statement_direct_vs_delete_only(self):
        merge_upsert = """
        MERGE INTO analytics.tgt t
        USING raw.src s ON t.id = s.id
        WHEN MATCHED THEN UPDATE SET t.val = s.val
        WHEN NOT MATCHED THEN INSERT (id, val) VALUES (s.id, s.val)
        """
        assert (
            analyze_indirect_lineage(merge_upsert, dialect=Dialect.SNOWFLAKE).classify_table("raw.src")
            == DependencyType.DIRECT
        )

        merge_delete = """
        MERGE INTO analytics.tgt t
        USING raw.deletions d ON t.id = d.id
        WHEN MATCHED AND d.should_delete = 1 THEN DELETE
        """
        res_del = analyze_indirect_lineage(merge_delete, dialect=Dialect.SNOWFLAKE)
        assert res_del.classify_table("raw.deletions") == DependencyType.INDIRECT
        assert {(r.column_name.lower(), r.subtype) for r in res_del.get_indirect_columns("raw.deletions")} == {
            ("id", SUBTYPE_JOIN),
            ("should_delete", SUBTYPE_FILTER),
        }


class TestSqlLineageIndirectIntegration:
    def setup_method(self):
        search_cache.clear()

    def teardown_method(self):
        search_cache.clear()

    def test_get_lineage_by_query_dim_user_emits_direct_indirect_and_exists_edges(self):
        tables = {
            "svc.db.analytics.dim_user": _make_table("svc.db.analytics.dim_user", ["user_id", "email", "team_id"]),
            "svc.db.raw.sat_user": _make_table("svc.db.raw.sat_user", ["user_id", "email"]),
            "svc.db.raw.bridge_user_team": _make_table("svc.db.raw.bridge_user_team", ["user_id", "team_id"]),
            "svc.db.raw.xref_team": _make_table("svc.db.raw.xref_team", ["team_id", "team_hk"]),
            "svc.db.raw.sat_team": _make_table("svc.db.raw.sat_team", ["team_hk", "updated_at"]),
            "svc.db.raw.filter_only_tbl": _make_table("svc.db.raw.filter_only_tbl", ["user_id", "active"]),
        }
        metadata = _mock_metadata_for_tables(tables)

        results = list(
            get_lineage_by_query(
                metadata=metadata,
                service_names="svc",
                database_name="db",
                schema_name="raw",
                query=DIM_USER_SQL,
                dialect=Dialect.SNOWFLAKE,
            )
        )

        assert all(r.left is None and r.right is not None for r in results)
        by_source = {r.right.from_entity_fqn: r.right for r in results}

        # All 5 upstream tables (including filter_only_tbl missed by collate-sqllineage!) must be emitted once.
        assert len(results) == 5
        assert set(by_source) == {
            "svc.db.raw.sat_user",
            "svc.db.raw.bridge_user_team",
            "svc.db.raw.xref_team",
            "svc.db.raw.sat_team",
            "svc.db.raw.filter_only_tbl",
        }

        # DIRECT edges with DIRECT column lineage
        sat_user_details = by_source["svc.db.raw.sat_user"].lineage_details
        assert sat_user_details.dependencyType == DependencyType.DIRECT
        assert sat_user_details.columnsLineage
        assert all(col.transformationType == "DIRECT" for col in sat_user_details.columnsLineage)

        bridge_details = by_source["svc.db.raw.bridge_user_team"].lineage_details
        assert bridge_details.dependencyType == DependencyType.DIRECT
        assert bridge_details.columnsLineage

        # INDIRECT JOIN-only edge
        xref_details = by_source["svc.db.raw.xref_team"].lineage_details
        assert xref_details.dependencyType == DependencyType.INDIRECT
        assert not xref_details.columnsLineage
        assert {
            (model_str(c.fromColumn), c.transformationType, c.transformationSubtype)
            for c in xref_details.indirectColumns or []
        } == {
            ("svc.db.raw.xref_team.team_id", "INDIRECT", "JOIN"),
            ("svc.db.raw.xref_team.team_hk", "INDIRECT", "JOIN"),
        }

        # INDIRECT JOIN + QUALIFY/WINDOW edge
        sat_team_details = by_source["svc.db.raw.sat_team"].lineage_details
        assert sat_team_details.dependencyType == DependencyType.INDIRECT
        assert not sat_team_details.columnsLineage
        assert {
            (model_str(c.fromColumn), c.transformationType, c.transformationSubtype)
            for c in sat_team_details.indirectColumns or []
        } == {
            ("svc.db.raw.sat_team.team_hk", "INDIRECT", "JOIN"),
            ("svc.db.raw.sat_team.updated_at", "INDIRECT", "WINDOW"),
        }

        # INDIRECT WHERE EXISTS edge discovered exclusively by sqlglot
        filter_details = by_source["svc.db.raw.filter_only_tbl"].lineage_details
        assert filter_details.dependencyType == DependencyType.INDIRECT
        assert not filter_details.columnsLineage
        assert {
            (model_str(c.fromColumn), c.transformationType, c.transformationSubtype)
            for c in filter_details.indirectColumns or []
        } == {
            ("svc.db.raw.filter_only_tbl.user_id", "INDIRECT", "FILTER"),
            ("svc.db.raw.filter_only_tbl.active", "INDIRECT", "FILTER"),
        }

    def test_view_lineage_via_table_entity_emits_indirect_and_exists_edges(self):
        view_entity = _make_table("svc.db.analytics.v_users", ["user_id"])
        tables = {
            "svc.db.analytics.v_users": view_entity,
            "svc.db.raw.users": _make_table("svc.db.raw.users", ["user_id", "team_id"]),
            "svc.db.raw.teams": _make_table("svc.db.raw.teams", ["team_id"]),
            "svc.db.raw.allowlist": _make_table("svc.db.raw.allowlist", ["user_id"]),
        }
        metadata = _mock_metadata_for_tables(tables)
        view_sql = """
        SELECT u.user_id
        FROM raw.users u
        JOIN raw.teams t ON u.team_id = t.team_id
        WHERE EXISTS (SELECT 1 FROM raw.allowlist a WHERE a.user_id = u.user_id)
        """
        parser = LineageParser(view_sql, dialect=Dialect.SNOWFLAKE)

        results = list(
            get_lineage_via_table_entity(
                metadata=metadata,
                table_entity=view_entity,
                database_name="db",
                schema_name="analytics",
                service_names="svc",
                query=view_sql,
                dialect=Dialect.SNOWFLAKE,
                lineage_source=LineageSource.ViewLineage,
                lineage_parser=parser,
            )
        )

        assert all(r.left is None and r.right is not None for r in results)
        by_source = {r.right.from_entity_fqn: r.right.lineage_details for r in results}
        assert by_source["svc.db.raw.users"].dependencyType == DependencyType.DIRECT
        assert by_source["svc.db.raw.teams"].dependencyType == DependencyType.INDIRECT
        assert by_source["svc.db.raw.allowlist"].dependencyType == DependencyType.INDIRECT
        assert {
            (model_str(c.fromColumn), c.transformationSubtype)
            for c in by_source["svc.db.raw.allowlist"].indirectColumns or []
        } == {("svc.db.raw.allowlist.user_id", "FILTER")}

    def test_multi_statement_script_classifies_per_target(self):
        tables = {
            "svc.db.raw.users": _make_table("svc.db.raw.users", ["user_id", "team_id"]),
            "svc.db.raw.teams": _make_table("svc.db.raw.teams", ["team_id"]),
            "svc.db.staging.tmp_users": _make_table("svc.db.staging.tmp_users", ["user_id"]),
            "svc.db.raw.allowlist": _make_table("svc.db.raw.allowlist", ["user_id"]),
            "svc.db.analytics.final_users": _make_table("svc.db.analytics.final_users", ["user_id"]),
        }
        metadata = _mock_metadata_for_tables(tables)
        script = """
        CREATE TABLE staging.tmp_users AS
        SELECT u.user_id
        FROM raw.users u
        JOIN raw.teams t ON u.team_id = t.team_id;

        INSERT INTO analytics.final_users
        SELECT tu.user_id
        FROM staging.tmp_users tu
        WHERE EXISTS (SELECT 1 FROM raw.allowlist a WHERE a.user_id = tu.user_id);
        """
        results = list(
            get_lineage_by_query(
                metadata=metadata,
                service_names="svc",
                database_name="db",
                schema_name="raw",
                query=script,
                dialect=Dialect.SNOWFLAKE,
            )
        )

        assert all(r.left is None and r.right is not None for r in results)
        by_edge = {(r.right.from_entity_fqn, r.right.to_entity_fqn): r.right.lineage_details for r in results}
        assert by_edge[("svc.db.raw.users", "svc.db.staging.tmp_users")].dependencyType == DependencyType.DIRECT
        assert by_edge[("svc.db.raw.teams", "svc.db.staging.tmp_users")].dependencyType == DependencyType.INDIRECT
        assert (
            by_edge[("svc.db.staging.tmp_users", "svc.db.analytics.final_users")].dependencyType
            == DependencyType.DIRECT
        )
        assert (
            by_edge[("svc.db.raw.allowlist", "svc.db.analytics.final_users")].dependencyType == DependencyType.INDIRECT
        )


class TestDbtIndirectLineage:
    @staticmethod
    def _make_dbt_source(tables: dict[str, Table], *, catalog_mapping: dict[str, str] | None = None) -> DbtSource:
        source = DbtSource.__new__(DbtSource)
        source.metadata = _mock_metadata_for_tables(tables)
        source.config = SimpleNamespace(
            serviceName="svc",
            serviceConnection=SimpleNamespace(
                root=SimpleNamespace(config=SimpleNamespace(type=SimpleNamespace(value="Snowflake")))
            ),
        )
        source.source_config = SimpleNamespace(
            overrideLineage=False,
            searchAcrossDatabases=False,
            parsingTimeoutLimit=10,
            catalogMapping=catalog_mapping or {},
        )
        source.status = MagicMock()
        source.reported_unresolved_upstreams = set()
        source.resolved_tables = LRUCache(100)
        source.resolved_tables_by_fqn = LRUCache(100)
        for table_fqn, tbl in tables.items():
            source.resolved_tables_by_fqn.put(table_fqn, tbl)
        return source

    def test_dbt_manifest_with_compiled_sql_classifies_direct_and_indirect(self):
        dim_user = _make_table("svc.db.analytics.dim_user", ["user_id", "email", "team_id"])
        sat_user = _make_table("svc.db.raw.sat_user", ["user_id", "email"])
        xref_team = _make_table("svc.db.raw.xref_team", ["team_id", "team_hk"])
        filter_tbl = _make_table("svc.db.raw.filter_only_tbl", ["user_id", "active"])
        tables = {model_str(tbl.fullyQualifiedName): tbl for tbl in (dim_user, sat_user, xref_team, filter_tbl)}
        source = self._make_dbt_source(tables)

        compiled_sql = """
        SELECT u.user_id, u.email
        FROM db.raw.sat_user u
        LEFT JOIN db.raw.xref_team x ON u.user_id = x.team_id
        WHERE EXISTS (SELECT 1 FROM db.raw.filter_only_tbl f WHERE f.user_id = u.user_id AND f.active = 1)
        """
        link = DataModelLink(
            table_entity=dim_user,
            upstream_table_ids={
                "svc.db.raw.sat_user": sat_user.id.root,
                "svc.db.raw.xref_team": xref_team.id.root,
                "svc.db.raw.filter_only_tbl": filter_tbl.id.root,
            },
            parse_query_lineage=True,
            datamodel=DataModel(
                modelType=ModelType.DBT,
                resourceType="model",
                sql=SqlQuery(compiled_sql),
                upstream=[
                    "svc.db.raw.sat_user",
                    "svc.db.raw.xref_team",
                    "svc.db.raw.filter_only_tbl",
                ],
            ),
        )

        edges = [either.right.lineage_request.edge for either in source.create_dbt_lineage(link) if either.right]
        by_from_id = {edge.fromEntity.id.root: edge.lineageDetails for edge in edges}

        assert by_from_id[sat_user.id.root].dependencyType == DependencyType.DIRECT
        assert by_from_id[xref_team.id.root].dependencyType == DependencyType.INDIRECT
        assert {
            (model_str(c.fromColumn), c.transformationType, c.transformationSubtype)
            for c in by_from_id[xref_team.id.root].indirectColumns or []
        } == {("svc.db.raw.xref_team.team_id", "INDIRECT", "JOIN")}

        assert by_from_id[filter_tbl.id.root].dependencyType == DependencyType.INDIRECT
        assert {
            (model_str(c.fromColumn), c.transformationType, c.transformationSubtype)
            for c in by_from_id[filter_tbl.id.root].indirectColumns or []
        } == {
            ("svc.db.raw.filter_only_tbl.user_id", "INDIRECT", "FILTER"),
            ("svc.db.raw.filter_only_tbl.active", "INDIRECT", "FILTER"),
        }

    def test_dbt_python_model_missing_sql_and_jinja_raw_sql_stay_conservative(self):
        dim_user = _make_table("svc.db.analytics.dim_user", ["user_id"])
        sat_user = _make_table("svc.db.raw.sat_user", ["user_id"])
        tables = {model_str(tbl.fullyQualifiedName): tbl for tbl in (dim_user, sat_user)}
        source = self._make_dbt_source(tables)

        cases = [
            # Python dbt model: parse_query_lineage=False
            DataModelLink(
                table_entity=dim_user,
                upstream_table_ids={"svc.db.raw.sat_user": sat_user.id.root},
                parse_query_lineage=False,
                datamodel=DataModel(
                    modelType=ModelType.DBT,
                    resourceType="model",
                    sql=SqlQuery("def model(dbt, session): return dbt.ref('sat_user')"),
                    upstream=["svc.db.raw.sat_user"],
                ),
            ),
            # Missing compiled and raw SQL
            DataModelLink(
                table_entity=dim_user,
                upstream_table_ids={"svc.db.raw.sat_user": sat_user.id.root},
                parse_query_lineage=True,
                datamodel=DataModel(
                    modelType=ModelType.DBT,
                    resourceType="model",
                    sql=None,
                    rawSql=None,
                    upstream=["svc.db.raw.sat_user"],
                ),
            ),
            # Missing compiled SQL, raw SQL contains uncompiled Jinja
            DataModelLink(
                table_entity=dim_user,
                upstream_table_ids={"svc.db.raw.sat_user": sat_user.id.root},
                parse_query_lineage=True,
                datamodel=DataModel(
                    modelType=ModelType.DBT,
                    resourceType="model",
                    sql=None,
                    rawSql=SqlQuery("SELECT user_id FROM {{ ref('sat_user') }}"),
                    upstream=["svc.db.raw.sat_user"],
                ),
            ),
        ]

        for link in cases:
            edges = [either.right.lineage_request.edge for either in source.create_dbt_lineage(link) if either.right]
            assert len(edges) == 1
            assert edges[0].lineageDetails.dependencyType is None
            assert edges[0].lineageDetails.indirectColumns is None

    def test_dbt_catalog_mapping_applies_to_indirect_classification(self):
        dim_user = _make_table("svc.gcp_proj.analytics.dim_user", ["user_id"])
        sat_user = _make_table("svc.gcp_proj.raw.sat_user", ["user_id"])
        xref_team = _make_table("svc.gcp_proj.raw.xref_team", ["team_id"])
        tables = {model_str(tbl.fullyQualifiedName): tbl for tbl in (dim_user, sat_user, xref_team)}
        source = self._make_dbt_source(tables, catalog_mapping={"trino_cat": "gcp_proj"})

        compiled_sql = """
        SELECT u.user_id
        FROM trino_cat.raw.sat_user u
        LEFT JOIN trino_cat.raw.xref_team x ON u.user_id = x.team_id
        """
        link = DataModelLink(
            table_entity=dim_user,
            upstream_table_ids={
                "svc.gcp_proj.raw.sat_user": sat_user.id.root,
                "svc.gcp_proj.raw.xref_team": xref_team.id.root,
            },
            parse_query_lineage=True,
            datamodel=DataModel(
                modelType=ModelType.DBT,
                resourceType="model",
                sql=SqlQuery(compiled_sql),
                upstream=["svc.gcp_proj.raw.sat_user", "svc.gcp_proj.raw.xref_team"],
            ),
        )

        edges = [either.right.lineage_request.edge for either in source.create_dbt_lineage(link) if either.right]
        by_from_id = {edge.fromEntity.id.root: edge.lineageDetails for edge in edges}

        assert by_from_id[sat_user.id.root].dependencyType == DependencyType.DIRECT
        assert by_from_id[xref_team.id.root].dependencyType == DependencyType.INDIRECT
        assert {
            (model_str(c.fromColumn), c.transformationSubtype)
            for c in by_from_id[xref_team.id.root].indirectColumns or []
        } == {("svc.gcp_proj.raw.xref_team.team_id", "JOIN")}
