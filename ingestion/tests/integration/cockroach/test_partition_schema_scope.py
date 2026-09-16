import textwrap
import time

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from testcontainers.cockroachdb import CockroachDBContainer
from testcontainers.core.waiting_utils import wait_for_logs

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
        # Testcontainers returns after user creation, before database privileges are granted.
        wait_for_logs(container, "end running init files from /docker-entrypoint-initdb.d")
        yield container
    finally:
        container.stop()


@pytest.fixture(scope="module")
def prepare_partitioned_schemas(cockroach_container):
    """Create same-named `events` tables in two schemas with different partition
    strategies, plus a non-partitioned same-named table in a third schema.

    - public.events    : LIST partition on `region`
    - analytics.events  : RANGE partition on `id`
    - reporting.events : non-partitioned regular table

    This is the configuration that exposed the bug where partitions from one
    schema's table were attributed to another schema's same-named table.

    CockroachDB requires the partition column to be a prefix of the primary
    key, hence `region` is the first PK column for `public.events`.
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
    "schema,expected_type,expected_partition_columns",
    [
        ("public", TableType.Partitioned, {"region"}),
        ("analytics", TableType.Partitioned, {"id"}),
        ("reporting", TableType.Regular, None),
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
    expected_type,
    expected_partition_columns,
    prepare_partitioned_schemas,
):
    """End-to-end regression: each same-named `events` table must be published
    with only its own partition columns (or none, if non-partitioned)."""
    run_workflow(MetadataWorkflow, ingestion_config)

    fqn = f"{db_service.fullyQualifiedName.root}.roach.{schema}.events"
    table = metadata.get_by_name(entity=Table, fqn=fqn)
    assert table is not None, f"{fqn} was not ingested"

    if expected_type == TableType.Partitioned:
        assert table.tableType == TableType.Partitioned
        assert table.tablePartition is not None
        column_names = {col.columnName for col in table.tablePartition.columns}
        assert column_names == expected_partition_columns, (
            f"{schema}.events partitions leaked across schemas: {column_names}"
        )
    else:
        # Non-partitioned same-named table must NOT inherit another schema's
        # partitions and must NOT be flagged Partitioned.
        assert table.tableType in (None, TableType.Regular), f"{schema}.events wrongly flagged {table.tableType}"
        assert table.tablePartition is None, (
            f"{schema}.events wrongly assigned partitions "
            f"{table.tablePartition.columns if table.tablePartition else None}"
        )
