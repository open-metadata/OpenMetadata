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
Unit tests for the YDB connector path helpers and SQL normalization.
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.ydb.utils import (
    ROOT_SCHEMA,
    full_name,
    schema_of,
    table_of,
)

# ---------------------------------------------------------------------------
# schema_of
# ---------------------------------------------------------------------------


class TestSchemaOf:
    def test_root_table_returns_default(self):
        assert schema_of("orders") == ROOT_SCHEMA

    def test_single_slash_returns_prefix(self):
        assert schema_of("staging/events") == "staging"

    def test_nested_path_returns_all_but_last(self):
        assert schema_of("marts/analytics/session_stats") == "marts/analytics"

    def test_deeply_nested_path(self):
        assert schema_of("a/b/c/d") == "a/b/c"


# ---------------------------------------------------------------------------
# table_of
# ---------------------------------------------------------------------------


class TestTableOf:
    def test_root_table_returns_name(self):
        assert table_of("orders") == "orders"

    def test_single_slash_returns_suffix(self):
        assert table_of("staging/events") == "events"

    def test_nested_path_returns_last_segment(self):
        assert table_of("marts/analytics/session_stats") == "session_stats"

    def test_deeply_nested_path(self):
        assert table_of("a/b/c/d") == "d"


# ---------------------------------------------------------------------------
# full_name  (round-trip with schema_of / table_of)
# ---------------------------------------------------------------------------


class TestFullName:
    def test_root_schema_omits_prefix(self):
        assert full_name(ROOT_SCHEMA, "orders") == "orders"

    def test_simple_schema_joins_with_slash(self):
        assert full_name("staging", "events") == "staging/events"

    def test_nested_schema_joins_with_slash(self):
        assert full_name("marts/analytics", "session_stats") == "marts/analytics/session_stats"

    def test_roundtrip_root(self):
        path = "orders"
        assert full_name(schema_of(path), table_of(path)) == path

    def test_roundtrip_simple(self):
        path = "staging/events"
        assert full_name(schema_of(path), table_of(path)) == path

    def test_roundtrip_nested(self):
        path = "marts/analytics/session_stats"
        assert full_name(schema_of(path), table_of(path)) == path



# ---------------------------------------------------------------------------
# YdbSource.query_table_names_and_types / query_view_names_and_types
# ---------------------------------------------------------------------------


class TestQueryNamesAndTypes:
    @pytest.fixture
    def source(self):
        from metadata.ingestion.source.database.ydb.metadata import YdbSource

        inspector_mock = MagicMock()
        with patch(
            "metadata.ingestion.source.database.ydb.metadata.CommonDbSourceService.__init__",
            return_value=None,
        ):
            src = YdbSource.__new__(YdbSource)

        thread_id = "test"
        src._inspector_map = {thread_id: inspector_mock}
        src.context = MagicMock()
        src.context.get_current_thread_id.return_value = thread_id
        src._inspector_mock = inspector_mock
        return src

    def test_tables_filtered_by_schema(self, source):
        source._inspector_mock.get_table_names.return_value = [
            "staging/events",
            "staging/users",
            "raw/orders",
        ]
        result = source.query_table_names_and_types("staging")
        names = [t.name for t in result]
        assert names == ["events", "users"]

    def test_root_schema_tables(self, source):
        source._inspector_mock.get_table_names.return_value = ["orders", "products"]
        result = source.query_table_names_and_types(ROOT_SCHEMA)
        names = [t.name for t in result]
        assert names == ["orders", "products"]

    def test_views_filtered_by_schema(self, source):
        source._inspector_mock.get_view_names.return_value = [
            "marts/analytics/session_stats",
            "staging/events",
        ]
        result = source.query_view_names_and_types("marts/analytics")
        assert len(result) == 1
        assert result[0].name == "session_stats"
        assert result[0].type_ == TableType.View

    def test_empty_tables_list(self, source):
        source._inspector_mock.get_table_names.return_value = []
        assert source.query_table_names_and_types("staging") == []

    def test_nested_schema_table_not_in_shallow_parent(self, source):
        # marts/analytics/session_stats belongs to schema "marts/analytics", not "marts"
        source._inspector_mock.get_table_names.return_value = [
            "marts/analytics/session_stats",
        ]
        result = source.query_table_names_and_types("marts")
        assert result == []

    def test_get_raw_database_schema_names_deduplicates(self, source):
        source._inspector_mock.get_table_names.return_value = [
            "staging/events",
            "staging/users",
            "raw/orders",
        ]
        source._inspector_mock.get_view_names.return_value = [
            "marts/analytics/session_stats",
        ]
        schemas = list(source.get_raw_database_schema_names())
        assert len(schemas) == len(set(schemas))
        assert "staging" in schemas
        assert "raw" in schemas
        assert "marts/analytics" in schemas


# ---------------------------------------------------------------------------
# YdbSource.get_schema_definition
# ---------------------------------------------------------------------------


class TestGetSchemaDefinition:
    @pytest.fixture
    def source(self):
        with patch(
            "metadata.ingestion.source.database.ydb.metadata.CommonDbSourceService.__init__",
            return_value=None,
        ):
            from metadata.ingestion.source.database.ydb.metadata import YdbSource

            src = YdbSource.__new__(YdbSource)
            return src

    def test_view_returns_definition(self, source):
        inspector = MagicMock()
        inspector.get_view_definition.return_value = "SELECT * FROM `raw/events`"
        result = source.get_schema_definition(TableType.View, "events", "staging", inspector)
        assert result == "SELECT * FROM `raw/events`"
        inspector.get_view_definition.assert_called_once_with("staging/events", schema=None)

    def test_regular_table_returns_none(self, source):
        inspector = MagicMock()
        result = source.get_schema_definition(TableType.Regular, "orders", "raw", inspector)
        assert result is None
        inspector.get_view_definition.assert_not_called()

    def test_view_with_no_definition_returns_none(self, source):
        inspector = MagicMock()
        inspector.get_view_definition.return_value = None
        result = source.get_schema_definition(TableType.View, "events", "staging", inspector)
        assert result is None

    def test_view_exception_returns_none(self, source):
        inspector = MagicMock()
        inspector.get_view_definition.side_effect = Exception("connection error")
        result = source.get_schema_definition(TableType.View, "events", "staging", inspector)
        assert result is None

    def test_root_schema_view_uses_bare_name(self, source):
        inspector = MagicMock()
        inspector.get_view_definition.return_value = "SELECT 1"
        source.get_schema_definition(TableType.View, "my_view", ROOT_SCHEMA, inspector)
        inspector.get_view_definition.assert_called_once_with("my_view", schema=None)


# ---------------------------------------------------------------------------
# rewrite_yql_paths_to_dotted
# ---------------------------------------------------------------------------


class TestRewriteYqlPathsToDotted:
    def test_no_backticks_passthrough(self):
        from metadata.ingestion.source.database.ydb.utils import (
            rewrite_yql_paths_to_dotted,
        )

        sql = "SELECT 1 FROM t"
        assert rewrite_yql_paths_to_dotted(sql) == sql

    def test_backtick_without_slash_untouched(self):
        from metadata.ingestion.source.database.ydb.utils import (
            rewrite_yql_paths_to_dotted,
        )

        sql = "SELECT * FROM `users`"
        assert rewrite_yql_paths_to_dotted(sql) == sql

    def test_single_slash_splits_at_last(self):
        from metadata.ingestion.source.database.ydb.utils import (
            rewrite_yql_paths_to_dotted,
        )

        sql = "SELECT * FROM `staging/events`"
        assert "FROM `staging`.`events`" in rewrite_yql_paths_to_dotted(sql)

    def test_deep_path_only_promotes_last_slash(self):
        from metadata.ingestion.source.database.ydb.utils import (
            rewrite_yql_paths_to_dotted,
        )

        sql = "SELECT * FROM `marts/analytics/session_stats`"
        out = rewrite_yql_paths_to_dotted(sql)
        # Schema part keeps its slashes; only the boundary with table is a dot.
        assert "`marts/analytics`.`session_stats`" in out
        assert out.count(".") == 1

    def test_view_ddl_rewrites_all_table_refs(self):
        from metadata.ingestion.source.database.ydb.utils import (
            rewrite_yql_paths_to_dotted,
        )

        ddl = (
            "CREATE VIEW `marts/analytics/session_stats` AS\n"
            "SELECT e.user_id FROM `staging/events` AS e "
            "JOIN `staging/users` AS u ON e.user_id = u.user_id"
        )
        out = rewrite_yql_paths_to_dotted(ddl)
        assert "`marts/analytics`.`session_stats`" in out
        assert "`staging`.`events`" in out
        assert "`staging`.`users`" in out
        # No leftover single-token slashed paths.
        assert "`marts/analytics/session_stats`" not in out
        assert "`staging/events`" not in out

    def test_mixed_quoted_and_unquoted(self):
        from metadata.ingestion.source.database.ydb.utils import (
            rewrite_yql_paths_to_dotted,
        )

        sql = "SELECT e.id FROM `raw/events` AS e WHERE e.id = users.id"
        out = rewrite_yql_paths_to_dotted(sql)
        assert "`raw`.`events`" in out
        # Non-backticked identifiers untouched.
        assert "users.id" in out


# ---------------------------------------------------------------------------
# YdbLineageSource.view_lineage_producer
# ---------------------------------------------------------------------------


class TestYdbLineageSourceProducer:
    def _make_source(self):
        from metadata.ingestion.source.database.ydb.lineage import YdbLineageSource

        return YdbLineageSource.__new__(YdbLineageSource)

    def test_rewrites_slashed_paths_in_view_definition(self):
        from metadata.ingestion.source.database.lineage_source import LineageSource
        from metadata.ingestion.source.models import TableView

        src = self._make_source()
        upstream = [
            TableView(
                table_name="session_stats",
                schema_name="marts/analytics",
                db_name="/local",
                view_definition=(
                    "CREATE VIEW `marts/analytics/session_stats` AS "
                    "SELECT * FROM `staging/events`"
                ),
            )
        ]
        with patch.object(
            LineageSource, "view_lineage_producer", return_value=iter(upstream)
        ):
            out = list(src.view_lineage_producer())
        assert len(out) == 1
        assert "`staging`.`events`" in out[0].view_definition
        assert "`marts/analytics`.`session_stats`" in out[0].view_definition

    def test_none_view_definition_passthrough(self):
        from metadata.ingestion.source.database.lineage_source import LineageSource
        from metadata.ingestion.source.models import TableView

        src = self._make_source()
        upstream = [
            TableView(
                table_name="x",
                schema_name="s",
                db_name="/local",
                view_definition=None,
            )
        ]
        with patch.object(
            LineageSource, "view_lineage_producer", return_value=iter(upstream)
        ):
            out = list(src.view_lineage_producer())
        assert len(out) == 1
        assert out[0].view_definition is None

    def test_empty_iterable(self):
        from metadata.ingestion.source.database.lineage_source import LineageSource

        src = self._make_source()
        with patch.object(
            LineageSource, "view_lineage_producer", return_value=iter([])
        ):
            assert list(src.view_lineage_producer()) == []


# ---------------------------------------------------------------------------
# YdbSampler.build_table_orm
# ---------------------------------------------------------------------------


class TestYdbSamplerBuildTableOrm:
    def _make_om_table(self, table_name, columns):
        """Construct a minimal OM Table-like object the builder consumes."""
        from metadata.generated.schema.entity.data.table import (
            Column,
            DataType,
        )
        from metadata.generated.schema.entity.data.table import (
            Table as OMTable,
        )

        col_objs = [
            Column(name=name, dataType=DataType.INT) for name in columns
        ]
        tbl = MagicMock(spec=OMTable)
        tbl.name = MagicMock()
        tbl.name.root = table_name
        tbl.columns = col_objs
        tbl.databaseSchema = MagicMock()
        tbl.databaseSchema.id = "schema-uuid"
        tbl.serviceType = MagicMock()
        return tbl

    def _make_sampler(self):
        from metadata.sampler.sqlalchemy.ydb.sampler import YdbSampler

        return YdbSampler.__new__(YdbSampler)

    def _ometa_for_schema(self, schema_name):
        ometa = MagicMock()
        ometa.get_by_id.return_value.name.root = schema_name
        return ometa

    def test_tablename_uses_slash_path_and_schema_is_none(self):
        sampler = self._make_sampler()
        tbl = self._make_om_table("customers", ["id", "name"])
        orm = sampler.build_table_orm(
            tbl, MagicMock(), self._ometa_for_schema("jaffle_shop")
        )
        assert orm is not None
        assert orm.__tablename__ == "jaffle_shop/customers"
        assert orm.__table_args__["schema"] is None
        assert orm.__table_args__["quote"] is True

    def test_root_schema_table_omits_prefix(self):
        sampler = self._make_sampler()
        tbl = self._make_om_table("orders", ["id"])
        orm = sampler.build_table_orm(
            tbl, MagicMock(), self._ometa_for_schema("default")
        )
        # ROOT_SCHEMA collapses path back to bare table name.
        assert orm.__tablename__ == "orders"

    def test_nested_schema_preserves_directory_path(self):
        sampler = self._make_sampler()
        tbl = self._make_om_table("session_stats", ["user_id"])
        orm = sampler.build_table_orm(
            tbl, MagicMock(), self._ometa_for_schema("marts/analytics")
        )
        assert orm.__tablename__ == "marts/analytics/session_stats"

    def test_empty_columns_returns_none(self):
        sampler = self._make_sampler()
        tbl = MagicMock()
        tbl.columns = []
        assert sampler.build_table_orm(tbl, MagicMock(), MagicMock()) is None


# ---------------------------------------------------------------------------
# YdbSampler.get_sample_query — must emit subqueries, never CTEs.
#
# YQL in some YDB releases rejects ``WITH ... AS (...) SELECT ...`` at the
# top level. ``FROM (SELECT ...) AS x`` is accepted everywhere and produces
# the same downstream shape, so the sampler swaps every ``.cte(...)`` call
# in the base implementation for ``.subquery(...)``.
# ---------------------------------------------------------------------------


class TestYdbSamplerGetSampleQuery:
    def _make_sampler_with_orm(self, randomized: bool = False):
        """Build a YdbSampler bound to a real SQLite session + a real ORM class.

        We don't execute anything — only compile — so SQLite is enough to
        produce a valid SQLAlchemy statement object that can be inspected.
        """
        from sqlalchemy import Column, Integer, MetaData, create_engine
        from sqlalchemy import Table as SaTable
        from sqlalchemy.orm import declarative_base, sessionmaker

        from metadata.sampler.models import SampleConfig
        from metadata.sampler.sqlalchemy.ydb.sampler import YdbSampler

        engine = create_engine("sqlite://")
        Base = declarative_base()  # noqa: N806

        class Foo(Base):
            __tablename__ = "schema/foo"
            __table_args__ = {"quote": True}  # noqa: RUF012
            id = Column(Integer, primary_key=True)
            value = Column(Integer)

        SaTable("dummy", MetaData())  # touch SA so Table import is exercised

        sampler = YdbSampler.__new__(YdbSampler)
        sampler._table = Foo  # backs the raw_dataset property
        sampler.partition_details = None
        sampler.sample_config = SampleConfig(randomizedSample=randomized)
        sampler.session_factory = sessionmaker(bind=engine)
        return sampler

    def _compile(self, sq) -> str:
        return str(sq.compile(compile_kwargs={"literal_binds": True}))

    def test_percentage_path_returns_subquery_not_cte(self):
        from sqlalchemy.sql.selectable import CTE, Subquery

        from metadata.generated.schema.type.basic import ProfileSampleType
        from metadata.generated.schema.type.staticSamplingConfig import (
            StaticSamplingConfig,
        )

        sampler = self._make_sampler_with_orm()
        static = StaticSamplingConfig(
            profileSample=50, profileSampleType=ProfileSampleType.PERCENTAGE
        )
        result = sampler.get_sample_query(static)
        assert isinstance(result, Subquery)
        assert not isinstance(result, CTE)
        # CTE rendering prepends WITH; subquery is inlined as FROM (SELECT ...).
        sql = self._compile(result)
        assert "WITH" not in sql.upper().split("\n")[0]
        assert "FROM (SELECT" in sql.replace("\n", " ")

    def test_rows_path_returns_subquery_not_cte(self):
        from sqlalchemy.sql.selectable import CTE, Subquery

        from metadata.generated.schema.type.basic import ProfileSampleType
        from metadata.generated.schema.type.staticSamplingConfig import (
            StaticSamplingConfig,
        )

        sampler = self._make_sampler_with_orm()
        static = StaticSamplingConfig(
            profileSample=100, profileSampleType=ProfileSampleType.ROWS
        )
        result = sampler.get_sample_query(static)
        assert isinstance(result, Subquery)
        assert not isinstance(result, CTE)

    def test_none_sampling_still_returns_subquery(self):
        """``static=None`` is the path the UI auto-pipeline hits when no
        explicit profileSample is set — must also avoid CTE."""
        from sqlalchemy.sql.selectable import CTE, Subquery

        sampler = self._make_sampler_with_orm()
        result = sampler.get_sample_query(None)
        assert isinstance(result, Subquery)
        assert not isinstance(result, CTE)

    def test_percentage_path_has_no_order_by(self):
        """YQL rejects subqueries with ``ORDER BY`` and no ``LIMIT`` (issue
        4504, severity 2 — treated as fatal by ydb-dbapi). The base sampler
        adds ``ORDER BY rnd.random`` when ``profileSample==100`` and
        ``randomizedSample is True``; our override must drop it."""
        from metadata.generated.schema.type.basic import ProfileSampleType
        from metadata.generated.schema.type.staticSamplingConfig import (
            StaticSamplingConfig,
        )

        sampler = self._make_sampler_with_orm(randomized=True)
        static = StaticSamplingConfig(
            profileSample=100, profileSampleType=ProfileSampleType.PERCENTAGE
        )
        sql = self._compile(sampler.get_sample_query(static)).replace("\n", " ")
        assert "ORDER BY" not in sql.upper()


# ---------------------------------------------------------------------------
# RandomNumFn YDB compile — emits "0", not bare RANDOM()
# ---------------------------------------------------------------------------


class TestRandomNumFnYdb:
    def test_emits_zero(self):
        """YQL ``Random()`` requires at least one argument (severity-1 error
        otherwise). The YDB compile override mirrors Snowflake/Teradata and
        emits ``0`` instead — downstream ``MOD(0, 100) <= profileSample``
        degrades to a full-table scan, which is the same trade-off the
        already-shipped Snowflake sampler makes."""
        from sqlalchemy.dialects import registry

        from metadata.profiler.orm.functions.random_num import RandomNumFn
        from metadata.profiler.orm.registry import Dialects

        ydb_dialect = registry.load("yql")()
        compiled = str(RandomNumFn().compile(dialect=ydb_dialect))
        assert compiled == "0"
        assert Dialects.YDB == "yql"  # belt-and-braces: the @compiles key matches
