import pytest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
    MssqlScheme,
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
from metadata.workflow.metadata import MetadataWorkflow
from integration.integration_base import int_admin_ometa
from metadata.ingestion.ometa.ometa_api import OpenMetadata


@pytest.fixture(scope="module")
def metadata():
    return int_admin_ometa()


@pytest.fixture(
    scope="module",
    params=[
        MssqlScheme.mssql_pytds,
        pytest.param(
            MssqlScheme.mssql_pyodbc, marks=pytest.mark.xfail(reason="fails with mssql")
        ),
    ],
)
def db_service(metadata, sql_server_container, request):
    service = CreateDatabaseServiceRequest(
        name="docker_test_db_ + " + request.id,
        serviceType=DatabaseServiceType.Mssql,
        connection=DatabaseConnection(
            config=MssqlConnection(
                scheme=request.param,
                username=sql_server_container.username,
                password=sql_server_container.password,
                hostPort="localhost:"
                + sql_server_container.get_exposed_port(sql_server_container.port),
                database="AdventureWorks",
            )
        ),
    )
    service_entity = metadata.create_or_update(data=service)
    service_entity.connection.config.password = sql_server_container.password
    yield service_entity
    metadata.delete(
        DatabaseService, service_entity.id, recursive=True, hard_delete=True
    )


@pytest.fixture(autouse=True, scope="module")
def ingest_metadata(db_service, metadata: OpenMetadata):
    workflow_config = OpenMetadataWorkflowConfig(
        source=Source(
            type=db_service.connection.config.type.value.lower(),
            serviceName=db_service.fullyQualifiedName.__root__,
            sourceConfig=SourceConfig(config={}),
            serviceConnection=db_service.connection,
        ),
        sink=Sink(
            type="metadata-rest",
            config={},
        ),
        workflowConfig=WorkflowConfig(openMetadataServerConfig=metadata.config),
    )
    metadata_ingestion = MetadataWorkflow.create(workflow_config)
    metadata_ingestion.execute()
    return


@pytest.fixture(scope="module")
def db_fqn(db_service: DatabaseService):
    return ".".join(
        [
            db_service.fullyQualifiedName.__root__,
            db_service.connection.config.database,
        ]
    )


def test_pass(
    db_service,
    metadata,
    db_fqn,
):
    pass
