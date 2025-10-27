"""
Comprehensive unit tests for API Collection entity.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.data.createAPICollection import (
    CreateAPICollectionRequest,
)
from metadata.generated.schema.entity.data.apiCollection import (
    APICollection as APICollectionEntity,
)
from metadata.sdk import APICollections


class TestAPICollectionEntity(unittest.TestCase):
    """Comprehensive tests for APICollection entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()
        APICollections.set_default_client(self.mock_ometa)

        self.entity_id = "550e8400-e29b-41d4-a716-446655440000"
        self.entity_fqn = "service.api_collection.test_api_collection"

    def test_create_api_collection(self):
        """Test creating a api collection"""
        create_request = MagicMock(spec=CreateAPICollectionRequest)
        create_request.name = "test_api_collection"
        create_request.displayName = "Test API Collection"
        create_request.description = "Test api collection for unit tests"

        expected_entity = MagicMock(spec=APICollectionEntity)
        expected_entity.id = UUID(self.entity_id)
        expected_entity.name = "test_api_collection"

        self.mock_ometa.create_or_update.return_value = expected_entity

        result = APICollections.create(create_request)

        self.assertEqual(str(result.id), self.entity_id)
        self.assertEqual(result.name, "test_api_collection")
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_api_collection_by_id(self):
        """Test retrieving a api collection by ID"""
        expected_entity = MagicMock(spec=APICollectionEntity)
        expected_entity.id = UUID(self.entity_id)
        expected_entity.name = "test_api_collection"

        self.mock_ometa.get_by_id.return_value = expected_entity

        result = APICollections.retrieve(self.entity_id)

        self.assertEqual(str(result.id), self.entity_id)
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=APICollectionEntity, entity_id=self.entity_id, fields=None
        )

    def test_retrieve_api_collection_by_name(self):
        """Test retrieving a api collection by name"""
        expected_entity = MagicMock(spec=APICollectionEntity)
        expected_entity.fullyQualifiedName = self.entity_fqn

        self.mock_ometa.get_by_name.return_value = expected_entity

        result = APICollections.retrieve_by_name(self.entity_fqn)

        self.assertEqual(result.fullyQualifiedName, self.entity_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=APICollectionEntity, fqn=self.entity_fqn, fields=None
        )

    def test_update_api_collection(self):
        """Test updating a api collection"""
        entity_to_update = MagicMock(spec=APICollectionEntity)
        entity_to_update.id = UUID(self.entity_id)
        entity_to_update.description = "Updated description"

        # Mock the get_by_id to return the current state
        current_entity = MagicMock(spec=type(entity_to_update))
        current_entity.id = (
            entity_to_update.id
            if hasattr(entity_to_update, "id")
            else UUID(self.entity_id)
        )
        self.mock_ometa.get_by_id.return_value = current_entity

        # Mock the patch to return the updated entity
        self.mock_ometa.patch.return_value = entity_to_update

        result = APICollections.update(entity_to_update)

        self.assertEqual(result.description, "Updated description")
        # Verify get_by_id was called to fetch current state
        self.mock_ometa.get_by_id.assert_called_once()
        # Verify patch was called with source and destination
        self.mock_ometa.patch.assert_called_once()

    def test_delete_api_collection(self):
        """Test deleting a api collection"""
        APICollections.delete(self.entity_id, recursive=True, hard_delete=False)

        self.mock_ometa.delete.assert_called_once_with(
            entity=APICollectionEntity,
            entity_id=self.entity_id,
            recursive=True,
            hard_delete=False,
        )

    def test_list_api_collections(self):
        """Test listing api collections"""
        mock_entity1 = MagicMock(spec=APICollectionEntity)
        mock_entity1.name = "entity1"
        mock_entity2 = MagicMock(spec=APICollectionEntity)
        mock_entity2.name = "entity2"

        mock_response = MagicMock()
        mock_response.entities = [mock_entity1, mock_entity2]

        self.mock_ometa.list_entities.return_value = mock_response

        result = APICollections.list(limit=10)

        self.assertEqual(len(result.entities), 2)
        self.assertEqual(result.entities[0].name, "entity1")
        self.mock_ometa.list_entities.assert_called_once()


if __name__ == "__main__":
    unittest.main()
