from unittest.mock import patch

import pytest
from sqlalchemy.engine.url import make_url

from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.databaseServiceQueryUsagePipeline import (
    DatabaseUsageConfigType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.ingestion.source.database.postgres.usage import PostgresUsageSource
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.usage import UsageWorkflow


@pytest.fixture()
def usage_config(sink_config, workflow_config, db_service):
    return {
        "source": {
            "type": "postgres-usage",
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {"config": {"type": DatabaseUsageConfigType.DatabaseUsage.value}},
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


def test_usage_registers_failing_query_source(postgres_container, workflow_config):
    """
    When the usage query fails against the source (here the configured query
    source does not exist), the failure must be registered on the source status
    instead of the run reporting Errors: 0 / Success 100% (#17204).
    """
    url = make_url(postgres_container.get_connection_url())
    config = {
        "source": {
            "type": "postgres-usage",
            "serviceName": "test_usage_17204",
            "serviceConnection": {
                "config": {
                    "type": "Postgres",
                    "username": url.username,
                    "authType": {"password": url.password},
                    "hostPort": f"{url.host}:{url.port}",
                    "database": url.database,
                    "queryStatementSource": "nonexistent_query_source_17204",
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseUsage", "queryLogDuration": 1}},
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": workflow_config,
    }
    parsed = OpenMetadataWorkflowConfig.model_validate(config)
    with patch("metadata.ingestion.source.database.postgres.usage.PostgresUsageSource.test_connection"):
        source = PostgresUsageSource.create(config["source"], parsed.workflowConfig.openMetadataServerConfig)

    list(source._iter())

    assert len(source.status.failures) >= 1
    assert "nonexistent_query_source_17204" in str(source.status.failures[0].error)
