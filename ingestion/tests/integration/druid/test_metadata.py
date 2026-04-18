from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow


def test_ingest_metadata(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    metadata: OpenMetadata,
    db_service,
):
    """Verify that the Druid metadata workflow discovers system schemas."""
    run_workflow(MetadataWorkflow, ingestion_config)

    schemas = metadata.list_entities(
        entity=DatabaseSchema,
        params={"database": f"{db_service.fullyQualifiedName.root}.druid"},
    )
    assert schemas.entities, (
        "Expected at least one schema to be discovered from Druid"
    )
