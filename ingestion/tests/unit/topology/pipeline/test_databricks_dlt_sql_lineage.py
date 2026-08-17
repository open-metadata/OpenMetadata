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

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.pipeline.databrickspipeline.kafka_parser import (
    extract_dlt_table_dependencies,
)
from metadata.ingestion.source.pipeline.databrickspipeline.metadata import (
    DatabrickspipelineSource,
)
from metadata.ingestion.source.pipeline.databrickspipeline.models import (
    DataBrickPipelineDetails,
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
        with patch.object(DatabrickspipelineSource, "__init__", lambda s, a, b: None):
            source = DatabrickspipelineSource(None, None)

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

        source._table_lookup_cache = {}
        source._dlt_table_cache = {}
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
