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


def reindex_search(metadata: OpenMetadata, timeout=60):
    start = time.time()
    # wait for previous reindexing to finish (if any)
    while True:
        response = metadata.client.get(
            "/apps/name/SearchIndexingApplication/status?offset=0&limit=1"
        )
        if len(response["data"]) == 0:
            break
        if response["data"][0]["status"] != "running":
            break
        if time.time() - start > timeout:
            raise TimeoutError("Timed out waiting for reindexing to start")
        time.sleep(1)
    time.sleep(
        0.5
    )  # app interactivity is not immediate (probably bc async operations), so we wait a bit
    metadata.client.post("/apps/trigger/SearchIndexingApplication")
    time.sleep(0.5)  # here too
    status = None
    while status != "success":
        response = metadata.client.get(
            "/apps/name/SearchIndexingApplication/status?offset=0&limit=1"
        )
        status = response["data"][0]["status"]
        if time.time() - start > timeout:
            raise TimeoutError("Timed out waiting for reindexing to complete")
        time.sleep(1)


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
