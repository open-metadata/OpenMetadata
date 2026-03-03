#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
OpenMetadata high-level API Database Service tests
"""
import pytest

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)

from ..integration_base import generate_name


@pytest.fixture
def service_connection():
    """Database service connection configuration."""
    return DatabaseConnection(
        config=MysqlConnection(
            username="username",
            authType=BasicAuth(
                password="password",
            ),
            hostPort="http://localhost:1234",
        )
    )


@pytest.fixture
def service_name():
    """Generate unique name for test database service."""
    return generate_name()


@pytest.fixture
def service_request(service_connection, service_name):
    """Create database service request."""
    return CreateDatabaseServiceRequest(
        name=service_name,
        serviceType=DatabaseServiceType.Mysql,
        connection=service_connection,
    )


@pytest.fixture
def expected_fqn(service_name):
    """Expected fully qualified name for test service."""
    return service_name.root


@pytest.fixture
def create_service(metadata, request):
    """
    Factory fixture for creating database services with automatic cleanup.
    """
    services = []

    def _create_service(create_request):
        service = metadata.create_or_update(data=create_request)
        services.append(service)
        return service

    def teardown():
        for service in services:
            metadata.delete(
                entity=DatabaseService,
                entity_id=service.id,
                recursive=True,
                hard_delete=True,
            )

    request.addfinalizer(teardown)

    return _create_service


class TestOMetaDatabaseServiceAPI:
    """
    Database Service API integration tests.
    Tests CRUD operations and versioning for database services.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    def test_create_database_service(
        self,
        metadata,
        service_request,
        service_name,
        service_connection,
        expected_fqn,
        create_service,
    ):
        """
        We can create a DB Service and we receive it back as Entity
        """
        res = create_service(service_request)

        assert res.name == service_name
        assert res.serviceType == DatabaseServiceType.Mysql
        assert res.connection.config.hostPort == service_connection.config.hostPort

        # Verify persistence by fetching from backend
        fetched = metadata.get_by_name(entity=DatabaseService, fqn=expected_fqn)
        assert fetched is not None
        assert fetched.id == res.id

    def test_update_database_service(
        self, metadata, service_request, service_name, create_service
    ):
        """
        Updating a DB Service entity changes its properties
        """
        original_res = create_service(service_request)

        new_connection = DatabaseConnection(
            config=MysqlConnection(
                username="username",
                authType=BasicAuth(
                    password="password",
                ),
                hostPort="http://localhost:2000",
            )
        )

        update_request = CreateDatabaseServiceRequest(
            name=service_name,
            serviceType=DatabaseServiceType.Mysql,
            connection=new_connection,
        )

        updated_res = metadata.create_or_update(data=update_request)

        # Same ID, updated connection
        assert updated_res.id == original_res.id
        assert updated_res.connection.config.hostPort == new_connection.config.hostPort

    def test_get_name(self, metadata, service_request, expected_fqn, create_service):
        """
        We can fetch a Database Service by name and get it back as Entity
        """
        created = create_service(service_request)

        res = metadata.get_by_name(entity=DatabaseService, fqn=expected_fqn)
        assert res.name == created.name

    def test_get_id(self, metadata, service_request, expected_fqn, create_service):
        """
        We can fetch a Database Service by ID and get it back as Entity
        """
        create_service(service_request)

        # First pick up by name
        res_name = metadata.get_by_name(entity=DatabaseService, fqn=expected_fqn)
        # Then fetch by ID
        res = metadata.get_by_id(entity=DatabaseService, entity_id=res_name.id)

        assert res_name.id == res.id

    def test_list(self, metadata, service_request, create_service):
        """
        We can list all our Database Services
        """
        created = create_service(service_request)

        res = metadata.list_entities(entity=DatabaseService)

        assert created.name in (ent.name for ent in res.entities)

    def test_delete(self, metadata, service_request, expected_fqn, create_service):
        """
        We can delete a Database Service by ID
        """
        created = create_service(service_request)

        # Delete
        metadata.delete(
            entity=DatabaseService, entity_id=str(created.id.root), recursive=True
        )

        # Verify deletion - get_by_name should return None
        deleted = metadata.get_by_name(entity=DatabaseService, fqn=expected_fqn)
        assert deleted is None

    def test_list_versions(self, metadata, service_request, create_service):
        """
        We can list the version of a given DB Service entity
        """
        created = create_service(service_request)

        res = metadata.get_list_entity_versions(
            entity=DatabaseService, entity_id=created.id.root
        )
        assert res is not None
        assert len(res.versions) >= 1
