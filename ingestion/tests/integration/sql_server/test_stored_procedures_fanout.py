import pytest
from sqlalchemy import create_engine, text

from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def sp_collision_schemas(mssql_container, db_name):
    engine = create_engine(
        "mssql+pytds://" + mssql_container.get_connection_url().split("://")[1],
        connect_args={"autocommit": True},
    )
    schemas = ["dbo", "sales"]
    with engine.connect() as conn:
        transaction = conn.begin()
        conn.execute(text("USE [" + db_name + "];"))
        conn.execute(text("IF SCHEMA_ID('sales') IS NULL EXEC('CREATE SCHEMA sales');"))
        for schema in schemas:
            conn.execute(text(f"IF OBJECT_ID('{schema}.cleanup') IS NOT NULL DROP PROCEDURE {schema}.cleanup;"))
        conn.execute(text("CREATE PROCEDURE dbo.cleanup AS SELECT 1 AS dbo_body;"))
        conn.execute(text("CREATE PROCEDURE sales.cleanup AS SELECT 2 AS sales_body;"))
        transaction.commit()
    return schemas


@pytest.fixture()
def sp_config(sp_collision_schemas, db_service, workflow_config, sink_config, db_name):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "serviceConnection": db_service.connection.model_dump(),
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                    "includeStoredProcedures": True,
                    "databaseFilterPattern": {"includes": [db_name]},
                    "schemaFilterPattern": {"includes": ["dbo", "sales"]},
                }
            },
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


def test_stored_procedure_no_cross_schema_definition_override(
    patch_passwords_for_db_services,
    run_workflow,
    sp_config,
    db_service,
    metadata,
    db_name,
    cleanup_fqns,
):
    run_workflow(MetadataWorkflow, sp_config)

    service_fqn = db_service.fullyQualifiedName.root
    dbo_sp: StoredProcedure = metadata.get_by_name(
        StoredProcedure,
        f"{service_fqn}.{db_name}.dbo.cleanup",
        nullable=False,
    )
    sales_sp: StoredProcedure = metadata.get_by_name(
        StoredProcedure,
        f"{service_fqn}.{db_name}.sales.cleanup",
        nullable=False,
    )

    assert "dbo_body" in dbo_sp.storedProcedureCode.code
    assert "sales_body" not in dbo_sp.storedProcedureCode.code

    assert "sales_body" in sales_sp.storedProcedureCode.code
    assert "dbo_body" not in sales_sp.storedProcedureCode.code

    cleanup_fqns(StoredProcedure, f"{service_fqn}.{db_name}.dbo.cleanup")
    cleanup_fqns(StoredProcedure, f"{service_fqn}.{db_name}.sales.cleanup")
