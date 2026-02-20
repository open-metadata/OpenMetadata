from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.metadata import MetadataWorkflow


def test_classifier(
    patch_passwords_for_db_services, run_workflow, ingestion_config, classifier_config
):
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(AutoClassificationWorkflow, classifier_config)
