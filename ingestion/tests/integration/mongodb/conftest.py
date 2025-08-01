import os
from datetime import datetime

import pytest

from _openmetadata_testutils.helpers.docker import try_bind
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)


@pytest.fixture(scope="module")
def mongodbContainer(tmp_path_factory):
    """
    Start a Mongodb container
    """
    from testcontainers.mongodb import MongoDbContainer

    container = MongoDbContainer()

    with (
        try_bind(container, 27017, None) if not os.getenv("CI") else container
    ) as container:
        db = container.get_connection_client().test
        db.user_profiles.insert_one(
            {
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "first_name": "John",
                "last_name": "Doe",
                "email": "john.doe@example.com",
                "signup_date": datetime.now(),
                "is_active": True,
            }
        )

        yield container


@pytest.fixture(scope="module")
def create_service_request(mongodbContainer, tmp_path_factory):
    return CreateDatabaseServiceRequest(
        name="docker_test_" + tmp_path_factory.mktemp("mongodb").name,
        serviceType=DatabaseServiceType.MongoDB,
        connection=DatabaseConnection(
            config=MongoDBConnection(
                username="test",
                password="test",
                hostPort=f"localhost:{mongodbContainer.get_exposed_port(27017)}",
                databaseName="test",
            )
        ),
    )
