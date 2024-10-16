from typing import cast

import pytest
from testcontainers.mysql import MySqlContainer

from _openmetadata_testutils.postgres.conftest import postgres_container, try_bind
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import LogLevels
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow

__all__ = [
    "postgres_container",
]


@pytest.fixture(scope="module")
def mysql_container():
    with try_bind(MySqlContainer("mysql:8"), 3306, 3307) as container:
        yield container


@pytest.fixture(scope="module")
def ingest_mysql_service(
    mysql_container: MySqlContainer, metadata: OpenMetadata, tmp_path_factory
):
    workflow_config = {
        "source": {
            "type": "mysql",
            "serviceName": "integration_test_mysql_"
            + tmp_path_factory.mktemp("mysql").name.split("/")[-1],
            "serviceConnection": {
                "config": {
                    "type": "Mysql",
                    "username": mysql_container.username,
                    "authType": {
                        "password": mysql_container.password,
                    },
                    "hostPort": "localhost:" + mysql_container.get_exposed_port(3306),
                    "databaseSchema": mysql_container.dbname,
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                },
            },
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": {
            "loggerLevel": LogLevels.DEBUG.value,
            "openMetadataServerConfig": metadata.config.model_dump(),
        },
    }
    metadata_ingestion = MetadataWorkflow.create(workflow_config)
    metadata_ingestion.execute()
    metadata_ingestion.raise_from_status()
    metadata_ingestion.stop()
    db_service: DatabaseService = metadata.get_by_name(
        DatabaseService, workflow_config["source"]["serviceName"]
    )
    db_service.connection.config.authType.password = CustomSecretStr(
        mysql_container.password
    )
    yield db_service
    metadata.delete(DatabaseService, db_service.id, recursive=True, hard_delete=True)


@pytest.fixture(scope="module")
def create_service_request(tmp_path_factory, postgres_container):
    return CreateDatabaseServiceRequest(
        name="docker_test_" + tmp_path_factory.mktemp("postgres").name,
        serviceType=DatabaseServiceType.Postgres,
        connection=DatabaseConnection(
            config=PostgresConnection(
                username=postgres_container.username,
                authType=BasicAuth(password=postgres_container.password),
                hostPort="localhost:"
                + postgres_container.get_exposed_port(postgres_container.port),
                database="dvdrental",
            )
        ),
    )


@pytest.fixture(scope="module")
def postgres_service(db_service):
    return db_service


@pytest.fixture()
def ingest_postgres_metadata(
    postgres_service, metadata: OpenMetadata, sink_config, workflow_config, run_workflow
):
    workflow_config = {
        "source": {
            "type": postgres_service.connection.config.type.value.lower(),
            "serviceName": postgres_service.fullyQualifiedName.root,
            "serviceConnection": postgres_service.connection.model_copy(
                update={
                    "config": postgres_service.connection.config.model_copy(
                        update={
                            "ingestAllDatabases": True,
                        }
                    )
                }
            ),
            "sourceConfig": {
                "config": {
                    "schemaFilterPattern": {"excludes": ["information_schema"]},
                }
            },
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }
    run_workflow(MetadataWorkflow, workflow_config)


@pytest.fixture(scope="module")
def patch_password(postgres_container):
    def inner(service: DatabaseService):
        service.connection.config = cast(PostgresConnection, service.connection.config)
        service.connection.config.authType.password = type(
            service.connection.config.authType.password
        )(postgres_container.password)
        return service

    return inner
