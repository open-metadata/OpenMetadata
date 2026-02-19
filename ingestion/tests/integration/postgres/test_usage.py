import pytest

from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.databaseServiceQueryUsagePipeline import (
    DatabaseUsageConfigType,
)
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.usage import UsageWorkflow


@pytest.fixture()
def usage_config(sink_config, workflow_config, db_service):
    return {
        "source": {
            "type": "postgres-usage",
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {"type": DatabaseUsageConfigType.DatabaseUsage.value}
            },
        },
        "processor": {"type": "query-parser", "config": {}},
        "stage": {
            "type": "table-usage",
            "config": {
                "filename": "/tmp/postgres_usage",
            },
        },
        "bulkSink": {
            "type": "metadata-usage",
            "config": {
                "filename": "/tmp/postgres_usage",
            },
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


def test_usage(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    usage_config,
    metadata,
    db_service,
):
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(UsageWorkflow, usage_config)


@pytest.mark.xfail(
    reason="'metadata.ingestion.lineage.sql_lineage.search_cache' gets corrupted with invalid data."
    " See issue https://github.com/open-metadata/OpenMetadata/issues/16408",
    strict=True,
)
def test_usage_delete_usage(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    usage_config,
    metadata,
    db_service,
):
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(UsageWorkflow, usage_config)
    metadata.delete(DatabaseService, db_service.id, hard_delete=True, recursive=True)
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(UsageWorkflow, usage_config)
