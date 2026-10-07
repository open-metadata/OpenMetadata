import textwrap
import time

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from testcontainers.cockroachdb import CockroachDBContainer

from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.workflow.metadata import MetadataWorkflow

# Partitioning requires an enterprise-enabled cluster. The shared conftest
# fixture uses `cockroachdb/cockroach:v23.1.0`, where `PARTITION BY` needs a
# license key. v24.3+ is released under the CockroachDB Software License and
# allows single-node dev clusters to use partitioning without a license key.
PARTITION_TEST_IMAGE = "cockroachdb/cockroach:v24.3.0"


@pytest.fixture(scope="module")
def cockroach_container():
    """Override the shared conftest fixture with a v24.3 image that supports
    partitioning on a license-free single-node dev cluster."""
    container = CockroachDBContainer(image=PARTITION_TEST_IMAGE)
    container.start()
    try:
        yield container
    finally:
        container.stop()


@pytest.fixture(scope="module")
def prepare_partitioned_schemas(cockroach_container):
    """Create same-named `events` tables in two schemas with different partition
    strategies, plus a non-partitioned same-named table in a third schema, plus a
    multi-column partitioned table and a table with a partitioned secondary index.

    - public.events       : LIST partition on `region` (single-column key)
    - analytics.events     : RANGE partition on `id` (single-column key)
    - reporting.events    : non-partitioned regular table (same name)
    - public.multi_events : LIST partition on `(region, kind)` (multi-column key)
    - public.sec_index_events : primary partition on `region` + secondary index
                                 partitioned on `category` (validates the
                                 fix's `index_type = 'primary'` filter)
    - public.sub_events   : LIST partition on `region`, with `us` sub-partitioned
                             on `city` (validates the `parent_name IS NULL` filter)
    - public.odd_events   : LIST partition on `("My Col", "a,b")` — identifiers
                             containing a space and a comma, which CockroachDB
                             emits unquoted as "My Col, a,b"

    This is the configuration that exposed the bug where partitions from one
    schema's table were attributed to another schema's same-named table, and
    where multi-column partition keys were emitted as a single malformed
    `"region, kind"` column name.

    CockroachDB requires the partition column to be a prefix of the primary
    key, hence the PK column ordering in each table.
    """
    engine = create_engine(cockroach_container.get_connection_url())
    sql = [
        "CREATE SCHEMA IF NOT EXISTS analytics;",
        "CREATE SCHEMA IF NOT EXISTS reporting;",
        # public.events — LIST partition by region (region is first PK column)
        """
        CREATE TABLE public.events (
            region TEXT NOT NULL,
            id INT8 NOT NULL DEFAULT unique_rowid(),
            PRIMARY KEY (region, id)
        ) PARTITION BY LIST (region) (
            PARTITION us_east VALUES IN ('us-east'),
            PARTITION us_west VALUES IN ('us-west')
        );
        """,
        # analytics.events — RANGE partition by id
        """
        CREATE TABLE analytics.events (
            id INT8 NOT NULL DEFAULT unique_rowid(),
            payload TEXT,
            PRIMARY KEY (id)
        ) PARTITION BY RANGE (id) (
            PARTITION p0 VALUES FROM (0) TO (1000),
            PARTITION p1 VALUES FROM (1000) TO (MAXVALUE)
        );
        """,
        # reporting.events — non-partitioned regular table (same name)
        """
        CREATE TABLE reporting.events (
            id INT8 NOT NULL DEFAULT unique_rowid(),
            note TEXT,
            PRIMARY KEY (id)
        );
        """,
        # public.multi_events — multi-column LIST partition by (region, kind).
        # `column_names` is the scalar STRING "region, kind"; the fix must split
        # it into one PartitionColumnDetails per key column instead of emitting a
        # single malformed "region, kind" columnName that the server rejects.
        """
        CREATE TABLE public.multi_events (
            region TEXT NOT NULL,
            kind TEXT NOT NULL,
            id INT8 NOT NULL DEFAULT unique_rowid(),
            PRIMARY KEY (region, kind, id)
        ) PARTITION BY LIST (region, kind) (
            PARTITION p_east_a VALUES IN (('us-east', 'a')),
            PARTITION p_west_b VALUES IN (('us-west', 'b'))
        );
        """,
        # public.sec_index_events — primary index partitioned by `region`, with a
        # secondary index partitioned by a different column (`category`). This
        # validates the fix's `index_type = 'primary'` filter: only the primary
        # index's partition columns (`region`) must be published, never the
        # secondary index's (`category`).
        """
        CREATE TABLE public.sec_index_events (
            region TEXT NOT NULL,
            category TEXT NOT NULL,
            id INT8 NOT NULL DEFAULT unique_rowid(),
            PRIMARY KEY (region, id)
        ) PARTITION BY LIST (region) (
            PARTITION us_east VALUES IN ('us-east'),
            PARTITION us_west VALUES IN ('us-west')
        );
        """,
        """
        CREATE INDEX idx_sec_category ON public.sec_index_events (category, id)
            PARTITION BY LIST (category) (
                PARTITION cat_a VALUES IN ('a'),
                PARTITION cat_b VALUES IN ('b')
            );
        """,
        # public.sub_events — top-level LIST on `region`, with the `us`
        # partition sub-partitioned on `city`. Sub-partition rows carry
        # `column_names = "city"`; only the top-level `region` must be published.
        """
        CREATE TABLE public.sub_events (
            region TEXT NOT NULL,
            city TEXT NOT NULL,
            id INT8 NOT NULL DEFAULT unique_rowid(),
            PRIMARY KEY (region, city, id)
        ) PARTITION BY LIST (region) (
            PARTITION us VALUES IN ('us') PARTITION BY LIST (city) (
                PARTITION us_nyc VALUES IN ('nyc'),
                PARTITION us_rest VALUES IN (DEFAULT)
            ),
            PARTITION eu VALUES IN ('eu')
        );
        """,
        # public.odd_events — partition key columns whose names contain a space
        # and a comma. `column_names` is "My Col, a,b"; splitting on a bare ","
        # would tear `a,b` apart, splitting on ", " keeps it whole.
        """
        CREATE TABLE public.odd_events (
            "My Col" TEXT NOT NULL,
            "a,b" TEXT NOT NULL,
            id INT8 NOT NULL DEFAULT unique_rowid(),
            PRIMARY KEY ("My Col", "a,b", id)
        ) PARTITION BY LIST ("My Col", "a,b") (
            PARTITION p1 VALUES IN (('x', 'y'))
        );
        """,
    ]
    with engine.connect() as conn:
        for stmt in sql:
            # CockroachDB schema changes can transiently fail with a
            # SerializationFailure ("cannot publish new versions for
            # descriptors ... old versions still in use") when descriptors are
            # leased. Commit each DDL in its own transaction and retry.
            for attempt in range(5):
                try:
                    conn.execute(text(textwrap.dedent(stmt)))
                    conn.commit()
                    break
                except OperationalError as exc:
                    conn.rollback()
                    if "restart transaction" in str(exc).lower() and attempt < 4:
                        time.sleep(1)
                        continue
                    raise


@pytest.mark.parametrize(
    "schema,table_name,expected_type,expected_partition_columns",
    [
        ("public", "events", TableType.Partitioned, ["region"]),
        ("analytics", "events", TableType.Partitioned, ["id"]),
        ("reporting", "events", TableType.Regular, None),
        # Multi-column LIST partition: the comma-joined "region, kind" must be
        # split into ["region", "kind"] (one entry per key column, in order).
        ("public", "multi_events", TableType.Partitioned, ["region", "kind"]),
        # Secondary-index-partitioned table: only the primary-index partition
        # columns ("region") must be published; the secondary index's partition
        # column ("category") must NOT leak in.
        ("public", "sec_index_events", TableType.Partitioned, ["region"]),
        # Sub-partitioned table: only the top-level key ("region") is published;
        # the sub-partition key ("city") must NOT leak in.
        ("public", "sub_events", TableType.Partitioned, ["region"]),
        # Identifiers containing a space and a comma survive the split intact.
        ("public", "odd_events", TableType.Partitioned, ["My Col", "a,b"]),
    ],
    ids=lambda x: x if isinstance(x, str) else "",
)
def test_partition_details_are_scoped_by_schema(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    metadata,
    db_service,
    schema,
    table_name,
    expected_type,
    expected_partition_columns,
    prepare_partitioned_schemas,
):
    """End-to-end regression: each table must be published with only its own
    primary-index partition columns, split into one entry per key column, in
    order, with no duplicates and no malformed comma-joined names."""
    run_workflow(MetadataWorkflow, ingestion_config)

    fqn = f"{db_service.fullyQualifiedName.root}.roach.{schema}.{table_name}"
    table = metadata.get_by_name(entity=Table, fqn=fqn)
    assert table is not None, f"{fqn} was not ingested"

    if expected_type == TableType.Partitioned:
        assert table.tableType == TableType.Partitioned
        assert table.tablePartition is not None
        # Ordered list assertion: enforces both cardinality (no duplicates) and
        # content (one entry per key column, in key order). A set comparison
        # would silently accept duplicates and ignore ordering.
        column_names = [col.columnName for col in table.tablePartition.columns]
        assert column_names == expected_partition_columns, (
            f"{schema}.{table_name} partition columns mismatch: "
            f"got {column_names}, expected {expected_partition_columns}"
        )
    else:
        # Non-partitioned same-named table must NOT inherit another schema's
        # partitions and must NOT be flagged Partitioned.
        assert table.tableType in (None, TableType.Regular), f"{schema}.{table_name} wrongly flagged {table.tableType}"
        assert table.tablePartition is None, (
            f"{schema}.{table_name} wrongly assigned partitions "
            f"{table.tablePartition.columns if table.tablePartition else None}"
        )
