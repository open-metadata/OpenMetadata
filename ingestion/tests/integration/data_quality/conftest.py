import pytest
from testcontainers.mysql import MySqlContainer

from _testutils.postgres.conftest import postgres_container, try_bind
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.workflow import LogLevels
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow

from ..postgres.conftest import db_service as postgres_service
from ..postgres.conftest import ingest_metadata as ingest_postgres

__all__ = [
    "ingest_postgres",
    "postgres_service",
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
            "openMetadataServerConfig": metadata.config.dict(),
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
