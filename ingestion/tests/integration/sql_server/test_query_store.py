"""
Integration test proving Query Store durability for MSSQL lineage.

SQL Server's default lineage source is the volatile plan cache (sys.dm_exec_*),
which is wiped on restart or DBCC FREEPROCCACHE. Query Store persists query
history inside the user database, so lineage built from it survives those events.

This test enables Query Store, creates a lineage edge, forces Query Store to
persist, then WIPES the plan cache and runs the lineage workflow. The edge must
still resolve - which is only possible if lineage came from Query Store, because
the plan-cache (DMV) path would now find nothing.

Requires a Query-Store-capable SQL Server (2016+); the 2022 test container
qualifies. Run with the sql_server integration suite (needs Docker).
"""

import pytest
from sqlalchemy import create_engine, text

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.metadata import MetadataWorkflow

QUERY_STORE_TARGET = "CustomerCopyQueryStore"


@pytest.fixture()
def query_store_lineage_edge(mssql_container, db_name):
    """
    Enable Query Store on the test database, create a lineage edge via
    SELECT ... INTO, force Query Store to flush to disk, then evict the plan
    cache so the edge survives only in Query Store.
    """
    engine = create_engine(
        "mssql+pytds://" + mssql_container.get_connection_url().split("://")[1],
        connect_args={"autocommit": True},
    )
    with engine.connect() as conn:
        # QUERY_CAPTURE_MODE = ALL is required: the connector only uses Query Store
        # in ALL mode (AUTO skips ad-hoc queries like the SELECT ... INTO below).
        conn.execute(
            text(
                f"ALTER DATABASE [{db_name}] SET QUERY_STORE = ON "
                "(OPERATION_MODE = READ_WRITE, QUERY_CAPTURE_MODE = ALL);"
            )
        )
        conn.execute(text(f"ALTER DATABASE [{db_name}] SET QUERY_STORE CLEAR;"))
        conn.execute(text(f"SELECT * INTO {db_name}.SalesLT.{QUERY_STORE_TARGET} FROM {db_name}.SalesLT.Customer;"))
        # Persist runtime stats so the query is durably recorded, then wipe the
        # volatile plan cache - the dm_exec_* path can no longer see the query.
        conn.execute(text(f"EXEC {db_name}.sys.sp_query_store_flush_db;"))
        conn.execute(text("DBCC FREEPROCCACHE;"))
        conn.commit()
    return QUERY_STORE_TARGET


@pytest.fixture()
def lineage_config(db_service, workflow_config, sink_config, db_name):
    return {
        "source": {
            "type": "mssql-lineage",
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "DatabaseLineage",
                    "databaseFilterPattern": {"includes": [db_name]},
                },
            },
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


def test_lineage_survives_plan_cache_eviction_via_query_store(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    lineage_config,
    query_store_lineage_edge,
    db_service,
    metadata,
    db_name,
):
    """
    With Query Store enabled and the plan cache wiped, lineage for a query that
    now exists only in Query Store must still resolve. On the plan-cache path
    this assertion would fail (no rows after DBCC FREEPROCCACHE).
    """
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(MetadataWorkflow, lineage_config)

    target_table = metadata.get_by_name(
        Table,
        f"{db_service.fullyQualifiedName.root}.{db_name}.SalesLT.{query_store_lineage_edge}",
        nullable=False,
    )
    lineage = metadata.get_lineage_by_id(Table, target_table.id.root)
    assert lineage is not None, (
        "Lineage for the Query-Store-only query did not resolve after the plan "
        "cache was evicted - the Query Store path was not active"
    )
