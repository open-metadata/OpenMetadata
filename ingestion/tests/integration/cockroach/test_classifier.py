import sys
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

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)

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
    logger.info("Running CockroachDB metadata ingestion workflow")
    for attempt in range(max_retries):
        try:
            logger.info(
                "CockroachDB classification workflow attempt %d of %d",
                attempt + 1,
                max_retries,
            )
            run_workflow(MetadataWorkflow, ingestion_config)
            run_workflow(AutoClassificationWorkflow, classifier_config)
            return
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                sleep(delay)

    raise last_error


@pytest.fixture(scope="module")
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


@pytest.mark.flaky(reruns=3, reruns_delay=30)
@pytest.mark.parametrize(
    "table_name",
    (
        "{database_service}.roach.public.user_profiles",
        "{database_service}.roach.public.kv",
        "{database_service}.roach.public.employees",
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


@pytest.mark.flaky(reruns=3, reruns_delay=30)
def test_bytes_column_sample_data(
    run_classifier,
    metadata: OpenMetadata,
    db_service: DatabaseServiceAutoClassificationPipeline,
):
    table = metadata.get_by_name(
        Table,
        "{database_service}.roach.public.kv".format(
            database_service=db_service.fullyQualifiedName.root
        ),
    )
    assert table is not None
    sample_data = metadata.get_sample_data(table)
    assert sample_data is not None
    assert sample_data.sampleData is not None
    assert len(sample_data.sampleData.rows) > 0
