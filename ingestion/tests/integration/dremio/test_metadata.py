from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.workflow.metadata import MetadataWorkflow


def test_ingest_tables_and_views(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    metadata,
    db_service,
):
    ingestion_config["source"]["sourceConfig"]["config"]["databaseFilterPattern"] = {
        "includes": ["^lake$", "^reporting$"]
    }
    run_workflow(MetadataWorkflow, ingestion_config)
    service = db_service.fullyQualifiedName.root

    customers = metadata.get_by_name(entity=Table, fqn=f"{service}.lake.sales.customers", fields=["columns"])
    assert customers
    assert customers.tableType == TableType.Regular
    assert {c.name.root for c in customers.columns} == {"id", "name", "country"}

    view = metadata.get_by_name(
        entity=Table, fqn=f"{service}.reporting.reporting.customer_totals", fields=["columns", "schemaDefinition"]
    )
    assert view
    assert view.tableType == TableType.View
    assert {c.name.root for c in view.columns} == {"name", "country", "total"}
    assert "customers" in view.schemaDefinition.root.lower()


def test_system_catalogs_are_not_ingested(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    metadata,
    db_service,
):
    run_workflow(MetadataWorkflow, ingestion_config)
    databases = metadata.list_all_entities(Database, params={"service": db_service.fullyQualifiedName.root})
    names = {database.name.root for database in databases}
    assert {"lake", "reporting"} <= names
    assert not {name.lower() for name in names} & {"information_schema", "sys"}
