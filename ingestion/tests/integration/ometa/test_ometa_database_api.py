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
OpenMetadata high-level API Database test
"""
import pytest

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList


@pytest.fixture
def database_request(database_service):
    """Create database request using the service from conftest."""
    return CreateDatabaseRequest(
        name="test-db",
        service=database_service.fullyQualifiedName,
    )


@pytest.fixture
def expected_fqn(database_service):
    """Expected fully qualified name for test database."""
    return f"{database_service.name.root}.test-db"


class TestOMetaDatabaseAPI:
    """
    Database API integration tests.
    Tests CRUD operations, versioning, and entity references.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    - service: DatabaseService (module scope)
    - create_user: User factory (function scope)
    - create_database: Database factory (function scope)
    """

    def test_create(
        self,
        metadata,
        database_service,
        database_request,
        expected_fqn,
        create_database,
    ):
        """
        We can create a Database and we receive it back as Entity
        """
        res = create_database(database_request)

        assert res.name.root == "test-db"
        assert res.service.id == database_service.id
        assert res.owners is None

        # Verify persistence by fetching from backend
        fetched = metadata.get_by_name(entity=Database, fqn=expected_fqn)
        assert fetched is not None
        assert fetched.id == res.id

    def test_update(
        self,
        metadata,
        database_service,
        database_request,
        create_user,
        create_database,
    ):
        """
        Updating it properly changes its properties
        """
        user = create_user()
        owners = EntityReferenceList(root=[EntityReference(id=user.id, type="user")])

        # Create database
        res_create = create_database(database_request)

        # Update with owners
        updated = database_request.model_dump(exclude_unset=True)
        updated["owners"] = owners
        updated_entity = CreateDatabaseRequest(**updated)

        res = metadata.create_or_update(data=updated_entity)

        # Verify update
        assert (
            res.service.fullyQualifiedName == database_service.fullyQualifiedName.root
        )
        assert res_create.id == res.id
        assert res.owners.root[0].id == user.id

    def test_get_name(self, metadata, database_request, expected_fqn, create_database):
        """
        We can fetch a Database by name and get it back as Entity
        """
        created = create_database(database_request)

        res = metadata.get_by_name(entity=Database, fqn=expected_fqn)
        assert res.name.root == created.name.root

    def test_get_id(self, metadata, database_request, expected_fqn, create_database):
        """
        We can fetch a Database by ID and get it back as Entity
        """
        create_database(database_request)

        # First pick up by name
        res_name = metadata.get_by_name(entity=Database, fqn=expected_fqn)
        # Then fetch by ID
        res = metadata.get_by_id(entity=Database, entity_id=res_name.id)

        assert res_name.id == res.id

    def test_list(self, metadata, database_service, database_request, create_database):
        """
        We can list all our Database entities
        """
        created = create_database(database_request)

        res = metadata.list_entities(
            entity=Database, params={"service": database_service.name.root}
        )

        # Fetch our test Database. We have already inserted it, so we should find it
        data = next(iter(ent for ent in res.entities if ent.name == created.name), None)
        assert data is not None

    def test_delete(self, metadata, database_request, expected_fqn, create_database):
        """
        We can delete a Database by ID
        """
        created = create_database(database_request)

        # Delete
        metadata.delete(entity=Database, entity_id=str(created.id.root), recursive=True)

        # Verify deletion - get_by_name should return None
        deleted = metadata.get_by_name(entity=Database, fqn=expected_fqn)
        assert deleted is None

    def test_list_versions(self, metadata, database_request, create_database):
        """
        Test listing database entity versions
        """
        created = create_database(database_request)

        res = metadata.get_list_entity_versions(
            entity=Database, entity_id=created.id.root
        )
        assert res is not None
        assert len(res.versions) >= 1

    def test_get_entity_version(self, metadata, database_request, create_database):
        """
        Test retrieving a specific database entity version
        """
        created = create_database(database_request)

        res = metadata.get_entity_version(
            entity=Database, entity_id=created.id.root, version=0.1
        )

        # Check we get the correct version requested and the correct entity ID
        assert res.version.root == 0.1
        assert res.id == created.id

    def test_get_entity_ref(self, metadata, database_request, create_database):
        """
        Test retrieving EntityReference for a database
        """
        created = create_database(database_request)
        entity_ref = metadata.get_entity_reference(
            entity=Database, fqn=created.fullyQualifiedName
        )

        assert created.id == entity_ref.id
