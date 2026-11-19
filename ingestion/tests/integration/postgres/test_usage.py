from datetime import datetime

import pytest
from sqlalchemy import create_engine, text

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.databaseServiceQueryUsagePipeline import (
    DatabaseUsageConfigType,
)
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.usage import UsageWorkflow

DELETE_RECREATE_QUERY = """
WITH usage_delete_recreate AS (SELECT * FROM public.actor)
SELECT * FROM usage_delete_recreate LIMIT 1
"""


@pytest.fixture()
def usage_config(sink_config, workflow_config, db_service, tmp_path):
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
                "filename": str(tmp_path / "postgres_usage"),
            },
        },
        "bulkSink": {
            "type": "metadata-usage",
            "config": {
                "filename": str(tmp_path / "postgres_usage"),
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
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(UsageWorkflow, usage_config)


def test_usage_delete_usage(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    usage_config,
    metadata,
    db_service,
    postgres_container,
    caplog,
):
    run_workflow(MetadataWorkflow, ingestion_config)
    engine = create_engine(postgres_container.get_connection_url())
    try:
        with engine.connect() as connection:
            connection.execute(text(DELETE_RECREATE_QUERY))
    finally:
        engine.dispose()
    usage_config["source"]["sourceConfig"]["config"].update(
        {
            "filterCondition": "query LIKE '%usage_delete_recreate%'",
            "resultLimit": 1,
        }
    )
    first_usage = run_workflow(UsageWorkflow, usage_config)
    published_tables = [
        record.removeprefix("Table: ") for record in first_usage.steps[2].status.records if record.startswith("Table: ")
    ]
    assert published_tables
    table_fqn = published_tables[0]
    old_table = metadata.get_by_name(Table, table_fqn, nullable=False)
    original_queries = metadata.get_entity_queries(old_table.id)
    assert original_queries
    original_sql = {query.query.root for query in original_queries if "usage_delete_recreate" in query.query.root}
    assert len(original_sql) == 1

    metadata.delete(Table, old_table.id, hard_delete=True, recursive=True)
    run_workflow(MetadataWorkflow, ingestion_config)
    new_table = metadata.get_by_name(Table, table_fqn, nullable=False)
    assert old_table.id != new_table.id

    caplog.clear()
    second_usage = run_workflow(UsageWorkflow, usage_config, raise_from_status=False)

    assert not second_usage.steps[2].status.failures
    assert f"Table: {table_fqn}" in second_usage.steps[2].status.records
    assert "Entity already exists" not in caplog.text
    assert str(old_table.id.root) not in caplog.text
    recreated_queries = metadata.get_entity_queries(new_table.id)
    assert recreated_queries
    assert {query.query.root for query in recreated_queries} == original_sql
    usage_date = datetime.today().strftime("%Y-%m-%d")
    usage = metadata.client.get(f"/usage/table/{new_table.id.root}?date={usage_date}&days=1")
    assert usage["usage"][0]["date"] == usage_date
    assert usage["usage"][0]["dailyStats"]["count"] == 1
