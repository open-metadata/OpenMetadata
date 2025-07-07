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
OpenMetadata high-level API Chart test
"""
import uuid
from unittest import TestCase

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.services.createMessagingService import (
    CreateMessagingServiceRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.messagingService import (
    MessagingConnection,
    MessagingService,
    MessagingServiceType,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OMetaTopicTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    user = metadata.create_or_update(
        data=CreateUserRequest(name="random-user", email="random@user.com"),
    )
    owners = EntityReferenceList(root=[EntityReference(id=user.id, type="user")])

    service = CreateMessagingServiceRequest(
        name="test-service-topic",
        serviceType=MessagingServiceType.Kafka,
        connection=MessagingConnection(
            config=KafkaConnection(bootstrapServers="localhost:9092")
        ),
    )
    service_type = "messagingService"

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """
        cls.service_entity = cls.metadata.create_or_update(data=cls.service)

        cls.entity = Topic(
            id=uuid.uuid4(),
            name="test",
            service=EntityReference(id=cls.service_entity.id, type="messagingService"),
            fullyQualifiedName="test-service-topic.test",
            partitions=2,
        )

        cls.create = CreateTopicRequest(
            name="test",
            service=cls.service_entity.fullyQualifiedName,
            partitions=2,
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=MessagingService, fqn="test-service-topic"
            ).id.root
        )

        cls.metadata.delete(
            entity=MessagingService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_create(self):
        """
        We can create a Topic and we receive it back as Entity
        """

        res = self.metadata.create_or_update(data=self.create)

        self.assertEqual(res.name, self.entity.name)
        self.assertEqual(res.service.id, self.entity.service.id)
        self.assertIsNone(res.owners)

    def test_update(self):
        """
        Updating it properly changes its properties
        """

        res_create = self.metadata.create_or_update(data=self.create)

        updated = self.create.model_dump(exclude_unset=True)
        updated["owners"] = self.owners
        updated_entity = CreateTopicRequest(**updated)

        res = self.metadata.create_or_update(data=updated_entity)

        # Same ID, updated algorithm
        self.assertEqual(res.service.fullyQualifiedName, updated_entity.service.root)
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.owners.root[0].id, self.user.id)

    def test_get_name(self):
        """
        We can fetch a Topic by name and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.get_by_name(
            entity=Topic, fqn=self.entity.fullyQualifiedName
        )
        self.assertEqual(res.name, self.entity.name)

    def test_get_id(self):
        """
        We can fetch a Topic by ID and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res_name = self.metadata.get_by_name(
            entity=Topic, fqn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res = self.metadata.get_by_id(entity=Topic, entity_id=res_name.id)

        self.assertEqual(res_name.id, res.id)

    def test_list(self):
        """
        We can list all our Topics
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.list_entities(entity=Topic, limit=100)

        # Fetch our test Database. We have already inserted it, so we should find it
        data = next(
            iter(ent for ent in res.entities if ent.name == self.entity.name), None
        )
        assert data

    def test_delete(self):
        """
        We can delete a Topic by ID
        """

        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Topic, fqn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res_id = self.metadata.get_by_id(entity=Topic, entity_id=str(res_name.id.root))

        # Delete
        self.metadata.delete(entity=Topic, entity_id=str(res_id.id.root))

        # Then we should not find it
        res = self.metadata.list_entities(entity=Topic)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == self.entity.fullyQualifiedName
            ),
            None,
        )

    def test_list_versions(self):
        """
        test list topic entity versions
        """
        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Topic, fqn=self.entity.fullyQualifiedName
        )

        res = self.metadata.get_list_entity_versions(
            entity=Topic, entity_id=res_name.id.root
        )
        assert res

    def test_get_entity_version(self):
        """
        test get topic entity version
        """
        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Topic, fqn=self.entity.fullyQualifiedName
        )
        res = self.metadata.get_entity_version(
            entity=Topic, entity_id=res_name.id.root, version=0.1
        )

        # check we get the correct version requested and the correct entity ID
        assert res.version.root == 0.1
        assert res.id == res_name.id

    def test_get_entity_ref(self):
        """
        test get EntityReference
        """
        res = self.metadata.create_or_update(data=self.create)
        entity_ref = self.metadata.get_entity_reference(
            entity=Topic, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id
