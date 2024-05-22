import pytest

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Sink,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def db_service(metadata, trino_container):
    service = CreateDatabaseServiceRequest(
        name="docker_test_trino",
        serviceType=DatabaseServiceType.Trino,
        connection=DatabaseConnection(
            config=TrinoConnection(
                username=trino_container.user,
                hostPort="localhost:"
                + trino_container.get_exposed_port(trino_container.port),
                catalog="minio",
                connectionArguments={"http_scheme": "http"},
            )
        ),
    )
    service_entity = metadata.create_or_update(data=service)
    yield service_entity
    metadata.delete(
        DatabaseService, service_entity.id, recursive=True, hard_delete=True
    )


@pytest.fixture(scope="module")
def ingest_metadata(db_service, metadata: OpenMetadata, create_test_data):
    workflow_config = OpenMetadataWorkflowConfig(
        source=Source(
            type=db_service.connection.config.type.value.lower(),
            serviceName=db_service.fullyQualifiedName.__root__,
            serviceConnection=db_service.connection,
            sourceConfig=SourceConfig(config={}),
        ),
        sink=Sink(
            type="metadata-rest",
            config={},
        ),
        workflowConfig=WorkflowConfig(openMetadataServerConfig=metadata.config),
    )
    metadata_ingestion = MetadataWorkflow.create(workflow_config)
    metadata_ingestion.execute()
    metadata_ingestion.raise_from_status()
    return


def test_ingest_metadata(ingest_metadata, db_service, metadata: OpenMetadata):
    tables = metadata.list_entities(
        Table, params={"databaseSchema": "docker_test_trino.minio.my_schema"}
    )
    assert (
        next((t for t in tables.entities if t.name.__root__ == "test_table"), None)
        is not None
    )
