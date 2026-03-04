from metadata.workflow.metadata import MetadataWorkflow


def test_ingest_metadata(
    patch_passwords_for_db_services, run_workflow, ingestion_config
):
    run_workflow(MetadataWorkflow, ingestion_config)
