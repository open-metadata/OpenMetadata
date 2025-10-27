"""
Comprehensive unit tests for Tag entity.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.entity.classification.tag import Tag as TagEntity
from metadata.sdk import Tags


class TestTagEntity(unittest.TestCase):
    """Comprehensive tests for Tag entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()
        Tags.set_default_client(self.mock_ometa)

        self.entity_id = "550e8400-e29b-41d4-a716-446655440000"
        self.entity_fqn = "service.tag.test_tag"

    def test_create_tag(self):
        """Test creating a tag"""
        create_request = MagicMock(spec=CreateTagRequest)
        create_request.name = "test_tag"
        create_request.displayName = "Test Tag"
        create_request.description = "Test tag for unit tests"

        expected_entity = MagicMock(spec=TagEntity)
        expected_entity.id = UUID(self.entity_id)
        expected_entity.name = "test_tag"

        self.mock_ometa.create_or_update.return_value = expected_entity

        result = Tags.create(create_request)

        self.assertEqual(str(result.id), self.entity_id)
        self.assertEqual(result.name, "test_tag")
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_tag_by_id(self):
        """Test retrieving a tag by ID"""
        expected_entity = MagicMock(spec=TagEntity)
        expected_entity.id = UUID(self.entity_id)
        expected_entity.name = "test_tag"

        self.mock_ometa.get_by_id.return_value = expected_entity

        result = Tags.retrieve(self.entity_id)

        self.assertEqual(str(result.id), self.entity_id)
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=TagEntity, entity_id=self.entity_id, fields=None
        )

    def test_retrieve_tag_by_name(self):
        """Test retrieving a tag by name"""
        expected_entity = MagicMock(spec=TagEntity)
        expected_entity.fullyQualifiedName = self.entity_fqn

        self.mock_ometa.get_by_name.return_value = expected_entity

        result = Tags.retrieve_by_name(self.entity_fqn)

        self.assertEqual(result.fullyQualifiedName, self.entity_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=TagEntity, fqn=self.entity_fqn, fields=None
        )

    def test_update_tag(self):
        """Test updating a tag"""
        entity_to_update = MagicMock(spec=TagEntity)
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

        result = Tags.update(entity_to_update)

        self.assertEqual(result.description, "Updated description")
        # Verify get_by_id was called to fetch current state
        self.mock_ometa.get_by_id.assert_called_once()
        # Verify patch was called with source and destination
        self.mock_ometa.patch.assert_called_once()

    def test_delete_tag(self):
        """Test deleting a tag"""
        Tags.delete(self.entity_id, recursive=True, hard_delete=False)

        self.mock_ometa.delete.assert_called_once_with(
            entity=TagEntity,
            entity_id=self.entity_id,
            recursive=True,
            hard_delete=False,
        )

    def test_list_tags(self):
        """Test listing tags"""
        mock_entity1 = MagicMock(spec=TagEntity)
        mock_entity1.name = "entity1"
        mock_entity2 = MagicMock(spec=TagEntity)
        mock_entity2.name = "entity2"

        mock_response = MagicMock()
        mock_response.entities = [mock_entity1, mock_entity2]

        self.mock_ometa.list_entities.return_value = mock_response

        result = Tags.list(limit=10)

        self.assertEqual(len(result.entities), 2)
        self.assertEqual(result.entities[0].name, "entity1")
        self.mock_ometa.list_entities.assert_called_once()


if __name__ == "__main__":
    unittest.main()
