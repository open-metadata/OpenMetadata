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
OpenMetadata high-level API Topic test
"""
import pytest

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList


@pytest.fixture
def topic_request(messaging_service):
    """Create topic request using the messaging service from conftest."""
    return CreateTopicRequest(
        name="test",
        service=messaging_service.fullyQualifiedName,
        partitions=2,
    )


@pytest.fixture
def expected_fqn(messaging_service):
    """Expected fully qualified name for test topic."""
    return f"{messaging_service.name.root}.test"


class TestOMetaTopicAPI:
    """
    Topic API integration tests.
    Tests CRUD operations, versioning, and entity references.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    - messaging_service: MessagingService (module scope)
    - create_user: User factory (function scope)
    - create_topic: Topic factory (function scope)
    """

    def test_create(
        self, metadata, messaging_service, topic_request, expected_fqn, create_topic
    ):
        """
        We can create a Topic and we receive it back as Entity
        """
        res = create_topic(topic_request)

        assert res.name.root == "test"
        assert res.service.id == messaging_service.id
        assert res.owners is None

        # Verify persistence by fetching from backend
        fetched = metadata.get_by_name(entity=Topic, fqn=expected_fqn)
        assert fetched is not None
        assert fetched.id == res.id

    def test_update(
        self,
        metadata,
        messaging_service,
        topic_request,
        create_user,
        create_topic,
    ):
        """
        Updating it properly changes its properties
        """
        user = create_user()
        owners = EntityReferenceList(root=[EntityReference(id=user.id, type="user")])

        # Create topic
        res_create = create_topic(topic_request)

        # Update with owners
        updated = topic_request.model_dump(exclude_unset=True)
        updated["owners"] = owners
        updated_entity = CreateTopicRequest(**updated)

        res = metadata.create_or_update(data=updated_entity)

        # Verify update
        assert (
            res.service.fullyQualifiedName == messaging_service.fullyQualifiedName.root
        )
        assert res_create.id == res.id
        assert res.owners.root[0].id == user.id

    def test_get_name(self, metadata, topic_request, expected_fqn, create_topic):
        """
        We can fetch a Topic by name and get it back as Entity
        """
        created = create_topic(topic_request)

        res = metadata.get_by_name(entity=Topic, fqn=expected_fqn)
        assert res.name.root == created.name.root

    def test_get_id(self, metadata, topic_request, expected_fqn, create_topic):
        """
        We can fetch a Topic by ID and get it back as Entity
        """
        create_topic(topic_request)

        # First pick up by name
        res_name = metadata.get_by_name(entity=Topic, fqn=expected_fqn)
        # Then fetch by ID
        res = metadata.get_by_id(entity=Topic, entity_id=res_name.id)

        assert res_name.id == res.id

    def test_list(self, metadata, topic_request, create_topic):
        """
        We can list all our Topics
        """
        created = create_topic(topic_request)

        res = metadata.list_entities(entity=Topic, limit=100)

        # Fetch our test Topic. We have already inserted it, so we should find it
        data = next(iter(ent for ent in res.entities if ent.name == created.name), None)
        assert data is not None

    def test_delete(self, metadata, topic_request, expected_fqn, create_topic):
        """
        We can delete a Topic by ID
        """
        created = create_topic(topic_request)

        # Delete
        metadata.delete(entity=Topic, entity_id=str(created.id.root))

        # Verify deletion - get_by_name should return None
        deleted = metadata.get_by_name(entity=Topic, fqn=expected_fqn)
        assert deleted is None

    def test_list_versions(self, metadata, topic_request, create_topic):
        """
        Test listing topic entity versions
        """
        created = create_topic(topic_request)

        res = metadata.get_list_entity_versions(entity=Topic, entity_id=created.id.root)
        assert res is not None
        assert len(res.versions) >= 1

    def test_get_entity_version(self, metadata, topic_request, create_topic):
        """
        Test retrieving a specific topic entity version
        """
        created = create_topic(topic_request)

        res = metadata.get_entity_version(
            entity=Topic, entity_id=created.id.root, version=0.1
        )

        # Check we get the correct version requested and the correct entity ID
        assert res.version.root == 0.1
        assert res.id == created.id

    def test_get_entity_ref(self, metadata, topic_request, create_topic):
        """
        Test retrieving EntityReference for a topic
        """
        created = create_topic(topic_request)
        entity_ref = metadata.get_entity_reference(
            entity=Topic, fqn=created.fullyQualifiedName
        )

        assert created.id == entity_ref.id
