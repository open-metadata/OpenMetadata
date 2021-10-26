"""
OpenMetadata high-level API Database test
"""
import uuid
from unittest import TestCase

from metadata.generated.schema.api.data.createTask import CreateTaskEntityRequest
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceEntityRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserEntityRequest
from metadata.generated.schema.entity.data.task import Task
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig


class OMetaTaskTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = MetadataServerConfig(api_endpoint="http://localhost:8585/api")
    metadata = OpenMetadata(server_config)

    user = metadata.create_or_update(
        data=CreateUserEntityRequest(name="random-user", email="random@user.com"),
    )
    owner = EntityReference(id=user.id, type="user")

    service = CreatePipelineServiceEntityRequest(
        name="test-service-task",
        serviceType=PipelineServiceType.Airflow,
        pipelineUrl="https://localhost:1000",
    )
    service_type = "pipelineService"

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """
        cls.service_entity = cls.metadata.create_or_update(data=cls.service)

        cls.entity = Task(
            id=uuid.uuid4(),
            name="test",
            service=EntityReference(id=cls.service_entity.id, type=cls.service_type),
            fullyQualifiedName="test-service-task.test",
        )

        cls.create = CreateTaskEntityRequest(
            name="test",
            service=EntityReference(id=cls.service_entity.id, type=cls.service_type),
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """
        _id = str(
            cls.metadata.get_by_name(
                entity=Task, fqdn="test-service-task.test"
            ).id.__root__
        )

        service_id = str(
            cls.metadata.get_by_name(
                entity=PipelineService, fqdn="test-service-task"
            ).id.__root__
        )

        cls.metadata.delete(entity=Task, entity_id=_id)
        cls.metadata.delete(entity=PipelineService, entity_id=service_id)

    def test_create(self):
        """
        We can create a Task and we receive it back as Entity
        """

        res = self.metadata.create_or_update(data=self.create)

        self.assertEqual(res.name, self.entity.name)
        self.assertEqual(res.service.id, self.entity.service.id)
        self.assertEqual(res.owner, None)

    def test_update(self):
        """
        Updating it properly changes its properties
        """

        res_create = self.metadata.create_or_update(data=self.create)

        updated = self.create.dict(exclude_unset=True)
        updated["owner"] = self.owner
        updated_entity = CreateTaskEntityRequest(**updated)

        res = self.metadata.create_or_update(data=updated_entity)

        # Same ID, updated algorithm
        self.assertEqual(res.service.id, updated_entity.service.id)
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.owner.id, self.user.id)

    def test_get_name(self):
        """
        We can fetch a Task by name and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.get_by_name(
            entity=Task, fqdn=self.entity.fullyQualifiedName
        )
        self.assertEqual(res.name, self.entity.name)

    def test_get_id(self):
        """
        We can fetch a Task by ID and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res_name = self.metadata.get_by_name(
            entity=Task, fqdn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res = self.metadata.get_by_id(entity=Task, entity_id=str(res_name.id.__root__))

        self.assertEqual(res_name.id, res.id)

    def test_list(self):
        """
        We can list all our Tasks
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.list_entities(entity=Task, limit=100)

        # Fetch our test Database. We have already inserted it, so we should find it
        data = next(
            iter(ent for ent in res.entities if ent.name == self.entity.name), None
        )
        assert data

    def test_delete(self):
        """
        We can delete a Task by ID
        """

        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Task, fqdn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res_id = self.metadata.get_by_id(
            entity=Task, entity_id=str(res_name.id.__root__)
        )

        # Delete
        self.metadata.delete(entity=Task, entity_id=str(res_id.id.__root__))

        # Then we should not find it
        res = self.metadata.list_entities(entity=Task)
        assert not next(
            iter(ent for ent in res.entities if ent.name == self.entity.name), None
        )
