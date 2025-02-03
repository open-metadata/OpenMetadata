from copy import deepcopy

import pytest

from _openmetadata_testutils.postgres.conftest import postgres_container
from ingestion.tests.integration.conftest import ingestion_config
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
    DatabaseServiceType,
)


@pytest.fixture(scope="module")
def create_service_request(postgres_container, tmp_path_factory):
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
                ingestAllDatabases=True,
            )
        ),
    )


@pytest.fixture(scope="module")
def postgres_ingestion_config(
    db_service, ingestion_config, metadata, workflow_config, sink_config
):
    ingestion_config = deepcopy(ingestion_config)
    ingestion_config["source"]["sourceConfig"]["config"].update(
        {
            "schemaFilterPattern": {"excludes": ["information_schema"]},
        }
    )
    return ingestion_config
