"""
OpenMetadata high-level API Model test
"""
import uuid
from unittest import TestCase

from metadata.generated.schema.api.data.createModel import CreateModelEntityRequest
from metadata.generated.schema.api.teams.createUser import CreateUserEntityRequest
from metadata.generated.schema.entity.data.model import Model
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig


class OMetaModelTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    server_config = MetadataServerConfig(api_endpoint="http://localhost:8585/api")
    metadata = OpenMetadata(server_config)

    user = metadata.create_or_update(
        data=CreateUserEntityRequest(name="random-user", email="random@user.com"),
    )
    owner = EntityReference(id=user.id, type="user")

    entity = Model(
        id=uuid.uuid4(),
        name="test-model",
        algorithm="algo",
        fullyQualifiedName="test-model",
    )
    create = CreateModelEntityRequest(name="test-model", algorithm="algo")

    def test_create(self):
        """
        We can create a Model and we receive it back as Entity
        """

        res = self.metadata.create_or_update(data=self.create)

        self.assertEqual(res.name, self.entity.name)
        self.assertEqual(res.algorithm, self.entity.algorithm)
        self.assertEqual(res.owner, None)

    def test_update(self):
        """
        Updating it properly changes its properties
        """

        res_create = self.metadata.create_or_update(data=self.create)

        updated = self.create.dict(exclude_unset=True)
        updated["owner"] = self.owner
        updated_entity = CreateModelEntityRequest(**updated)

        res = self.metadata.create_or_update(data=updated_entity)

        # Same ID, updated algorithm
        self.assertEqual(res.algorithm, updated_entity.algorithm)
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.owner.id, self.user.id)

    def test_get_name(self):
        """
        We can fetch a model by name and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.get_by_name(
            entity=Model, fqdn=self.entity.fullyQualifiedName
        )
        self.assertEqual(res.name, self.entity.name)

    def test_get_id(self):
        """
        We can fetch a model by ID and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res_name = self.metadata.get_by_name(
            entity=Model, fqdn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res = self.metadata.get_by_id(entity=Model, entity_id=str(res_name.id.__root__))

        self.assertEqual(res_name.id, res.id)

    def test_list(self):
        """
        We can list all our models
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.list_entities(entity=Model)

        # Fetch our test model. We have already inserted it, so we should find it
        data = next(
            iter(ent for ent in res.entities if ent.name == self.entity.name), None
        )
        assert data

    def test_delete(self):
        """
        We can delete a model by ID
        """

        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Model, fqdn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res_id = self.metadata.get_by_id(
            entity=Model, entity_id=str(res_name.id.__root__)
        )

        # Delete
        self.metadata.delete(entity=Model, entity_id=str(res_id.id.__root__))

        # Then we should not find it
        res = self.metadata.list_entities(entity=Model)
        print(res)
        assert not next(
            iter(ent for ent in res.entities if ent.name == self.entity.name), None
        )
