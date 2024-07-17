from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow


def test_metadata(
    db_service, metadata: OpenMetadata, run_workflow, ingestion_config, create_test_data
):
    run_workflow(MetadataWorkflow, ingestion_config)
    tables = metadata.list_entities(
        Table,
        params={
            "databaseSchema": f"{db_service.fullyQualifiedName.root}.minio.my_schema"
        },
    )
    assert (
        next((t for t in tables.entities if t.name.root == "test_table"), None)
        is not None
    )
