import sys
import time
from os import path

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseLineageConfigType,
)
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
            "sourceConfig": {
                "config": {"type": DatabaseLineageConfigType.DatabaseLineage.value}
            },
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@pytest.mark.parametrize(
    "source_config,expected_nodes",
    [
        ({"includeDDL": False}, 3),
        ({"includeDDL": True}, 3),
    ],
    ids=lambda config: (
        "".join([f"{k}={str(v)}" for k, v in config.items()])
        if isinstance(config, dict)
        else ""
    ),
)
def test_native_lineage(
    patch_passwords_for_db_services,
    source_config,
    expected_nodes,
    run_workflow,
    ingestion_config,
    native_lineage_config,
    metadata,
    db_service,
):
    ingestion_config["source"]["sourceConfig"]["config"].update(source_config)
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(MetadataWorkflow, native_lineage_config)
    film_actor_edges = metadata.get_lineage_by_name(
        Table, f"{db_service.fullyQualifiedName.root}.dvdrental.public.film_actor"
    )
    assert len(film_actor_edges["nodes"]) == expected_nodes
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
    assert len(workflow.source.status.failures) == 0
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


def reindex_search(metadata: OpenMetadata, entities=None, timeout=180):
    if entities is None:
        entities = ["table", "query"]

    wait_timeout = timeout // 2
    complete_timeout = timeout // 2

    start_wait = time.time()
    while True:
        try:
            response = metadata.client.get(
                "/apps/name/SearchIndexingApplication/status?offset=0&limit=1"
            )
            if len(response["data"]) == 0:
                break
            current_status = response["data"][0]["status"]
            if current_status not in ("running", "active"):
                break
            if time.time() - start_wait > wait_timeout:
                raise TimeoutError(
                    f"Timed out waiting for previous reindexing to complete. "
                    f"Current status: {current_status}"
                )
        except Exception as e:
            if "TimeoutError" in str(type(e).__name__):
                raise
            time.sleep(1)
            continue
        time.sleep(2)

    time.sleep(1)

    try:
        metadata.client.post(
            "/apps/trigger/SearchIndexingApplication", json={"entities": entities}
        )
    except Exception as e:
        raise RuntimeError(f"Failed to trigger reindexing: {e}")

    time.sleep(1)

    start_complete = time.time()
    status = None
    while status not in ("success", "completed"):
        try:
            response = metadata.client.get(
                "/apps/name/SearchIndexingApplication/status?offset=0&limit=1"
            )
            if len(response["data"]) == 0:
                raise RuntimeError("No reindexing status found after triggering")

            status = response["data"][0]["status"]

            if status in ("failed", "error"):
                raise RuntimeError(f"Reindexing failed with status: {status}")

            if time.time() - start_complete > complete_timeout:
                raise TimeoutError(
                    f"Timed out waiting for reindexing to complete. "
                    f"Current status: {status}, elapsed: {int(time.time() - start_complete)}s"
                )
        except Exception as e:
            if "TimeoutError" in str(type(e).__name__) or "RuntimeError" in str(
                type(e).__name__
            ):
                raise
            time.sleep(1)
            continue
        time.sleep(2)


@pytest.fixture()
def long_cell_query_log(tmp_path_factory):
    log_file = tmp_path_factory.mktemp("data") / "large_query_log.csv"
    with open(log_file, "w") as f:
        f.write("query_text,database_name,schema_name\n")
        f.write(
            "insert into dvdrental.public.rental select {} from dvdrental.public.payment\n".format(
                "first_name || '" + "a" * 100_000 + "'"
            )
        )
    return log_file


@pytest.fixture()
def long_cell_query_file(
    db_service, metadata, workflow_config, sink_config, long_cell_query_log
):
    return {
        "source": {
            "type": "query-log-lineage",
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "DatabaseLineage",
                    "queryLogFilePath": str(long_cell_query_log),
                }
            },
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


def test_log_file_with_long_cell(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    long_cell_query_file,
    metadata,
    db_service,
):
    # since query cache is stored in ES, we need to reindex to avoid having a stale cache
    # TODO fix the server so that we dont need to run this
    reindex_search(metadata)
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(MetadataWorkflow, long_cell_query_file)
    rental_table: Table = metadata.get_by_name(
        Table,
        f"{db_service.fullyQualifiedName.root}.dvdrental.public.rental",
        nullable=False,
    )
    payment_table: Table = metadata.get_by_name(
        Table,
        f"{db_service.fullyQualifiedName.root}.dvdrental.public.payment",
        nullable=False,
    )
    edge = metadata.get_lineage_edge(
        str(payment_table.id.root), str(rental_table.id.root)
    )
    assert edge is not None
