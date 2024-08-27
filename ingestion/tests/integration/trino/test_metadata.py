import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def run_workflow(run_workflow, ingestion_config, create_test_data):
    run_workflow(MetadataWorkflow, ingestion_config)


@pytest.mark.parametrize(
    "table_name",
    [
        "{database_service}.minio.my_schema.table",
        "{database_service}.minio.my_schema.titanic",
        "{database_service}.minio.my_schema.iris",
        "{database_service}.minio.my_schema.userdata",
        "{database_service}.minio.my_schema.empty",
    ],
    ids=lambda x: x.split(".")[-1],
)
def test_metadata(run_workflow, db_service, metadata: OpenMetadata, table_name):
    metadata.get_by_name(
        Table, table_name.format(database_service=db_service.fullyQualifiedName.root)
    )
