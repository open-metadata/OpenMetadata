from copy import deepcopy

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    DatabaseServiceAutoClassificationPipeline,
)
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def sampling_only_classifier_config(
    db_service, sink_config, workflow_config, classifier_config
):
    config = deepcopy(classifier_config)
    config["source"]["sourceConfig"]["config"]["enableAutoClassification"] = False
    return config


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
    search_cache.clear()
    run_workflow(MetadataWorkflow, ingestion_config)
    run_workflow(AutoClassificationWorkflow, sampling_only_classifier_config)
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
