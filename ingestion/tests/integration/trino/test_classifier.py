from copy import deepcopy
from logging import getLogger
from time import sleep

import pytest

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    DatabaseServiceAutoClassificationPipeline,
)
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.metadata import MetadataWorkflow

logger = getLogger(__name__)


@pytest.fixture(scope="module")
def sampling_only_classifier_config(
    db_service, sink_config, workflow_config, classifier_config
):
    config = deepcopy(classifier_config)
    config["source"]["sourceConfig"]["config"]["enableAutoClassification"] = False
    return config


def _run_classifier_with_retry(
    run_workflow,
    ingestion_config,
    classifier_config,
    metadata: OpenMetadata,
    max_retries=3,
    delay=30,
):
    """Run classifier workflow with retry logic for flaky elasticsearch issues."""
    last_error = None
    logger.info("Running trino metadata ingestion workflow")
    run_workflow(MetadataWorkflow, ingestion_config)
    for attempt in range(max_retries):
        search_cache.clear()
        try:
            logger.info(
                "Trino classification workflow attempt %d of %d",
                attempt + 1,
                max_retries,
            )
            run_workflow(AutoClassificationWorkflow, classifier_config)
            return
        except Exception as e:
            last_error = e

            logger.info("Trino classification workflow failed with exception %s", e)
            logger.info("Recreating indexes")
            metadata.reindex()

            if attempt < max_retries - 1:
                while True:
                    sleep(delay)
                    if not metadata.is_reindex_app_running():
                        break

    raise last_error


@pytest.fixture(
    scope="module",
)
def run_classifier(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    sampling_only_classifier_config,
    create_test_data,
    request,
    caplog,
):
    _run_classifier_with_retry(
        run_workflow,
        ingestion_config,
        sampling_only_classifier_config,
        int_admin_ometa(),
    )
    return ingestion_config


@pytest.mark.flaky(reruns=3, reruns_delay=30)
@pytest.mark.parametrize(
    "table_name",
    (
        "{database_service}.minio.my_schema.table",
        "{database_service}.minio.my_schema.titanic",
        "{database_service}.minio.my_schema.iris",
        "{database_service}.minio.my_schema.userdata",
        "{database_service}.minio.my_schema.empty",
        "{database_service}.minio.my_schema.complex_and_simple",
        "{database_service}.minio.my_schema.only_complex",
    ),
)
def test_auto_classification_workflow(
    run_classifier,
    metadata: OpenMetadata,
    table_name: str,
    db_service: DatabaseServiceAutoClassificationPipeline,
):
    table = metadata.get_by_name(
        Table, table_name.format(database_service=db_service.fullyQualifiedName.root)
    )

    assert metadata.get_sample_data(table) is not None
