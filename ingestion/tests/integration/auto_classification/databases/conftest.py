import os
import uuid

import pytest
from testcontainers.postgres import PostgresContainer

from _openmetadata_testutils.helpers.docker import try_bind
from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceRequest
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import BasicAuth
from metadata.generated.schema.entity.services.connections.database.postgresConnection import PostgresConnection
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection, DatabaseServiceType
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import DatabaseMetadataConfigType
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def postgres_container():
    """Start a PostgreSQL container with the test database."""
    init_file = os.path.join(os.path.dirname(__file__), "init.sql")  # noqa: PTH118, PTH120
    container = PostgresContainer("postgres:15", dbname="test_db").with_volume_mapping(
        init_file, "/docker-entrypoint-initdb.d/init.sql"
    )

    with try_bind(container, 5432, 5432) if not os.getenv("CI") else container as container:
        yield container


@pytest.fixture(scope="module")
def create_service_request(postgres_container: PostgresConnection):
    return CreateDatabaseServiceRequest(
        name=f"docker_test_postgres_{uuid.uuid4().hex[:8]}",
        serviceType=DatabaseServiceType.Postgres,
        connection=DatabaseConnection(
            config=PostgresConnection(
                username=postgres_container.username,
                authType=BasicAuth(password=postgres_container.password),
                hostPort=postgres_container.get_container_host_ip()
                + ":"
                + str(postgres_container.get_exposed_port(postgres_container.port)),
                database=postgres_container.dbname,
            )
        ),
    )


@pytest.fixture(scope="module")
def ingestion_config(db_service, metadata, workflow_config, sink_config):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": DatabaseMetadataConfigType.DatabaseMetadata.value,
                    "tableFilterPattern": FilterPattern(
                        includes=["^(example_table|card_prefix_cases|identifier_en|identifier_es|identifier_it)$"]
                    ),
                }
            },
            "serviceConnection": db_service.connection.model_dump(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@pytest.fixture(scope="module")
def load_metadata(run_workflow, ingestion_config) -> MetadataWorkflow:
    return run_workflow(MetadataWorkflow, ingestion_config)
