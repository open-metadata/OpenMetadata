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
OpenMetadata high-level API Container test
"""
import pytest

from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList


@pytest.fixture
def container_request(storage_service):
    """Create container request using the storage service from conftest."""
    return CreateContainerRequest(
        name="test",
        service=storage_service.fullyQualifiedName,
    )


@pytest.fixture
def expected_fqn(storage_service):
    """Expected fully qualified name for test container."""
    return f"{storage_service.name.root}.test"


class TestOMetaStorageAPI:
    """
    Storage API integration tests.
    Tests CRUD operations and versioning for containers.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    - storage_service: StorageService (module scope)
    - create_user: User factory (function scope)
    - create_container: Container factory (function scope)
    """

    def test_create(
        self,
        metadata,
        storage_service,
        container_request,
        expected_fqn,
        create_container,
    ):
        """
        We can create a Container and we receive it back as Entity
        """
        res = create_container(container_request)

        assert res.name.root == "test"
        assert res.service.id == storage_service.id
        assert res.owners is None

        fetched = metadata.get_by_name(entity=Container, fqn=expected_fqn)
        assert fetched is not None
        assert fetched.id == res.id

    def test_update(
        self,
        metadata,
        storage_service,
        container_request,
        create_user,
        create_container,
    ):
        """
        Updating it properly changes its properties
        """
        user = create_user()
        owners = EntityReferenceList(root=[EntityReference(id=user.id, type="user")])

        res_create = create_container(container_request)

        updated = container_request.model_dump(exclude_unset=True)
        updated["owners"] = owners
        updated_entity = CreateContainerRequest(**updated)

        res = metadata.create_or_update(data=updated_entity)

        assert res.service.fullyQualifiedName == storage_service.fullyQualifiedName.root
        assert res_create.id == res.id
        assert res.owners.root[0].id == user.id

    def test_get_name(
        self, metadata, container_request, expected_fqn, create_container
    ):
        """
        We can fetch a Container by name and get it back as Entity
        """
        created = create_container(container_request)

        res = metadata.get_by_name(entity=Container, fqn=expected_fqn)
        assert res.name.root == created.name.root

    def test_get_id(self, metadata, container_request, expected_fqn, create_container):
        """
        We can fetch a Container by ID and get it back as Entity
        """
        create_container(container_request)

        res_name = metadata.get_by_name(entity=Container, fqn=expected_fqn)
        res = metadata.get_by_id(entity=Container, entity_id=res_name.id)

        assert res_name.id == res.id

    def test_list(self, metadata, container_request, create_container):
        """
        We can list all our Containers
        """
        created = create_container(container_request)

        res = metadata.list_entities(entity=Container, limit=100)

        data = next(iter(ent for ent in res.entities if ent.name == created.name), None)
        assert data is not None

    def test_delete(self, metadata, container_request, expected_fqn, create_container):
        """
        We can delete a Container by ID
        """
        created = create_container(container_request)

        metadata.delete(
            entity=Container, entity_id=str(created.id.root), recursive=True
        )

        deleted = metadata.get_by_name(entity=Container, fqn=expected_fqn)
        assert deleted is None

    def test_list_versions(self, metadata, container_request, create_container):
        """
        Test listing container entity versions
        """
        created = create_container(container_request)

        res = metadata.get_list_entity_versions(
            entity=Container, entity_id=created.id.root
        )
        assert res is not None
        assert len(res.versions) >= 1

    def test_get_entity_version(self, metadata, container_request, create_container):
        """
        Test retrieving a specific container entity version
        """
        created = create_container(container_request)

        res = metadata.get_entity_version(
            entity=Container, entity_id=created.id.root, version=0.1
        )

        assert res.version.root == 0.1
        assert res.id == created.id

    def test_get_entity_ref(self, metadata, container_request, create_container):
        """
        Test retrieving EntityReference for a container
        """
        created = create_container(container_request)
        entity_ref = metadata.get_entity_reference(
            entity=Container, fqn=created.fullyQualifiedName
        )

        assert created.id == entity_ref.id
