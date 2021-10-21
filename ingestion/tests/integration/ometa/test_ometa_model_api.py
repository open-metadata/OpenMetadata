import json
import unittest
import uuid
from unittest import TestCase

from metadata.generated.schema.entity.data.model import Model
from metadata.ingestion.ometa.ometa_api import OMeta
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig


class OMetaModelTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    server_config = MetadataServerConfig(api_endpoint="http://localhost:8585/api")
    metadata = OMeta(server_config)

    model = Model(id=uuid.uuid4(), name="test-model", algorithm="algo")

    def test_create_model(self):

        res = self.metadata.create_or_update(entity=Model, data=self.model)
        self.assertEqual(res.name, self.model.name)
        self.assertEqual(res.algorithm, self.model.algorithm)

    def test_get_model_name(self):

        self.metadata.create_or_update(entity=Model, data=self.model)

        res = self.metadata.get_by_name(entity=Model, name=self.model.name)
        self.assertEqual(res.name, self.model.name)

    def test_get_model_id(self):

        self.metadata.create_or_update(entity=Model, data=self.model)

        # First pick up by name
        res_name = self.metadata.get_by_name(entity=Model, name=self.model.name)
        # Then fetch by ID
        res = self.metadata.get_by_id(entity=Model, entity_id=str(res_name.id.__root__))

        self.assertEqual(res_name.id, res.id)

    def test_list_models(self):

        self.metadata.create_or_update(entity=Model, data=self.model)

        res = self.metadata.list_entities(entity=Model)

        # Fetch our test model. We have already inserted it, so we should find it
        data = next(
            iter(ent for ent in res.entities if ent.name == self.model.name), None
        )
        assert data

    def test_delete_model(self):

        self.metadata.create_or_update(entity=Model, data=self.model)

        # Find by name
        res_name = self.metadata.get_by_name(entity=Model, name=self.model.name)
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
            iter(ent for ent in res.entities if ent.name == self.model.name), None
        )
