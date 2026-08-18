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
Lineage extraction for SQL-defined Delta Live Tables pipelines.

Before SQL support, `kafka_parser` only recognised the Python DLT API (`@dlt.table`
and `@dlt.view`), so a pipeline whose transformations are `.sql` files parsed to
nothing and the connector logged "Skipping lineage for this notebook - no DLT tables
found" for every file, even though the upstream references in those files are real,
fully qualified and resolvable.

The SQL below covers the shapes a SQL DLT pipeline uses: a single-line
`CREATE MATERIALIZED VIEW`, a `CREATE OR REFRESH` variant, the view name on its
own line, three-part qualified upstreams, and dependencies on sibling views
declared elsewhere in the same pipeline.
"""

import uuid
from typing import ClassVar
from unittest.mock import MagicMock, patch

from ingestion.tests.unit.topology.pipeline.test_databricks_pipeline import (
    mock_databricks_config,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.pipeline.databrickspipeline.dlt_parsers import (
    DLT_PARSERS,
    PythonDltParser,
    SqlDltParser,
    extract_dlt_table_dependencies,
)
from metadata.ingestion.source.pipeline.databrickspipeline.kafka_parser import (
    get_pipeline_libraries,
    glob_base_directory,
    glob_matches,
)
from metadata.ingestion.source.pipeline.databrickspipeline.metadata import (
    DatabrickspipelineSource,
)
from metadata.ingestion.source.pipeline.databrickspipeline.models import (
    DataBrickPipelineDetails,
    DLTLibrarySource,
    DLTTableReference,
)

DB_SERVICE = "databricks_pipeline_test"
CATALOG = "demo_catalog"
SCHEMA = "demo_schema"
TRANSFORMATIONS_DIR = "/Repos/demo/transformations/"

# Single-line CREATE, depends on two sibling views declared in the same pipeline
SQL_SINGLE_LINE_CREATE = """-- join staged orders to their computed totals
CREATE MATERIALIZED VIEW orders_enriched CLUSTER BY (order_id) AS
    SELECT
        s.* ,
        t.amount
    FROM orders_staged s
        LEFT JOIN order_totals t
        ON t.order_id = s.order_id
"""

# CREATE OR REFRESH, two three-part qualified upstreams
SQL_QUALIFIED_UPSTREAMS = """CREATE OR REFRESH MATERIALIZED VIEW customer_orders CLUSTER BY (order_id)
AS
SELECT
    c.customer_id,
    c.region,
    o.order_id
FROM raw_catalog.raw_schema.orders_raw o
INNER JOIN
raw_catalog.raw_schema.customers_raw c
ON o.customer_id = c.customer_id
WHERE o.status = "complete"
"""

# View name on its own line, mixes a qualified upstream with a sibling view
SQL_MULTILINE_CREATE = """CREATE OR REFRESH MATERIALIZED VIEW
    order_summary
CLUSTER BY (order_id)
AS
SELECT
  e.*,
  t.amount
FROM raw_catalog.raw_schema.events_raw AS e
INNER JOIN order_totals t
  ON e.order_id = t.order_id
"""

# The Python DLT shape that already works, kept as a regression guard
PYTHON_DLT = """
import dlt

@dlt.table(name="events_bronze")
def build_events():
    return spark.readStream.format("kafka") \\
        .option("kafka.bootstrap.servers", "broker:9092") \\
        .option("subscribe", "events_topic") \\
        .load()

@dlt.table(name="events_silver")
def refine_events():
    return dlt.read_stream("events_bronze")
"""

SQL_FILES = {
    "orders_enriched.sql": SQL_SINGLE_LINE_CREATE,
    "customer_orders.sql": SQL_QUALIFIED_UPSTREAMS,
    "order_summary.sql": SQL_MULTILINE_CREATE,
}


def _deps_by_name(source_code):
    return {dep.table_name: dep for dep in extract_dlt_table_dependencies(source_code)}


class TestPythonDltStillParses:
    """Guard so SQL support does not regress the Python DLT path."""

    def test_python_decorators_are_parsed(self):
        deps = _deps_by_name(PYTHON_DLT)
        assert set(deps) == {"events_bronze", "events_silver"}
        assert deps["events_bronze"].reads_from_kafka is True
        assert deps["events_silver"].depends_on == ["events_bronze"]


class TestSqlDltParsing:
    """SQL-defined DLT must produce the same DLTTableDependency records."""

    def test_single_line_create_materialized_view(self):
        deps = _deps_by_name(SQL_SINGLE_LINE_CREATE)
        assert "orders_enriched" in deps
        assert set(deps["orders_enriched"].depends_on) == {"orders_staged", "order_totals"}

    def test_create_or_refresh_with_qualified_upstreams(self):
        deps = _deps_by_name(SQL_QUALIFIED_UPSTREAMS)
        assert "customer_orders" in deps
        assert set(deps["customer_orders"].depends_on) == {
            "raw_catalog.raw_schema.orders_raw",
            "raw_catalog.raw_schema.customers_raw",
        }

    def test_view_name_on_its_own_line(self):
        deps = _deps_by_name(SQL_MULTILINE_CREATE)
        assert "order_summary" in deps
        assert set(deps["order_summary"].depends_on) == {
            "raw_catalog.raw_schema.events_raw",
            "order_totals",
        }

    def test_sql_files_are_not_silently_skipped(self):
        """Every SQL transformation must contribute at least one table."""
        empty = [name for name, sql in SQL_FILES.items() if not extract_dlt_table_dependencies(sql)]
        assert not empty, f"SQL DLT files parsed to nothing: {empty}"


class TestSqlDltPipelineLineage:
    """End to end through the connector, with only the Databricks client stubbed."""

    # The tables that exist in OpenMetadata. Anything the connector asks for outside
    # this set resolves to None, so a wrongly built FQN drops the edge instead of
    # quietly succeeding.
    EXISTING_TABLES: ClassVar[set] = {
        f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.orders_enriched",
        f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.customer_orders",
        f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.order_summary",
        f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.orders_staged",
        f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.order_totals",
        f"{DB_SERVICE}.raw_catalog.raw_schema.orders_raw",
        f"{DB_SERVICE}.raw_catalog.raw_schema.customers_raw",
        f"{DB_SERVICE}.raw_catalog.raw_schema.events_raw",
    }

    @classmethod
    def _build_source(cls):
        """
        Build the source through its real `create()`, patching only the external
        boundary. Nothing about the connector's internals (caches included) is
        assembled here, so an implementation change cannot leave this test
        asserting against a shape production no longer uses.
        """
        with patch("metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"):
            source = DatabrickspipelineSource.create(
                mock_databricks_config["source"],
                OpenMetadataWorkflowConfig.model_validate(
                    mock_databricks_config
                ).workflowConfig.openMetadataServerConfig,
            )

        client = MagicMock()
        client.get_pipeline_details.return_value = {
            "pipeline_id": "pipeline-uuid",
            "spec": {
                "catalog": CATALOG,
                "schema": SCHEMA,
                "libraries": [{"glob": {"include": TRANSFORMATIONS_DIR + "**"}}],
            },
        }
        client.list_workspace_objects.return_value = [
            {"object_type": "FILE", "path": TRANSFORMATIONS_DIR + name} for name in SQL_FILES
        ]
        client.export_notebook_source.side_effect = lambda path: SQL_FILES[path.rsplit("/", 1)[-1]]
        client.get_table_lineage.return_value = []
        client.get_column_lineage.return_value = []
        source.client = client

        source._databricks_services_cached = True
        source._databricks_services = [DB_SERVICE]

        metadata = MagicMock()
        metadata.client.get.return_value = {"hits": {"hits": []}}
        # force FQN building to go through the explicit service.catalog.schema.table path
        metadata.es_search_from_fqn.return_value = None

        ids_to_fqn = {}

        def get_by_name(entity=None, fqn=None, **_):
            name = str(fqn)
            if entity is not Table or name not in cls.EXISTING_TABLES:
                return None
            table = MagicMock(spec=Table)
            table.id = uuid.uuid4()
            table.fullyQualifiedName = name
            table.columns = []
            ids_to_fqn[str(table.id)] = name
            return table

        metadata.get_by_name.side_effect = get_by_name
        source.metadata = metadata
        return source, ids_to_fqn

    def _edges(self):
        source, ids_to_fqn = self._build_source()
        pipeline_entity = MagicMock()
        pipeline_entity.id.root = uuid.uuid4()

        requests = [
            either.right
            for either in source._yield_kafka_lineage(
                DataBrickPipelineDetails(pipeline_id="pipeline-uuid", name="demo_sql_dlt"),
                pipeline_entity,
            )
            if getattr(either, "right", None) is not None
        ]
        return {
            (
                ids_to_fqn.get(model_str(r.edge.fromEntity.id)),
                ids_to_fqn.get(model_str(r.edge.toEntity.id)),
            )
            for r in requests
        }

    def test_sql_dlt_pipeline_yields_table_lineage(self):
        assert self._edges(), "SQL DLT pipeline produced no lineage at all"

    def test_bare_upstreams_resolve_against_the_pipeline_target(self):
        """A sibling dataset resolves under the pipeline's own catalog and schema."""
        assert (
            f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.orders_staged",
            f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.orders_enriched",
        ) in self._edges()

    def test_qualified_upstreams_keep_their_own_catalog_and_schema(self):
        """A three-part upstream must NOT be nested under the pipeline target."""
        edges = self._edges()
        assert (
            f"{DB_SERVICE}.raw_catalog.raw_schema.orders_raw",
            f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.customer_orders",
        ) in edges
        assert not any(
            "raw_catalog" in (src or "") and src.startswith(f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.") for src, _ in edges
        ), "qualified upstream was nested under the pipeline catalog/schema"

    def test_all_expected_edges_are_produced(self):
        assert self._edges() == {
            (f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.orders_staged", f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.orders_enriched"),
            (f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.order_totals", f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.orders_enriched"),
            (f"{DB_SERVICE}.raw_catalog.raw_schema.orders_raw", f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.customer_orders"),
            (f"{DB_SERVICE}.raw_catalog.raw_schema.customers_raw", f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.customer_orders"),
            (f"{DB_SERVICE}.raw_catalog.raw_schema.events_raw", f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.order_summary"),
            (f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.order_totals", f"{DB_SERVICE}.{CATALOG}.{SCHEMA}.order_summary"),
        }


class TestParserDispatch:
    """The registry must pick the right language, whatever the source contains."""

    def test_python_is_checked_before_sql(self):
        """Order is the dispatch rule, so it is asserted rather than assumed."""
        assert [PythonDltParser, SqlDltParser] == DLT_PARSERS

    def test_python_wins_over_embedded_sql(self):
        """A Python notebook that builds SQL strings must not be read as SQL."""
        source = """
import dlt
spark.sql("CREATE OR REFRESH MATERIALIZED VIEW sneaky AS SELECT * FROM raw_catalog.raw_schema.other")

@dlt.table(name="real_table")
def build():
    return dlt.read("upstream_ds")
"""
        deps = _deps_by_name(source)
        assert set(deps) == {"real_table"}
        assert deps["real_table"].depends_on == ["upstream_ds"]

    def test_dlt_view_without_a_name_is_recognised(self):
        """`@dlt.view()` takes no name argument, so detection must not require one."""
        source = """
@dlt.view()
def staged():
    return spark.read.json("s3://bucket/data/")
"""
        assert PythonDltParser.handles(source) is True
        assert extract_dlt_table_dependencies(source)

    def test_unrecognised_source_yields_nothing(self):
        assert extract_dlt_table_dependencies("print('not a dlt pipeline')") == []
        assert extract_dlt_table_dependencies("") == []
        assert extract_dlt_table_dependencies(None) == []


class TestSqlDltEdgeCases:
    """Databricks SQL constructs that a plain CREATE ... SELECT reader would miss."""

    def test_apply_changes_into_keeps_its_source(self):
        """CDC pipelines declare the table, then populate it with APPLY CHANGES INTO."""
        source = (
            "CREATE OR REFRESH STREAMING TABLE customers_cdc;\n"
            "APPLY CHANGES INTO live.customers_cdc "
            "FROM STREAM(raw_catalog.raw_schema.customers_raw) KEYS (id) SEQUENCE BY ts"
        )
        deps = _deps_by_name(source)
        assert deps["customers_cdc"].depends_on == ["raw_catalog.raw_schema.customers_raw"]

    def test_live_prefix_resolves_to_a_sibling_dataset(self):
        """`LIVE.x` is a pipeline namespace, not a schema called `live`."""
        deps = _deps_by_name("CREATE MATERIALIZED VIEW gold AS SELECT * FROM LIVE.silver JOIN live.bronze USING (id)")
        assert set(deps["gold"].depends_on) == {"silver", "bronze"}

    def test_table_valued_functions_are_not_treated_as_tables(self):
        """Auto Loader reads have no upstream entity to resolve."""
        assert (
            _deps_by_name(
                "CREATE OR REFRESH STREAMING TABLE raw AS "
                "SELECT * FROM STREAM read_files('/mnt/data', format => 'json')"
            )["raw"].depends_on
            == []
        )
        assert (
            _deps_by_name("CREATE OR REFRESH STREAMING TABLE raw2 AS SELECT * FROM cloud_files('/mnt/data', 'json')")[
                "raw2"
            ].depends_on
            == []
        )

    def test_streaming_table_and_backticked_identifiers(self):
        deps = _deps_by_name(
            "CREATE OR REFRESH STREAMING TABLE `bronze` AS SELECT * FROM `raw_catalog`.`raw_schema`.`src`"
        )
        assert deps["bronze"].depends_on == ["raw_catalog.raw_schema.src"]

    def test_cte_does_not_leak_as_an_upstream(self):
        deps = _deps_by_name(
            "CREATE MATERIALIZED VIEW c AS WITH staged AS "
            "(SELECT * FROM raw_catalog.raw_schema.orders_raw) SELECT * FROM staged"
        )
        assert deps["c"].depends_on == ["raw_catalog.raw_schema.orders_raw"]

    def test_unparseable_statement_is_skipped_not_raised(self):
        assert extract_dlt_table_dependencies("CREATE MATERIALIZED VIEW broken AS SELECT FROM WHERE ((") == []

    def test_multiple_statements_in_one_file(self):
        deps = _deps_by_name(
            "CREATE MATERIALIZED VIEW a AS SELECT * FROM raw_catalog.raw_schema.t1;\n"
            "CREATE MATERIALIZED VIEW b AS SELECT * FROM raw_catalog.raw_schema.t2"
        )
        assert deps["a"].depends_on == ["raw_catalog.raw_schema.t1"]
        assert deps["b"].depends_on == ["raw_catalog.raw_schema.t2"]


class TestQualifyDltTableName:
    """Resolution of a dataset reference against the pipeline's target."""

    @staticmethod
    def _resolve(name):
        return DatabrickspipelineSource._qualify_dlt_table_name(name, "cat", "sch")

    def test_bare_name_uses_the_pipeline_target(self):
        assert self._resolve("orders") == DLTTableReference(catalog="cat", schema="sch", table="orders")

    def test_two_part_name_overrides_only_the_schema(self):
        assert self._resolve("other.orders") == DLTTableReference(catalog="cat", schema="other", table="orders")

    def test_three_part_name_overrides_both(self):
        assert self._resolve("c2.s2.orders") == DLTTableReference(catalog="c2", schema="s2", table="orders")

    def test_extra_qualifiers_keep_the_last_three_parts(self):
        assert self._resolve("x.c2.s2.orders") == DLTTableReference(catalog="c2", schema="s2", table="orders")

    def test_empty_name_falls_back_to_the_pipeline_target(self):
        assert self._resolve("") == DLTTableReference(catalog="cat", schema="sch", table="")

    def test_surrounding_whitespace_and_stray_dots_are_stripped(self):
        for raw in ("  orders  ", "orders.", ".orders"):
            assert self._resolve(raw) == DLTTableReference(catalog="cat", schema="sch", table="orders")


class TestGlobNormalisation:
    """`spec.libraries` glob patterns must reduce to a directory the caller can expand."""

    def test_recursive_and_extension_patterns_reduce_to_a_directory(self):
        for pattern in ("/tx/**", "/tx/*.sql", "/tx/**/*.sql", "/tx/**/*.py", "/tx/staging*"):
            assert glob_base_directory(pattern) == "/tx/", pattern

    def test_a_concrete_path_is_left_alone(self):
        assert glob_base_directory("/tx/one.sql") == "/tx/one.sql"

    def test_glob_library_keeps_its_pattern_for_filtering(self):
        libraries = get_pipeline_libraries({"libraries": [{"glob": {"include": "/tx/**/*.sql"}}]})
        assert libraries == [DLTLibrarySource(path="/tx/", pattern="/tx/**/*.sql")]
        assert libraries[0].is_directory
        assert libraries[0].is_recursive

    def test_all_library_shapes_are_collected(self):
        libraries = get_pipeline_libraries(
            {
                "libraries": [
                    {"notebook": {"path": "/repo/nb"}},
                    {"file": {"path": "/repo/transform.sql"}},
                    {"glob": {"include": "/repo/tx/**"}},
                    {"unknown": {"path": "/ignored"}},
                    "not-a-dict",
                ]
            }
        )
        assert libraries == [
            DLTLibrarySource(path="/repo/nb"),
            DLTLibrarySource(path="/repo/transform.sql"),
            DLTLibrarySource(path="/repo/tx/", pattern="/repo/tx/**"),
        ]

    def test_missing_or_empty_config_is_safe(self):
        assert get_pipeline_libraries({}) == []
        assert get_pipeline_libraries({"libraries": None}) == []


class TestSqlUpstreamHygiene:
    """Upstream lists must be de-duplicated and must not drop real datasets."""

    def test_live_prefix_and_bare_name_collapse_to_one_dependency(self):
        deps = _deps_by_name(
            "CREATE MATERIALIZED VIEW g AS SELECT * FROM LIVE.silver JOIN silver s ON s.id = LIVE.silver.id"
        )
        assert deps["g"].depends_on == ["silver"]

    def test_table_valued_function_dropped_only_when_invoked(self):
        """A dataset may legitimately be named `range`, so filter on call form."""
        assert _deps_by_name("CREATE MATERIALIZED VIEW m AS SELECT * FROM range")["m"].depends_on == ["range"]
        assert _deps_by_name("CREATE MATERIALIZED VIEW m AS SELECT * FROM range(1, 10)")["m"].depends_on == []


class TestConnectorCaches:
    """
    The connector's entity caches are part of its contract, so they are asserted
    against the real object rather than a stub. CLAUDE.md requires every cache to
    be bounded.
    """

    @staticmethod
    def _real_source():
        with patch("metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"):
            return DatabrickspipelineSource.create(
                mock_databricks_config["source"],
                OpenMetadataWorkflowConfig.model_validate(
                    mock_databricks_config
                ).workflowConfig.openMetadataServerConfig,
            )

    def test_entity_caches_are_bounded(self):
        source = self._real_source()
        for cache in (source._table_lookup_cache, source._dlt_table_cache):
            assert hasattr(cache, "capacity"), "caches must be bounded, not plain dicts"
            assert cache.capacity > 0

    def test_cache_evicts_beyond_capacity(self):
        source = self._real_source()
        capacity = source._dlt_table_cache.capacity
        for index in range(capacity + 10):
            source._dlt_table_cache.put(f"cat.sch.table_{index}", None)
        assert len(source._dlt_table_cache) == capacity

    def test_lookup_caches_misses_so_absent_tables_are_asked_for_once(self):
        source = self._real_source()
        source.metadata = MagicMock()
        source.metadata.get_by_name.return_value = None

        assert source._lookup_table("svc.cat.sch.missing") is None
        assert source._lookup_table("svc.cat.sch.missing") is None
        assert source.metadata.get_by_name.call_count == 1

    def test_lookup_of_an_unbuildable_fqn_never_reaches_the_server(self):
        source = self._real_source()
        source.metadata = MagicMock()
        assert source._lookup_table(None) is None
        source.metadata.get_by_name.assert_not_called()


class TestGlobExpansion:
    """
    A glob selects specific files. Expanding it must not widen the selection, or a
    pipeline picks up transformations that belong to something else.
    """

    WORKSPACE: ClassVar[dict] = {
        "/tx/": [
            {"object_type": "FILE", "path": "/tx/a.sql"},
            {"object_type": "FILE", "path": "/tx/notes.py"},
            {"object_type": "DIRECTORY", "path": "/tx/archive"},
        ],
        "/tx/archive/": [{"object_type": "FILE", "path": "/tx/archive/old_v1.sql"}],
    }

    def _expand(self, pattern):
        with patch.object(DatabrickspipelineSource, "__init__", lambda s, a, b: None):
            source = DatabrickspipelineSource(None, None)
        source.client = MagicMock()
        source.client.list_workspace_objects.side_effect = lambda path: self.WORKSPACE.get(path, [])
        return source._expand_workspace_directory(DLTLibrarySource(path=glob_base_directory(pattern), pattern=pattern))

    def test_single_star_stays_in_the_directory_and_respects_the_extension(self):
        assert self._expand("/tx/*.sql") == ["/tx/a.sql"]

    def test_double_star_takes_the_whole_tree(self):
        assert self._expand("/tx/**") == ["/tx/a.sql", "/tx/notes.py", "/tx/archive/old_v1.sql"]

    def test_double_star_with_extension_recurses_but_still_filters(self):
        assert self._expand("/tx/**/*.sql") == ["/tx/a.sql", "/tx/archive/old_v1.sql"]


class TestGlobMatching:
    """`*` stays within a path segment, `**` spans them."""

    def test_single_star_does_not_cross_a_directory_boundary(self):
        assert glob_matches("/tx/a.sql", "/tx/*.sql") is True
        assert glob_matches("/tx/archive/old.sql", "/tx/*.sql") is False

    def test_double_star_spans_directories(self):
        assert glob_matches("/tx/archive/old.sql", "/tx/**/*.sql") is True
        assert glob_matches("/tx/a.sql", "/tx/**/*.sql") is True

    def test_extension_is_honoured(self):
        assert glob_matches("/tx/notes.py", "/tx/*.sql") is False

    def test_an_entry_without_a_pattern_always_matches(self):
        assert glob_matches("/tx/anything", None) is True
