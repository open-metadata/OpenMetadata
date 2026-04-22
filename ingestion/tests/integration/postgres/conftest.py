import uuid

import pytest

from _openmetadata_testutils.postgres.conftest import postgres_container
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

from ..conftest import _safe_delete


@pytest.fixture(scope="package")
def create_service_request(postgres_container):
    return CreateDatabaseServiceRequest(
        name=f"docker_test_postgres_{uuid.uuid4().hex[:8]}",
        serviceType=DatabaseServiceType.Postgres,
        connection=DatabaseConnection(
            config=PostgresConnection(
                username=postgres_container.username,
                authType=BasicAuth(password=postgres_container.password),
                hostPort="localhost:"
                + str(postgres_container.get_exposed_port(postgres_container.port)),
                database="dvdrental",
            )
        ),
    )


@pytest.fixture(scope="package")
def unmask_password(create_service_request):
    def patch_password(service: DatabaseService):
        service.connection.config.authType.password = (
            create_service_request.connection.config.authType.password
        )
        return service

    return patch_password


@pytest.fixture(scope="package")
def db_service(metadata, create_service_request, unmask_password):
    service_entity = metadata.create_or_update(data=create_service_request)
    fqn = service_entity.fullyQualifiedName.root
    yield unmask_password(service_entity)
    service_entity = metadata.get_by_name(DatabaseService, fqn)
    if service_entity:
        _safe_delete(
            metadata,
            entity=DatabaseService,
            entity_id=service_entity.id,
            recursive=True,
            hard_delete=True,
        )
