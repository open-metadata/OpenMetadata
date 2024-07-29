import sys
import time
from os import path

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


@pytest.fixture()
def native_lineage_config(db_service, workflow_config, sink_config):
    return {
        "source": {
            "type": "postgres-lineage",
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {"config": {}},
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


def test_native_lineage(
    run_workflow, ingestion_config, native_lineage_config, metadata, db_service
):
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(MetadataWorkflow, native_lineage_config)


@pytest.fixture()
def log_lineage_config(db_service, metadata, workflow_config, sink_config):
    return {
        "source": {
            "type": "query-log-lineage",
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "DatabaseLineage",
                    "queryLogFilePath": path.dirname(__file__) + "/bad_query_log.csv",
                }
            },
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


def test_log_lineage(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    log_lineage_config,
    metadata,
    db_service,
):
    # since query cache is stored in ES, we need to reindex to avoid having a stale cache
    # TODO fix the server so that we dont need to run this
    reindex_search(metadata)
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    workflow = run_workflow(
        MetadataWorkflow, log_lineage_config, raise_from_status=False
    )
    assert len(workflow.source.status.failures) == 2
    for failure in workflow.source.status.failures:
        assert "Table entity not found" in failure.error
    customer_table: Table = metadata.get_by_name(
        Table,
        f"{db_service.fullyQualifiedName.root}.dvdrental.public.customer",
        nullable=False,
    )
    actor_table: Table = metadata.get_by_name(
        Table,
        f"{db_service.fullyQualifiedName.root}.dvdrental.public.actor",
        nullable=False,
    )
    staff_table: Table = metadata.get_by_name(
        Table,
        f"{db_service.fullyQualifiedName.root}.dvdrental.public.staff",
        nullable=False,
    )
    edge = metadata.get_lineage_edge(
        str(customer_table.id.root), str(actor_table.id.root)
    )
    assert edge is not None
    edge = metadata.get_lineage_edge(
        str(customer_table.id.root), str(staff_table.id.root)
    )
    assert edge is not None


def reindex_search(metadata: OpenMetadata, timeout=60):
    start = time.time()
    status = None
    while status is None or status == "running":
        response = metadata.client.get(
            "/apps/name/SearchIndexingApplication/status?offset=0&limit=1"
        )
        status = response["data"][0]["status"]
        if time.time() - start > timeout:
            raise TimeoutError("Timed out waiting for reindexing to start")
        time.sleep(1)
    time.sleep(
        0.5
    )  # app interactivity is not immediate (probably bc async operations), so we wait a bit
    metadata.client.post("/apps/trigger/SearchIndexingApplication")
    time.sleep(0.5)  # here too
    while status != "success":
        response = metadata.client.get(
            "/apps/name/SearchIndexingApplication/status?offset=0&limit=1"
        )
        status = response["data"][0]["status"]
        if time.time() - start > timeout:
            raise TimeoutError("Timed out waiting for reindexing to complete")
        time.sleep(1)
