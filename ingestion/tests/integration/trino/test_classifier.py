from copy import deepcopy
from logging import getLogger
from time import sleep

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    DatabaseServiceAutoClassificationPipeline,
)
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
    max_retries=3,
    delay=30,
):
    """Run classifier workflow with retry logic for flaky elasticsearch issues."""
    last_error = None
    logger.info("Running trino metadata ingestion workflow")

    for attempt in range(max_retries):
        logger.info(
            "Trino classification workflow attempt %d of %d",
            attempt + 1,
            max_retries,
        )
        try:
            run_workflow(MetadataWorkflow, ingestion_config)
            run_workflow(AutoClassificationWorkflow, classifier_config)
            return
        except Exception as e:
            last_error = e

            if attempt < max_retries - 1:
                sleep(delay)

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
):
    _run_classifier_with_retry(
        run_workflow,
        ingestion_config,
        sampling_only_classifier_config,
    )
    return ingestion_config


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
