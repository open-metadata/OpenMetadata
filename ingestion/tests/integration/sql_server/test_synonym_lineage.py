"""
Lineage through SQL Server synonyms.

Synonyms are a common abstraction layer: a consuming view references
`SynonymDB.dbo.synCustomer`, which is an alias for a real object living in
another database. Synonyms are not tables or views, so they are never ingested
as entities, and the reference in the consuming view's DDL resolves to nothing.
The connector has to resolve the alias itself for the edge to be created.
"""

import pytest
from sqlalchemy import create_engine, text

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.metadata import MetadataWorkflow

SYNONYM_DB = "SynonymDB"
SYNONYM_SCHEMA = "dbo"
SYNONYM_NAME = "synCustomer"
CONSUMER_VIEW = "vCustomerFromSynonym"
BASE_SCHEMA = "SalesLT"
BASE_TABLE = "Customer"


@pytest.fixture(scope="package")
def synonym_objects(mssql_container, db_name):
    """Create a database whose view reaches another database only through a synonym."""
    engine = create_engine(
        "mssql+pytds://" + mssql_container.get_connection_url().split("://")[1],
        connect_args={"autocommit": True},
    )
    with engine.connect() as conn:
        conn.execute(text(f"IF DB_ID('{SYNONYM_DB}') IS NULL CREATE DATABASE [{SYNONYM_DB}];"))
        # USE persists on the connection, so CREATE VIEW below is still first in its own batch
        conn.execute(text(f"USE [{SYNONYM_DB}];"))
        conn.execute(
            text(
                f"IF NOT EXISTS (SELECT 1 FROM sys.synonyms WHERE name = '{SYNONYM_NAME}' "
                f"AND SCHEMA_NAME(schema_id) = '{SYNONYM_SCHEMA}') "
                f"CREATE SYNONYM [{SYNONYM_SCHEMA}].[{SYNONYM_NAME}] "
                f"FOR [{db_name}].[{BASE_SCHEMA}].[{BASE_TABLE}];"
            )
        )
        conn.execute(
            text(
                f"IF OBJECT_ID('{SYNONYM_SCHEMA}.{CONSUMER_VIEW}', 'V') IS NOT NULL DROP VIEW [{SYNONYM_SCHEMA}].[{CONSUMER_VIEW}];"
            )
        )
        conn.execute(
            text(
                f"CREATE VIEW [{SYNONYM_SCHEMA}].[{CONSUMER_VIEW}] AS "
                f"SELECT CustomerID, FirstName, LastName FROM [{SYNONYM_SCHEMA}].[{SYNONYM_NAME}];"
            )
        )
    yield


@pytest.fixture(scope="module")
def synonym_ingestion_config(synonym_objects, db_service, workflow_config, sink_config, db_name):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                    "databaseFilterPattern": {"includes": [db_name, SYNONYM_DB]},
                }
            },
            "serviceConnection": db_service.connection.model_dump(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@pytest.fixture(scope="module")
def synonym_lineage_config(db_service, workflow_config, sink_config, db_name):
    return {
        "source": {
            "type": "mssql-lineage",
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "DatabaseLineage",
                    "databaseFilterPattern": {"includes": [db_name, SYNONYM_DB]},
                }
            },
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@pytest.fixture(scope="module")
def ingested_synonym_lineage(
    patch_passwords_for_db_services,
    run_workflow,
    synonym_ingestion_config,
    synonym_lineage_config,
):
    """Ingest metadata and lineage once for every assertion in this module."""
    search_cache.clear()
    run_workflow(MetadataWorkflow, synonym_ingestion_config)
    run_workflow(MetadataWorkflow, synonym_lineage_config)


def test_synonym_view_lineage(
    ingested_synonym_lineage,
    db_service,
    metadata,
    db_name,
):
    """The consuming view must be linked to the object its synonym points at."""
    service_fqn = db_service.fullyQualifiedName.root
    base_table = metadata.get_by_name(
        Table,
        f"{service_fqn}.{db_name}.{BASE_SCHEMA}.{BASE_TABLE}",
        nullable=False,
    )
    consumer_view = metadata.get_by_name(
        Table,
        f"{service_fqn}.{SYNONYM_DB}.{SYNONYM_SCHEMA}.{CONSUMER_VIEW}",
        nullable=False,
    )

    lineage = metadata.get_lineage_by_id(Table, consumer_view.id.root)
    upstream_ids = {edge["fromEntity"] for edge in (lineage or {}).get("upstreamEdges") or []}
    assert str(base_table.id.root) in upstream_ids, (
        f"No lineage from {base_table.fullyQualifiedName.root} to "
        f"{consumer_view.fullyQualifiedName.root}; upstream edges were {upstream_ids}"
    )


def test_synonym_column_lineage(
    ingested_synonym_lineage,
    db_service,
    metadata,
    db_name,
):
    """Column mappings must survive the alias resolution."""
    service_fqn = db_service.fullyQualifiedName.root
    base_fqn = f"{service_fqn}.{db_name}.{BASE_SCHEMA}.{BASE_TABLE}"
    consumer_fqn = f"{service_fqn}.{SYNONYM_DB}.{SYNONYM_SCHEMA}.{CONSUMER_VIEW}"
    consumer_view = metadata.get_by_name(Table, consumer_fqn, nullable=False)

    lineage = metadata.get_lineage_by_id(Table, consumer_view.id.root)
    column_pairs = {
        (from_column, mapping["toColumn"])
        for edge in (lineage or {}).get("upstreamEdges") or []
        for mapping in ((edge.get("lineageDetails") or {}).get("columnsLineage") or [])
        for from_column in mapping["fromColumns"]
    }
    assert (f"{base_fqn}.CustomerID", f"{consumer_fqn}.CustomerID") in column_pairs, (
        f"Column lineage missing for CustomerID; got {column_pairs}"
    )
