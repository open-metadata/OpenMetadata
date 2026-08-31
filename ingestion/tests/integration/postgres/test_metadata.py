import pytest
from sqlalchemy import create_engine, text

from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.workflow.metadata import MetadataWorkflow

MATVIEW_SCHEMA = "mv_repro"


@pytest.fixture(scope="module")
def matview_schema(postgres_container):
    """A plain view and a materialized view, so the ingestion below covers both (#31515)."""
    engine = create_engine(postgres_container.get_connection_url())
    with engine.begin() as conn:
        conn.execute(text(f"CREATE SCHEMA {MATVIEW_SCHEMA}"))
        conn.execute(text(f"CREATE TABLE {MATVIEW_SCHEMA}.base_table (id int, amount numeric)"))
        conn.execute(
            text(f"CREATE VIEW {MATVIEW_SCHEMA}.plain_view AS SELECT id, amount FROM {MATVIEW_SCHEMA}.base_table")
        )
        conn.execute(
            text(
                f"CREATE MATERIALIZED VIEW {MATVIEW_SCHEMA}.mat_view AS "
                f"SELECT id, sum(amount) AS total FROM {MATVIEW_SCHEMA}.base_table GROUP BY 1"
            )
        )
    yield
    with engine.begin() as conn:
        conn.execute(text(f"DROP SCHEMA {MATVIEW_SCHEMA} CASCADE"))
    engine.dispose()


@pytest.fixture(scope="module")
def ingested_metadata(patch_passwords_for_db_services, matview_schema, run_workflow, ingestion_config):
    """One metadata ingestion, shared by every assertion in this module."""
    run_workflow(MetadataWorkflow, ingestion_config)


def test_ingest_metadata(ingested_metadata):
    """The workflow runs clean — run_workflow raises from status otherwise."""


def test_materialized_view_ingested_as_materialized_view(ingested_metadata, metadata, db_service):
    """
    #31515: a materialized view must reach the catalogue typed MaterializedView,
    with its columns, rather than being silently skipped.
    """
    ingested = {
        table.name.root: table
        for table in metadata.list_entities(
            Table,
            params={"databaseSchema": f"{db_service.fullyQualifiedName.root}.dvdrental.{MATVIEW_SCHEMA}"},
            fields=["columns"],
            limit=100,
        ).entities
    }

    assert "mat_view" in ingested, f"materialized view was not ingested; got {sorted(ingested)}"
    assert ingested["mat_view"].tableType == TableType.MaterializedView
    assert [column.name.root for column in ingested["mat_view"].columns] == ["id", "total"]
    assert ingested["plain_view"].tableType == TableType.View
